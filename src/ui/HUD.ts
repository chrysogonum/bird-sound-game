/**
 * HUD - Heads-Up Display for SoundField: Birds
 *
 * Displays real-time game information:
 * - Current score
 * - Timer (remaining time)
 * - Progress (events completed)
 * - Current streak
 */

import type { HUDState, HUDConfig, HUDUpdateCallback } from './types.js';
import { UI_COLORS, UI_ANIMATIONS } from './types.js';

/** Default HUD configuration */
const DEFAULT_CONFIG: Required<HUDConfig> = {
  showTimer: true,
  showScore: true,
  showProgress: true,
  showStreak: true,
  position: 'top',
};

/**
 * HUD handles in-game score display, timer, and progress.
 */
export class HUD {
  private readonly config: Required<HUDConfig>;
  private state: HUDState;
  private listeners: Set<HUDUpdateCallback> = new Set();
  private animatingScore: boolean = false;
  private previousScore: number = 0;

  constructor(config: HUDConfig = {}) {
    this.config = {
      showTimer: config.showTimer ?? DEFAULT_CONFIG.showTimer,
      showScore: config.showScore ?? DEFAULT_CONFIG.showScore,
      showProgress: config.showProgress ?? DEFAULT_CONFIG.showProgress,
      showStreak: config.showStreak ?? DEFAULT_CONFIG.showStreak,
      position: config.position ?? DEFAULT_CONFIG.position,
    };

    this.state = this.createInitialState();
  }

  /**
   * Creates the initial HUD state.
   */
  private createInitialState(): HUDState {
    return {
      score: 0,
      timeRemainingMs: 0,
      totalTimeMs: 0,
      eventsCompleted: 0,
      totalEvents: 0,
      currentStreak: 0,
      isPlaying: false,
    };
  }

  /**
   * Initializes the HUD for a new round.
   * @param totalTimeMs Total round time in milliseconds
   * @param totalEvents Total number of events in the round
   */
  initialize(totalTimeMs: number, totalEvents: number): void {
    this.state = {
      score: 0,
      timeRemainingMs: totalTimeMs,
      totalTimeMs,
      eventsCompleted: 0,
      totalEvents,
      currentStreak: 0,
      isPlaying: false,
    };
    this.previousScore = 0;
    this.notifyListeners();
  }

  /**
   * Starts the HUD display (marks as playing).
   */
  start(): void {
    this.state.isPlaying = true;
    this.notifyListeners();
  }

  /**
   * Stops the HUD display.
   */
  stop(): void {
    this.state.isPlaying = false;
    this.notifyListeners();
  }

  /**
   * Updates the score.
   * @param newScore The new total score
   */
  updateScore(newScore: number): void {
    this.previousScore = this.state.score;
    this.state.score = newScore;
    this.animatingScore = true;

    // Clear animation flag after duration
    setTimeout(() => {
      this.animatingScore = false;
    }, UI_ANIMATIONS.SCORE_UPDATE_MS);

    this.notifyListeners();
  }

  /**
   * Adds points to the score.
   * @param points Points to add
   */
  addScore(points: number): void {
    this.updateScore(this.state.score + points);
  }

  /**
   * Updates the remaining time.
   * @param timeRemainingMs Time remaining in milliseconds
   */
  updateTime(timeRemainingMs: number): void {
    this.state.timeRemainingMs = Math.max(0, timeRemainingMs);
    this.notifyListeners();
  }

  /**
   * Updates the events completed count.
   * @param eventsCompleted Number of events completed
   */
  updateProgress(eventsCompleted: number): void {
    this.state.eventsCompleted = eventsCompleted;
    this.notifyListeners();
  }

  /**
   * Updates the current streak.
   * @param streak Current streak count
   */
  updateStreak(streak: number): void {
    this.state.currentStreak = streak;
    this.notifyListeners();
  }

  /**
   * Increments the events completed count.
   */
  incrementProgress(): void {
    this.updateProgress(this.state.eventsCompleted + 1);
  }

  /**
   * Increments the streak.
   */
  incrementStreak(): void {
    this.updateStreak(this.state.currentStreak + 1);
  }

