/**
 * ScoreEngine - Score calculation per Event for ChipNotes!
 *
 * Calculates scores based on three independent dimensions:
 * - Species identification (+50 points)
 * - Channel identification (+25 points)
 * - Timing accuracy (+25 perfect / +10 partial)
 *
 * Maximum score per event: 100 points
 */

import type {
  ScoringEvent,
  ScoringInput,
  ScoringResult,
  ScoreBreakdown,
  ScoreState,
  TimingAccuracy,
  FeedbackType,
} from './types.js';
import { SCORE_VALUES } from './types.js';

/** Default perfect timing tolerance in ms */
const DEFAULT_PERFECT_TOLERANCE_MS = 100;

/**
 * ScoreEngine handles all scoring logic for the game.
 */
export class ScoreEngine {
  private state: ScoreState;
  private readonly perfectToleranceMs: number;

  constructor(perfectToleranceMs: number = DEFAULT_PERFECT_TOLERANCE_MS) {
    this.perfectToleranceMs = perfectToleranceMs;
    this.state = this.createInitialState();
  }

  /**
   * Creates a fresh score state.
   */
  private createInitialState(): ScoreState {
    return {
      totalScore: 0,
      eventsScored: 0,
      perfectCount: 0,
      speciesCorrectCount: 0,
      channelCorrectCount: 0,
      missCount: 0,
      history: [],
    };
  }

  /**
   * Resets the score state.
   */
  reset(): void {
    this.state = this.createInitialState();
  }

  /**
   * Scores a player input against an event.
   * @param event The game event to score against
   * @param input The player's input
   * @returns The scoring result
   */
  scoreEvent(event: ScoringEvent, input: ScoringInput): ScoringResult {
    const breakdown = this.calculateBreakdown(event, input);
    const missed = breakdown.totalPoints === 0 && !this.isInputInWindow(event, input);

    const result: ScoringResult = {
      event,
      input,
      breakdown,
      missed,
    };

    // Update state
    this.state.totalScore += breakdown.totalPoints;
    this.state.eventsScored++;
    this.state.history.push(result);

    if (breakdown.totalPoints === SCORE_VALUES.MAX_PER_EVENT) {
      this.state.perfectCount++;
    }
    if (breakdown.speciesCorrect) {
      this.state.speciesCorrectCount++;
    }
    if (breakdown.channelCorrect) {
      this.state.channelCorrectCount++;
    }
    if (missed) {
      this.state.missCount++;
    }

    return result;
  }

  /**
   * Calculates the score breakdown for an input.
   */
  calculateBreakdown(event: ScoringEvent, input: ScoringInput): ScoreBreakdown {
    // Check if input is within scoring window
    if (!this.isInputInWindow(event, input)) {
      return this.createMissBreakdown();
    }

    // Calculate each dimension
    const speciesCorrect = input.speciesCode === event.expectedSpecies;
    const channelCorrect = input.channel === event.expectedChannel;
    const timingAccuracy = this.calculateTimingAccuracy(event, input);

    const speciesPoints = speciesCorrect ? SCORE_VALUES.SPECIES_CORRECT : 0;
    const channelPoints = channelCorrect ? SCORE_VALUES.CHANNEL_CORRECT : 0;
    const timingPoints = this.getTimingPoints(timingAccuracy);

    return {
      speciesPoints,
      channelPoints,
      timingPoints,
      totalPoints: speciesPoints + channelPoints + timingPoints,
      speciesCorrect,
      channelCorrect,
      timingAccuracy,
    };
  }

  /**
   * Checks if input is within the scoring window.
   */
  isInputInWindow(event: ScoringEvent, input: ScoringInput): boolean {
    return input.timestampMs >= event.windowStartMs && input.timestampMs <= event.windowEndMs;
  }

  /**
   * Calculates timing accuracy.
   */
  calculateTimingAccuracy(event: ScoringEvent, input: ScoringInput): TimingAccuracy {
    if (!this.isInputInWindow(event, input)) {
      return 'miss';
    }

    const perfectTolerance = event.perfectToleranceMs ?? this.perfectToleranceMs;
    const deviation = Math.abs(input.timestampMs - event.perfectTimeMs);

    if (deviation <= perfectTolerance) {
      return 'perfect';
    }

    return 'partial';
  }

  /**
   * Gets timing points based on accuracy.
   */
  private getTimingPoints(accuracy: TimingAccuracy): number {
    switch (accuracy) {
      case 'perfect':
        return SCORE_VALUES.TIMING_PERFECT;
      case 'partial':
        return SCORE_VALUES.TIMING_PARTIAL;
      case 'miss':
        return 0;
    }
  }

  /**
   * Creates a miss breakdown.
   */
  private createMissBreakdown(): ScoreBreakdown {
    return {
      speciesPoints: 0,
      channelPoints: 0,
      timingPoints: 0,
      totalPoints: 0,
      speciesCorrect: false,
      channelCorrect: false,
      timingAccuracy: 'miss',
    };
  }

  /**
   * Gets the current score state.
   */
  getState(): ScoreState {
    return { ...this.state, history: [...this.state.history] };
  }

  /**
   * Gets the total score.
   */
  getTotalScore(): number {
    return this.state.totalScore;
  }

  /**
   * Gets the number of events scored.
   */
  getEventsScored(): number {
    return this.state.eventsScored;
  }

  /**
   * Gets the accuracy percentage.
   */
  getAccuracyPercent(): number {
    if (this.state.eventsScored === 0) return 0;
    const maxPossible = this.state.eventsScored * SCORE_VALUES.MAX_PER_EVENT;
    return (this.state.totalScore / maxPossible) * 100;
  }

  /**
   * Gets the species accuracy percentage.
   */
  getSpeciesAccuracyPercent(): number {
    if (this.state.eventsScored === 0) return 0;
    return (this.state.speciesCorrectCount / this.state.eventsScored) * 100;
  }

  /**
   * Gets the channel accuracy percentage.
   */
  getChannelAccuracyPercent(): number {
    if (this.state.eventsScored === 0) return 0;
    return (this.state.channelCorrectCount / this.state.eventsScored) * 100;
  }

  /**
   * Determines the feedback type for a score breakdown.
   */
  static getFeedbackType(breakdown: ScoreBreakdown): FeedbackType {
    if (breakdown.totalPoints === SCORE_VALUES.MAX_PER_EVENT) {
      return 'perfect';
    }
    if (breakdown.speciesCorrect && breakdown.channelCorrect) {
      return 'good';
    }
    if (breakdown.totalPoints > 0) {
      return 'partial';
    }
    return 'miss';
  }

  /**
   * Static method to calculate score for a single event without state.
   */
  static calculateScore(
    expectedSpecies: string,
    expectedChannel: string,
    inputSpecies: string | null,
    inputChannel: string,
    isInWindow: boolean,
    isPerfectTiming: boolean
  ): number {
    if (!isInWindow) return 0;

    let score = 0;

    if (inputSpecies === expectedSpecies) {
      score += SCORE_VALUES.SPECIES_CORRECT;
    }

    if (inputChannel === expectedChannel) {
      score += SCORE_VALUES.CHANNEL_CORRECT;
    }

    if (isPerfectTiming) {
      score += SCORE_VALUES.TIMING_PERFECT;
    } else {
      score += SCORE_VALUES.TIMING_PARTIAL;
    }

    return score;
  }
}
