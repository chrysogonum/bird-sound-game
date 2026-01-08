/**
 * VisibilityController - Manages spectrogram visibility modes for SoundField: Birds
 *
 * Controls:
 * - Spectrogram visibility modes (full, fading, none)
 * - Tile opacity calculations based on mode
 * - Progressive difficulty through visibility reduction
 * - Transition animations between modes
 */

import type { SpectrogramMode } from '../game/types.js';
import type { SpectrogramTile, LanePosition } from './types.js';
import { VISUAL_ANIMATIONS } from './types.js';

/** Visibility mode descriptions for UI */
export const VISIBILITY_MODE_INFO: Record<SpectrogramMode, {
  label: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
}> = {
  full: {
    label: 'Full',
    description: 'Spectrograms always visible - best for learning',
    difficulty: 'easy',
  },
  fading: {
    label: 'Fading',
    description: 'Spectrograms fade as tiles approach - intermediate challenge',
    difficulty: 'medium',
  },
  none: {
    label: 'Audio Only',
    description: 'No spectrograms shown - expert mode, audio-only identification',
    difficulty: 'hard',
  },
};

/** Visibility controller configuration */
export interface VisibilityControllerConfig {
  /** Initial visibility mode */
  initialMode?: SpectrogramMode;
  /** Fade start position (normalized Y, 0-1) for fading mode */
  fadeStartY?: number;
  /** Fade end position (normalized Y, 0-1) for fading mode */
  fadeEndY?: number;
  /** Minimum opacity in fading mode */
  fadeMinOpacity?: number;
  /** Whether to show species labels in none mode */
  showLabelsInNoneMode?: boolean;
  /** Label opacity in none mode */
  noneModeLabeOpacity?: number;
  /** Transition duration when changing modes */
  transitionDurationMs?: number;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<VisibilityControllerConfig> = {
  initialMode: 'full',
  fadeStartY: 0.8,
  fadeEndY: 0.2,
  fadeMinOpacity: 0.3,
  showLabelsInNoneMode: true,
  noneModeLabeOpacity: 0.8,
  transitionDurationMs: 300,
};

/** Visibility change callback */
export type VisibilityChangeCallback = (mode: SpectrogramMode) => void;

/**
 * Controls spectrogram visibility based on mode and tile position.
 */
export class VisibilityController {
  private readonly config: Required<VisibilityControllerConfig>;
  private currentMode: SpectrogramMode;
  private targetMode: SpectrogramMode;
  private transitionProgress: number = 1; // 0 = transitioning, 1 = complete
  private transitionStartMs: number = 0;
  private listeners: Set<VisibilityChangeCallback> = new Set();

  constructor(config: VisibilityControllerConfig = {}) {
    this.config = {
      initialMode: config.initialMode ?? DEFAULT_CONFIG.initialMode,
      fadeStartY: config.fadeStartY ?? DEFAULT_CONFIG.fadeStartY,
      fadeEndY: config.fadeEndY ?? DEFAULT_CONFIG.fadeEndY,
      fadeMinOpacity: config.fadeMinOpacity ?? DEFAULT_CONFIG.fadeMinOpacity,
      showLabelsInNoneMode: config.showLabelsInNoneMode ?? DEFAULT_CONFIG.showLabelsInNoneMode,
      noneModeLabeOpacity: config.noneModeLabeOpacity ?? DEFAULT_CONFIG.noneModeLabeOpacity,
      transitionDurationMs: config.transitionDurationMs ?? DEFAULT_CONFIG.transitionDurationMs,
    };

    this.currentMode = this.config.initialMode;
    this.targetMode = this.config.initialMode;
  }

  /**
   * Gets the current visibility mode.
   */
  getMode(): SpectrogramMode {
    return this.currentMode;
  }

  /**
   * Gets the target mode (during transitions).
   */
  getTargetMode(): SpectrogramMode {
    return this.targetMode;
  }

  /**
   * Sets the visibility mode.
   */
  setMode(mode: SpectrogramMode, immediate: boolean = false): void {
    if (mode === this.currentMode && mode === this.targetMode) {
      return;
    }

    this.targetMode = mode;

    if (immediate) {
      this.currentMode = mode;
      this.transitionProgress = 1;
      this.notifyListeners();
    } else {
      this.transitionProgress = 0;
      this.transitionStartMs = Date.now();
    }
  }

  /**
   * Updates the controller (for transition animations).
   */
  update(currentTimeMs?: number): void {
    if (this.transitionProgress >= 1) {
      return;
    }

    const now = currentTimeMs ?? Date.now();
    const elapsed = now - this.transitionStartMs;
    this.transitionProgress = Math.min(1, elapsed / this.config.transitionDurationMs);

    if (this.transitionProgress >= 1) {
      this.currentMode = this.targetMode;
      this.notifyListeners();
    }
  }

  /**
   * Checks if currently transitioning between modes.
   */
  isTransitioning(): boolean {
    return this.transitionProgress < 1;
  }

  /**
   * Gets the transition progress (0-1).
   */
  getTransitionProgress(): number {
    return this.transitionProgress;
  }

  /**
   * Calculates spectrogram opacity for a tile based on mode and position.
   */
  getSpectrogramOpacity(tile: SpectrogramTile): number {
    const baseOpacity = this.calculateModeOpacity(tile, this.currentMode);

    // If transitioning, blend between modes
    if (this.isTransitioning()) {
      const targetOpacity = this.calculateModeOpacity(tile, this.targetMode);
      return this.lerp(baseOpacity, targetOpacity, this.transitionProgress);
    }

    return baseOpacity;
  }

