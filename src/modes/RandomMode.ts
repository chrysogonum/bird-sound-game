/**
 * RandomMode - Continuous random Events from Pack for ChipNotes!
 *
 * Features:
 * - Continuous events until player quits or fails threshold
 * - Random species selection from pack
 * - Difficulty ramps over time (minute 1 = Level 1, minute 5 = Level 3+)
 * - High score tracking
 * - Integrates with InfiniteScheduler for event generation
 */

import type { LevelConfig, RoundStats, SpeciesSelection, GameEvent } from '../game/types.js';
import type { Pack } from '../packs/types.js';
import type {
  BaseModeConfig,
  ModeState,
  ModeResult,
  RandomSettings,
} from './types.js';
import { InfiniteScheduler, type DifficultyState, type DifficultyRamp } from '../game/InfiniteScheduler.js';

/** Extended random settings with difficulty options */
export interface ExtendedRandomSettings extends RandomSettings {
  /** Optional pack for modifiers */
  pack?: Pack | null;
  /** Custom difficulty ramp */
  difficultyRamp?: Partial<DifficultyRamp>;
  /** Fail threshold - end session if accuracy drops below this */
  failThreshold?: number;
  /** Random seed for reproducibility */
  seed?: number;
}

/** Default random mode settings */
const DEFAULT_SETTINGS: Required<ExtendedRandomSettings> = {
  packId: 'default',
  speciesCodes: [],
  eventDensity: 'medium',
  pack: null,
  difficultyRamp: {},
  failThreshold: 0, // 0 = no fail threshold
  seed: 0, // 0 = use Date.now()
};

/** Random mode configuration */
export interface RandomModeConfig extends BaseModeConfig {
  /** Available species for random mode */
  availableSpecies: SpeciesSelection[];
  /** Initial settings */
  settings?: ExtendedRandomSettings;
  /** Callback when high score is achieved */
  onHighScore?: (score: number) => void;
  /** Current high score (for comparison) */
  currentHighScore?: number;
}

/**
 * RandomMode manages continuous random event gameplay with difficulty ramping.
 */
export class RandomMode {
  private readonly availableSpecies: SpeciesSelection[];
  private settings: Required<ExtendedRandomSettings>;
  private state: ModeState = 'idle';
  private selectedSpecies: SpeciesSelection[] = [];
  private sessionStats: RoundStats;
  private sessionStartTime: number = 0;
  private eventsPlayed: number = 0;
  private onComplete: ((result: ModeResult) => void) | null;
  private onStateChange: ((state: ModeState) => void) | null;
  private onHighScore: ((score: number) => void) | null;

  // New Phase I additions
  private scheduler: InfiniteScheduler | null = null;
  private currentHighScore: number = 0;
  private sessionHighScore: number = 0;
  private isNewHighScore: boolean = false;
  private failedThreshold: boolean = false;

  constructor(config: RandomModeConfig) {
    this.availableSpecies = config.availableSpecies;
    this.onComplete = config.onComplete ?? null;
    this.onStateChange = config.onStateChange ?? null;
    this.onHighScore = config.onHighScore ?? null;
    this.currentHighScore = config.currentHighScore ?? 0;

    // Initialize settings
    this.settings = {
      packId: config.settings?.packId ?? DEFAULT_SETTINGS.packId,
      speciesCodes: config.settings?.speciesCodes ?? DEFAULT_SETTINGS.speciesCodes,
      eventDensity: config.settings?.eventDensity ?? DEFAULT_SETTINGS.eventDensity,
      pack: config.settings?.pack ?? DEFAULT_SETTINGS.pack,
      difficultyRamp: config.settings?.difficultyRamp ?? DEFAULT_SETTINGS.difficultyRamp,
      failThreshold: config.settings?.failThreshold ?? DEFAULT_SETTINGS.failThreshold,
      seed: config.settings?.seed ?? DEFAULT_SETTINGS.seed,
    };

    // Initialize session stats
    this.sessionStats = this.createEmptyStats();

    // Filter species if codes provided
    this.updateSelectedSpecies();
  }

  /**
   * Gets all available species.
   */
  getAvailableSpecies(): SpeciesSelection[] {
    return [...this.availableSpecies];
  }

  /**
   * Gets currently selected species for random events.
   */
  getSelectedSpecies(): SpeciesSelection[] {
    return [...this.selectedSpecies];
  }

  /**
   * Gets current settings.
   */
  getSettings(): Required<ExtendedRandomSettings> {
    return { ...this.settings };
  }

  /**
   * Sets the pack for difficulty modifiers.
   */
  setPack(pack: Pack | null): void {
    this.settings.pack = pack;
    if (pack) {
      this.settings.packId = pack.packId;
    }
  }

  /**
   * Gets the current pack.
   */
  getPack(): Pack | null {
    return this.settings.pack;
  }

