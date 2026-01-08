/**
 * EventScheduler - Generate Events based on Level params for SoundField: Birds
 *
 * Generates game events with proper timing, spacing, and overlap based on
 * level configuration parameters. Supports pack modifiers via DifficultyCalculator.
 */

import type { Channel, ClipMetadata } from '../audio/types.js';
import type { LevelConfig, GameEvent, EventDensity, SpeciesSelection } from './types.js';
import type { Pack, VocalizationWeights } from '../packs/types.js';
import { EVENT_DENSITY_CONFIG } from './types.js';
import { DifficultyCalculator, type DifficultyParams } from './DifficultyCalculator.js';

/** Event scheduler configuration */
export interface SchedulerConfig {
  /** Random seed for deterministic event generation */
  seed?: number;
}

/**
 * EventScheduler generates game events based on level parameters.
 */
export class EventScheduler {
  private seed: number;
  private random: () => number;
  private readonly difficultyCalculator: DifficultyCalculator;

  constructor(config: SchedulerConfig = {}) {
    this.seed = config.seed ?? Date.now();
    this.random = this.createSeededRandom(this.seed);
    this.difficultyCalculator = new DifficultyCalculator();
  }

  /**
   * Generates events for a round based on level configuration.
   * @param level The level configuration
   * @param species Available species for this level
   * @param pack Optional pack with difficulty modifiers
   * @returns Array of game events
   */
  generateEvents(level: LevelConfig, species: SpeciesSelection[], pack: Pack | null = null): GameEvent[] {
    const events: GameEvent[] = [];
    const roundDurationMs = level.round_duration_sec * 1000;

    // Calculate difficulty parameters with pack modifiers
    const difficulty = this.difficultyCalculator.calculate(level, pack);
    const halfWindow = difficulty.scoringWindowMs / 2;

    let currentTimeMs = 1000; // Start 1 second into the round
    let eventIndex = 0;

    while (currentTimeMs < roundDurationMs - 3000) {
      // Stop 3 seconds before end
      // Generate primary event with vocalization filtering
      const primaryEvent = this.createEventWithVocalization(
        eventIndex++,
        currentTimeMs,
        species,
        difficulty.scoringWindowMs,
        halfWindow,
        difficulty.vocalizationWeights
      );
      events.push(primaryEvent);

      // Possibly generate overlapping event (using adjusted overlap probability)
      if (difficulty.overlapProbability > 0 && this.random() < difficulty.overlapProbability) {
        const overlapEvent = this.createOverlapEventWithVocalization(
          eventIndex++,
          currentTimeMs,
          species,
          difficulty.scoringWindowMs,
          halfWindow,
          primaryEvent.channel,
          difficulty.vocalizationWeights
        );
        events.push(overlapEvent);
      }

      // Calculate next event time based on adjusted gap timing
      const gap = this.randomInRange(difficulty.minGapMs, difficulty.maxGapMs);
      currentTimeMs += gap;
    }

    return events;
  }

  /**
   * Generates events for a specific level, ensuring no overlaps when overlap_probability is 0.
   * @param level The level configuration
   * @param species Available species
   * @param pack Optional pack with difficulty modifiers
   * @returns Array of non-overlapping events
   */
  generateNonOverlappingEvents(level: LevelConfig, species: SpeciesSelection[], pack: Pack | null = null): GameEvent[] {
    const events: GameEvent[] = [];
    const roundDurationMs = level.round_duration_sec * 1000;

    // Calculate difficulty parameters with pack modifiers
    const difficulty = this.difficultyCalculator.calculate(level, pack);
    const halfWindow = difficulty.scoringWindowMs / 2;

    let currentTimeMs = 1000;
    let eventIndex = 0;

    while (currentTimeMs < roundDurationMs - 3000) {
      const event = this.createEventWithVocalization(
        eventIndex++,
        currentTimeMs,
        species,
        difficulty.scoringWindowMs,
        halfWindow,
        difficulty.vocalizationWeights
      );
      events.push(event);

      // Ensure no overlap by adding event duration plus gap
      const eventDuration = event.duration_ms || 2000;
      const minGap = Math.max(difficulty.minGapMs, eventDuration);
      const maxGap = Math.max(difficulty.maxGapMs, eventDuration + 1000);
      const gap = this.randomInRange(minGap, maxGap);
      currentTimeMs += gap;
    }

    return events;
  }

  /**
   * Creates a single game event.
   */
  private createEvent(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    windowMs: number,
    halfWindow: number
  ): GameEvent {
    // Select random species
    const speciesIndex = Math.floor(this.random() * species.length);
    const selectedSpecies = species[speciesIndex];

    // Select random clip for species
    const clipIndex = Math.floor(this.random() * selectedSpecies.clips.length);
    const clip = selectedSpecies.clips[clipIndex];

    // Select random channel
    const channel: Channel = this.random() < 0.5 ? 'left' : 'right';

    return {
      event_id: `evt_${index}_${this.seed}`,
      clip_id: clip.clip_id,
      species_code: selectedSpecies.speciesCode,
      channel,
      scheduled_time_ms: timeMs,
      scoring_window_start_ms: timeMs - halfWindow,
      scoring_window_end_ms: timeMs + halfWindow,
      duration_ms: clip.duration_ms,
    };
  }

