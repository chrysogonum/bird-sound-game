/**
 * VisualSettings - UI component for visual settings in SoundField: Birds
 *
 * Provides:
 * - Spectrogram visibility mode selection
 * - Lane scroll speed adjustment
 * - Hit zone position adjustment
 * - Accessibility options
 */

import type { SpectrogramMode } from '../game/types.js';
import { UI_COLORS } from './types.js';
import {
  VisibilityController,
  VISIBILITY_MODE_INFO,
  type VisibilityChangeCallback,
} from '../visual/VisibilityController.js';

/** Visual settings configuration */
export interface VisualSettingsConfig {
  /** Initial spectrogram mode */
  initialMode?: SpectrogramMode;
  /** Initial scroll speed multiplier (0.5-2.0) */
  initialScrollSpeed?: number;
  /** Initial hit zone position (0.1-0.3) */
  initialHitZoneY?: number;
  /** Whether high contrast mode is enabled */
  highContrastMode?: boolean;
  /** Whether reduced motion is enabled */
  reducedMotion?: boolean;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<VisualSettingsConfig> = {
  initialMode: 'full',
  initialScrollSpeed: 1.0,
  initialHitZoneY: 0.15,
  highContrastMode: false,
  reducedMotion: false,
};

/** Settings change callback */
export type SettingsChangeCallback = (settings: VisualSettingsState) => void;

/** Visual settings state */
export interface VisualSettingsState {
  spectrogramMode: SpectrogramMode;
  scrollSpeedMultiplier: number;
  hitZoneY: number;
  highContrastMode: boolean;
  reducedMotion: boolean;
}

/** Scroll speed presets */
export const SCROLL_SPEED_PRESETS = {
  slow: { value: 0.7, label: 'Slow' },
  normal: { value: 1.0, label: 'Normal' },
  fast: { value: 1.3, label: 'Fast' },
  expert: { value: 1.6, label: 'Expert' },
} as const;

/** Hit zone position presets */
export const HIT_ZONE_PRESETS = {
  low: { value: 0.1, label: 'Low' },
  normal: { value: 0.15, label: 'Normal' },
  high: { value: 0.25, label: 'High' },
} as const;

/**
 * UI component for managing visual settings.
 */
export class VisualSettings {
  private readonly config: Required<VisualSettingsConfig>;
  private readonly visibilityController: VisibilityController;
  private state: VisualSettingsState;
  private listeners: Set<SettingsChangeCallback> = new Set();
  private isOpen: boolean = false;

  constructor(config: VisualSettingsConfig = {}) {
    this.config = {
      initialMode: config.initialMode ?? DEFAULT_CONFIG.initialMode,
      initialScrollSpeed: config.initialScrollSpeed ?? DEFAULT_CONFIG.initialScrollSpeed,
      initialHitZoneY: config.initialHitZoneY ?? DEFAULT_CONFIG.initialHitZoneY,
      highContrastMode: config.highContrastMode ?? DEFAULT_CONFIG.highContrastMode,
      reducedMotion: config.reducedMotion ?? DEFAULT_CONFIG.reducedMotion,
    };

    this.visibilityController = new VisibilityController({
      initialMode: this.config.initialMode,
    });

    this.state = {
      spectrogramMode: this.config.initialMode,
      scrollSpeedMultiplier: this.config.initialScrollSpeed,
      hitZoneY: this.config.initialHitZoneY,
      highContrastMode: this.config.highContrastMode,
      reducedMotion: this.config.reducedMotion,
    };

    // Sync visibility controller changes
    this.visibilityController.addListener((mode) => {
      this.state.spectrogramMode = mode;
      this.notifyListeners();
    });
  }

  /**
   * Opens the settings panel.
   */
  open(): void {
    this.isOpen = true;
  }

  /**
   * Closes the settings panel.
   */
  close(): void {
    this.isOpen = false;
  }

  /**
   * Toggles the settings panel.
   */
  toggle(): void {
    this.isOpen = !this.isOpen;
  }