  /**
   * Sets the fail threshold (0 = disabled).
   */
  setFailThreshold(threshold: number): void {
    this.settings.failThreshold = Math.max(0, Math.min(100, threshold));
  }

  /**
   * Gets the fail threshold.
   */
  getFailThreshold(): number {
    return this.settings.failThreshold;
  }

  /**
   * Gets the current difficulty state based on elapsed time.
   */
  getDifficultyState(): DifficultyState | null {
    if (!this.scheduler || this.sessionStartTime === 0) {
      return null;
    }
    const elapsedMs = this.getSessionDurationMs();
    return this.scheduler.getDifficultyState(elapsedMs);
  }

  /**
   * Gets the InfiniteScheduler instance.
   */
  getScheduler(): InfiniteScheduler | null {
    return this.scheduler;
  }

  /**
   * Sets specific species to use (empty = all species).
   */
  setSpecies(speciesCodes: string[]): void {
    this.settings.speciesCodes = [...speciesCodes];
    this.updateSelectedSpecies();
  }

  /**
   * Sets event density.
   */
  setEventDensity(density: 'low' | 'medium' | 'high'): void {
    this.settings.eventDensity = density;
  }

  /**
   * Gets event density setting.
   */
  getEventDensity(): 'low' | 'medium' | 'high' {
    return this.settings.eventDensity;
  }

  /**
   * Checks if mode is ready to start.
   */
  isReady(): boolean {
    return this.selectedSpecies.length > 0;
  }

  /**
   * Creates a level config for random mode.
   * Note: Uses a long duration since random mode is continuous.
   */
  createLevelConfig(): LevelConfig {
    return {
      level_id: -2, // Random mode uses -2
      pack_id: this.settings.packId,
      mode: 'random',
      round_duration_sec: 3600, // 1 hour max (effectively continuous)
      species_count: this.selectedSpecies.length,
      event_density: this.settings.eventDensity,
      overlap_probability: 0.15,
      scoring_window_ms: 1500,
      spectrogram_mode: 'full',
    };
  }

  /**
   * Creates species selection for random mode.
   */
  createSpeciesSelection(): SpeciesSelection[] {
    return [...this.selectedSpecies];
  }

  /**
   * Starts random mode with InfiniteScheduler.
   */
  start(): { level: LevelConfig; species: SpeciesSelection[]; scheduler: InfiniteScheduler } | null {
    if (!this.isReady()) {
      return null;
    }

    this.sessionStats = this.createEmptyStats();
    this.sessionStartTime = Date.now();
    this.eventsPlayed = 0;
    this.sessionHighScore = 0;
    this.isNewHighScore = false;
    this.failedThreshold = false;

    // Create InfiniteScheduler with settings
    this.scheduler = new InfiniteScheduler({
      seed: this.settings.seed || Date.now(),
      pack: this.settings.pack,
      ramp: this.settings.difficultyRamp,
    });
    this.scheduler.start(this.sessionStartTime);

    this.setState('playing');

    return {
      level: this.createLevelConfig(),
      species: this.createSpeciesSelection(),
      scheduler: this.scheduler,
    };
  }

  /**
   * Records an event result during the session.
   * @returns Object with session status (failed if below threshold)
   */
  recordEvent(correct: boolean, score: number): { failed: boolean; isHighScore: boolean } {
    this.eventsPlayed++;
    this.sessionStats.eventsScored++;
    this.sessionStats.totalScore += score;

    if (correct) {
      this.sessionStats.speciesCorrectCount++;
    }

    // Update accuracy
    if (this.sessionStats.eventsScored > 0) {
      this.sessionStats.accuracy =
        (this.sessionStats.speciesCorrectCount / this.sessionStats.eventsScored) * 100;
    }

    // Track high score
    if (this.sessionStats.totalScore > this.sessionHighScore) {
      this.sessionHighScore = this.sessionStats.totalScore;

      // Check if this is a new all-time high score
      if (this.sessionHighScore > this.currentHighScore) {
        if (!this.isNewHighScore) {
          this.isNewHighScore = true;
          this.onHighScore?.(this.sessionHighScore);
        }
      }
    }

    // Check fail threshold (only after minimum events to be fair)
    const minEventsForThreshold = 10;
    if (
      this.settings.failThreshold > 0 &&
      this.sessionStats.eventsScored >= minEventsForThreshold &&
      this.sessionStats.accuracy < this.settings.failThreshold
    ) {
      this.failedThreshold = true;
    }

    return {
      failed: this.failedThreshold,
      isHighScore: this.isNewHighScore,
    };
  }

  /**
   * Checks if the session has failed the threshold.
   */
  hasFailedThreshold(): boolean {
    return this.failedThreshold;
  }

  /**
   * Gets the current session high score.
   */
  getSessionHighScore(): number {
    return this.sessionHighScore;
  }

  /**
   * Checks if this session achieved a new high score.
   */
  isSessionHighScore(): boolean {
    return this.isNewHighScore;
  }

