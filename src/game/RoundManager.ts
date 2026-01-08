/**
 * RoundManager - Round lifecycle management for SoundField: Birds
 *
 * Manages the lifecycle of a game round: start, update, end.
 * Coordinates event playback, scoring, and timing.
 */

import type {
  LevelConfig,
  GameEvent,
  RoundState,
  RoundStats,
  RoundUpdateCallback,
  RoundEventCallback,
  RoundEndCallback,
  SpeciesSelection,
} from './types.js';
import { EventScheduler } from './EventScheduler.js';
import type { ScoreEngine } from '../scoring/ScoreEngine.js';
import type { ScoringEvent, ScoringInput } from '../scoring/types.js';

/** Round manager configuration */
export interface RoundManagerConfig {
  /** Countdown duration before round starts (ms) */
  countdownMs?: number;
  /** Callback for time/state updates */
  onUpdate?: RoundUpdateCallback;
  /** Callback when an event should play */
  onEvent?: RoundEventCallback;
  /** Callback when round ends */
  onEnd?: RoundEndCallback;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<Omit<RoundManagerConfig, 'onUpdate' | 'onEvent' | 'onEnd'>> = {
  countdownMs: 3000,
};

/**
 * RoundManager handles the complete lifecycle of a game round.
 */
export class RoundManager {
  private readonly config: Required<Omit<RoundManagerConfig, 'onUpdate' | 'onEvent' | 'onEnd'>>;
  private readonly scheduler: EventScheduler;

  private state: RoundState = 'idle';
  private level: LevelConfig | null = null;
  private events: GameEvent[] = [];
  private species: SpeciesSelection[] = [];
  private currentEventIndex: number = 0;
  private roundStartTime: number = 0;
  private updateInterval: ReturnType<typeof setInterval> | null = null;

  // Callbacks
  private onUpdate: RoundUpdateCallback | null = null;
  private onEvent: RoundEventCallback | null = null;
  private onEnd: RoundEndCallback | null = null;

  // Stats tracking
  private eventsTriggered: Set<string> = new Set();
  private scoreEngine: ScoreEngine | null = null;

  constructor(config: RoundManagerConfig = {}) {
    this.config = {
      countdownMs: config.countdownMs ?? DEFAULT_CONFIG.countdownMs,
    };
    this.scheduler = new EventScheduler();

    this.onUpdate = config.onUpdate ?? null;
    this.onEvent = config.onEvent ?? null;
    this.onEnd = config.onEnd ?? null;
  }

  /**
   * Sets up a round with the given level and species.
   * @param level The level configuration
   * @param species Available species for this round
   * @param seed Optional random seed
   */
  setupRound(level: LevelConfig, species: SpeciesSelection[], seed?: number): void {
    if (this.state !== 'idle') {
      this.stopRound();
    }

    this.level = level;
    this.species = species;

    // Reset scheduler seed if provided
    if (seed !== undefined) {
      this.scheduler.resetSeed(seed);
    }

    // Generate events based on level config
    if (level.overlap_probability === 0) {
      this.events = this.scheduler.generateNonOverlappingEvents(level, species);
    } else {
      this.events = this.scheduler.generateEvents(level, species);
    }

    // Sort events by scheduled time
    this.events.sort((a, b) => a.scheduled_time_ms - b.scheduled_time_ms);

    this.currentEventIndex = 0;
    this.eventsTriggered.clear();
  }

  /**
   * Starts the round with optional countdown.
   * @param skipCountdown Whether to skip the countdown
   */
  startRound(skipCountdown: boolean = false): void {
    if (!this.level) {
      throw new Error('Round not set up. Call setupRound() first.');
    }

    if (skipCountdown) {
      this.beginPlayback();
    } else {
      this.state = 'countdown';
      this.runCountdown();
    }
  }

  /**
   * Runs the countdown before starting.
   */
  private runCountdown(): void {
    const countdownStart = Date.now();
    const countdownDuration = this.config.countdownMs;

    const countdownInterval = setInterval(() => {
      const elapsed = Date.now() - countdownStart;
      const remaining = countdownDuration - elapsed;

      if (remaining <= 0) {
        clearInterval(countdownInterval);
        this.beginPlayback();
      } else {
        this.onUpdate?.(remaining, 'countdown');
      }
    }, 100);
  }

  /**
   * Begins actual round playback.
   */
  private beginPlayback(): void {
    this.state = 'playing';
    this.roundStartTime = Date.now();
    this.currentEventIndex = 0;

    // Start update loop
    this.updateInterval = setInterval(() => this.update(), 16); // ~60fps

    this.onUpdate?.(0, 'playing');
  }

