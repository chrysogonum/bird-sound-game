/**
 * RoundSummary - End-of-round statistics display for SoundField: Birds
 *
 * Displays:
 * - Overall accuracy percentage
 * - Per-species breakdown
 * - Score summary
 * - Retry/next/menu options
 */

import type { RoundStats } from '../game/types.js';
import type { ScoringResult, ScoreState } from '../scoring/types.js';
import type {
  RoundSummaryData,
  SpeciesBreakdown,
  ConfusionPair,
  RoundSummaryCallback,
} from './types.js';
import { UI_COLORS, UI_ANIMATIONS } from './types.js';

/** Species name mapping (should be loaded from data) */
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

/** Configuration for RoundSummary */
export interface RoundSummaryConfig {
  showSpeciesBreakdown?: boolean;
  showConfusionPairs?: boolean;
  onAction?: RoundSummaryCallback;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<Omit<RoundSummaryConfig, 'onAction'>> = {
  showSpeciesBreakdown: true,
  showConfusionPairs: true,
};

/**
 * RoundSummary handles end-of-round statistics display.
 */
export class RoundSummary {
  private readonly config: Required<Omit<RoundSummaryConfig, 'onAction'>>;
  private onAction: RoundSummaryCallback | null;
  private data: RoundSummaryData | null = null;
  private visible: boolean = false;

  constructor(config: RoundSummaryConfig = {}) {
    this.config = {
      showSpeciesBreakdown: config.showSpeciesBreakdown ?? DEFAULT_CONFIG.showSpeciesBreakdown,
      showConfusionPairs: config.showConfusionPairs ?? DEFAULT_CONFIG.showConfusionPairs,
    };
    this.onAction = config.onAction ?? null;
  }

  /**
   * Shows the round summary with the given data.
   * @param stats Round statistics
   * @param scoringHistory History of scoring results
   * @param levelId The level that was played
   * @param durationMs Round duration in milliseconds
   */
  show(
    stats: RoundStats,
    scoringHistory: ScoringResult[],
    levelId: number,
    durationMs: number
  ): void {
    const speciesBreakdowns = this.calculateSpeciesBreakdowns(scoringHistory);
    const confusionPairs = this.calculateConfusionPairs(scoringHistory);

    this.data = {
      stats,
      speciesBreakdowns,
      confusionPairs,
      duration: durationMs,
      levelId,
    };

    this.visible = true;
  }

  /**
   * Hides the round summary.
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Checks if the summary is currently visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  /**
   * Gets the current summary data.
   */
  getData(): RoundSummaryData | null {
    return this.data;
  }

  /**
   * Gets the overall accuracy percentage.
   */
  getAccuracyPercent(): number {
    if (!this.data) return 0;
    return this.data.stats.accuracy;
  }

  /**
   * Gets the formatted accuracy string (e.g., "80%").
   */
  getFormattedAccuracy(): string {
    return `${Math.round(this.getAccuracyPercent())}%`;
  }

  /**
   * Gets per-species breakdowns.
   */
  getSpeciesBreakdowns(): SpeciesBreakdown[] {
    if (!this.data) return [];
    return this.data.speciesBreakdowns;
  }

  /**
   * Gets confusion pairs (pairs with count > 2 highlighted).
   */
  getConfusionPairs(): ConfusionPair[] {
    if (!this.data) return [];
    return this.data.confusionPairs;
  }

  /**
   * Gets highlighted confusion pairs (count > 2).
   */
  getHighlightedConfusionPairs(): ConfusionPair[] {
    return this.getConfusionPairs().filter((pair) => pair.count > 2);
  }

  /**
   * Triggers the retry action.
   */
  retry(): void {
    this.onAction?.('retry');
  }

  /**
   * Triggers the next level action.
   */
  next(): void {
    this.onAction?.('next');
  }

  /**
   * Triggers the menu action.
   */
  menu(): void {
    this.onAction?.('menu');
  }

