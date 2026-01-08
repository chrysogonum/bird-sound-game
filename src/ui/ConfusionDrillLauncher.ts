/**
 * ConfusionDrillLauncher - Launches targeted practice drills for SoundField: Birds
 *
 * Provides:
 * - Post-round confusion analysis with drill suggestions
 * - One-click launch of drills for confused species pairs
 * - Progress tracking for drilled pairs
 * - Visual feedback on improvement
 */

import type { ScoringResult } from '../scoring/types.js';
import type { SpeciesSelection, LevelConfig } from '../game/types.js';
import type { ClipMetadata } from '../audio/types.js';
import { UI_COLORS } from './types.js';
import {
  ConfusionTracker,
  type DrillRecommendation,
  type ConfusionEntry,
} from '../stats/ConfusionTracker.js';

/** Drill type */
export type DrillType = 'comparison' | 'focused' | 'mixed';

/** Drill configuration */
export interface DrillConfig {
  /** Species A code */
  speciesA: string;
  /** Species B code */
  speciesB: string;
  /** Type of drill */
  drillType: DrillType;
  /** Duration in seconds */
  durationSec: number;
  /** Event density */
  density: 'low' | 'medium' | 'high';
  /** Whether to show spectrograms */
  showSpectrograms: boolean;
}

/** Drill result */
export interface DrillResult {
  /** Species A code */
  speciesA: string;
  /** Species B code */
  speciesB: string;
  /** Total events */
  totalEvents: number;
  /** Correct identifications */
  correctCount: number;
  /** Accuracy percentage */
  accuracy: number;
  /** Improved from before? */
  improved: boolean;
  /** Confusion count during drill */
  confusionCount: number;
}

/** Launcher configuration */
export interface ConfusionDrillLauncherConfig {
  /** Default drill duration */
  defaultDurationSec?: number;
  /** Default drill type */
  defaultDrillType?: DrillType;
  /** Auto-show after rounds with confusions */
  autoShowThreshold?: number;
}

/** Default configuration */
const DEFAULT_CONFIG: Required<ConfusionDrillLauncherConfig> = {
  defaultDurationSec: 30,
  defaultDrillType: 'comparison',
  autoShowThreshold: 2,
};

/** Drill launch callback */
export type DrillLaunchCallback = (config: DrillConfig, level: LevelConfig, species: SpeciesSelection[]) => void;

/** Drill complete callback */
export type DrillCompleteCallback = (result: DrillResult) => void;

/**
 * Manages confusion drill launching and tracking.
 */
export class ConfusionDrillLauncher {
  private readonly config: Required<ConfusionDrillLauncherConfig>;
  private readonly confusionTracker: ConfusionTracker;
  private clipsBySpecies: Map<string, ClipMetadata[]> = new Map();
  private speciesNames: Map<string, string> = new Map();
  private isVisible: boolean = false;
  private currentDrill: DrillConfig | null = null;
  private drillHistory: DrillResult[] = [];
  private onLaunch: DrillLaunchCallback | null = null;
  private onComplete: DrillCompleteCallback | null = null;

  constructor(
    confusionTracker: ConfusionTracker,
    config: ConfusionDrillLauncherConfig = {}
  ) {
    this.confusionTracker = confusionTracker;
    this.config = {
      defaultDurationSec: config.defaultDurationSec ?? DEFAULT_CONFIG.defaultDurationSec,
      defaultDrillType: config.defaultDrillType ?? DEFAULT_CONFIG.defaultDrillType,
      autoShowThreshold: config.autoShowThreshold ?? DEFAULT_CONFIG.autoShowThreshold,
    };
  }

  /**
   * Initializes with available clips and species.
   */
  initialize(clips: ClipMetadata[]): void {
    this.clipsBySpecies.clear();
    this.speciesNames.clear();

    for (const clip of clips) {
      if (!this.clipsBySpecies.has(clip.species_code)) {
        this.clipsBySpecies.set(clip.species_code, []);
      }
      this.clipsBySpecies.get(clip.species_code)!.push(clip);
      this.speciesNames.set(clip.species_code, clip.common_name);
    }
  }

  /**
   * Processes round results and shows drill options if needed.
   */
  processRoundResults(history: ScoringResult[]): boolean {
    // Record confusions
    this.confusionTracker.recordFromHistory(history);

    // Check if we should auto-show
    const sessionConfusions = this.confusionTracker.getSessionConfusions();
    let maxConfusions = 0;

    for (const count of sessionConfusions.values()) {
      maxConfusions = Math.max(maxConfusions, count);
    }

    const shouldShow = maxConfusions >= this.config.autoShowThreshold;

    if (shouldShow) {
      this.show();
    }

    return shouldShow;
  }

