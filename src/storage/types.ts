/**
 * Storage system types for ChipNotes!
 */

/** Confusion pair tracking */
export interface ConfusionPair {
  /** First species code */
  speciesA: string;
  /** Second species code */
  speciesB: string;
  /** Number of times confused */
  count: number;
  /** Last confused timestamp */
  lastConfused: number;
}

/** Per-pack statistics */
export interface PackStats {
  /** Pack ID */
  packId: string;
  /** Total games played with this pack */
  gamesPlayed: number;
  /** Total events seen */
  totalEvents: number;
  /** Correct identifications */
  correctCount: number;
  /** Best accuracy percentage */
  bestAccuracy: number;
  /** Current streak (correct in a row) */
  currentStreak: number;
  /** Best streak ever */
  bestStreak: number;
  /** Average response time in ms */
  averageResponseTimeMs: number;
  /** Response time samples for trend calculation */
  responseTimeSamples: number[];
  /** Confusion pairs for this pack */
  confusionPairs: ConfusionPair[];
  /** Last played timestamp */
  lastPlayed: number;
}

/** Per-level statistics */
export interface LevelStats {
  /** Level ID */
  levelId: number;
  /** Number of attempts */
  attempts: number;
  /** Number of completions */
  completions: number;
  /** Best score */
  bestScore: number;
  /** Best accuracy percentage */
  bestAccuracy: number;
  /** Last played timestamp */
  lastPlayed: number;
}

/** High scores by mode */
export interface HighScores {
  /** Campaign mode high scores by level */
  campaign: Record<number, number>;
  /** Challenge mode high score */
  challenge: number;
  /** Random mode high score */
  random: number;
}

/** Player progress data structure */
export interface PlayerProgress {
  /** Schema version for migrations */
  version: number;
  /** Player ID (for future multi-user support) */
  playerId: string;
  /** Unlocked level IDs */
  unlockedLevels: number[];
  /** Unlocked pack IDs */
  unlockedPacks: string[];
  /** Per-pack statistics */
  packStats: Record<string, PackStats>;
  /** Per-level statistics */
  levelStats: Record<number, LevelStats>;
  /** High scores */
  highScores: HighScores;
  /** Total play time in ms */
  totalPlayTimeMs: number;
  /** First played timestamp */
  firstPlayed: number;
  /** Last played timestamp */
  lastPlayed: number;
  /** Settings preferences */
  settings: PlayerSettings;
}

/** Player settings */
export interface PlayerSettings {
  /** Volume level (0-1) */
  volume: number;
  /** Show spectrograms */
  showSpectrograms: boolean;
  /** Colorblind mode */
  colorblindMode: boolean;
  /** Audio balance (-1 to 1, 0 = center) */
  audioBalance: number;
}

/** Default player settings */
export const DEFAULT_SETTINGS: PlayerSettings = {
  volume: 0.8,
  showSpectrograms: true,
  colorblindMode: false,
  audioBalance: 0,
};

/** Current schema version */
export const SCHEMA_VERSION = 1;

/** Storage key for localStorage */
export const STORAGE_KEY = 'soundfield_birds_progress';

/** Create empty player progress */
export function createEmptyProgress(playerId: string = 'default'): PlayerProgress {
  return {
    version: SCHEMA_VERSION,
    playerId,
    unlockedLevels: [1], // Level 1 always unlocked
    unlockedPacks: ['common_se_birds'], // Default pack unlocked
    packStats: {},
    levelStats: {},
    highScores: {
      campaign: {},
      challenge: 0,
      random: 0,
    },
    totalPlayTimeMs: 0,
    firstPlayed: Date.now(),
    lastPlayed: Date.now(),
    settings: { ...DEFAULT_SETTINGS },
  };
}

/** Create empty pack stats */
export function createEmptyPackStats(packId: string): PackStats {
  return {
    packId,
    gamesPlayed: 0,
    totalEvents: 0,
    correctCount: 0,
    bestAccuracy: 0,
    currentStreak: 0,
    bestStreak: 0,
    averageResponseTimeMs: 0,
    responseTimeSamples: [],
    confusionPairs: [],
    lastPlayed: Date.now(),
  };
}

/** Create empty level stats */
export function createEmptyLevelStats(levelId: number): LevelStats {
  return {
    levelId,
    attempts: 0,
    completions: 0,
    bestScore: 0,
    bestAccuracy: 0,
    lastPlayed: Date.now(),
  };
}
