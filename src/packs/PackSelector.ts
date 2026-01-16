/**
 * PackSelector - UI for Pack selection for ChipNotes!
 *
 * Features:
 * - Display available packs
 * - Pack selection
 * - Show pack details (species count, modifiers)
 */

import type { Pack, PackInfo, PackSelectCallback } from './types.js';
import { UI_COLORS } from '../ui/types.js';

/** Pack selector configuration */
export interface PackSelectorConfig {
  /** Available packs */
  packs: Pack[];
  /** Initially unlocked pack IDs (default: all) */
  unlockedPacks?: string[];
  /** Callback when a pack is selected */
  onSelect?: PackSelectCallback;
}

/**
 * PackSelector manages pack selection UI.
 */
export class PackSelector {
  private readonly packs: Map<string, Pack> = new Map();
  private unlockedPacks: Set<string>;
  private selectedPackId: string | null = null;
  private visible: boolean = false;
  private onSelect: PackSelectCallback | null;

  constructor(config: PackSelectorConfig) {
    // Store packs
    for (const pack of config.packs) {
      this.packs.set(pack.packId, pack);
    }

    // Set unlocked packs (default: all)
    if (config.unlockedPacks) {
      this.unlockedPacks = new Set(config.unlockedPacks);
    } else {
      this.unlockedPacks = new Set(this.packs.keys());
    }

    this.onSelect = config.onSelect ?? null;
  }

  /**
   * Gets all packs with their info.
   */
  getPacks(): PackInfo[] {
    const result: PackInfo[] = [];
    for (const pack of this.packs.values()) {
      result.push({
        pack,
        speciesCount: pack.species.length,
        unlocked: this.unlockedPacks.has(pack.packId),
      });
    }
    return result;
  }

  /**
   * Gets a specific pack.
   */
  getPack(packId: string): Pack | null {
    return this.packs.get(packId) ?? null;
  }

  /**
   * Gets pack info.
   */
  getPackInfo(packId: string): PackInfo | null {
    const pack = this.packs.get(packId);
    if (!pack) return null;
    return {
      pack,
      speciesCount: pack.species.length,
      unlocked: this.unlockedPacks.has(packId),
    };
  }

  /**
   * Checks if a pack is unlocked.
   */
  isPackUnlocked(packId: string): boolean {
    return this.unlockedPacks.has(packId);
  }

  /**
   * Unlocks a pack.
   */
  unlockPack(packId: string): void {
    this.unlockedPacks.add(packId);
  }

  /**
   * Locks a pack.
   */
  lockPack(packId: string): void {
    this.unlockedPacks.delete(packId);
  }

  /**
   * Gets all unlocked pack IDs.
   */
  getUnlockedPackIds(): string[] {
    return Array.from(this.unlockedPacks);
  }

  /**
   * Selects a pack.
   * @param packId The pack to select
   * @returns True if pack was selected (exists and unlocked)
   */
  selectPack(packId: string): boolean {
    const pack = this.packs.get(packId);
    if (!pack) return false;
    if (!this.unlockedPacks.has(packId)) return false;

    this.selectedPackId = packId;
    this.onSelect?.(pack);
    return true;
  }

  /**
   * Gets the currently selected pack.
   */
  getSelectedPack(): Pack | null {
    if (!this.selectedPackId) return null;
    return this.packs.get(this.selectedPackId) ?? null;
  }

  /**
   * Gets the selected pack ID.
   */
  getSelectedPackId(): string | null {
    return this.selectedPackId;
  }

  /**
   * Clears the selection.
   */
  clearSelection(): void {
    this.selectedPackId = null;
  }

  /**
   * Shows the pack selector.
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Hides the pack selector.
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Checks if the selector is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Handles a tap on a pack item.
   */
  handleTap(packId: string): boolean {
    return this.selectPack(packId);
  }

  /**
   * Sets the select callback.
   */
  setOnSelect(callback: PackSelectCallback | null): void {
    this.onSelect = callback;
  }

  /**
   * Adds packs to the selector.
   */
  addPacks(packs: Pack[], unlocked: boolean = true): void {
    for (const pack of packs) {
      this.packs.set(pack.packId, pack);
      if (unlocked) {
        this.unlockedPacks.add(pack.packId);
      }
    }
  }

  /**
   * Removes a pack from the selector.
   */
  removePack(packId: string): void {
    this.packs.delete(packId);
    this.unlockedPacks.delete(packId);
    if (this.selectedPackId === packId) {
      this.selectedPackId = null;
    }
  }

  /**
   * Gets the species list for the selected pack.
   */
  getSelectedPackSpecies(): string[] {
    const pack = this.getSelectedPack();
    return pack ? [...pack.species] : [];
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    visible: boolean;
    packs: PackInfo[];
    selectedPackId: string | null;
    colors: typeof UI_COLORS;
  } {
    return {
      visible: this.visible,
      packs: this.getPacks(),
      selectedPackId: this.selectedPackId,
      colors: UI_COLORS,
    };
  }

  /**
   * Gets CSS class for a pack item.
   */
  getPackClass(packId: string): string {
    const classes = ['pack-item'];

    if (!this.unlockedPacks.has(packId)) {
      classes.push('pack-locked');
    }

    if (this.selectedPackId === packId) {
      classes.push('pack-selected');
    }

    return classes.join(' ');
  }

  /**
   * Gets the pack count.
   */
  getPackCount(): number {
    return this.packs.size;
  }

  /**
   * Gets the unlocked pack count.
   */
  getUnlockedPackCount(): number {
    return this.unlockedPacks.size;
  }

  /**
   * Filters packs by seasonal context.
   */
  getPacksBySeason(season: string): PackInfo[] {
    return this.getPacks().filter(
      (info) => info.pack.seasonalContext === season
    );
  }

  /**
   * Gets packs sorted by species count.
   */
  getPacksBySpeciesCount(ascending: boolean = true): PackInfo[] {
    const packs = this.getPacks();
    return packs.sort((a, b) =>
      ascending
        ? a.speciesCount - b.speciesCount
        : b.speciesCount - a.speciesCount
    );
  }
}
