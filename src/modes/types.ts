/**
 * Mode system types for SoundField: Birds
 */

import type { LevelConfig, RoundStats, GameMode, SpeciesSelection } from '../game/types.js';

/** Mode state */
export type ModeState = 'idle' | 'setup' | 'playing' | 'paused' | 'ended';

/** Base mode configuration */
export interface BaseModeConfig {
  /** Callback when mode completes */
  onComplete?: (result: ModeResult) => void;
  /** Callback when mode state changes */
  onStateChange?: (state: ModeState) => void;
}

/** Mode result after completion */
export interface ModeResult {
  mode: GameMode;
  stats: RoundStats;
  levelId?: number;
  unlockedLevelId?: number;
  highScore?: number;
  isNewHighScore?: boolean;
}

/** Campaign mode specific types */
export interface CampaignProgress {
  currentLevel: number;
  unlockedLevels: number[];
  levelStats: Map<number, RoundStats>;
}

/** Practice mode settings */
export interface PracticeSettings {
  speciesCode: string;
  vocalizationType?: 'song' | 'call' | 'both';
  eventDensity?: 'low' | 'medium' | 'high';
  roundDurationSec?: number;
}

/** Challenge mode settings */
export interface ChallengeSettings {
  durationSec: number;
  seed?: number;
  dailySeed?: string;
  packId?: string;
}

/** Random mode settings */
export interface RandomSettings {
  packId?: string;
  speciesCodes?: string[];
  eventDensity?: 'low' | 'medium' | 'high';
}

/** Mode selection callback */
export type ModeSelectCallback = (mode: GameMode, settings?: unknown) => void;

/** Available mode info for display */
export interface ModeInfo {
  mode: GameMode;
  displayName: string;
  description: string;
  icon: string;
  unlocked: boolean;
}

/** Seed utilities */
export function generateDailySeed(date?: Date): number {
  const d = date ?? new Date();
  const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return hashString(dateString);
}

export function seedFromDateString(dateString: string): number {
  return hashString(dateString);
}

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}
