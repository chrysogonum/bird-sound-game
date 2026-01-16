/**
 * ConfusionTracker - Persistent confusion pattern tracking for ChipNotes!
 *
 * Tracks:
 * - Species confusion pairs across games
 * - Confusion frequency and recency
 * - Improvement tracking over time
 * - Targeted practice recommendations
 */

import type { ScoringResult } from '../scoring/types.js';
import type { ConfusionPair } from '../storage/types.js';

/** Confusion entry with additional analytics */
export interface ConfusionEntry {
  /** First species code */
  speciesA: string;
  /** Second species code */
  speciesB: string;
  /** Total confusion count */
  count: number;
  /** Last confused timestamp */
  lastConfused: number;
  /** First confused timestamp */
  firstConfused: number;
  /** Recent confusion count (last 7 days) */
  recentCount: number;
  /** Has this been drilled (practiced) */
  drilled: boolean;
  /** Last drilled timestamp */
  lastDrilled: number | null;
  /** Improvement score (-1 to 1, positive = improving) */
  improvement: number;
}

/** Confusion tracker configuration */
export interface ConfusionTrackerConfig {
  /** Threshold for highlighting a confusion (minimum count) */
  highlightThreshold?: number;
  /** Days to consider for "recent" confusion count */
  recentDays?: number;
  /** Maximum entries to track */
  maxEntries?: number;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<ConfusionTrackerConfig> = {
  highlightThreshold: 2,
  recentDays: 7,
  maxEntries: 100,
};

/** Drill recommendation */
export interface DrillRecommendation {
  /** Species A code */
  speciesA: string;
  /** Species A name */
  speciesAName: string;
  /** Species B code */
  speciesB: string;
  /** Species B name */
  speciesBName: string;
  /** Confusion count */
  count: number;
  /** Priority (0-1, higher = more important to drill) */
  priority: number;
  /** Reason for recommendation */
  reason: string;
}

/** Species name lookup */
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
  HAWO: 'Hairy Woodpecker',
  WBNU: 'White-breasted Nuthatch',
  CACH: 'Carolina Chickadee',
  EATO: 'Eastern Towhee',
  CHSP: 'Chipping Sparrow',
  SOSP: 'Song Sparrow',
  WTSP: 'White-throated Sparrow',
  FISP: 'Field Sparrow',
};

/**
 * Tracks confusion patterns across gameplay sessions.
 */
export class ConfusionTracker {
  private readonly config: Required<ConfusionTrackerConfig>;
  private entries: Map<string, ConfusionEntry> = new Map();
  private sessionConfusions: Map<string, number> = new Map();

  constructor(config: ConfusionTrackerConfig = {}) {
    this.config = {
      highlightThreshold: config.highlightThreshold ?? DEFAULT_CONFIG.highlightThreshold,
      recentDays: config.recentDays ?? DEFAULT_CONFIG.recentDays,
      maxEntries: config.maxEntries ?? DEFAULT_CONFIG.maxEntries,
    };
  }

  /**
   * Records a confusion from a scoring result.
   */
  recordConfusion(result: ScoringResult): void {
    // Only track confusions (wrong species)
    if (result.breakdown.speciesCorrect || !result.input.speciesCode) {
      return;
    }

    const expected = result.event.expectedSpecies;
    const actual = result.input.speciesCode;

    this.addConfusion(expected, actual);
  }

  /**
   * Records multiple confusions from scoring history.
   */
  recordFromHistory(history: ScoringResult[]): void {
    for (const result of history) {
      this.recordConfusion(result);
    }
  }

  /**
   * Adds a confusion between two species.
   */
  addConfusion(speciesA: string, speciesB: string): void {
    const key = this.makeKey(speciesA, speciesB);
    const now = Date.now();

    let entry = this.entries.get(key);

    if (!entry) {
      entry = {
        speciesA: speciesA < speciesB ? speciesA : speciesB,
        speciesB: speciesA < speciesB ? speciesB : speciesA,
        count: 0,
        lastConfused: now,
        firstConfused: now,
        recentCount: 0,
        drilled: false,
        lastDrilled: null,
        improvement: 0,
      };
      this.entries.set(key, entry);
    }

    entry.count++;
    entry.lastConfused = now;
    entry.recentCount++;

    // Track session confusions
    this.sessionConfusions.set(key, (this.sessionConfusions.get(key) ?? 0) + 1);

    // Enforce max entries
    this.pruneEntries();
  }

