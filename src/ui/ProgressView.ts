/**
 * ProgressView - Display unlocks and stats for SoundField: Birds
 *
 * Features:
 * - Display unlocked levels and packs
 * - Show player statistics
 * - Visualize mastery progress
 * - Show confusion matrix highlights
 */

import type { PlayerProgress, PackStats, ConfusionPair } from '../storage/types.js';
import type {
  MasteryLevel,
  PackMasterySummary,
  PlayerStatsSummary,
  ResponseTimeAnalysis,
} from '../stats/types.js';
import { StatsCalculator } from '../stats/StatsCalculator.js';
import { UI_COLORS } from './types.js';

/** Progress view section */
export type ProgressSection = 'overview' | 'levels' | 'packs' | 'stats' | 'confusions';

/** Level display info */
export interface LevelDisplayInfo {
  levelId: number;
  unlocked: boolean;
  completed: boolean;
  bestScore: number;
  bestAccuracy: number;
  attempts: number;
}

/** Pack display info */
export interface PackDisplayInfo {
  packId: string;
  displayName: string;
  unlocked: boolean;
  gamesPlayed: number;
  accuracy: number;
  masteryLevel: MasteryLevel;
}

/** Progress view configuration */
export interface ProgressViewConfig {
  /** Player progress data */
  progress: PlayerProgress;
  /** Pack display names */
  packNames?: Record<string, string>;
  /** Total available levels */
  totalLevels?: number;
  /** Total available packs */
  totalPacks?: number;
}

/**
 * ProgressView manages the display of player progress.
 */
export class ProgressView {
  private progress: PlayerProgress;
  private readonly statsCalculator: StatsCalculator;
  private readonly packNames: Record<string, string>;
  private readonly totalLevels: number;
  private readonly totalPacks: number;
  private currentSection: ProgressSection = 'overview';
  private visible: boolean = false;

  constructor(config: ProgressViewConfig) {
    this.progress = config.progress;
    this.statsCalculator = new StatsCalculator();
    this.packNames = config.packNames ?? {};
    this.totalLevels = config.totalLevels ?? 10;
    this.totalPacks = config.totalPacks ?? 4;
  }

  /**
   * Updates the progress data.
   */
  updateProgress(progress: PlayerProgress): void {
    this.progress = progress;
  }

  /**
   * Gets the current section.
   */
  getSection(): ProgressSection {
    return this.currentSection;
  }

  /**
   * Sets the current section.
   */
  setSection(section: ProgressSection): void {
    this.currentSection = section;
  }

  /**
   * Shows the progress view.
   */
  show(): void {
    this.visible = true;
  }

  /**
   * Hides the progress view.
   */
  hide(): void {
    this.visible = false;
  }

  /**
   * Checks if view is visible.
   */
  isVisible(): boolean {
    return this.visible;
  }

  // ============ Overview ============

  /**
   * Gets player stats summary for overview.
   */
  getOverviewStats(): PlayerStatsSummary {
    return this.statsCalculator.getPlayerStatsSummary(this.progress);
  }

  /**
   * Gets progress percentages.
   */
  getProgressPercentages(): {
    levels: number;
    packs: number;
    mastery: number;
  } {
    const levelsUnlocked = this.progress.unlockedLevels.length;
    const packsUnlocked = this.progress.unlockedPacks.length;
    const stats = this.statsCalculator.getPlayerStatsSummary(this.progress);

    return {
      levels: Math.round((levelsUnlocked / this.totalLevels) * 100),
      packs: Math.round((packsUnlocked / this.totalPacks) * 100),
      mastery: Math.round(stats.overallAccuracy),
    };
  }

  // ============ Levels ============

  /**
   * Gets level display info for all levels.
   */
  getLevelDisplayInfo(): LevelDisplayInfo[] {
    const levels: LevelDisplayInfo[] = [];

    for (let levelId = 1; levelId <= this.totalLevels; levelId++) {
      const unlocked = this.progress.unlockedLevels.includes(levelId);
      const stats = this.progress.levelStats[levelId];

      levels.push({
        levelId,
        unlocked,
        completed: (stats?.completions ?? 0) > 0,
        bestScore: stats?.bestScore ?? 0,
        bestAccuracy: stats?.bestAccuracy ?? 0,
        attempts: stats?.attempts ?? 0,
      });
    }

    return levels;
  }

  /**
   * Gets the next level to unlock.
   */
  getNextLevelToUnlock(): number | null {
    const highest = Math.max(...this.progress.unlockedLevels, 0);
    const next = highest + 1;
    return next <= this.totalLevels ? next : null;
  }

  // ============ Packs ============

