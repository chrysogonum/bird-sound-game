/**
 * ConfusionMatrix - Species confusion visualization for SoundField: Birds
 *
 * Displays:
 * - Grid of species pairs
 * - Confusion counts with color intensity
 * - Highlights pairs with >2 confusions
 */

import type { ScoringResult } from '../scoring/types.js';
import type { ConfusionPair } from './types.js';
import { UI_COLORS } from './types.js';

/** Species name mapping */
const SPECIES_NAMES: Record<string, string> = {
  NOCA: 'Northern Cardinal',
  BLJA: 'Blue Jay',
  CARW: 'Carolina Wren',
  AMCR: 'American Crow',
  TUTI: 'Tufted Titmouse',
  EABL: 'Eastern Bluebird',
  MODO: 'Mourning Dove',
  AMRO: 'American Robin',
  PYNU: 'Pyrrhuloxia',
  RBWO: 'Red-bellied Woodpecker',
  DOWO: 'Downy Woodpecker',
  PIWO: 'Pileated Woodpecker',
};

/** Matrix cell data */
export interface MatrixCell {
  rowSpecies: string;
  colSpecies: string;
  count: number;
  isHighlighted: boolean;
  intensity: number; // 0-1 scale for color intensity
}

/** Confusion matrix configuration */
export interface ConfusionMatrixConfig {
  highlightThreshold?: number; // Minimum count to highlight (default: 2)
  showZeroCells?: boolean; // Whether to show cells with 0 confusions
}

/** Default configuration */
const DEFAULT_CONFIG: Required<ConfusionMatrixConfig> = {
  highlightThreshold: 2,
  showZeroCells: false,
};

/**
 * ConfusionMatrix handles species confusion visualization.
 */
export class ConfusionMatrix {
  private readonly config: Required<ConfusionMatrixConfig>;
  private species: string[] = [];
  private confusionCounts: Map<string, number> = new Map();
  private maxCount: number = 0;

  constructor(config: ConfusionMatrixConfig = {}) {
    this.config = {
      highlightThreshold: config.highlightThreshold ?? DEFAULT_CONFIG.highlightThreshold,
      showZeroCells: config.showZeroCells ?? DEFAULT_CONFIG.showZeroCells,
    };
  }

  /**
   * Builds the confusion matrix from scoring history.
   * @param history Array of scoring results
   */
  buildFromHistory(history: ScoringResult[]): void {
    const speciesSet = new Set<string>();
    this.confusionCounts.clear();
    this.maxCount = 0;

    for (const result of history) {
      const expected = result.event.expectedSpecies;
      speciesSet.add(expected);

      // Track confusions (where species was wrong)
      if (!result.breakdown.speciesCorrect && result.input.speciesCode) {
        const actual = result.input.speciesCode;
        speciesSet.add(actual);

        const key = this.makeKey(expected, actual);
        const newCount = (this.confusionCounts.get(key) ?? 0) + 1;
        this.confusionCounts.set(key, newCount);
        this.maxCount = Math.max(this.maxCount, newCount);
      }
    }

    this.species = Array.from(speciesSet).sort();
  }

  /**
   * Gets all species in the matrix.
   */
  getSpecies(): string[] {
    return [...this.species];
  }

  /**
   * Gets the confusion count between two species.
   */
  getConfusionCount(speciesA: string, speciesB: string): number {
    const key = this.makeKey(speciesA, speciesB);
    return this.confusionCounts.get(key) ?? 0;
  }

  /**
   * Checks if a species pair is highlighted (exceeds threshold).
   */
  isHighlighted(speciesA: string, speciesB: string): boolean {
    return this.getConfusionCount(speciesA, speciesB) > this.config.highlightThreshold;
  }

