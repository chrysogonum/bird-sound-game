/**
 * InfiniteScheduler - Continuous event generation with difficulty ramping
 *
 * Features:
 * - Generate events on-demand (no fixed end time)
 * - Difficulty ramps over time (minute 1 = Level 1, minute 5 = Level 3+)
 * - Integrates with Pack modifiers via DifficultyCalculator
 * - Seeded random for reproducibility
 */

import type { Channel, ClipMetadata } from '../audio/types.js';
import type { LevelConfig, GameEvent, EventDensity, SpeciesSelection } from './types.js';
import type { Pack, VocalizationWeights } from '../packs/types.js';
import { EVENT_DENSITY_CONFIG } from './types.js';
import { DifficultyCalculator, type DifficultyParams } from './DifficultyCalculator.js';

/** Difficulty ramp configuration */
export interface DifficultyRamp {
  /** Starting event density */
  startDensity: EventDensity;
  /** Maximum event density */
  maxDensity: EventDensity;
  /** Starting overlap probability */
  startOverlap: number;
  /** Maximum overlap probability */
  maxOverlap: number;
  /** Time in ms to reach max difficulty */
  rampDurationMs: number;
  /** Starting scoring window in ms */
  startScoringWindowMs: number;
  /** Minimum scoring window in ms (harder) */
  minScoringWindowMs: number;
}

/** Default difficulty ramp: Level 1 → Level 3+ over 5 minutes */
const DEFAULT_RAMP: DifficultyRamp = {
  startDensity: 'low',
  maxDensity: 'high',
  startOverlap: 0.0,
  maxOverlap: 0.3,
  rampDurationMs: 5 * 60 * 1000, // 5 minutes
  startScoringWindowMs: 2000,
  minScoringWindowMs: 500,
};

/** Infinite scheduler configuration */
export interface InfiniteSchedulerConfig {
  /** Random seed for deterministic generation */
  seed?: number;
  /** Difficulty ramp settings */
  ramp?: Partial<DifficultyRamp>;
  /** Pack to apply modifiers from */
  pack?: Pack | null;
}

/** Current difficulty state */
export interface DifficultyState {
  /** Current interpolated density factor (0-1, where 0=low, 1=high) */
  densityFactor: number;
  /** Current event density */
  eventDensity: EventDensity;
  /** Current overlap probability */
  overlapProbability: number;
  /** Current scoring window in ms */
  scoringWindowMs: number;
  /** Current min gap in ms */
  minGapMs: number;
  /** Current max gap in ms */
  maxGapMs: number;
  /** Time elapsed in ms */
  elapsedMs: number;
  /** Ramp progress (0-1) */
  rampProgress: number;
}

/**
 * InfiniteScheduler generates events continuously with difficulty ramping.
 */
export class InfiniteScheduler {
  private seed: number;
  private random: () => number;
  private readonly ramp: DifficultyRamp;
  private readonly pack: Pack | null;
  private readonly difficultyCalculator: DifficultyCalculator;

  private sessionStartMs: number = 0;
  private lastEventTimeMs: number = 0;
  private eventIndex: number = 0;
  private isRunning: boolean = false;

  constructor(config: InfiniteSchedulerConfig = {}) {
    this.seed = config.seed ?? Date.now();
    this.random = this.createSeededRandom(this.seed);
    this.pack = config.pack ?? null;
    this.difficultyCalculator = new DifficultyCalculator();

    // Merge ramp config with defaults
    this.ramp = {
      ...DEFAULT_RAMP,
      ...config.ramp,
    };
  }

  /**
   * Starts the scheduler session.
   * @param startTimeMs Optional start time (defaults to now)
   */
  start(startTimeMs?: number): void {
    this.sessionStartMs = startTimeMs ?? Date.now();
    this.lastEventTimeMs = 1000; // First event after 1 second
    this.eventIndex = 0;
    this.isRunning = true;
  }