  /**
   * Sets the current high score for comparison.
   */
  setCurrentHighScore(score: number): void {
    this.currentHighScore = score;
  }

  /**
   * Gets the current (all-time) high score.
   */
  getCurrentHighScore(): number {
    return this.currentHighScore;
  }

  /**
   * Gets the current session stats.
   */
  getSessionStats(): RoundStats {
    return { ...this.sessionStats };
  }

  /**
   * Gets the session duration in milliseconds.
   */
  getSessionDurationMs(): number {
    if (this.sessionStartTime === 0) {
      return 0;
    }
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Gets the number of events played.
   */
  getEventsPlayed(): number {
    return this.eventsPlayed;
  }

  /**
   * Stops (quits) random mode.
   */
  stop(): ModeResult {
    this.setState('ended');

    // Stop the scheduler
    if (this.scheduler) {
      this.scheduler.stop();
    }

    this.sessionStats.totalEvents = this.eventsPlayed;

    const result: ModeResult = {
      mode: 'random',
      stats: this.sessionStats,
      highScore: this.sessionHighScore,
      isNewHighScore: this.isNewHighScore,
    };

    this.onComplete?.(result);
    return result;
  }

  /**
   * Alias for stop() - ends the random session.
   */
  quit(): ModeResult {
    return this.stop();
  }

  /**
   * Gets the current mode state.
   */
  getState(): ModeState {
    return this.state;
  }

  /**
   * Checks if random mode is currently active.
   */
  isPlaying(): boolean {
    return this.state === 'playing';
  }

  /**
   * Pauses random mode.
   */
  pause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
    }
  }

  /**
   * Resumes random mode.
   */
  resume(): void {
    if (this.state === 'paused') {
      this.setState('playing');
    }
  }

  /**
   * Resets to idle state.
   */
  reset(): void {
    this.sessionStats = this.createEmptyStats();
    this.sessionStartTime = 0;
    this.eventsPlayed = 0;
    this.sessionHighScore = 0;
    this.isNewHighScore = false;
    this.failedThreshold = false;

    if (this.scheduler) {
      this.scheduler.reset();
      this.scheduler = null;
    }

    this.setState('idle');
  }

  /**
   * Updates selected species based on settings.
   */
  private updateSelectedSpecies(): void {
    if (this.settings.speciesCodes.length === 0) {
      // Use all available species
      this.selectedSpecies = [...this.availableSpecies];
    } else {
      // Filter to only specified species
      this.selectedSpecies = this.availableSpecies.filter((s) =>
        this.settings.speciesCodes.includes(s.speciesCode)
      );
    }
  }

  /**
   * Creates empty stats object.
   */
  private createEmptyStats(): RoundStats {
    return {
      totalEvents: 0,
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
   * Sets callbacks.
   */
  setCallbacks(callbacks: {
    onComplete?: (result: ModeResult) => void;
    onStateChange?: (state: ModeState) => void;
    onHighScore?: (score: number) => void;
  }): void {
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
    if (callbacks.onHighScore) this.onHighScore = callbacks.onHighScore;
  }

  /**
   * Generates the next events using the scheduler.
   * @param currentTimeMs Current elapsed time in ms
   * @returns Array of events to schedule
   */
  generateNextEvents(currentTimeMs?: number): GameEvent[] {
    if (!this.scheduler || !this.isPlaying()) {
      return [];
    }

    const elapsedMs = currentTimeMs ?? this.getSessionDurationMs();
    return this.scheduler.generateNextEvents(elapsedMs, this.selectedSpecies);
  }

  /**
   * Generates events for a time window.
   * @param startMs Start of time window
   * @param endMs End of time window
   * @returns All events in the time window
   */
  generateEventsForWindow(startMs: number, endMs: number): GameEvent[] {
    if (!this.scheduler || !this.isPlaying()) {
      return [];
    }

    return this.scheduler.generateEventsForWindow(startMs, endMs, this.selectedSpecies);
  }

  /**
   * Gets the time until the next event.
   */
  getTimeUntilNextEvent(): number {
    if (!this.scheduler) {
      return 0;
    }
    return this.scheduler.getTimeUntilNextEvent(this.getSessionDurationMs());
  }

  /**
   * Gets summary of current session state.
   */
  getSessionSummary(): {
    duration: number;
    eventsPlayed: number;
    score: number;
    accuracy: number;
    difficulty: DifficultyState | null;
    isHighScore: boolean;
    failed: boolean;
  } {
    return {
      duration: this.getSessionDurationMs(),
      eventsPlayed: this.eventsPlayed,
      score: this.sessionStats.totalScore,
      accuracy: this.sessionStats.accuracy,
      difficulty: this.getDifficultyState(),
      isHighScore: this.isNewHighScore,
      failed: this.failedThreshold,
    };
  }

  /**
   * Updates state and notifies listeners.
   */
  private setState(newState: ModeState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }
}
