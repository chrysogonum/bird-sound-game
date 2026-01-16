/**
 * Stats system types for ChipNotes!
 */

import type { PackStats, ConfusionPair } from '../storage/types.js';

/** Mastery level thresholds */
export const MASTERY_THRESHOLDS = {
  novice: 0,
  beginner: 50,
  intermediate: 70,
  advanced: 85,
  expert: 95,
} as const;

/** Mastery level names */
export type MasteryLevel = keyof typeof MASTERY_THRESHOLDS;

/** Response time trend */
export type ResponseTimeTrend = 'improving' | 'stable' | 'declining';

/** Species mastery info */
export interface SpeciesMastery {
  speciesCode: string;
  accuracy: number;
  masteryLevel: MasteryLevel;
  totalAttempts: number;
  correctCount: number;
  averageResponseTimeMs: number;
}

/** Pack mastery summary */
export interface PackMasterySummary {
  packId: string;
  overallAccuracy: number;
  masteryLevel: MasteryLevel;
  gamesPlayed: number;
  totalEvents: number;
  bestStreak: number;
  responseTimeTrend: ResponseTimeTrend;
  topConfusions: ConfusionPair[];
  averageResponseTimeMs: number;
}

/** Overall player stats */
export interface PlayerStatsSummary {
  totalGamesPlayed: number;
  totalEventsScored: number;
  overallAccuracy: number;
  masteryLevel: MasteryLevel;
  totalPlayTimeMs: number;
  averageSessionLength: number;
  longestStreak: number;
  levelsCompleted: number;
  packsUnlocked: number;
}

/** Response time analysis */
export interface ResponseTimeAnalysis {
  average: number;
  median: number;
  min: number;
  max: number;
  trend: ResponseTimeTrend;
  recentAverage: number;
  improvement: number;
}
