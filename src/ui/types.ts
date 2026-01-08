/**
 * UI system types for SoundField: Birds
 */

import type { RoundStats, SpectrogramMode } from '../game/types.js';
import type { ScoringResult } from '../scoring/types.js';

/** Per-species performance breakdown */
export interface SpeciesBreakdown {
  speciesCode: string;
  commonName: string;
  totalEvents: number;
  correctCount: number;
  accuracy: number;
}

/** Confusion pair data */
export interface ConfusionPair {
  speciesA: string;
  speciesB: string;
  speciesAName: string;
  speciesBName: string;
  count: number;
}

/** Round summary data */
export interface RoundSummaryData {
  stats: RoundStats;
  speciesBreakdowns: SpeciesBreakdown[];
  confusionPairs: ConfusionPair[];
  duration: number;
  levelId: number;
}

/** HUD state */
export interface HUDState {
  score: number;
  timeRemainingMs: number;
  totalTimeMs: number;
  eventsCompleted: number;
  totalEvents: number;
  currentStreak: number;
  isPlaying: boolean;
}

/** HUD configuration */
export interface HUDConfig {
  showTimer?: boolean;
  showScore?: boolean;
  showProgress?: boolean;
  showStreak?: boolean;
  position?: 'top' | 'bottom';
}

/** Calibration state */
export type CalibrationStep = 'intro' | 'left' | 'right' | 'confirm' | 'complete';

/** Calibration result */
export interface CalibrationResult {
  leftConfirmed: boolean;
  rightConfirmed: boolean;
  latencyMs?: number;
  completed: boolean;
}

/** Round summary callback */
export type RoundSummaryCallback = (action: 'retry' | 'next' | 'menu') => void;

/** HUD update callback */
export type HUDUpdateCallback = (state: HUDState) => void;

/** Calibration callback */
export type CalibrationCallback = (result: CalibrationResult) => void;

/** Color palette for high-contrast, colorblind-safe design */
export const UI_COLORS = {
  // Primary colors
  PRIMARY: '#2563EB',       // Blue-600
  SECONDARY: '#7C3AED',     // Violet-600

  // Feedback colors (colorblind-safe)
  SUCCESS: '#059669',       // Emerald-600
  WARNING: '#D97706',       // Amber-600
  ERROR: '#DC2626',         // Red-600

  // Neutral colors
  BACKGROUND: '#1F2937',    // Gray-800
  SURFACE: '#374151',       // Gray-700
  TEXT_PRIMARY: '#F9FAFB',  // Gray-50
  TEXT_SECONDARY: '#D1D5DB', // Gray-300

  // Accent colors for confusion matrix
  CONFUSION_LOW: '#FEF3C7',   // Amber-100
  CONFUSION_MEDIUM: '#FBBF24', // Amber-400
  CONFUSION_HIGH: '#F59E0B',   // Amber-500
} as const;

/** Animation durations */
export const UI_ANIMATIONS = {
  FEEDBACK_DURATION_MS: 300,
  SCORE_UPDATE_MS: 200,
  SUMMARY_TRANSITION_MS: 500,
} as const;
