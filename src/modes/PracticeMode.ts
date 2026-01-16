/**
 * PracticeMode - Single species focused practice for ChipNotes!
 *
 * Features:
 * - Focus on a single species
 * - Adjustable settings (vocalization type, density, duration)
 * - Only clips from selected species play
 */

import type { LevelConfig, RoundStats, SpeciesSelection, GameEvent } from '../game/types.js';
import type { ClipMetadata } from '../audio/types.js';
import type {
  BaseModeConfig,
  ModeState,
  ModeResult,
  PracticeSettings,
} from './types.js';

/** Default practice settings */
const DEFAULT_SETTINGS: Required<PracticeSettings> = {
  speciesCode: '',
  vocalizationType: 'both',
  eventDensity: 'low',
  roundDurationSec: 30,
};

/** Practice mode configuration */
export interface PracticeModeConfig extends BaseModeConfig {
  /** Available species with their clips */
  availableSpecies: SpeciesSelection[];
  /** Initial settings */
  settings?: PracticeSettings;
}

/**
 * PracticeMode manages single-species focused practice.
 */
export class PracticeMode {
  private readonly availableSpecies: SpeciesSelection[];
  private settings: Required<PracticeSettings>;
  private state: ModeState = 'idle';
  private selectedSpecies: SpeciesSelection | null = null;
  private filteredClips: ClipMetadata[] = [];
  private onComplete: ((result: ModeResult) => void) | null;
  private onStateChange: ((state: ModeState) => void) | null;

  constructor(config: PracticeModeConfig) {
    this.availableSpecies = config.availableSpecies;
    this.onComplete = config.onComplete ?? null;
    this.onStateChange = config.onStateChange ?? null;

    // Initialize settings
    this.settings = {
      speciesCode: config.settings?.speciesCode ?? DEFAULT_SETTINGS.speciesCode,
      vocalizationType: config.settings?.vocalizationType ?? DEFAULT_SETTINGS.vocalizationType,
      eventDensity: config.settings?.eventDensity ?? DEFAULT_SETTINGS.eventDensity,
      roundDurationSec: config.settings?.roundDurationSec ?? DEFAULT_SETTINGS.roundDurationSec,
    };

    // Select species if provided
    if (this.settings.speciesCode) {
      this.selectSpecies(this.settings.speciesCode);
    }
  }

  /**
   * Gets all available species for practice.
   */
  getAvailableSpecies(): SpeciesSelection[] {
    return [...this.availableSpecies];
  }

  /**
   * Selects a species for practice.
   * @param speciesCode The species code to practice
   * @returns True if species was found and selected
   */
  selectSpecies(speciesCode: string): boolean {
    const species = this.availableSpecies.find((s) => s.speciesCode === speciesCode);
    if (!species) {
      return false;
    }

    this.selectedSpecies = species;
    this.settings.speciesCode = speciesCode;
    this.filterClips();
    return true;
  }

  /**
   * Gets the currently selected species.
   */
  getSelectedSpecies(): SpeciesSelection | null {
    return this.selectedSpecies;
  }

  /**
   * Gets the selected species code.
   */
  getSelectedSpeciesCode(): string {
    return this.settings.speciesCode;
  }

  /**
   * Sets the vocalization type filter.
   */
  setVocalizationType(type: 'song' | 'call' | 'both'): void {
    this.settings.vocalizationType = type;
    this.filterClips();
  }

  /**
   * Gets the vocalization type setting.
   */
  getVocalizationType(): 'song' | 'call' | 'both' {
    return this.settings.vocalizationType;
  }

  /**
   * Sets the event density.
   */
  setEventDensity(density: 'low' | 'medium' | 'high'): void {
    this.settings.eventDensity = density;
  }

  /**
   * Gets the event density setting.
   */
  getEventDensity(): 'low' | 'medium' | 'high' {
    return this.settings.eventDensity;
  }

  /**
   * Sets the round duration.
   */
  setRoundDuration(seconds: number): void {
    this.settings.roundDurationSec = Math.max(10, Math.min(120, seconds));
  }

  /**
   * Gets the round duration setting.
   */
  getRoundDuration(): number {
    return this.settings.roundDurationSec;
  }

  /**
   * Gets current settings.
   */
  getSettings(): Required<PracticeSettings> {
    return { ...this.settings };
  }

  /**
   * Updates multiple settings at once.
   */
  updateSettings(settings: Partial<PracticeSettings>): void {
    if (settings.speciesCode !== undefined) {
      this.selectSpecies(settings.speciesCode);
    }
    if (settings.vocalizationType !== undefined) {
      this.settings.vocalizationType = settings.vocalizationType;
      this.filterClips();
    }
    if (settings.eventDensity !== undefined) {
      this.settings.eventDensity = settings.eventDensity;
    }
    if (settings.roundDurationSec !== undefined) {
      this.settings.roundDurationSec = settings.roundDurationSec;
    }
  }

  /**
   * Gets the filtered clips for the selected species and settings.
   */
  getFilteredClips(): ClipMetadata[] {
    return [...this.filteredClips];
  }

  /**
   * Checks if the mode is ready to start.
   */
  isReady(): boolean {
    return this.selectedSpecies !== null && this.filteredClips.length > 0;
  }

  /**
   * Creates a level config for practice based on current settings.
   */
  createLevelConfig(): LevelConfig {
    return {
      level_id: 0, // Practice mode uses 0
      pack_id: 'practice',
      mode: 'practice',
      round_duration_sec: this.settings.roundDurationSec,
      species_count: 1,
      event_density: this.settings.eventDensity,
      overlap_probability: 0, // No overlaps in practice
      scoring_window_ms: 2000, // Generous window for practice
      spectrogram_mode: 'full', // Full visual aid in practice
    };
  }

  /**
   * Creates a species selection for practice (single species).
   */
  createSpeciesSelection(): SpeciesSelection[] {
    if (!this.selectedSpecies) {
      return [];
    }

    return [
      {
        speciesCode: this.selectedSpecies.speciesCode,
        commonName: this.selectedSpecies.commonName,
        clips: this.filteredClips,
      },
    ];
  }

  /**
   * Starts practice mode.
   * @returns Level config and species selection, or null if not ready
   */
  start(): { level: LevelConfig; species: SpeciesSelection[] } | null {
    if (!this.isReady()) {
      return null;
    }

    this.setState('playing');

    return {
      level: this.createLevelConfig(),
      species: this.createSpeciesSelection(),
    };
  }

  /**
   * Completes practice with the given stats.
   */
  complete(stats: RoundStats): ModeResult {
    this.setState('ended');

    const result: ModeResult = {
      mode: 'practice',
      stats,
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
   * Pauses practice.
   */
  pause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
    }
  }

  /**
   * Resumes practice.
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
   * Filters clips based on vocalization type setting.
   */
  private filterClips(): void {
    if (!this.selectedSpecies) {
      this.filteredClips = [];
      return;
    }

    if (this.settings.vocalizationType === 'both') {
      this.filteredClips = [...this.selectedSpecies.clips];
    } else {
      this.filteredClips = this.selectedSpecies.clips.filter(
        (clip) => clip.vocalization_type === this.settings.vocalizationType
      );
    }

    // Fallback to all clips if filter results in empty
    if (this.filteredClips.length === 0) {
      this.filteredClips = [...this.selectedSpecies.clips];
    }
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