  /**
   * Shows the drill launcher.
   */
  show(): void {
    this.isVisible = true;
  }

  /**
   * Hides the drill launcher.
   */
  hide(): void {
    this.isVisible = false;
  }

  /**
   * Checks if launcher is visible.
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Gets drill recommendations.
   */
  getRecommendations(max: number = 3): DrillRecommendation[] {
    return this.confusionTracker.getDrillRecommendations(max);
  }

  /**
   * Gets session-specific confusions (from last round).
   */
  getSessionConfusions(): Array<{
    speciesA: string;
    speciesAName: string;
    speciesB: string;
    speciesBName: string;
    count: number;
  }> {
    const results: Array<{
      speciesA: string;
      speciesAName: string;
      speciesB: string;
      speciesBName: string;
      count: number;
    }> = [];

    for (const [key, count] of this.confusionTracker.getSessionConfusions()) {
      const [speciesA, speciesB] = key.split(':');
      results.push({
        speciesA,
        speciesAName: this.getSpeciesName(speciesA),
        speciesB,
        speciesBName: this.getSpeciesName(speciesB),
        count,
      });
    }

    return results.sort((a, b) => b.count - a.count);
  }

  /**
   * Creates a drill config for a species pair.
   */
  createDrillConfig(
    speciesA: string,
    speciesB: string,
    options: Partial<DrillConfig> = {}
  ): DrillConfig {
    return {
      speciesA,
      speciesB,
      drillType: options.drillType ?? this.config.defaultDrillType,
      durationSec: options.durationSec ?? this.config.defaultDurationSec,
      density: options.density ?? 'low',
      showSpectrograms: options.showSpectrograms ?? true,
    };
  }

  /**
   * Creates level config for a drill.
   */
  createLevelConfig(drillConfig: DrillConfig): LevelConfig {
    return {
      level_id: -1, // Drill mode
      pack_id: 'drill',
      mode: 'practice',
      round_duration_sec: drillConfig.durationSec,
      species_count: 2,
      event_density: drillConfig.density,
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: drillConfig.showSpectrograms ? 'full' : 'none',
    };
  }

  /**
   * Creates species selection for a drill.
   */
  createSpeciesSelection(drillConfig: DrillConfig): SpeciesSelection[] {
    const selections: SpeciesSelection[] = [];

    const clipsA = this.clipsBySpecies.get(drillConfig.speciesA) ?? [];
    const clipsB = this.clipsBySpecies.get(drillConfig.speciesB) ?? [];

    if (clipsA.length > 0) {
      selections.push({
        speciesCode: drillConfig.speciesA,
        commonName: this.getSpeciesName(drillConfig.speciesA),
        clips: clipsA,
      });
    }

    if (clipsB.length > 0) {
      selections.push({
        speciesCode: drillConfig.speciesB,
        commonName: this.getSpeciesName(drillConfig.speciesB),
        clips: clipsB,
      });
    }

    return selections;
  }

  /**
   * Launches a drill for a species pair.
   */
  launchDrill(speciesA: string, speciesB: string, options: Partial<DrillConfig> = {}): boolean {
    const drillConfig = this.createDrillConfig(speciesA, speciesB, options);
    const levelConfig = this.createLevelConfig(drillConfig);
    const speciesSelection = this.createSpeciesSelection(drillConfig);

    if (speciesSelection.length < 2) {
      return false; // Not enough clips
    }

    this.currentDrill = drillConfig;
    this.confusionTracker.markDrilled(speciesA, speciesB);

    this.onLaunch?.(drillConfig, levelConfig, speciesSelection);
    this.hide();

    return true;
  }

  /**
   * Launches a drill from a recommendation.
   */
  launchFromRecommendation(recommendation: DrillRecommendation): boolean {
    return this.launchDrill(recommendation.speciesA, recommendation.speciesB);
  }