  /**
   * Gets all highlighted confusion pairs.
   */
  getHighlightedPairs(): ConfusionPair[] {
    const pairs: ConfusionPair[] = [];

    for (const [key, count] of this.confusionCounts) {
      if (count > this.config.highlightThreshold) {
        const [speciesA, speciesB] = key.split(':');
        pairs.push({
          speciesA,
          speciesB,
          speciesAName: this.getSpeciesName(speciesA),
          speciesBName: this.getSpeciesName(speciesB),
          count,
        });
      }
    }

    return pairs.sort((a, b) => b.count - a.count);
  }

  /**
   * Gets all confusion pairs sorted by count.
   */
  getAllPairs(): ConfusionPair[] {
    const pairs: ConfusionPair[] = [];

    for (const [key, count] of this.confusionCounts) {
      const [speciesA, speciesB] = key.split(':');
      pairs.push({
        speciesA,
        speciesB,
        speciesAName: this.getSpeciesName(speciesA),
        speciesBName: this.getSpeciesName(speciesB),
        count,
      });
    }

    return pairs.sort((a, b) => b.count - a.count);
  }

  /**
   * Gets the full matrix data for rendering.
   */
  getMatrixData(): MatrixCell[][] {
    const matrix: MatrixCell[][] = [];

    for (const rowSpecies of this.species) {
      const row: MatrixCell[] = [];
      for (const colSpecies of this.species) {
        if (rowSpecies === colSpecies) {
          // Diagonal - not applicable
          row.push({
            rowSpecies,
            colSpecies,
            count: 0,
            isHighlighted: false,
            intensity: 0,
          });
        } else {
          const count = this.getConfusionCount(rowSpecies, colSpecies);
          if (count > 0 || this.config.showZeroCells) {
            row.push({
              rowSpecies,
              colSpecies,
              count,
              isHighlighted: count > this.config.highlightThreshold,
              intensity: this.maxCount > 0 ? count / this.maxCount : 0,
            });
          }
        }
      }
      matrix.push(row);
    }

    return matrix;
  }

  /**
   * Gets the color for a cell based on confusion intensity.
   */
  getCellColor(intensity: number, isHighlighted: boolean): string {
    if (isHighlighted) {
      return UI_COLORS.CONFUSION_HIGH;
    }
    if (intensity > 0.5) {
      return UI_COLORS.CONFUSION_MEDIUM;
    }
    if (intensity > 0) {
      return UI_COLORS.CONFUSION_LOW;
    }
    return 'transparent';
  }

  /**
   * Gets CSS class for a cell.
   */
  getCellClass(count: number): string {
    if (count > this.config.highlightThreshold) {
      return 'confusion-cell confusion-high';
    }
    if (count > 0) {
      return 'confusion-cell confusion-low';
    }
    return 'confusion-cell confusion-none';
  }

  /**
   * Gets the species name from code.
   */
  getSpeciesName(code: string): string {
    return SPECIES_NAMES[code] ?? code;
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    species: Array<{ code: string; name: string }>;
    highlightedPairs: ConfusionPair[];
    matrix: MatrixCell[][];
    maxCount: number;
    colors: typeof UI_COLORS;
  } {
    return {
      species: this.species.map((code) => ({
        code,
        name: this.getSpeciesName(code),
      })),
      highlightedPairs: this.getHighlightedPairs(),
      matrix: this.getMatrixData(),
      maxCount: this.maxCount,
      colors: UI_COLORS,
    };
  }

  /**
   * Checks if there are any confusions.
   */
  hasConfusions(): boolean {
    return this.confusionCounts.size > 0;
  }

  /**
   * Gets the total number of confusions.
   */
  getTotalConfusions(): number {
    let total = 0;
    for (const count of this.confusionCounts.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Creates a canonical key for a species pair.
   */
  private makeKey(speciesA: string, speciesB: string): string {
    const [a, b] = [speciesA, speciesB].sort();
    return `${a}:${b}`;
  }

  /**
   * Clears the matrix data.
   */
  clear(): void {
    this.species = [];
    this.confusionCounts.clear();
    this.maxCount = 0;
  }

  /**
   * Registers species names.
   */
  static registerSpeciesNames(names: Record<string, string>): void {
    Object.assign(SPECIES_NAMES, names);
  }
}