  /**
   * Stops the scheduler session.
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Checks if the scheduler is running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the current difficulty state based on elapsed time.
   * @param elapsedMs Time elapsed since session start
   */
  getDifficultyState(elapsedMs: number): DifficultyState {
    // Calculate ramp progress (0-1, clamped)
    const rampProgress = Math.min(1, Math.max(0, elapsedMs / this.ramp.rampDurationMs));

    // Interpolate overlap probability
    const overlapProbability =
      this.ramp.startOverlap + (this.ramp.maxOverlap - this.ramp.startOverlap) * rampProgress;

    // Interpolate scoring window (larger → smaller as difficulty increases)
    const scoringWindowMs = Math.round(
      this.ramp.startScoringWindowMs -
        (this.ramp.startScoringWindowMs - this.ramp.minScoringWindowMs) * rampProgress
    );

    // Determine event density based on ramp progress
    const densityFactor = rampProgress;
    let eventDensity: EventDensity;
    if (rampProgress < 0.33) {
      eventDensity = 'low';
    } else if (rampProgress < 0.66) {
      eventDensity = 'medium';
    } else {
      eventDensity = 'high';
    }

    // Calculate gap timing by interpolating between density configs
    const lowConfig = EVENT_DENSITY_CONFIG.low;
    const highConfig = EVENT_DENSITY_CONFIG.high;

    let minGapMs = Math.round(
      lowConfig.minGapMs - (lowConfig.minGapMs - highConfig.minGapMs) * rampProgress
    );
    let maxGapMs = Math.round(
      lowConfig.maxGapMs - (lowConfig.maxGapMs - highConfig.maxGapMs) * rampProgress
    );

    // Apply pack tempo modifier if present
    if (this.pack) {
      minGapMs = Math.round(minGapMs / this.pack.tempoMultiplier);
      maxGapMs = Math.round(maxGapMs / this.pack.tempoMultiplier);
    }

    // Apply pack overlap modifier if present
    let finalOverlap = overlapProbability;
    if (this.pack) {
      finalOverlap = Math.min(1, overlapProbability * this.pack.overlapMultiplier);
    }

    return {
      densityFactor,
      eventDensity,
      overlapProbability: finalOverlap,
      scoringWindowMs,
      minGapMs,
      maxGapMs,
      elapsedMs,
      rampProgress,
    };
  }

  /**
   * Generates the next event(s) for the given elapsed time.
   * @param elapsedMs Time elapsed since session start
   * @param species Available species to choose from
   * @returns Array of events to schedule (usually 1, but may include overlaps)
   */
  generateNextEvents(elapsedMs: number, species: SpeciesSelection[]): GameEvent[] {
    if (!this.isRunning || species.length === 0) {
      return [];
    }

    const difficulty = this.getDifficultyState(elapsedMs);
    const events: GameEvent[] = [];

    // Check if it's time for the next event
    if (elapsedMs < this.lastEventTimeMs) {
      return [];
    }

    // Generate primary event
    const primaryEvent = this.createEvent(
      this.eventIndex++,
      this.lastEventTimeMs,
      species,
      difficulty
    );
    events.push(primaryEvent);

    // Possibly generate overlapping event
    if (difficulty.overlapProbability > 0 && this.random() < difficulty.overlapProbability) {
      const overlapEvent = this.createOverlapEvent(
        this.eventIndex++,
        this.lastEventTimeMs,
        species,
        difficulty,
        primaryEvent.channel
      );
      events.push(overlapEvent);
    }

    // Schedule next event time
    const gap = this.randomInRange(difficulty.minGapMs, difficulty.maxGapMs);
    this.lastEventTimeMs += gap;

    return events;
  }

  /**
   * Generates a batch of events for a time window.
   * @param startMs Start of time window
   * @param endMs End of time window
   * @param species Available species
   * @returns All events in the time window
   */
  generateEventsForWindow(
    startMs: number,
    endMs: number,
    species: SpeciesSelection[]
  ): GameEvent[] {
    const events: GameEvent[] = [];

    // Ensure we're at the right starting point
    if (this.lastEventTimeMs < startMs) {
      this.lastEventTimeMs = startMs;
    }

    // Generate events until we exceed the window
    while (this.lastEventTimeMs < endMs) {
      const newEvents = this.generateNextEvents(this.lastEventTimeMs, species);
      events.push(...newEvents);

      // Safety check to prevent infinite loop
      if (newEvents.length === 0) {
        break;
      }
    }

    return events;
  }

  /**
   * Gets the time until the next event.
   * @param currentTimeMs Current elapsed time
   * @returns Milliseconds until next event
   */
  getTimeUntilNextEvent(currentTimeMs: number): number {
    return Math.max(0, this.lastEventTimeMs - currentTimeMs);
  }

  /**
   * Gets the next scheduled event time.
   */
  getNextEventTime(): number {
    return this.lastEventTimeMs;
  }

  /**
   * Gets the current event index.
   */
  getEventCount(): number {
    return this.eventIndex;
  }

  /**
   * Gets the session start time.
   */
  getSessionStartMs(): number {
    return this.sessionStartMs;
  }

  /**
   * Resets the scheduler with optional new seed.
   */
  reset(seed?: number): void {
    this.seed = seed ?? Date.now();
    this.random = this.createSeededRandom(this.seed);
    this.sessionStartMs = 0;
    this.lastEventTimeMs = 0;
    this.eventIndex = 0;
    this.isRunning = false;
  }

