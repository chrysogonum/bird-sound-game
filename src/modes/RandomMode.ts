/**
 * RandomMode - Continuous random Events from Pack for SoundField: Birds
 *
 * Features:
 * - Continuous events until player quits
 * - Random species selection from pack
 * - Adjustable density settings
 * - No fixed end time
 */

import type { LevelConfig, RoundStats, SpeciesSelection, GameEvent } from '../game/types.js';
import type {
  BaseModeConfig,
  ModeState,
  ModeResult,
  RandomSettings,
} from './types.js';

/** Default random mode settings */
const DEFAULT_SETTINGS: Required<RandomSettings> = {
  packId: 'default',
  speciesCodes: [],
  eventDensity: 'medium',
};

/** Random mode configuration */
export interface RandomModeConfig extends BaseModeConfig {
  /** Available species for random mode */
  availableSpecies: SpeciesSelection[];
  /** Initial settings */
  settings?: RandomSettings;
}

/**
 * RandomMode manages continuous random event gameplay.
 */
export class RandomMode {
  private readonly availableSpecies: SpeciesSelection[];
  private settings: Required<RandomSettings>;
  private state: ModeState = 'idle';
  private selectedSpecies: SpeciesSelection[] = [];
  private sessionStats: RoundStats;
  private sessionStartTime: number = 0;
  private eventsPlayed: number = 0;
  private onComplete: ((result: ModeResult) => void) | null;
  private onStateChange: ((state: ModeState) => void) | null;

  constructor(config: RandomModeConfig) {
    this.availableSpecies = config.availableSpecies;
    this.onComplete = config.onComplete ?? null;
    this.onStateChange = config.onStateChange ?? null;

    // Initialize settings
    this.settings = {
      packId: config.settings?.packId ?? DEFAULT_SETTINGS.packId,
      speciesCodes: config.settings?.speciesCodes ?? DEFAULT_SETTINGS.speciesCodes,
      eventDensity: config.settings?.eventDensity ?? DEFAULT_SETTINGS.eventDensity,
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
  getSettings(): Required<RandomSettings> {
    return { ...this.settings };
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
   * Starts random mode.
   */
  start(): { level: LevelConfig; species: SpeciesSelection[] } | null {
    if (!this.isReady()) {
      return null;
    }

    this.sessionStats = this.createEmptyStats();
    this.sessionStartTime = Date.now();
    this.eventsPlayed = 0;
    this.setState('playing');

    return {
      level: this.createLevelConfig(),
      species: this.createSpeciesSelection(),
    };
  }

  /**
   * Records an event result during the session.
   */
  recordEvent(correct: boolean, score: number): void {
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

    this.sessionStats.totalEvents = this.eventsPlayed;

    const result: ModeResult = {
      mode: 'random',
      stats: this.sessionStats,
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
}
