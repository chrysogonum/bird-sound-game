/**
 * ChallengeMode - Timed high-score mode for ChipNotes!
 *
 * Features:
 * - Fixed 60-second timed rounds
 * - High score tracking
 * - Optional daily seed for reproducible challenges
 * - Same seed produces same event sequence
 */

import type { LevelConfig, RoundStats, SpeciesSelection } from '../game/types.js';
import type {
  BaseModeConfig,
  ModeState,
  ModeResult,
  ChallengeSettings,
} from './types.js';
import { generateDailySeed, seedFromDateString } from './types.js';

/** Default challenge settings */
const DEFAULT_SETTINGS: Required<ChallengeSettings> = {
  durationSec: 60,
  seed: 0,
  dailySeed: '',
  packId: 'default',
};

/** Challenge mode configuration */
export interface ChallengeModeConfig extends BaseModeConfig {
  /** Available species for the challenge */
  availableSpecies: SpeciesSelection[];
  /** Initial settings */
  settings?: ChallengeSettings;
  /** High score (for comparison) */
  highScore?: number;
}

/**
 * ChallengeMode manages timed high-score gameplay.
 */
export class ChallengeMode {
  private readonly availableSpecies: SpeciesSelection[];
  private settings: Required<ChallengeSettings>;
  private state: ModeState = 'idle';
  private highScore: number;
  private currentSeed: number;
  private onComplete: ((result: ModeResult) => void) | null;
  private onStateChange: ((state: ModeState) => void) | null;

  constructor(config: ChallengeModeConfig) {
    this.availableSpecies = config.availableSpecies;
    this.highScore = config.highScore ?? 0;
    this.onComplete = config.onComplete ?? null;
    this.onStateChange = config.onStateChange ?? null;

    // Initialize settings
    this.settings = {
      durationSec: config.settings?.durationSec ?? DEFAULT_SETTINGS.durationSec,
      seed: config.settings?.seed ?? DEFAULT_SETTINGS.seed,
      dailySeed: config.settings?.dailySeed ?? DEFAULT_SETTINGS.dailySeed,
      packId: config.settings?.packId ?? DEFAULT_SETTINGS.packId,
    };

    // Calculate seed
    this.currentSeed = this.calculateSeed();
  }

  /**
   * Gets the available species.
   */
  getAvailableSpecies(): SpeciesSelection[] {
    return [...this.availableSpecies];
  }

  /**
   * Gets current settings.
   */
  getSettings(): Required<ChallengeSettings> {
    return { ...this.settings };
  }

  /**
   * Sets the challenge duration.
   */
  setDuration(seconds: number): void {
    this.settings.durationSec = Math.max(30, Math.min(120, seconds));
  }

  /**
   * Gets the challenge duration.
   */
  getDuration(): number {
    return this.settings.durationSec;
  }

  /**
   * Sets a specific seed for reproducible results.
   */
  setSeed(seed: number): void {
    this.settings.seed = seed;
    this.settings.dailySeed = '';
    this.currentSeed = seed;
  }

  /**
   * Sets a daily seed from a date string (e.g., "2024-01-15").
   */
  setDailySeed(dateString: string): void {
    this.settings.dailySeed = dateString;
    this.settings.seed = 0;
    this.currentSeed = seedFromDateString(dateString);
  }

  /**
   * Uses today's date as the daily seed.
   */
  useTodaysSeed(): void {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    this.setDailySeed(dateString);
  }

  /**
   * Gets the current seed value.
   */
  getSeed(): number {
    return this.currentSeed;
  }

  /**
   * Gets the daily seed string if set.
   */
  getDailySeed(): string {
    return this.settings.dailySeed;
  }

  /**
   * Checks if using a daily seed.
   */
  isUsingDailySeed(): boolean {
    return this.settings.dailySeed !== '';
  }

  /**
   * Gets the current high score.
   */
  getHighScore(): number {
    return this.highScore;
  }

  /**
   * Sets the high score.
   */
  setHighScore(score: number): void {
    this.highScore = score;
  }

  /**
   * Creates a level config for the challenge.
   */
  createLevelConfig(): LevelConfig {
    return {
      level_id: -1, // Challenge mode uses -1
      pack_id: this.settings.packId,
      mode: 'challenge',
      round_duration_sec: this.settings.durationSec,
      species_count: Math.min(8, this.availableSpecies.length),
      event_density: 'medium',
      overlap_probability: 0.2,
      scoring_window_ms: 1500,
      spectrogram_mode: 'full',
    };
  }

  /**
   * Creates species selection for the challenge.
   */
  createSpeciesSelection(): SpeciesSelection[] {
    // Use up to 8 species for challenge
    return this.availableSpecies.slice(0, 8);
  }

  /**
   * Starts challenge mode.
   * @returns Level config, species, and seed
   */
  start(): { level: LevelConfig; species: SpeciesSelection[]; seed: number } {
    // Recalculate seed in case settings changed
    this.currentSeed = this.calculateSeed();
    this.setState('playing');

    return {
      level: this.createLevelConfig(),
      species: this.createSpeciesSelection(),
      seed: this.currentSeed,
    };
  }

  /**
   * Completes challenge with the given stats.
   */
  complete(stats: RoundStats): ModeResult {
    this.setState('ended');

    const isNewHighScore = stats.totalScore > this.highScore;
    if (isNewHighScore) {
      this.highScore = stats.totalScore;
    }

    const result: ModeResult = {
      mode: 'challenge',
      stats,
      highScore: this.highScore,
      isNewHighScore,
    };

    this.onComplete?.(result);
    return result;
  }

  /**
   * Gets the current mode state.
   */
  getState(): ModeState {
    return this.state;
  }

  /**
   * Pauses challenge.
   */
  pause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
    }
  }

  /**
   * Resumes challenge.
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
    this.setState('idle');
  }

  /**
   * Calculates the seed to use based on settings.
   */
  private calculateSeed(): number {
    if (this.settings.dailySeed) {
      return seedFromDateString(this.settings.dailySeed);
    }
    if (this.settings.seed) {
      return this.settings.seed;
    }
    return Date.now();
  }

  /**
   * Sets callbacks.
   */
  setCallbacks(callbacks: {
    onComplete?: (result: ModeResult) => void;
    onStateChange?: (state: ModeState) => void;
  }): void {
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
  }

  /**
   * Updates state and notifies listeners.
   */
  private setState(newState: ModeState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }

  /**
   * Exports state for persistence.
   */
  exportState(): { highScore: number; settings: Required<ChallengeSettings> } {
    return {
      highScore: this.highScore,
      settings: { ...this.settings },
    };
  }

  /**
   * Imports state from persistence.
   */
  importState(data: { highScore: number; settings?: Partial<ChallengeSettings> }): void {
    this.highScore = data.highScore;
    if (data.settings) {
      Object.assign(this.settings, data.settings);
      this.currentSeed = this.calculateSeed();
    }
  }
}