  /**
   * Marks a confusion pair as drilled (practiced).
   */
  markDrilled(speciesA: string, speciesB: string): void {
    const key = this.makeKey(speciesA, speciesB);
    let entry = this.entries.get(key);

    // Create entry if it doesn't exist (allows proactive drilling)
    if (!entry) {
      const now = Date.now();
      entry = {
        speciesA: speciesA < speciesB ? speciesA : speciesB,
        speciesB: speciesA < speciesB ? speciesB : speciesA,
        count: 0,
        lastConfused: now,
        firstConfused: now,
        recentCount: 0,
        drilled: false,
        lastDrilled: null,
        improvement: 0,
      };
      this.entries.set(key, entry);
    }

    entry.drilled = true;
    entry.lastDrilled = Date.now();
  }

  /**
   * Records improvement for a confusion pair.
   */
  recordImprovement(speciesA: string, speciesB: string, improved: boolean): void {
    const key = this.makeKey(speciesA, speciesB);
    const entry = this.entries.get(key);

    if (entry) {
      // Exponential moving average of improvement
      const delta = improved ? 0.2 : -0.1;
      entry.improvement = Math.max(-1, Math.min(1, entry.improvement + delta));
    }
  }

  /**
   * Gets a confusion entry.
   */
  getEntry(speciesA: string, speciesB: string): ConfusionEntry | undefined {
    const key = this.makeKey(speciesA, speciesB);
    return this.entries.get(key);
  }

  /**
   * Gets the confusion count for a pair.
   */
  getConfusionCount(speciesA: string, speciesB: string): number {
    return this.getEntry(speciesA, speciesB)?.count ?? 0;
  }

  /**
   * Checks if a pair is highlighted (exceeds threshold).
   */
  isHighlighted(speciesA: string, speciesB: string): boolean {
    return this.getConfusionCount(speciesA, speciesB) > this.config.highlightThreshold;
  }

  /**
   * Gets all confusion entries sorted by count.
   */
  getAllEntries(): ConfusionEntry[] {
    return Array.from(this.entries.values()).sort((a, b) => b.count - a.count);
  }

  /**
   * Gets highlighted entries (above threshold).
   */
  getHighlightedEntries(): ConfusionEntry[] {
    return this.getAllEntries().filter((e) => e.count > this.config.highlightThreshold);
  }

  /**
   * Gets entries that haven't been drilled.
   */
  getUndrilledEntries(): ConfusionEntry[] {
    return this.getAllEntries().filter((e) => !e.drilled && e.count > this.config.highlightThreshold);
  }

  /**
   * Gets entries with recent confusions.
   */
  getRecentEntries(): ConfusionEntry[] {
    this.updateRecentCounts();
    return this.getAllEntries().filter((e) => e.recentCount > 0);
  }

  /**
   * Gets entries showing decline (negative improvement).
   */
  getDecliningEntries(): ConfusionEntry[] {
    return this.getAllEntries().filter((e) => e.improvement < -0.2);
  }