  /**
   * Resets the streak to zero.
   */
  resetStreak(): void {
    this.updateStreak(0);
  }

  /**
   * Gets the current HUD state.
   */
  getState(): HUDState {
    return { ...this.state };
  }

  /**
   * Gets the current score.
   */
  getScore(): number {
    return this.state.score;
  }

  /**
   * Gets the remaining time in milliseconds.
   */
  getTimeRemainingMs(): number {
    return this.state.timeRemainingMs;
  }

  /**
   * Gets the remaining time formatted as MM:SS.
   */
  getFormattedTime(): string {
    const totalSeconds = Math.ceil(this.state.timeRemainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Gets the remaining time formatted as seconds.
   */
  getFormattedSeconds(): string {
    const totalSeconds = Math.ceil(this.state.timeRemainingMs / 1000);
    return `${totalSeconds}s`;
  }

  /**
   * Gets the progress as a percentage (0-100).
   */
  getProgressPercent(): number {
    if (this.state.totalEvents === 0) return 0;
    return (this.state.eventsCompleted / this.state.totalEvents) * 100;
  }

  /**
   * Gets the progress as a fraction string (e.g., "5/10").
   */
  getProgressString(): string {
    return `${this.state.eventsCompleted}/${this.state.totalEvents}`;
  }

  /**
   * Gets the time progress as a percentage (0-100).
   */
  getTimeProgressPercent(): number {
    if (this.state.totalTimeMs === 0) return 0;
    return ((this.state.totalTimeMs - this.state.timeRemainingMs) / this.state.totalTimeMs) * 100;
  }

  /**
   * Checks if the score is currently animating.
   */
  isScoreAnimating(): boolean {
    return this.animatingScore;
  }

  /**
   * Gets the score change (current - previous).
   */
  getScoreChange(): number {
    return this.state.score - this.previousScore;
  }

  /**
   * Adds an update listener.
   */
  addListener(callback: HUDUpdateCallback): void {
    this.listeners.add(callback);
  }

  /**
   * Removes an update listener.
   */
  removeListener(callback: HUDUpdateCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Notifies all listeners of state change.
   */
  private notifyListeners(): void {
    const state = this.getState();
    for (const callback of this.listeners) {
      callback(state);
    }
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    score: number;
    scoreFormatted: string;
    timeRemaining: string;
    timeRemainingMs: number;
    progress: string;
    progressPercent: number;
    streak: number;
    isPlaying: boolean;
    isScoreAnimating: boolean;
    scoreChange: number;
    config: Required<HUDConfig>;
    colors: typeof UI_COLORS;
  } {
    return {
      score: this.state.score,
      scoreFormatted: this.state.score.toLocaleString(),
      timeRemaining: this.getFormattedTime(),
      timeRemainingMs: this.state.timeRemainingMs,
      progress: this.getProgressString(),
      progressPercent: this.getProgressPercent(),
      streak: this.state.currentStreak,
      isPlaying: this.state.isPlaying,
      isScoreAnimating: this.animatingScore,
      scoreChange: this.getScoreChange(),
      config: this.config,
      colors: UI_COLORS,
    };
  }

  /**
   * Gets CSS class for timer based on time remaining.
   */
  getTimerClass(): string {
    const percent = (this.state.timeRemainingMs / this.state.totalTimeMs) * 100;
    if (percent <= 10) return 'timer-critical';
    if (percent <= 25) return 'timer-warning';
    return 'timer-normal';
  }

  /**
   * Gets CSS class for streak display.
   */
  getStreakClass(): string {
    if (this.state.currentStreak >= 10) return 'streak-fire';
    if (this.state.currentStreak >= 5) return 'streak-hot';
    if (this.state.currentStreak >= 3) return 'streak-warm';
    return 'streak-normal';
  }

  /**
   * Resets the HUD to initial state.
   */
  reset(): void {
    this.state = this.createInitialState();
    this.previousScore = 0;
    this.animatingScore = false;
    this.notifyListeners();
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<HUDConfig> {
    return { ...this.config };
  }
}
