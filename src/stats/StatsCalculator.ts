/**
 * StatsCalculator - Compute mastery metrics for SoundField: Birds
 *
 * Features:
 * - Calculate mastery levels
 * - Analyze response time trends
 * - Identify confusion patterns
 * - Generate player summaries
 */

import type { PlayerProgress, PackStats, ConfusionPair } from '../storage/types.js';
import type {
  MasteryLevel,
  ResponseTimeTrend,
  SpeciesMastery,
  PackMasterySummary,
  PlayerStatsSummary,
  ResponseTimeAnalysis,
} from './types.js';
import { MASTERY_THRESHOLDS } from './types.js';

/**
 * StatsCalculator computes mastery metrics from player progress.
 */
export class StatsCalculator {
  /**
   * Calculates mastery level from accuracy percentage.
   */
  calculateMasteryLevel(accuracy: number): MasteryLevel {
    if (accuracy >= MASTERY_THRESHOLDS.expert) return 'expert';
    if (accuracy >= MASTERY_THRESHOLDS.advanced) return 'advanced';
    if (accuracy >= MASTERY_THRESHOLDS.intermediate) return 'intermediate';
    if (accuracy >= MASTERY_THRESHOLDS.beginner) return 'beginner';
    return 'novice';
  }

  /**
   * Analyzes response time samples to determine trend.
   */
  analyzeResponseTimeTrend(samples: number[]): ResponseTimeTrend {
    if (samples.length < 10) {
      return 'stable';
    }

    // Split into early and recent halves
    const midpoint = Math.floor(samples.length / 2);
    const earlyHalf = samples.slice(0, midpoint);
    const recentHalf = samples.slice(midpoint);

    const earlyAvg = this.average(earlyHalf);
    const recentAvg = this.average(recentHalf);

    // Calculate percentage change
    const changePercent = ((recentAvg - earlyAvg) / earlyAvg) * 100;

    // Threshold for significant change (10%)
    if (changePercent < -10) {
      return 'improving'; // Faster response times = improving
    } else if (changePercent > 10) {
      return 'declining'; // Slower response times = declining
    }

    return 'stable';
  }

  /**
   * Performs full response time analysis.
   */
  analyzeResponseTime(samples: number[]): ResponseTimeAnalysis {
    if (samples.length === 0) {
      return {
        average: 0,
        median: 0,
        min: 0,
        max: 0,
        trend: 'stable',
        recentAverage: 0,
        improvement: 0,
      };
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const average = this.average(samples);
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const trend = this.analyzeResponseTimeTrend(samples);

    // Calculate recent average (last 20 samples)
    const recentSamples = samples.slice(-20);
    const recentAverage = this.average(recentSamples);

    // Calculate early average for improvement comparison
    const earlySamples = samples.slice(0, 20);
    const earlyAverage = this.average(earlySamples);

    // Improvement as percentage (negative = faster = better)
    const improvement = earlyAverage > 0 ? ((earlyAverage - recentAverage) / earlyAverage) * 100 : 0;

    return {
      average: Math.round(average),
      median: Math.round(median),
      min: Math.round(min),
      max: Math.round(max),
      trend,
      recentAverage: Math.round(recentAverage),
      improvement: Math.round(improvement),
    };
  }

  /**
   * Generates pack mastery summary.
   */
  getPackMasterySummary(stats: PackStats): PackMasterySummary {
    const accuracy = stats.totalEvents > 0
      ? (stats.correctCount / stats.totalEvents) * 100
      : 0;

    const trend = this.analyzeResponseTimeTrend(stats.responseTimeSamples);

    // Get top 5 confusion pairs
    const topConfusions = [...stats.confusionPairs]
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      packId: stats.packId,
      overallAccuracy: Math.round(accuracy * 10) / 10,
      masteryLevel: this.calculateMasteryLevel(accuracy),
      gamesPlayed: stats.gamesPlayed,
      totalEvents: stats.totalEvents,
      bestStreak: stats.bestStreak,
      responseTimeTrend: trend,
      topConfusions,
      averageResponseTimeMs: stats.averageResponseTimeMs,
    };
  }