  /**
   * Gets the current seed.
   */
  getSeed(): number {
    return this.seed;
  }

  /**
   * Gets the difficulty ramp configuration.
   */
  getRamp(): DifficultyRamp {
    return { ...this.ramp };
  }

  /**
   * Creates a level config based on current difficulty state.
   * @param elapsedMs Elapsed time in ms
   */
  createLevelConfig(elapsedMs: number): LevelConfig {
    const difficulty = this.getDifficultyState(elapsedMs);

    return {
      level_id: -3, // Infinite mode uses -3
      pack_id: this.pack?.packId ?? 'default',
      mode: 'random',
      round_duration_sec: 3600, // Effectively infinite
      species_count: 0, // Determined by species array
      event_density: difficulty.eventDensity,
      overlap_probability: difficulty.overlapProbability,
      scoring_window_ms: difficulty.scoringWindowMs,
      spectrogram_mode: 'full',
    };
  }

  /**
   * Creates a single game event.
   */
  private createEvent(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    difficulty: DifficultyState
  ): GameEvent {
    // Select random species
    const speciesIndex = Math.floor(this.random() * species.length);
    const selectedSpecies = species[speciesIndex];

    // Get vocalization weights
    const weights = this.pack?.vocalizationWeights ?? { song: 0.5, call: 0.5 };

    // Select vocalization type based on weights
    const vocalizationType = this.selectVocalizationType(weights);

    // Filter clips by vocalization type if possible
    const matchingClips = selectedSpecies.clips.filter(
      (clip) => clip.vocalization_type === vocalizationType
    );
    const availableClips = matchingClips.length > 0 ? matchingClips : selectedSpecies.clips;

    // Select random clip
    const clipIndex = Math.floor(this.random() * availableClips.length);
    const clip = availableClips[clipIndex];

    // Select random channel
    const channel: Channel = this.random() < 0.5 ? 'left' : 'right';

    const halfWindow = difficulty.scoringWindowMs / 2;

    return {
      event_id: `inf_${index}_${this.seed}`,
      clip_id: clip.clip_id,
      species_code: selectedSpecies.speciesCode,
      channel,
      scheduled_time_ms: timeMs,
      scoring_window_start_ms: timeMs - halfWindow,
      scoring_window_end_ms: timeMs + halfWindow,
      duration_ms: clip.duration_ms,
      vocalization_type: clip.vocalization_type,
    };
  }

  /**
   * Creates an overlapping event on the opposite channel.
   */
  private createOverlapEvent(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    difficulty: DifficultyState,
    primaryChannel: Channel
  ): GameEvent {
    // Select species (prefer different from primary)
    const speciesIndex = Math.floor(this.random() * species.length);
    const selectedSpecies = species[speciesIndex];

    // Get vocalization weights
    const weights = this.pack?.vocalizationWeights ?? { song: 0.5, call: 0.5 };

    // Select vocalization type
    const vocalizationType = this.selectVocalizationType(weights);

    // Filter clips
    const matchingClips = selectedSpecies.clips.filter(
      (clip) => clip.vocalization_type === vocalizationType
    );
    const availableClips = matchingClips.length > 0 ? matchingClips : selectedSpecies.clips;

    // Select random clip
    const clipIndex = Math.floor(this.random() * availableClips.length);
    const clip = availableClips[clipIndex];

    // Use opposite channel
    const channel: Channel = primaryChannel === 'left' ? 'right' : 'left';

    // Slight time offset
    const offset = this.randomInRange(-200, 200);
    const halfWindow = difficulty.scoringWindowMs / 2;

    return {
      event_id: `inf_${index}_${this.seed}`,
      clip_id: clip.clip_id,
      species_code: selectedSpecies.speciesCode,
      channel,
      scheduled_time_ms: timeMs + offset,
      scoring_window_start_ms: timeMs + offset - halfWindow,
      scoring_window_end_ms: timeMs + offset + halfWindow,
      duration_ms: clip.duration_ms,
      vocalization_type: clip.vocalization_type,
    };
  }

  /**
   * Selects vocalization type based on weights.
   */
  private selectVocalizationType(weights: VocalizationWeights): 'song' | 'call' {
    const total = weights.song + weights.call;
    if (total === 0) return 'song';

    const songProbability = weights.song / total;
    return this.random() < songProbability ? 'song' : 'call';
  }

  /**
   * Creates a seeded random number generator.
   */
  private createSeededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }

  /**
   * Returns a random number in the given range.
   */
  private randomInRange(min: number, max: number): number {
    return min + Math.floor(this.random() * (max - min));
  }
}
