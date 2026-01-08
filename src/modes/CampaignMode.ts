/**
 * CampaignMode - Linear progression through Levels for SoundField: Birds
 *
 * Features:
 * - Start at Level 1, unlock subsequent levels by completing previous
 * - Track progress across sessions
 * - Level completion requirements based on accuracy threshold
 */

import type { LevelConfig, RoundStats, SpeciesSelection } from '../game/types.js';
import type {
  BaseModeConfig,
  ModeState,
  ModeResult,
  CampaignProgress,
} from './types.js';

/** Minimum accuracy to unlock next level */
const UNLOCK_THRESHOLD_PERCENT = 60;

/** Campaign mode configuration */
export interface CampaignModeConfig extends BaseModeConfig {
  /** All available levels */
  levels: LevelConfig[];
  /** Initial progress (for loading saved state) */
  initialProgress?: CampaignProgress;
  /** Accuracy threshold to unlock next level (default: 60%) */
  unlockThreshold?: number;
}

/**
 * CampaignMode manages linear level progression.
 */
export class CampaignMode {
  private readonly levels: LevelConfig[];
  private readonly unlockThreshold: number;
  private progress: CampaignProgress;
  private state: ModeState = 'idle';
  private currentLevel: LevelConfig | null = null;
  private onComplete: ((result: ModeResult) => void) | null;
  private onStateChange: ((state: ModeState) => void) | null;

  constructor(config: CampaignModeConfig) {
    this.levels = config.levels.sort((a, b) => a.level_id - b.level_id);
    this.unlockThreshold = config.unlockThreshold ?? UNLOCK_THRESHOLD_PERCENT;
    this.onComplete = config.onComplete ?? null;
    this.onStateChange = config.onStateChange ?? null;

    // Initialize progress
    if (config.initialProgress) {
      this.progress = config.initialProgress;
    } else {
      this.progress = {
        currentLevel: 1,
        unlockedLevels: [1], // Level 1 always unlocked
        levelStats: new Map(),
      };
    }
  }

  /**
   * Gets the current campaign progress.
   */
  getProgress(): CampaignProgress {
    return {
      ...this.progress,
      levelStats: new Map(this.progress.levelStats),
    };
  }

  /**
   * Gets the current level ID.
   */
  getCurrentLevelId(): number {
    return this.progress.currentLevel;
  }

  /**
   * Gets all unlocked level IDs.
   */
  getUnlockedLevels(): number[] {
    return [...this.progress.unlockedLevels];
  }

  /**
   * Checks if a level is unlocked.
   */
  isLevelUnlocked(levelId: number): boolean {
    return this.progress.unlockedLevels.includes(levelId);
  }

  /**
   * Gets the level configuration for a level ID.
   */
  getLevel(levelId: number): LevelConfig | null {
    return this.levels.find((l) => l.level_id === levelId) ?? null;
  }

  /**
   * Gets all levels with unlock status.
   */
  getAllLevels(): Array<{ level: LevelConfig; unlocked: boolean; completed: boolean }> {
    return this.levels.map((level) => ({
      level,
      unlocked: this.isLevelUnlocked(level.level_id),
      completed: this.progress.levelStats.has(level.level_id),
    }));
  }

  /**
   * Starts a specific level.
   * @param levelId The level to start
   * @returns The level config, or null if not unlocked
   */
  startLevel(levelId: number): LevelConfig | null {
    if (!this.isLevelUnlocked(levelId)) {
      return null;
    }

    const level = this.getLevel(levelId);
    if (!level) {
      return null;
    }

    this.currentLevel = level;
    this.progress.currentLevel = levelId;
    this.setState('playing');

    return level;
  }

  /**
   * Starts the current level (or first unlocked).
   */
  start(): LevelConfig | null {
    return this.startLevel(this.progress.currentLevel);
  }

  /**
   * Completes the current level with the given stats.
   * @param stats Round statistics
   * @returns Result including whether next level was unlocked
   */
  completeLevel(stats: RoundStats): ModeResult {
    if (!this.currentLevel) {
      throw new Error('No level in progress');
    }

    const levelId = this.currentLevel.level_id;

    // Save stats for this level
    this.progress.levelStats.set(levelId, stats);

    // Check if next level should be unlocked
    let unlockedLevelId: number | undefined;
    if (stats.accuracy >= this.unlockThreshold) {
      const nextLevelId = levelId + 1;
      const nextLevel = this.getLevel(nextLevelId);

      if (nextLevel && !this.isLevelUnlocked(nextLevelId)) {
        this.progress.unlockedLevels.push(nextLevelId);
        this.progress.unlockedLevels.sort((a, b) => a - b);
        unlockedLevelId = nextLevelId;
        this.progress.currentLevel = nextLevelId;
      }
    }

    this.setState('ended');

    const result: ModeResult = {
      mode: 'campaign',
      stats,
      levelId,
      unlockedLevelId,
    };

    this.onComplete?.(result);
    return result;
  }

  /**
   * Gets the stats for a completed level.
   */
  getLevelStats(levelId: number): RoundStats | null {
    return this.progress.levelStats.get(levelId) ?? null;
  }

  /**
   * Gets the highest completed level.
   */
  getHighestCompletedLevel(): number {
    let highest = 0;
    for (const levelId of this.progress.levelStats.keys()) {
      if (levelId > highest) {
        highest = levelId;
      }
    }
    return highest;
  }

  /**
   * Gets the current mode state.
   */
  getState(): ModeState {
    return this.state;
  }

  /**
   * Gets the current level being played.
   */
  getCurrentLevel(): LevelConfig | null {
    return this.currentLevel;
  }

  /**
   * Pauses the current level.
   */
  pause(): void {
    if (this.state === 'playing') {
      this.setState('paused');
    }
  }

  /**
   * Resumes the current level.
   */
  resume(): void {
    if (this.state === 'paused') {
      this.setState('playing');
    }
  }

  /**
   * Resets progress to initial state.
   */
  reset(): void {
    this.progress = {
      currentLevel: 1,
      unlockedLevels: [1],
      levelStats: new Map(),
    };
    this.currentLevel = null;
    this.setState('idle');
  }

  /**
   * Exports progress for persistence.
   */
  exportProgress(): {
    currentLevel: number;
    unlockedLevels: number[];
    levelStats: Array<[number, RoundStats]>;
  } {
    return {
      currentLevel: this.progress.currentLevel,
      unlockedLevels: [...this.progress.unlockedLevels],
      levelStats: Array.from(this.progress.levelStats.entries()),
    };
  }

  /**
   * Imports progress from persistence.
   */
  importProgress(data: {
    currentLevel: number;
    unlockedLevels: number[];
    levelStats: Array<[number, RoundStats]>;
  }): void {
    this.progress = {
      currentLevel: data.currentLevel,
      unlockedLevels: [...data.unlockedLevels],
      levelStats: new Map(data.levelStats),
    };
  }

  /**
   * Sets callbacks.
   */
  setCallbacks(callbacks: {
    onComplete?: (result: ModeResult) => void;
    onStateChange?: (state: ModeState) => void;
  }): void {
    if (callbacks.onComplete) this.onComplete = callbacks.onComplete;
    if (callbacks.onStateChange) this.onStateChange = callbacks.onStateChange;
  }

  /**
   * Updates state and notifies listeners.
   */
  private setState(newState: ModeState): void {
    this.state = newState;
    this.onStateChange?.(newState);
  }
}