  /**
   * Completes the current drill with results.
   */
  completeDrill(history: ScoringResult[]): DrillResult | null {
    if (!this.currentDrill) {
      return null;
    }

    const { speciesA, speciesB } = this.currentDrill;

    // Calculate results
    let totalEvents = 0;
    let correctCount = 0;
    let confusionCount = 0;

    for (const result of history) {
      if (
        result.event.expectedSpecies === speciesA ||
        result.event.expectedSpecies === speciesB
      ) {
        totalEvents++;
        if (result.breakdown.speciesCorrect) {
          correctCount++;
        } else if (
          result.input.speciesCode === speciesA ||
          result.input.speciesCode === speciesB
        ) {
          confusionCount++;
        }
      }
    }

    const accuracy = totalEvents > 0 ? (correctCount / totalEvents) * 100 : 0;
    const improved = accuracy >= 70; // Consider improved if 70%+ accuracy

    this.confusionTracker.recordImprovement(speciesA, speciesB, improved);

    const result: DrillResult = {
      speciesA,
      speciesB,
      totalEvents,
      correctCount,
      accuracy,
      improved,
      confusionCount,
    };

    this.drillHistory.push(result);
    this.currentDrill = null;

    this.onComplete?.(result);

    return result;
  }

  /**
   * Gets the current drill config.
   */
  getCurrentDrill(): DrillConfig | null {
    return this.currentDrill;
  }

  /**
   * Checks if a drill is in progress.
   */
  isDrillInProgress(): boolean {
    return this.currentDrill !== null;
  }

  /**
   * Gets drill history.
   */
  getDrillHistory(): DrillResult[] {
    return [...this.drillHistory];
  }

  /**
   * Gets drill history for a specific pair.
   */
  getDrillHistoryForPair(speciesA: string, speciesB: string): DrillResult[] {
    return this.drillHistory.filter(
      (r) =>
        (r.speciesA === speciesA && r.speciesB === speciesB) ||
        (r.speciesA === speciesB && r.speciesB === speciesA)
    );
  }

  /**
   * Gets the species name from code.
   */
  getSpeciesName(code: string): string {
    return this.speciesNames.get(code) ?? this.confusionTracker.getSpeciesName(code);
  }

  /**
   * Checks if clips are available for a species.
   */
  hasClipsForSpecies(speciesCode: string): boolean {
    const clips = this.clipsBySpecies.get(speciesCode);
    return clips !== undefined && clips.length > 0;
  }

  /**
   * Checks if a drill can be launched for a pair.
   */
  canLaunchDrill(speciesA: string, speciesB: string): boolean {
    return this.hasClipsForSpecies(speciesA) && this.hasClipsForSpecies(speciesB);
  }

  /**
   * Sets callbacks.
   */
  setCallbacks(callbacks: {
    onLaunch?: DrillLaunchCallback;
    onComplete?: DrillCompleteCallback;
  }): void {
    if (callbacks.onLaunch) this.onLaunch = callbacks.onLaunch;
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
  }

  /**
   * Gets render data for UI.
   */
  getRenderData(): {
    isVisible: boolean;
    recommendations: DrillRecommendation[];
    sessionConfusions: ReturnType<ConfusionDrillLauncher['getSessionConfusions']>;
    currentDrill: DrillConfig | null;
    drillHistory: DrillResult[];
    stats: ReturnType<ConfusionTracker['getStats']>;
    colors: typeof UI_COLORS;
  } {
    return {
      isVisible: this.isVisible,
      recommendations: this.getRecommendations(),
      sessionConfusions: this.getSessionConfusions(),
      currentDrill: this.currentDrill,
      drillHistory: this.drillHistory,
      stats: this.confusionTracker.getStats(),
      colors: UI_COLORS,
    };
  }

  /**
   * Gets drill type descriptions.
   */
  getDrillTypeInfo(): Array<{
    type: DrillType;
    label: string;
    description: string;
  }> {
    return [
      {
        type: 'comparison',
        label: 'Comparison',
        description: 'Both species play alternately for direct comparison',
      },
      {
        type: 'focused',
        label: 'Focused',
        description: 'Focus on one species at a time',
      },
      {
        type: 'mixed',
        label: 'Mixed',
        description: 'Random mix of both species',
      },
    ];
  }

  /**
   * Clears session data.
   */
  clearSession(): void {
    this.confusionTracker.clearSession();
    this.currentDrill = null;
  }

  /**
   * Resets all drill history.
   */
  resetHistory(): void {
    this.drillHistory = [];
  }

  /**
   * Gets the confusion tracker.
   */
  getConfusionTracker(): ConfusionTracker {
    return this.confusionTracker;
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<ConfusionDrillLauncherConfig> {
    return { ...this.config };
  }
}