  /**
   * Checks if settings panel is open.
   */
  isVisible(): boolean {
    return this.isOpen;
  }

  /**
   * Gets the current settings state.
   */
  getState(): VisualSettingsState {
    return { ...this.state };
  }

  /**
   * Gets the visibility controller.
   */
  getVisibilityController(): VisibilityController {
    return this.visibilityController;
  }

  // ==================== Spectrogram Mode ====================

  /**
   * Gets the current spectrogram mode.
   */
  getSpectrogramMode(): SpectrogramMode {
    return this.state.spectrogramMode;
  }

  /**
   * Sets the spectrogram mode.
   */
  setSpectrogramMode(mode: SpectrogramMode, immediate: boolean = true): void {
    this.visibilityController.setMode(mode, immediate);
    this.state.spectrogramMode = mode;
    this.notifyListeners();
  }

  /**
   * Cycles to the next spectrogram mode.
   */
  cycleSpectrogramMode(): SpectrogramMode {
    // Cycle modes directly for immediate effect
    const modes: SpectrogramMode[] = ['full', 'fading', 'none'];
    const currentIndex = modes.indexOf(this.state.spectrogramMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];

    this.setSpectrogramMode(newMode, true);
    return newMode;
  }

  /**
   * Gets available spectrogram modes with info.
   */
  getSpectrogramModes(): Array<{
    mode: SpectrogramMode;
    label: string;
    description: string;
    difficulty: 'easy' | 'medium' | 'hard';
    isSelected: boolean;
  }> {
    return (['full', 'fading', 'none'] as SpectrogramMode[]).map((mode) => ({
      mode,
      ...VISIBILITY_MODE_INFO[mode],
      isSelected: mode === this.state.spectrogramMode,
    }));
  }

  // ==================== Scroll Speed ====================

  /**
   * Gets the current scroll speed multiplier.
   */
  getScrollSpeed(): number {
    return this.state.scrollSpeedMultiplier;
  }

  /**
   * Sets the scroll speed multiplier.
   */
  setScrollSpeed(multiplier: number): void {
    this.state.scrollSpeedMultiplier = Math.max(0.5, Math.min(2.0, multiplier));
    this.notifyListeners();
  }

  /**
   * Sets scroll speed to a preset.
   */
  setScrollSpeedPreset(preset: keyof typeof SCROLL_SPEED_PRESETS): void {
    this.setScrollSpeed(SCROLL_SPEED_PRESETS[preset].value);
  }

  /**
   * Gets available scroll speed presets.
   */
  getScrollSpeedPresets(): Array<{
    key: string;
    value: number;
    label: string;
    isSelected: boolean;
  }> {
    return Object.entries(SCROLL_SPEED_PRESETS).map(([key, preset]) => ({
      key,
      ...preset,
      isSelected: Math.abs(this.state.scrollSpeedMultiplier - preset.value) < 0.05,
    }));
  }

  // ==================== Hit Zone Position ====================

  /**
   * Gets the hit zone Y position.
   */
  getHitZoneY(): number {
    return this.state.hitZoneY;
  }

  /**
   * Sets the hit zone Y position.
   */
  setHitZoneY(y: number): void {
    this.state.hitZoneY = Math.max(0.1, Math.min(0.3, y));
    this.notifyListeners();
  }

  /**
   * Sets hit zone to a preset.
   */
  setHitZonePreset(preset: keyof typeof HIT_ZONE_PRESETS): void {
    this.setHitZoneY(HIT_ZONE_PRESETS[preset].value);
  }

  /**
   * Gets available hit zone presets.
   */
  getHitZonePresets(): Array<{
    key: string;
    value: number;
    label: string;
    isSelected: boolean;
  }> {
    return Object.entries(HIT_ZONE_PRESETS).map(([key, preset]) => ({
      key,
      ...preset,
      isSelected: Math.abs(this.state.hitZoneY - preset.value) < 0.02,
    }));
  }

  // ==================== Accessibility ====================