  /**
   * Generates overall player stats summary.
   */
  getPlayerStatsSummary(progress: PlayerProgress): PlayerStatsSummary {
    let totalGamesPlayed = 0;
    let totalEventsScored = 0;
    let totalCorrect = 0;
    let longestStreak = 0;

    // Aggregate pack stats
    for (const packStats of Object.values(progress.packStats)) {
      totalGamesPlayed += packStats.gamesPlayed;
      totalEventsScored += packStats.totalEvents;
      totalCorrect += packStats.correctCount;
      if (packStats.bestStreak > longestStreak) {
        longestStreak = packStats.bestStreak;
      }
    }

    const overallAccuracy = totalEventsScored > 0
      ? (totalCorrect / totalEventsScored) * 100
      : 0;

    // Count completed levels
    let levelsCompleted = 0;
    for (const levelStats of Object.values(progress.levelStats)) {
      if (levelStats.completions > 0) {
        levelsCompleted++;
      }
    }

    // Calculate average session length
    const averageSessionLength = totalGamesPlayed > 0
      ? progress.totalPlayTimeMs / totalGamesPlayed
      : 0;

    return {
      totalGamesPlayed,
      totalEventsScored,
      overallAccuracy: Math.round(overallAccuracy * 10) / 10,
      masteryLevel: this.calculateMasteryLevel(overallAccuracy),
      totalPlayTimeMs: progress.totalPlayTimeMs,
      averageSessionLength: Math.round(averageSessionLength),
      longestStreak,
      levelsCompleted,
      packsUnlocked: progress.unlockedPacks.length,
    };
  }

  /**
   * Gets the most confused species pairs across all packs.
   */
  getTopConfusionPairs(progress: PlayerProgress, limit: number = 10): ConfusionPair[] {
    const allConfusions: ConfusionPair[] = [];

    for (const packStats of Object.values(progress.packStats)) {
      allConfusions.push(...packStats.confusionPairs);
    }

    // Merge duplicate pairs
    const merged = new Map<string, ConfusionPair>();
    for (const pair of allConfusions) {
      const key = `${pair.speciesA}:${pair.speciesB}`;
      const existing = merged.get(key);
      if (existing) {
        existing.count += pair.count;
        existing.lastConfused = Math.max(existing.lastConfused, pair.lastConfused);
      } else {
        merged.set(key, { ...pair });
      }
    }

    return Array.from(merged.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculates accuracy trend over recent games.
   */
  calculateAccuracyTrend(packStats: PackStats[]): ResponseTimeTrend {
    // This would need historical accuracy data per game
    // For now, use response time trend as proxy
    const allSamples: number[] = [];
    for (const stats of packStats) {
      allSamples.push(...stats.responseTimeSamples);
    }

    // Invert the trend (faster response = better accuracy usually)
    const trend = this.analyzeResponseTimeTrend(allSamples);
    return trend;
  }

  /**
   * Gets species that need more practice (low accuracy).
   */
  getSpeciesNeedingPractice(
    progress: PlayerProgress,
    confusionThreshold: number = 3
  ): string[] {
    const speciesConfusions = new Map<string, number>();

    // Count how many times each species appears in confusions
    for (const packStats of Object.values(progress.packStats)) {
      for (const pair of packStats.confusionPairs) {
        if (pair.count >= confusionThreshold) {
          speciesConfusions.set(
            pair.speciesA,
            (speciesConfusions.get(pair.speciesA) ?? 0) + pair.count
          );
          speciesConfusions.set(
            pair.speciesB,
            (speciesConfusions.get(pair.speciesB) ?? 0) + pair.count
          );
        }
      }
    }

    // Sort by confusion count
    return Array.from(speciesConfusions.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([species]) => species);
  }

  /**
   * Calculates estimated time to reach a mastery level.
   */
  estimateTimeToMastery(
    currentAccuracy: number,
    targetLevel: MasteryLevel,
    averageImprovementPerGame: number = 1 // 1% per game
  ): number {
    const targetAccuracy = MASTERY_THRESHOLDS[targetLevel];
    if (currentAccuracy >= targetAccuracy) {
      return 0;
    }

    const gap = targetAccuracy - currentAccuracy;
    return Math.ceil(gap / averageImprovementPerGame);
  }

  /**
   * Formats play time for display.
   */
  formatPlayTime(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  /**
   * Gets mastery level display info.
   */
  getMasteryLevelInfo(level: MasteryLevel): { name: string; color: string; nextThreshold: number | null } {
    const levels: Record<MasteryLevel, { name: string; color: string }> = {
      novice: { name: 'Novice', color: '#888888' },
      beginner: { name: 'Beginner', color: '#4CAF50' },
      intermediate: { name: 'Intermediate', color: '#2196F3' },
      advanced: { name: 'Advanced', color: '#9C27B0' },
      expert: { name: 'Expert', color: '#FF9800' },
    };

    const thresholdOrder: MasteryLevel[] = ['novice', 'beginner', 'intermediate', 'advanced', 'expert'];
    const currentIndex = thresholdOrder.indexOf(level);
    const nextLevel = currentIndex < thresholdOrder.length - 1
      ? thresholdOrder[currentIndex + 1]
      : null;

    return {
      ...levels[level],
      nextThreshold: nextLevel ? MASTERY_THRESHOLDS[nextLevel] : null,
    };
  }

  /**
   * Calculates average of an array.
   */
  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }
}
