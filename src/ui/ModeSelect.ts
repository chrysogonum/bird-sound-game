/**
 * ModeSelect - Mode selection menu for ChipNotes!
 *
 * Displays available game modes and allows selection.
 */

import type { GameMode } from '../game/types.js';
import type { ModeInfo, ModeSelectCallback } from '../modes/types.js';
import { UI_COLORS } from './types.js';

/** Mode display information */
const MODE_INFO: Record<GameMode, Omit<ModeInfo, 'mode' | 'unlocked'>> = {
  campaign: {
    displayName: 'Campaign',
    description: 'Progress through levels and unlock new challenges',
    icon: '🎯',
  },
  practice: {
    displayName: 'Practice',
    description: 'Focus on a single species with adjustable settings',
    icon: '📚',
  },
  challenge: {
    displayName: 'Challenge',
    description: 'Timed rounds with high-score tracking',
    icon: '🏆',
  },
  random: {
    displayName: 'Random Soundfield',
    description: 'Continuous random events until you quit',
    icon: '🎲',
  },
};

/** Mode select configuration */
export interface ModeSelectConfig {
  /** Initially unlocked modes (default: all) */
  unlockedModes?: GameMode[];
  /** Callback when a mode is selected */
  onSelect?: ModeSelectCallback;
}

/**
 * ModeSelect manages the mode selection UI.
 */
export class ModeSelect {
  private unlockedModes: Set<GameMode>;
  private selectedMode: GameMode | null = null;
  private visible: boolean = false;
  private onSelect: ModeSelectCallback | null;

  constructor(config: ModeSelectConfig = {}) {
    // Default: all modes unlocked
    const defaultModes: GameMode[] = ['campaign', 'practice', 'challenge', 'random'];
    this.unlockedModes = new Set(config.unlockedModes ?? defaultModes);
    this.onSelect = config.onSelect ?? null;
  }

  /**
   * Gets all available modes with their info.
   */
  getModes(): ModeInfo[] {
    const modes: GameMode[] = ['campaign', 'practice', 'challenge', 'random'];
    return modes.map((mode) => ({
      mode,
      ...MODE_INFO[mode],
      unlocked: this.unlockedModes.has(mode),
    }));
  }

  /**
   * Gets info for a specific mode.
   */
  getModeInfo(mode: GameMode): ModeInfo {
    return {
      mode,
      ...MODE_INFO[mode],
      unlocked: this.unlockedModes.has(mode),
    };
  }

  /**
   * Checks if a mode is unlocked.
   */
  isModeUnlocked(mode: GameMode): boolean {
    return this.unlockedModes.has(mode);
  }

  /**
   * Unlocks a mode.
   */
  unlockMode(mode: GameMode): void {
    this.unlockedModes.add(mode);
  }

  /**
   * Locks a mode.
   */
  lockMode(mode: GameMode): void {
    this.unlockedModes.delete(mode);
  }

  /**
   * Gets all unlocked modes.
   */
  getUnlockedModes(): GameMode[] {
    return Array.from(this.unlockedModes);
  }

  /**
   * Selects a mode.
   * @param mode The mode to select
   * @returns True if mode was selected (unlocked), false otherwise
   */
  selectMode(mode: GameMode): boolean {
    if (!this.unlockedModes.has(mode)) {
      return false;
    }

    this.selectedMode = mode;
    this.onSelect?.(mode);
    return true;
  }

  /**
   * Gets the currently selected mode.
   */
  getSelectedMode(): GameMode | null {
    return this.selectedMode;
  }

  /**
   * Clears the selection.
   */
  clearSelection(): void {
    this.selectedMode = null;
  }

  /**
   * Shows the mode selection menu.
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Hides the mode selection menu.
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Checks if the menu is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Handles a tap on a mode item.
   * @param mode The mode that was tapped
   * @returns True if mode was selected
   */
  handleTap(mode: GameMode): boolean {
    return this.selectMode(mode);
  }

  /**
   * Sets the select callback.
   */
  setOnSelect(callback: ModeSelectCallback | null): void {
    this.onSelect = callback;
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    visible: boolean;
    modes: ModeInfo[];
    selectedMode: GameMode | null;
    colors: typeof UI_COLORS;
  } {
    return {
      visible: this.visible,
      modes: this.getModes(),
      selectedMode: this.selectedMode,
      colors: UI_COLORS,
    };
  }

  /**
   * Gets CSS class for a mode item.
   */
  getModeClass(mode: GameMode): string {
    const classes = ['mode-item'];

    if (!this.unlockedModes.has(mode)) {
      classes.push('mode-locked');
    }

    if (this.selectedMode === mode) {
      classes.push('mode-selected');
    }

    return classes.join(' ');
  }

  /**
   * Gets the display name for a mode.
   */
  getDisplayName(mode: GameMode): string {
    return MODE_INFO[mode].displayName;
  }

  /**
   * Gets the description for a mode.
   */
  getDescription(mode: GameMode): string {
    return MODE_INFO[mode].description;
  }

  /**
   * Gets the icon for a mode.
   */
  getIcon(mode: GameMode): string {
    return MODE_INFO[mode].icon;
  }
}
