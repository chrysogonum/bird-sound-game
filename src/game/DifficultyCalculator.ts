/**
 * DifficultyCalculator - Combines Level and Pack modifiers for SoundField: Birds
 *
 * Features:
 * - Apply pack tempo modifier to event timing
 * - Apply pack overlap modifier to overlap probability
 * - Filter clips by vocalization weights
 * - Stack modifiers with level difficulty
 */

import type { LevelConfig } from './types.js';
import type { Pack, VocalizationWeights } from '../packs/types.js';
import { EVENT_DENSITY_CONFIG } from './types.js';

/** Calculated difficulty parameters */
export interface DifficultyParams {
  /** Minimum gap between events in ms */
  minGapMs: number;
  /** Maximum gap between events in ms */
  maxGapMs: number;
  /** Overlap probability (0-1) */
  overlapProbability: number;
  /** Scoring window in ms */
  scoringWindowMs: number;
  /** Vocalization weights for filtering clips */
  vocalizationWeights: VocalizationWeights;
  /** Event density level */
  eventDensity: 'low' | 'medium' | 'high';
}

/** Default vocalization weights (equal song/call) */
const DEFAULT_VOCALIZATION_WEIGHTS: VocalizationWeights = {
  song: 0.5,
  call: 0.5,
};

/**
 * DifficultyCalculator combines Level config with Pack modifiers
 * to produce final difficulty parameters for event scheduling.
 */
export class DifficultyCalculator {
  /**
   * Calculates difficulty parameters by combining Level and Pack settings.
   * @param level The level configuration
   * @param pack Optional pack with modifiers (null for defaults)
   * @returns Combined difficulty parameters
   */
  calculate(level: LevelConfig, pack: Pack | null = null): DifficultyParams {
    // Get base timing from level's event density
    const densityConfig = EVENT_DENSITY_CONFIG[level.event_density];
    let minGapMs = densityConfig.minGapMs;
    let maxGapMs = densityConfig.maxGapMs;

    // Get base overlap probability from level
    let overlapProbability = level.overlap_probability;

    // Get vocalization weights (default to equal)
    let vocalizationWeights = { ...DEFAULT_VOCALIZATION_WEIGHTS };

    // Apply pack modifiers if present
    if (pack) {
      // Tempo modifier: higher = shorter gaps = more events
      // tempo 1.2x means gaps are divided by 1.2 (faster tempo)
      const tempoMultiplier = pack.tempoMultiplier;
      minGapMs = Math.round(minGapMs / tempoMultiplier);
      maxGapMs = Math.round(maxGapMs / tempoMultiplier);

      // Overlap modifier: higher = more overlapping events
      // overlap 1.5x means 50% more overlap probability
      overlapProbability = Math.min(1.0, overlapProbability * pack.overlapMultiplier);

      // Use pack's vocalization weights
      vocalizationWeights = { ...pack.vocalizationWeights };
    }

    return {
      minGapMs,
      maxGapMs,
      overlapProbability,
      scoringWindowMs: level.scoring_window_ms,
      vocalizationWeights,
      eventDensity: level.event_density,
    };
  }

  /**
   * Calculates the expected event frequency change from pack modifiers.
   * @param pack The pack to check
   * @returns Multiplier for event frequency (1.2 = 20% more events)
   */
  getEventFrequencyMultiplier(pack: Pack | null): number {
    if (!pack) return 1.0;
    // Higher tempo = more events, so frequency multiplier equals tempo multiplier
    return pack.tempoMultiplier;
  }

  /**
   * Calculates the expected overlap change from pack modifiers.
   * @param pack The pack to check
   * @returns Multiplier for overlap probability
   */
  getOverlapMultiplier(pack: Pack | null): number {
    if (!pack) return 1.0;
    return pack.overlapMultiplier;
  }

  /**
   * Determines if a vocalization type should be included based on weights.
   * @param type The vocalization type ('song' or 'call')
   * @param weights The vocalization weights
   * @param random A random number between 0 and 1
   * @returns True if the vocalization should be included
   */
  shouldIncludeVocalization(
    type: 'song' | 'call',
    weights: VocalizationWeights,
    random: number
  ): boolean {
    const totalWeight = weights.song + weights.call;
    if (totalWeight === 0) return false;

    // Normalize weights to get probability
    const weight = type === 'song' ? weights.song : weights.call;
    const probability = weight / totalWeight;

    return random < probability;
  }

  /**
   * Selects a vocalization type based on weights.
   * @param weights The vocalization weights
   * @param random A random number between 0 and 1
   * @returns 'song' or 'call' based on weighted random selection
   */
  selectVocalizationType(
    weights: VocalizationWeights,
    random: number
  ): 'song' | 'call' {
    const totalWeight = weights.song + weights.call;
    if (totalWeight === 0) return 'song'; // Default to song if no weights

    const songProbability = weights.song / totalWeight;
    return random < songProbability ? 'song' : 'call';
  }

  /**
   * Calculates the percentage of events expected to be songs.
   * @param weights The vocalization weights
   * @returns Percentage (0-100) of events that should be songs
   */
  getSongPercentage(weights: VocalizationWeights): number {
    const totalWeight = weights.song + weights.call;
    if (totalWeight === 0) return 50;
    return (weights.song / totalWeight) * 100;
  }

  /**
   * Calculates the percentage of events expected to be calls.
   * @param weights The vocalization weights
   * @returns Percentage (0-100) of events that should be calls
   */
  getCallPercentage(weights: VocalizationWeights): number {
    const totalWeight = weights.song + weights.call;
    if (totalWeight === 0) return 50;
    return (weights.call / totalWeight) * 100;
  }

  /**
   * Validates that difficulty parameters are within acceptable bounds.
   * @param params The difficulty parameters to validate
   * @returns True if parameters are valid
   */
  validateParams(params: DifficultyParams): boolean {
    // Check gap timing is positive
    if (params.minGapMs <= 0 || params.maxGapMs <= 0) return false;
    if (params.minGapMs > params.maxGapMs) return false;

    // Check overlap probability is valid
    if (params.overlapProbability < 0 || params.overlapProbability > 1) return false;

    // Check scoring window is positive
    if (params.scoringWindowMs <= 0) return false;

    // Check vocalization weights are non-negative
    if (params.vocalizationWeights.song < 0 || params.vocalizationWeights.call < 0) return false;

    return true;
  }

  /**
   * Creates a summary string for difficulty parameters.
   * @param params The difficulty parameters
   * @returns Human-readable summary
   */
  summarize(params: DifficultyParams): string {
    const lines = [
      `Density: ${params.eventDensity}`,
      `Gap: ${params.minGapMs}-${params.maxGapMs}ms`,
      `Overlap: ${(params.overlapProbability * 100).toFixed(0)}%`,
      `Scoring window: ${params.scoringWindowMs}ms`,
      `Songs: ${this.getSongPercentage(params.vocalizationWeights).toFixed(0)}%`,
      `Calls: ${this.getCallPercentage(params.vocalizationWeights).toFixed(0)}%`,
    ];
    return lines.join(', ');
  }
}