  /**
   * Gets drill recommendations based on confusion data.
   */
  getDrillRecommendations(maxRecommendations: number = 3): DrillRecommendation[] {
    const entries = this.getAllEntries();
    const recommendations: DrillRecommendation[] = [];

    for (const entry of entries) {
      if (entry.count <= this.config.highlightThreshold) {
        continue;
      }

      // Calculate priority based on multiple factors
      let priority = 0;
      let reason = '';

      // High count = high priority
      const countFactor = Math.min(1, entry.count / 10);
      priority += countFactor * 0.4;

      // Recent confusions = higher priority
      const recentFactor = Math.min(1, entry.recentCount / 5);
      priority += recentFactor * 0.3;

      // Not drilled = higher priority
      if (!entry.drilled) {
        priority += 0.2;
        reason = 'Frequently confused, not yet practiced';
      } else if (entry.improvement < 0) {
        priority += 0.1;
        reason = 'Previously practiced but still struggling';
      } else {
        reason = 'Common confusion pair';
      }

      // Declining performance = higher priority
      if (entry.improvement < -0.2) {
        priority += 0.2;
        reason = 'Performance declining, needs attention';
      }

      recommendations.push({
        speciesA: entry.speciesA,
        speciesAName: this.getSpeciesName(entry.speciesA),
        speciesB: entry.speciesB,
        speciesBName: this.getSpeciesName(entry.speciesB),
        count: entry.count,
        priority,
        reason,
      });
    }

    // Sort by priority and return top N
    return recommendations
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxRecommendations);
  }

  /**
   * Gets the top N most confused pairs.
   */
  getTopConfusions(n: number = 5): ConfusionPair[] {
    return this.getAllEntries()
      .slice(0, n)
      .map((entry) => ({
        speciesA: entry.speciesA,
        speciesB: entry.speciesB,
        count: entry.count,
        lastConfused: entry.lastConfused,
      }));
  }

  /**
   * Gets species that appear most frequently in confusions.
   */
  getMostConfusedSpecies(): Array<{ speciesCode: string; name: string; confusionCount: number }> {
    const speciesCounts: Record<string, number> = {};

    for (const entry of this.entries.values()) {
      speciesCounts[entry.speciesA] = (speciesCounts[entry.speciesA] ?? 0) + entry.count;
      speciesCounts[entry.speciesB] = (speciesCounts[entry.speciesB] ?? 0) + entry.count;
    }

    return Object.entries(speciesCounts)
      .map(([code, count]) => ({
        speciesCode: code,
        name: this.getSpeciesName(code),
        confusionCount: count,
      }))
      .sort((a, b) => b.confusionCount - a.confusionCount);
  }

  /**
   * Gets statistics summary.
   */
  getStats(): {
    totalConfusions: number;
    uniquePairs: number;
    highlightedPairs: number;
    undrilledPairs: number;
    mostConfusedPair: ConfusionEntry | null;
    averageConfusions: number;
  } {
    const entries = this.getAllEntries();
    const totalConfusions = entries.reduce((sum, e) => sum + e.count, 0);

    return {
      totalConfusions,
      uniquePairs: entries.length,
      highlightedPairs: entries.filter((e) => e.count > this.config.highlightThreshold).length,
      undrilledPairs: entries.filter((e) => !e.drilled && e.count > this.config.highlightThreshold).length,
      mostConfusedPair: entries[0] ?? null,
      averageConfusions: entries.length > 0 ? totalConfusions / entries.length : 0,
    };
  }

  /**
   * Gets the species name from code.
   */
  getSpeciesName(code: string): string {
    return SPECIES_NAMES[code] ?? code;
  }

  /**
   * Clears session confusions (call at end of game).
   */
  clearSession(): void {
    this.sessionConfusions.clear();
  }

  /**
   * Gets session confusion count for a pair.
   */
  getSessionConfusionCount(speciesA: string, speciesB: string): number {
    const key = this.makeKey(speciesA, speciesB);
    return this.sessionConfusions.get(key) ?? 0;
  }

  /**
   * Gets all session confusions.
   */
  getSessionConfusions(): Map<string, number> {
    return new Map(this.sessionConfusions);
  }

  /**
   * Imports entries from stored data.
   */
  importEntries(pairs: ConfusionPair[]): void {
    for (const pair of pairs) {
      const key = this.makeKey(pair.speciesA, pair.speciesB);

      if (!this.entries.has(key)) {
        this.entries.set(key, {
          speciesA: pair.speciesA < pair.speciesB ? pair.speciesA : pair.speciesB,
          speciesB: pair.speciesA < pair.speciesB ? pair.speciesB : pair.speciesA,
          count: pair.count,
          lastConfused: pair.lastConfused,
          firstConfused: pair.lastConfused,
          recentCount: 0,
          drilled: false,
          lastDrilled: null,
          improvement: 0,
        });
      }
    }

    this.updateRecentCounts();
  }

  /**
   * Exports entries for storage.
   */
  exportEntries(): ConfusionPair[] {
    return Array.from(this.entries.values()).map((entry) => ({
      speciesA: entry.speciesA,
      speciesB: entry.speciesB,
      count: entry.count,
      lastConfused: entry.lastConfused,
    }));
  }

  /**
   * Clears all tracked confusions.
   */
  clear(): void {
    this.entries.clear();
    this.sessionConfusions.clear();
  }

  /**
   * Creates a canonical key for a species pair.
   */
  private makeKey(speciesA: string, speciesB: string): string {
    const [a, b] = [speciesA, speciesB].sort();
    return `${a}:${b}`;
  }

  /**
   * Updates recent counts based on time window.
   */
  private updateRecentCounts(): void {
    const recentThreshold = Date.now() - this.config.recentDays * 24 * 60 * 60 * 1000;

    for (const entry of this.entries.values()) {
      if (entry.lastConfused < recentThreshold) {
        entry.recentCount = 0;
      }
      // Note: Accurate recent counts would require storing timestamps
      // For now, recentCount decays over time
    }
  }

  /**
   * Prunes old/low-priority entries if over limit.
   */
  private pruneEntries(): void {
    if (this.entries.size <= this.config.maxEntries) {
      return;
    }

    // Sort by count (lowest first) and remove
    const sorted = Array.from(this.entries.entries()).sort(
      ([, a], [, b]) => a.count - b.count
    );

    const toRemove = sorted.slice(0, this.entries.size - this.config.maxEntries);
    for (const [key] of toRemove) {
      this.entries.delete(key);
    }
  }

  /**
   * Registers species names.
   */
  static registerSpeciesNames(names: Record<string, string>): void {
    Object.assign(SPECIES_NAMES, names);
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<ConfusionTrackerConfig> {
    return { ...this.config };
  }
}