  /**
   * Creates an overlapping event on the opposite channel.
   */
  private createOverlapEvent(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    windowMs: number,
    halfWindow: number,
    primaryChannel: Channel
  ): GameEvent {
    // Select different species if possible
    const availableSpecies = species.length > 1 ? species : species;
    const speciesIndex = Math.floor(this.random() * availableSpecies.length);
    const selectedSpecies = availableSpecies[speciesIndex];

    // Select random clip
    const clipIndex = Math.floor(this.random() * selectedSpecies.clips.length);
    const clip = selectedSpecies.clips[clipIndex];

    // Use opposite channel for overlap
    const channel: Channel = primaryChannel === 'left' ? 'right' : 'left';

    // Slight time offset for overlap (within 500ms)
    const offset = this.randomInRange(-200, 200);

    return {
      event_id: `evt_${index}_${this.seed}`,
      clip_id: clip.clip_id,
      species_code: selectedSpecies.speciesCode,
      channel,
      scheduled_time_ms: timeMs + offset,
      scoring_window_start_ms: timeMs + offset - halfWindow,
      scoring_window_end_ms: timeMs + offset + halfWindow,
      duration_ms: clip.duration_ms,
    };
  }

  /**
   * Creates a game event with vocalization type filtering.
   */
  private createEventWithVocalization(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    windowMs: number,
    halfWindow: number,
    vocalizationWeights: VocalizationWeights
  ): GameEvent {
    // Select random species
    const speciesIndex = Math.floor(this.random() * species.length);
    const selectedSpecies = species[speciesIndex];

    // Select vocalization type based on weights
    const vocalizationType = this.difficultyCalculator.selectVocalizationType(
      vocalizationWeights,
      this.random()
    );

    // Filter clips by vocalization type if possible
    const matchingClips = selectedSpecies.clips.filter(
      (clip) => clip.vocalization_type === vocalizationType
    );

    // Use matching clips if available, otherwise fall back to all clips
    const availableClips = matchingClips.length > 0 ? matchingClips : selectedSpecies.clips;
    const clipIndex = Math.floor(this.random() * availableClips.length);
    const clip = availableClips[clipIndex];

    // Select random channel
    const channel: Channel = this.random() < 0.5 ? 'left' : 'right';

    return {
      event_id: `evt_${index}_${this.seed}`,
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
   * Creates an overlapping event with vocalization filtering.
   */
  private createOverlapEventWithVocalization(
    index: number,
    timeMs: number,
    species: SpeciesSelection[],
    windowMs: number,
    halfWindow: number,
    primaryChannel: Channel,
    vocalizationWeights: VocalizationWeights
  ): GameEvent {
    // Select different species if possible
    const availableSpecies = species.length > 1 ? species : species;
    const speciesIndex = Math.floor(this.random() * availableSpecies.length);
    const selectedSpecies = availableSpecies[speciesIndex];

    // Select vocalization type based on weights
    const vocalizationType = this.difficultyCalculator.selectVocalizationType(
      vocalizationWeights,
      this.random()
    );

    // Filter clips by vocalization type if possible
    const matchingClips = selectedSpecies.clips.filter(
      (clip) => clip.vocalization_type === vocalizationType
    );

    // Use matching clips if available, otherwise fall back to all clips
    const availableClips = matchingClips.length > 0 ? matchingClips : selectedSpecies.clips;
    const clipIndex = Math.floor(this.random() * availableClips.length);
    const clip = availableClips[clipIndex];

    // Use opposite channel for overlap
    const channel: Channel = primaryChannel === 'left' ? 'right' : 'left';

    // Slight time offset for overlap (within 500ms)
    const offset = this.randomInRange(-200, 200);

    return {
      event_id: `evt_${index}_${this.seed}`,
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
   * Checks if a list of events has overlaps.
   * @param events Array of events to check
   * @returns True if any events overlap in time
   */
  hasOverlaps(events: GameEvent[]): boolean {
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.eventsOverlap(events[i], events[j])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Counts the number of overlapping event pairs.
   */
  countOverlaps(events: GameEvent[]): number {
    let count = 0;
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (this.eventsOverlap(events[i], events[j])) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Checks if two events overlap in time.
   */
  private eventsOverlap(a: GameEvent, b: GameEvent): boolean {
    // Events overlap if their scoring windows overlap
    return (
      a.scoring_window_start_ms < b.scoring_window_end_ms &&
      a.scoring_window_end_ms > b.scoring_window_start_ms
    );
  }

  /**
   * Gets the estimated event count for a level.
   * @param level The level configuration
   * @param pack Optional pack with difficulty modifiers
   */
  estimateEventCount(level: LevelConfig, pack: Pack | null = null): { min: number; max: number } {
    const roundDurationMs = level.round_duration_sec * 1000;
    const usableDuration = roundDurationMs - 4000; // Account for start/end margins

    // Calculate difficulty parameters with pack modifiers
    const difficulty = this.difficultyCalculator.calculate(level, pack);

    const minEvents = Math.floor(usableDuration / difficulty.maxGapMs);
    const maxEvents = Math.floor(usableDuration / difficulty.minGapMs);

    // Account for potential overlaps (using adjusted overlap probability)
    const overlapMultiplier = 1 + difficulty.overlapProbability;

    return {
      min: Math.floor(minEvents * overlapMultiplier),
      max: Math.ceil(maxEvents * overlapMultiplier),
    };
  }

  /**
   * Gets the difficulty calculator for external access.
   */
  getDifficultyCalculator(): DifficultyCalculator {
    return this.difficultyCalculator;
  }

  /**
   * Calculates difficulty parameters for a level with optional pack.
   */
  calculateDifficulty(level: LevelConfig, pack: Pack | null = null): DifficultyParams {
    return this.difficultyCalculator.calculate(level, pack);
  }

  /**
   * Resets the random seed.
   */
  resetSeed(seed?: number): void {
    this.seed = seed ?? Date.now();
    this.random = this.createSeededRandom(this.seed);
  }

  /**
   * Gets the current seed.
   */
  getSeed(): number {
    return this.seed;
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