  /**
   * Gets pack display info for all packs.
   */
  getPackDisplayInfo(packIds: string[]): PackDisplayInfo[] {
    return packIds.map((packId) => {
      const unlocked = this.progress.unlockedPacks.includes(packId);
      const stats = this.progress.packStats[packId];
      const accuracy = stats && stats.totalEvents > 0
        ? (stats.correctCount / stats.totalEvents) * 100
        : 0;

      return {
        packId,
        displayName: this.packNames[packId] ?? packId,
        unlocked,
        gamesPlayed: stats?.gamesPlayed ?? 0,
        accuracy: Math.round(accuracy * 10) / 10,
        masteryLevel: this.statsCalculator.calculateMasteryLevel(accuracy),
      };
    });
  }

  /**
   * Gets detailed pack mastery summary.
   */
  getPackMastery(packId: string): PackMasterySummary | null {
    const stats = this.progress.packStats[packId];
    if (!stats) return null;
    return this.statsCalculator.getPackMasterySummary(stats);
  }

  // ============ Stats ============

  /**
   * Gets high scores display data.
   */
  getHighScoresDisplay(): {
    campaign: { levelId: number; score: number }[];
    challenge: number;
    random: number;
  } {
    const campaign = Object.entries(this.progress.highScores.campaign)
      .map(([levelId, score]) => ({
        levelId: parseInt(levelId, 10),
        score,
      }))
      .sort((a, b) => a.levelId - b.levelId);

    return {
      campaign,
      challenge: this.progress.highScores.challenge,
      random: this.progress.highScores.random,
    };
  }

  /**
   * Gets response time analysis for a pack.
   */
  getResponseTimeAnalysis(packId: string): ResponseTimeAnalysis | null {
    const stats = this.progress.packStats[packId];
    if (!stats) return null;
    return this.statsCalculator.analyzeResponseTime(stats.responseTimeSamples);
  }

  /**
   * Gets formatted play time.
   */
  getFormattedPlayTime(): string {
    return this.statsCalculator.formatPlayTime(this.progress.totalPlayTimeMs);
  }

  // ============ Confusions ============

  /**
   * Gets top confusion pairs across all packs.
   */
  getTopConfusions(limit: number = 10): ConfusionPair[] {
    return this.statsCalculator.getTopConfusionPairs(this.progress, limit);
  }

  /**
   * Gets confusion pairs for a specific pack.
   */
  getPackConfusions(packId: string): ConfusionPair[] {
    const stats = this.progress.packStats[packId];
    if (!stats) return [];
    return [...stats.confusionPairs].sort((a, b) => b.count - a.count);
  }

  /**
   * Gets species that need practice.
   */
  getSpeciesNeedingPractice(): string[] {
    return this.statsCalculator.getSpeciesNeedingPractice(this.progress);
  }

  // ============ Render Data ============

  /**
   * Gets render data for the current section.
   */
  getRenderData(): {
    visible: boolean;
    section: ProgressSection;
    colors: typeof UI_COLORS;
    overview?: PlayerStatsSummary;
    levels?: LevelDisplayInfo[];
    packs?: PackDisplayInfo[];
    confusions?: ConfusionPair[];
    playTime?: string;
  } {
    const base = {
      visible: this.visible,
      section: this.currentSection,
      colors: UI_COLORS,
      playTime: this.getFormattedPlayTime(),
    };

    switch (this.currentSection) {
      case 'overview':
        return {
          ...base,
          overview: this.getOverviewStats(),
        };

      case 'levels':
        return {
          ...base,
          levels: this.getLevelDisplayInfo(),
        };

      case 'packs':
        return {
          ...base,
          packs: this.getPackDisplayInfo(Object.keys(this.progress.packStats)),
        };

      case 'confusions':
        return {
          ...base,
          confusions: this.getTopConfusions(),
        };

      default:
        return base;
    }
  }

  /**
   * Gets CSS class for mastery level.
   */
  getMasteryClass(level: MasteryLevel): string {
    const classes: Record<MasteryLevel, string> = {
      novice: 'mastery-novice',
      beginner: 'mastery-beginner',
      intermediate: 'mastery-intermediate',
      advanced: 'mastery-advanced',
      expert: 'mastery-expert',
    };
    return classes[level];
  }

  /**
   * Gets mastery level display info.
   */
  getMasteryInfo(level: MasteryLevel): { name: string; color: string; nextThreshold: number | null } {
    return this.statsCalculator.getMasteryLevelInfo(level);
  }

  /**
   * Gets navigation items for sections.
   */
  getNavigationItems(): { section: ProgressSection; label: string; icon: string }[] {
    return [
      { section: 'overview', label: 'Overview', icon: 'home' },
      { section: 'levels', label: 'Levels', icon: 'layers' },
      { section: 'packs', label: 'Packs', icon: 'folder' },
      { section: 'stats', label: 'Stats', icon: 'bar-chart' },
      { section: 'confusions', label: 'Confusions', icon: 'shuffle' },
    ];
  }
}
