/**
 * Scoring system types for SoundField: Birds
 */

import type { Channel } from '../audio/types.js';

/** Score point values from PRD */
export const SCORE_VALUES = {
  /** Points for correct species identification */
  SPECIES_CORRECT: 50,
  /** Points for correct channel identification */
  CHANNEL_CORRECT: 25,
  /** Points for perfect timing (within scoring window center) */
  TIMING_PERFECT: 25,
  /** Points for partial timing (within scoring window but not perfect) */
  TIMING_PARTIAL: 10,
  /** Maximum possible score per event */
  MAX_PER_EVENT: 100,
} as const;

/** Timing accuracy levels */
export type TimingAccuracy = 'perfect' | 'partial' | 'miss';

/** Individual score breakdown for an event */
export interface ScoreBreakdown {
  /** Points earned for species identification */
  speciesPoints: number;
  /** Points earned for channel identification */
  channelPoints: number;
  /** Points earned for timing */
  timingPoints: number;
  /** Total points for this event */
  totalPoints: number;
  /** Whether species was correct */
  speciesCorrect: boolean;
  /** Whether channel was correct */
  channelCorrect: boolean;
  /** Timing accuracy */
  timingAccuracy: TimingAccuracy;
}

/** Event data for scoring */
export interface ScoringEvent {
  /** Unique event identifier */
  eventId: string;
  /** Expected species code */
  expectedSpecies: string;
  /** Expected channel */
  expectedChannel: Channel;
  /** Scoring window start time (ms from round start) */
  windowStartMs: number;
  /** Scoring window end time (ms from round start) */
  windowEndMs: number;
  /** Perfect timing window center (ms from round start) */
  perfectTimeMs: number;
  /** Tolerance for perfect timing (±ms from perfectTimeMs) */
  perfectToleranceMs?: number;
}

/** Player input for scoring */
export interface ScoringInput {
  /** Selected species code */
  speciesCode: string | null;
  /** Selected channel */
  channel: Channel;
  /** Input timestamp (ms from round start) */
  timestampMs: number;
}

/** Result of scoring an event */
export interface ScoringResult {
  /** The event that was scored */
  event: ScoringEvent;
  /** The player's input */
  input: ScoringInput;
  /** Score breakdown */
  breakdown: ScoreBreakdown;
  /** Whether the event was missed (no valid input in window) */
  missed: boolean;
}

/** Cumulative score state */
export interface ScoreState {
  /** Total score accumulated */
  totalScore: number;
  /** Number of events scored */
  eventsScored: number;
  /** Number of perfect scores (100 points) */
  perfectCount: number;
  /** Number of species correct */
  speciesCorrectCount: number;
  /** Number of channels correct */
  channelCorrectCount: number;
  /** Number of misses */
  missCount: number;
  /** Score history */
  history: ScoringResult[];
}

/** Feedback type for visual/audio feedback */
export type FeedbackType = 'perfect' | 'good' | 'partial' | 'miss';

/** Feedback event for UI rendering */
export interface FeedbackEvent {
  /** Type of feedback */
  type: FeedbackType;
  /** Score earned */
  score: number;
  /** Score breakdown */
  breakdown: ScoreBreakdown;
  /** Position for rendering (optional) */
  position?: { x: number; y: number };
}