  /**
   * Sets the action callback.
   */
  setOnAction(callback: RoundSummaryCallback | null): void {
    this.onAction = callback;
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    visible: boolean;
    accuracy: string;
    totalScore: number;
    perfectCount: number;
    missCount: number;
    speciesBreakdowns: SpeciesBreakdown[];
    confusionPairs: ConfusionPair[];
    colors: typeof UI_COLORS;
  } {
    return {
      visible: this.visible,
      accuracy: this.getFormattedAccuracy(),
      totalScore: this.data?.stats.totalScore ?? 0,
      perfectCount: this.data?.stats.perfectCount ?? 0,
      missCount: this.data?.stats.missCount ?? 0,
      speciesBreakdowns: this.getSpeciesBreakdowns(),
      confusionPairs: this.getHighlightedConfusionPairs(),
      colors: UI_COLORS,
    };
  }

  /**
   * Calculates per-species breakdown from scoring history.
   */
  private calculateSpeciesBreakdowns(history: ScoringResult[]): SpeciesBreakdown[] {
    const bySpecies = new Map<string, { total: number; correct: number }>();

    for (const result of history) {
      const species = result.event.expectedSpecies;
      const current = bySpecies.get(species) ?? { total: 0, correct: 0 };
      current.total++;
      if (result.breakdown.speciesCorrect) {
        current.correct++;
      }
      bySpecies.set(species, current);
    }

    const breakdowns: SpeciesBreakdown[] = [];
    for (const [speciesCode, data] of bySpecies) {
      breakdowns.push({
        speciesCode,
        commonName: SPECIES_NAMES[speciesCode] ?? speciesCode,
        totalEvents: data.total,
        correctCount: data.correct,
        accuracy: data.total > 0 ? (data.correct / data.total) * 100 : 0,
      });
    }

    // Sort by accuracy (lowest first for areas needing improvement)
    return breakdowns.sort((a, b) => a.accuracy - b.accuracy);
  }

  /**
   * Calculates confusion pairs from scoring history.
   */
  private calculateConfusionPairs(history: ScoringResult[]): ConfusionPair[] {
    const confusions = new Map<string, number>();

    for (const result of history) {
      // Only track confusions where species was incorrect
      if (!result.breakdown.speciesCorrect && result.input.speciesCode) {
        const expected = result.event.expectedSpecies;
        const actual = result.input.speciesCode;

        // Create a canonical key (alphabetically sorted)
        const [a, b] = [expected, actual].sort();
        const key = `${a}:${b}`;

        confusions.set(key, (confusions.get(key) ?? 0) + 1);
      }
    }

    const pairs: ConfusionPair[] = [];
    for (const [key, count] of confusions) {
      const [speciesA, speciesB] = key.split(':');
      pairs.push({
        speciesA,
        speciesB,
        speciesAName: SPECIES_NAMES[speciesA] ?? speciesA,
        speciesBName: SPECIES_NAMES[speciesB] ?? speciesB,
        count,
      });
    }

    // Sort by count (highest first)
    return pairs.sort((a, b) => b.count - a.count);
  }

  /**
   * Gets CSS classes for accuracy indicator.
   */
  getAccuracyClass(): string {
    const accuracy = this.getAccuracyPercent();
    if (accuracy >= 90) return 'accuracy-excellent';
    if (accuracy >= 70) return 'accuracy-good';
    if (accuracy >= 50) return 'accuracy-average';
    return 'accuracy-needs-work';
  }

  /**
   * Gets a descriptive message for the accuracy.
   */
  getAccuracyMessage(): string {
    const accuracy = this.getAccuracyPercent();
    if (accuracy >= 90) return 'Excellent!';
    if (accuracy >= 70) return 'Good job!';
    if (accuracy >= 50) return 'Keep practicing!';
    return 'Try again!';
  }

  /**
   * Registers the species name mapping.
   */
  static registerSpeciesNames(names: Record<string, string>): void {
    Object.assign(SPECIES_NAMES, names);
  }
}