  /**
   * Main update loop.
   */
  private update(): void {
    if (this.state !== 'playing' || !this.level) return;

    const currentTimeMs = Date.now() - this.roundStartTime;
    const roundDurationMs = this.level.round_duration_sec * 1000;

    // Check for events to trigger
    while (
      this.currentEventIndex < this.events.length &&
      this.events[this.currentEventIndex].scheduled_time_ms <= currentTimeMs
    ) {
      const event = this.events[this.currentEventIndex];
      if (!this.eventsTriggered.has(event.event_id)) {
        this.eventsTriggered.add(event.event_id);
        this.onEvent?.(event);
      }
      this.currentEventIndex++;
    }

    // Update callback
    this.onUpdate?.(currentTimeMs, 'playing');

    // Check for round end
    if (currentTimeMs >= roundDurationMs) {
      this.endRound();
    }
  }

  /**
   * Stops the round immediately.
   */
  stopRound(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    this.state = 'idle';
  }

  /**
   * Ends the round and calculates stats.
   */
  private endRound(): void {
    this.stopRound();
    this.state = 'ended';

    const stats = this.calculateStats();
    this.onEnd?.(stats);
    this.onUpdate?.(this.level!.round_duration_sec * 1000, 'ended');
  }

  /**
   * Calculates round statistics.
   */
  private calculateStats(): RoundStats {
    if (this.scoreEngine) {
      const state = this.scoreEngine.getState();
      return {
        totalEvents: this.events.length,
        eventsScored: state.eventsScored,
        totalScore: state.totalScore,
        accuracy: this.scoreEngine.getAccuracyPercent(),
        perfectCount: state.perfectCount,
        missCount: state.missCount,
        speciesCorrectCount: state.speciesCorrectCount,
        channelCorrectCount: state.channelCorrectCount,
      };
    }

    // Default stats if no score engine
    return {
      totalEvents: this.events.length,
      eventsScored: 0,
      totalScore: 0,
      accuracy: 0,
      perfectCount: 0,
      missCount: 0,
      speciesCorrectCount: 0,
      channelCorrectCount: 0,
    };
  }

  /**
   * Sets the score engine for tracking stats.
   */
  setScoreEngine(engine: ScoreEngine): void {
    this.scoreEngine = engine;
  }

  /**
   * Gets the current round state.
   */
  getState(): RoundState {
    return this.state;
  }

  /**
   * Gets the current time in the round (ms).
   */
  getCurrentTimeMs(): number {
    if (this.state !== 'playing') return 0;
    return Date.now() - this.roundStartTime;
  }

  /**
   * Gets the round duration in ms.
   */
  getRoundDurationMs(): number {
    return this.level ? this.level.round_duration_sec * 1000 : 0;
  }

  /**
   * Gets remaining time in ms.
   */
  getRemainingTimeMs(): number {
    if (!this.level || this.state !== 'playing') return 0;
    return Math.max(0, this.getRoundDurationMs() - this.getCurrentTimeMs());
  }

  /**
   * Gets all events for this round.
   */
  getEvents(): GameEvent[] {
    return [...this.events];
  }

  /**
   * Gets the event count.
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Gets the species for this round.
   */
  getSpecies(): SpeciesSelection[] {
    return [...this.species];
  }

  /**
   * Gets the current level config.
   */
  getLevel(): LevelConfig | null {
    return this.level;
  }

  /**
   * Checks if the round has overlapping events.
   */
  hasOverlappingEvents(): boolean {
    return this.scheduler.hasOverlaps(this.events);
  }

  /**
   * Gets the number of overlapping event pairs.
   */
  getOverlapCount(): number {
    return this.scheduler.countOverlaps(this.events);
  }

  /**
   * Converts a game event to a scoring event.
   */
  static toScoringEvent(event: GameEvent): ScoringEvent {
    const perfectTime = event.scheduled_time_ms;
    return {
      eventId: event.event_id,
      expectedSpecies: event.species_code,
      expectedChannel: event.channel,
      windowStartMs: event.scoring_window_start_ms,
      windowEndMs: event.scoring_window_end_ms,
      perfectTimeMs: perfectTime,
    };
  }

  /**
   * Sets callback functions.
   */
  setCallbacks(callbacks: {
    onUpdate?: RoundUpdateCallback;
    onEvent?: RoundEventCallback;
    onEnd?: RoundEndCallback;
  }): void {
    if (callbacks.onUpdate) this.onUpdate = callbacks.onUpdate;
    if (callbacks.onEvent) this.onEvent = callbacks.onEvent;
    if (callbacks.onEnd) this.onEnd = callbacks.onEnd;
  }
}