  /**
   * Calculates opacity for a specific mode.
   */
  private calculateModeOpacity(tile: SpectrogramTile, mode: SpectrogramMode): number {
    switch (mode) {
      case 'full':
        return tile.opacity;

      case 'fading':
        return this.calculateFadingOpacity(tile);

      case 'none':
        return 0;
    }
  }

  /**
   * Calculates fading mode opacity based on Y position.
   */
  private calculateFadingOpacity(tile: SpectrogramTile): number {
    const { fadeStartY, fadeEndY, fadeMinOpacity } = this.config;

    // Above fade start - full opacity
    if (tile.normalizedY >= fadeStartY) {
      return tile.opacity;
    }

    // Below fade end - minimum opacity
    if (tile.normalizedY <= fadeEndY) {
      return tile.opacity * fadeMinOpacity;
    }

    // In fade zone - interpolate
    const fadeRange = fadeStartY - fadeEndY;
    const fadeProgress = (fadeStartY - tile.normalizedY) / fadeRange;
    const fadeMultiplier = 1 - (fadeProgress * (1 - fadeMinOpacity));

    return tile.opacity * fadeMultiplier;
  }

  /**
   * Calculates label opacity for a tile.
   */
  getLabelOpacity(tile: SpectrogramTile): number {
    switch (this.currentMode) {
      case 'full':
        return tile.opacity;

      case 'fading':
        // Labels stay more visible than spectrograms in fading mode
        return Math.max(this.calculateFadingOpacity(tile), tile.opacity * 0.6);

      case 'none':
        return this.config.showLabelsInNoneMode
          ? tile.opacity * this.config.noneModeLabeOpacity
          : 0;
    }
  }

  /**
   * Checks if spectrograms are visible in current mode.
   */
  areSpectrogramsVisible(): boolean {
    return this.currentMode !== 'none';
  }

  /**
   * Checks if labels should be shown.
   */
  areLabelsVisible(): boolean {
    return this.currentMode !== 'none' || this.config.showLabelsInNoneMode;
  }

  /**
   * Gets the mode info for the current mode.
   */
  getModeInfo(): typeof VISIBILITY_MODE_INFO[SpectrogramMode] {
    return VISIBILITY_MODE_INFO[this.currentMode];
  }

  /**
   * Gets all available modes with their info.
   */
  getAllModes(): Array<{ mode: SpectrogramMode; info: typeof VISIBILITY_MODE_INFO[SpectrogramMode] }> {
    return (['full', 'fading', 'none'] as SpectrogramMode[]).map((mode) => ({
      mode,
      info: VISIBILITY_MODE_INFO[mode],
    }));
  }

  /**
   * Cycles to the next visibility mode.
   */
  cycleMode(): SpectrogramMode {
    const modes: SpectrogramMode[] = ['full', 'fading', 'none'];
    const currentIndex = modes.indexOf(this.currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const nextMode = modes[nextIndex];

    this.setMode(nextMode);
    return nextMode;
  }

  /**
   * Gets difficulty level for current mode.
   */
  getDifficulty(): 'easy' | 'medium' | 'hard' {
    return VISIBILITY_MODE_INFO[this.currentMode].difficulty;
  }

  /**
   * Checks if current mode is the easiest.
   */
  isEasiestMode(): boolean {
    return this.currentMode === 'full';
  }

  /**
   * Checks if current mode is the hardest.
   */
  isHardestMode(): boolean {
    return this.currentMode === 'none';
  }

  /**
   * Increases difficulty (moves toward 'none').
   */
  increaseDifficulty(): SpectrogramMode {
    if (this.currentMode === 'full') {
      this.setMode('fading');
      return 'fading';
    } else if (this.currentMode === 'fading') {
      this.setMode('none');
      return 'none';
    }
    return this.currentMode;
  }

  /**
   * Decreases difficulty (moves toward 'full').
   */
  decreaseDifficulty(): SpectrogramMode {
    if (this.currentMode === 'none') {
      this.setMode('fading');
      return 'fading';
    } else if (this.currentMode === 'fading') {
      this.setMode('full');
      return 'full';
    }
    return this.currentMode;
  }

  /**
   * Adds a visibility change listener.
   */
  addListener(callback: VisibilityChangeCallback): void {
    this.listeners.add(callback);
  }

  /**
   * Removes a visibility change listener.
   */
  removeListener(callback: VisibilityChangeCallback): void {
    this.listeners.delete(callback);
  }

  /**
   * Notifies listeners of mode change.
   */
  private notifyListeners(): void {
    for (const callback of this.listeners) {
      callback(this.currentMode);
    }
  }

  /**
   * Linear interpolation helper.
   */
  private lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  }

  /**
   * Gets render data for UI.
   */
  getRenderData(): {
    mode: SpectrogramMode;
    modeInfo: typeof VISIBILITY_MODE_INFO[SpectrogramMode];
    isTransitioning: boolean;
    transitionProgress: number;
    spectrogramsVisible: boolean;
    labelsVisible: boolean;
    difficulty: 'easy' | 'medium' | 'hard';
  } {
    return {
      mode: this.currentMode,
      modeInfo: this.getModeInfo(),
      isTransitioning: this.isTransitioning(),
      transitionProgress: this.transitionProgress,
      spectrogramsVisible: this.areSpectrogramsVisible(),
      labelsVisible: this.areLabelsVisible(),
      difficulty: this.getDifficulty(),
    };
  }

  /**
   * Resets to initial mode.
   */
  reset(): void {
    this.currentMode = this.config.initialMode;
    this.targetMode = this.config.initialMode;
    this.transitionProgress = 1;
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<VisibilityControllerConfig> {
    return { ...this.config };
  }
}