  /**
   * Gets high contrast mode state.
   */
  isHighContrastMode(): boolean {
    return this.state.highContrastMode;
  }

  /**
   * Sets high contrast mode.
   */
  setHighContrastMode(enabled: boolean): void {
    this.state.highContrastMode = enabled;
    this.notifyListeners();
  }

  /**
   * Toggles high contrast mode.
   */
  toggleHighContrastMode(): boolean {
    this.state.highContrastMode = !this.state.highContrastMode;
    this.notifyListeners();
    return this.state.highContrastMode;
  }

  /**
   * Gets reduced motion state.
   */
  isReducedMotion(): boolean {
    return this.state.reducedMotion;
  }

  /**
   * Sets reduced motion mode.
   */
  setReducedMotion(enabled: boolean): void {
    this.state.reducedMotion = enabled;
    this.notifyListeners();
  }

  /**
   * Toggles reduced motion mode.
   */
  toggleReducedMotion(): boolean {
    this.state.reducedMotion = !this.state.reducedMotion;
    this.notifyListeners();
    return this.state.reducedMotion;
  }

  // ==================== Listeners ====================

  /**
   * Adds a settings change listener.
   */
  addListener(callback: SettingsChangeCallback): void {
    this.listeners.add(callback);
  }

  /**
   * Removes a settings change listener.
   */
  removeListener(callback: SettingsChangeCallback): void {
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

  // ==================== Render Data ====================

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    isOpen: boolean;
    state: VisualSettingsState;
    spectrogramModes: ReturnType<VisualSettings['getSpectrogramModes']>;
    scrollSpeedPresets: ReturnType<VisualSettings['getScrollSpeedPresets']>;
    hitZonePresets: ReturnType<VisualSettings['getHitZonePresets']>;
    visibilityData: ReturnType<VisibilityController['getRenderData']>;
    colors: typeof UI_COLORS;
  } {
    return {
      isOpen: this.isOpen,
      state: this.getState(),
      spectrogramModes: this.getSpectrogramModes(),
      scrollSpeedPresets: this.getScrollSpeedPresets(),
      hitZonePresets: this.getHitZonePresets(),
      visibilityData: this.visibilityController.getRenderData(),
      colors: UI_COLORS,
    };
  }

  /**
   * Gets a summary string of current settings.
   */
  getSummary(): string {
    const modeInfo = VISIBILITY_MODE_INFO[this.state.spectrogramMode];
    const speedPreset = this.getScrollSpeedPresets().find((p) => p.isSelected);

    return `Mode: ${modeInfo.label}, Speed: ${speedPreset?.label ?? 'Custom'}`;
  }

  // ==================== Persistence ====================

  /**
   * Exports settings to a JSON-serializable object.
   */
  exportSettings(): VisualSettingsState {
    return this.getState();
  }

  /**
   * Imports settings from a saved state.
   */
  importSettings(settings: Partial<VisualSettingsState>): void {
    if (settings.spectrogramMode) {
      this.setSpectrogramMode(settings.spectrogramMode);
    }
    if (settings.scrollSpeedMultiplier !== undefined) {
      this.setScrollSpeed(settings.scrollSpeedMultiplier);
    }
    if (settings.hitZoneY !== undefined) {
      this.setHitZoneY(settings.hitZoneY);
    }
    if (settings.highContrastMode !== undefined) {
      this.setHighContrastMode(settings.highContrastMode);
    }
    if (settings.reducedMotion !== undefined) {
      this.setReducedMotion(settings.reducedMotion);
    }
  }

  /**
   * Resets all settings to defaults.
   */
  reset(): void {
    this.visibilityController.reset();
    this.state = {
      spectrogramMode: this.config.initialMode,
      scrollSpeedMultiplier: this.config.initialScrollSpeed,
      hitZoneY: this.config.initialHitZoneY,
      highContrastMode: this.config.highContrastMode,
      reducedMotion: this.config.reducedMotion,
    };
    this.notifyListeners();
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<VisualSettingsConfig> {
    return { ...this.config };
  }
}
