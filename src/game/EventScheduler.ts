/**
 * EventScheduler - Generate Events based on Level params for SoundField: Birds
 *
 * Generates game events with proper timing, spacing, and overlap based on
 * level configuration parameters.
 */

import type { Channel, ClipMetadata } from '../audio/types.js';
import type { LevelConfig, GameEvent, EventDensity, SpeciesSelection } from './types.js';
import { EVENT_DENSITY_CONFIG } from './types.js';

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

  constructor(config: SchedulerConfig = {}) {
    this.seed = config.seed ?? Date.now();
    this.random = this.createSeededRandom(this.seed);
  }

  /**
   * Generates events for a round based on level configuration.
   * @param level The level configuration
   * @param species Available species for this level
   * @returns Array of game events
   */
  generateEvents(level: LevelConfig, species: SpeciesSelection[]): GameEvent[] {
    const events: GameEvent[] = [];
    const roundDurationMs = level.round_duration_sec * 1000;
    const densityConfig = EVENT_DENSITY_CONFIG[level.event_density];
    const halfWindow = level.scoring_window_ms / 2;

    let currentTimeMs = 1000; // Start 1 second into the round
    let eventIndex = 0;

    while (currentTimeMs < roundDurationMs - 3000) {
      // Stop 3 seconds before end
      // Generate primary event
      const primaryEvent = this.createEvent(
        eventIndex++,
        currentTimeMs,
        species,
        level.scoring_window_ms,
        halfWindow
      );
      events.push(primaryEvent);

      // Possibly generate overlapping event
      if (level.overlap_probability > 0 && this.random() < level.overlap_probability) {
        const overlapEvent = this.createOverlapEvent(
          eventIndex++,
          currentTimeMs,
          species,
          level.scoring_window_ms,
          halfWindow,
          primaryEvent.channel
        );
        events.push(overlapEvent);
      }

      // Calculate next event time based on density
      const gap = this.randomInRange(densityConfig.minGapMs, densityConfig.maxGapMs);
      currentTimeMs += gap;
    }

    return events;
  }

  /**
   * Generates events for a specific level, ensuring no overlaps when overlap_probability is 0.
   * @param level The level configuration
   * @param species Available species
   * @returns Array of non-overlapping events
   */
  generateNonOverlappingEvents(level: LevelConfig, species: SpeciesSelection[]): GameEvent[] {
    const events: GameEvent[] = [];
    const roundDurationMs = level.round_duration_sec * 1000;
    const densityConfig = EVENT_DENSITY_CONFIG[level.event_density];
    const halfWindow = level.scoring_window_ms / 2;

    let currentTimeMs = 1000;
    let eventIndex = 0;

    while (currentTimeMs < roundDurationMs - 3000) {
      const event = this.createEvent(
        eventIndex++,
        currentTimeMs,
        species,
        level.scoring_window_ms,
        halfWindow
      );
      events.push(event);

      // Ensure no overlap by adding event duration plus gap
      const eventDuration = event.duration_ms || 2000;
      const minGap = Math.max(densityConfig.minGapMs, eventDuration);
      const maxGap = Math.max(densityConfig.maxGapMs, eventDuration + 1000);
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
   */
  estimateEventCount(level: LevelConfig): { min: number; max: number } {
    const roundDurationMs = level.round_duration_sec * 1000;
    const densityConfig = EVENT_DENSITY_CONFIG[level.event_density];
    const usableDuration = roundDurationMs - 4000; // Account for start/end margins

    const minEvents = Math.floor(usableDuration / densityConfig.maxGapMs);
    const maxEvents = Math.floor(usableDuration / densityConfig.minGapMs);

    // Account for potential overlaps
    const overlapMultiplier = 1 + level.overlap_probability;

    return {
      min: Math.floor(minEvents * overlapMultiplier),
      max: Math.ceil(maxEvents * overlapMultiplier),
    };
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
