/**
 * RadialWheel - Species selection UI component for SoundField: Birds
 *
 * Displays 8-12 species icons in a radial arrangement.
 * Players tap species icons to make selections.
 */

import type { SpeciesIcon, WheelConfig, InputListener, SpeciesSelectionEvent } from './types.js';

/** Default wheel configuration */
const DEFAULT_CONFIG: Required<Omit<WheelConfig, 'species'>> = {
  radius: 150,
  centerX: 0,
  centerY: 0,
};

/**
 * RadialWheel manages a circular species selection interface.
 */
export class RadialWheel {
  private readonly config: Required<Omit<WheelConfig, 'species'>>;
  private species: SpeciesIcon[] = [];
  private readonly listeners: Set<InputListener> = new Set();
  private selectedSpecies: string | null = null;
  private enabled: boolean = true;

  /** Reference time for input timestamps */
  private referenceTimeMs: number = 0;

  constructor(config: WheelConfig = { species: [] }) {
    this.config = {
      ...DEFAULT_CONFIG,
      radius: config.radius ?? DEFAULT_CONFIG.radius,
      centerX: config.centerX ?? DEFAULT_CONFIG.centerX,
      centerY: config.centerY ?? DEFAULT_CONFIG.centerY,
    };
    this.setSpecies(config.species);
  }

  /**
   * Sets the species to display on the wheel.
   * Automatically calculates positions for even distribution.
   * @param species Array of species icons (max 12)
   */
  setSpecies(species: SpeciesIcon[]): void {
    if (species.length > 12) {
      throw new Error('RadialWheel supports a maximum of 12 species');
    }

    // Auto-calculate angles if not provided
    this.species = species.map((s, index) => ({
      ...s,
      angle: s.angle ?? (index * (360 / species.length)),
    }));
  }

  /**
   * Gets the current species on the wheel.
   */
  getSpecies(): SpeciesIcon[] {
    return [...this.species];
  }

  /**
   * Gets the number of species on the wheel.
   */
  getSpeciesCount(): number {
    return this.species.length;
  }

  /**
   * Checks if a species code is on the wheel.
   */
  hasSpecies(speciesCode: string): boolean {
    return this.species.some((s) => s.speciesCode === speciesCode);
  }

  /**
   * Sets the reference time for input timestamps.
   * @param timeMs Reference time in milliseconds
   */
  setReferenceTime(timeMs: number): void {
    this.referenceTimeMs = timeMs;
  }

  /**
   * Gets the position of a species icon.
   * @param speciesCode The species code
   * @returns Position object with x, y coordinates, or null if not found
   */
  getSpeciesPosition(speciesCode: string): { x: number; y: number } | null {
    const species = this.species.find((s) => s.speciesCode === speciesCode);
    if (!species) return null;

    const angleRad = (species.angle * Math.PI) / 180;
    return {
      x: this.config.centerX + this.config.radius * Math.cos(angleRad),
      y: this.config.centerY + this.config.radius * Math.sin(angleRad),
    };
  }

  /**
   * Gets all species positions for rendering.
   */
  getAllPositions(): Array<{ species: SpeciesIcon; x: number; y: number }> {
    return this.species.map((species) => {
      const angleRad = (species.angle * Math.PI) / 180;
      return {
        species,
        x: this.config.centerX + this.config.radius * Math.cos(angleRad),
        y: this.config.centerY + this.config.radius * Math.sin(angleRad),
      };
    });
  }

  /**
   * Handles a tap/click at specific coordinates.
   * @param x X coordinate of tap
   * @param y Y coordinate of tap
   * @param hitRadius Radius around icon center for hit detection (default: 40)
   * @returns The selected species code, or null if no hit
   */
  handleTap(x: number, y: number, hitRadius: number = 40): string | null {
    if (!this.enabled) return null;

    for (const species of this.species) {
      const pos = this.getSpeciesPosition(species.speciesCode);
      if (!pos) continue;

      const distance = Math.sqrt((x - pos.x) ** 2 + (y - pos.y) ** 2);
      if (distance <= hitRadius) {
        this.selectSpecies(species.speciesCode);
        return species.speciesCode;
      }
    }

    return null;
  }

  /**
   * Selects a species by code.
   * @param speciesCode The species code to select
   */
  selectSpecies(speciesCode: string): void {
    if (!this.enabled) return;
    if (!this.hasSpecies(speciesCode)) return;

    this.selectedSpecies = speciesCode;

    const event: SpeciesSelectionEvent = {
      type: 'species_selection',
      speciesCode,
      timestampMs: Date.now() - this.referenceTimeMs,
    };

    this.notifyListeners(event);
  }

  /**
   * Gets the currently selected species.
   */
  getSelectedSpecies(): string | null {
    return this.selectedSpecies;
  }

  /**
   * Clears the current selection.
   */
  clearSelection(): void {
    this.selectedSpecies = null;
  }

  /**
   * Enables or disables the wheel.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if the wheel is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Adds an input listener.
   */
  addListener(listener: InputListener): void {
    this.listeners.add(listener);
  }

  /**
   * Removes an input listener.
   */
  removeListener(listener: InputListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Gets the wheel configuration.
   */
  getConfig(): Required<Omit<WheelConfig, 'species'>> {
    return { ...this.config };
  }

  /**
   * Notifies all listeners of an input event.
   */
  private notifyListeners(event: SpeciesSelectionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
