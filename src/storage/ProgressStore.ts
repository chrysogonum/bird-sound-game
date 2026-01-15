/**
 * ProgressStore - Local storage wrapper for player progress
 *
 * Features:
 * - Persist unlocked levels and packs
 * - Track per-pack and per-level statistics
 * - Store high scores
 * - Export/import progress as JSON
 */

import type {
  PlayerProgress,
  PackStats,
  LevelStats,
  ConfusionPair,
  HighScores,
  PlayerSettings,
} from './types.js';
import {
  STORAGE_KEY,
  SCHEMA_VERSION,
  createEmptyProgress,
  createEmptyPackStats,
  createEmptyLevelStats,
  DEFAULT_SETTINGS,
} from './types.js';

/** Storage backend interface for testing */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** In-memory storage for testing */
export class MemoryStorage implements StorageBackend {
  private data: Map<string, string> = new Map();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  clear(): void {
    this.data.clear();
  }
}

/** ProgressStore configuration */
export interface ProgressStoreConfig {
  /** Storage backend (defaults to localStorage if available) */
  storage?: StorageBackend;
  /** Player ID */
  playerId?: string;
  /** Auto-save after changes */
  autoSave?: boolean;
}

/**
 * ProgressStore manages player progress persistence.
 */
export class ProgressStore {
  private storage: StorageBackend;
  private progress: PlayerProgress;
  private autoSave: boolean;
  private dirty: boolean = false;

  constructor(config: ProgressStoreConfig = {}) {
    // Use provided storage or fallback to memory storage
    this.storage = config.storage ?? new MemoryStorage();
    this.autoSave = config.autoSave ?? true;

    // Load or create progress
    const playerId = config.playerId ?? 'default';
    this.progress = this.load() ?? createEmptyProgress(playerId);
  }

  /**
   * Loads progress from storage.
   */
  load(): PlayerProgress | null {
    try {
      const data = this.storage.getItem(STORAGE_KEY);
      if (!data) return null;

      const parsed = JSON.parse(data) as PlayerProgress;

      // Validate and migrate if needed
      if (this.validateAndMigrate(parsed)) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Saves progress to storage.
   */
  save(): boolean {
    try {
      this.progress.lastPlayed = Date.now();
      const data = JSON.stringify(this.progress);
      this.storage.setItem(STORAGE_KEY, data);
      this.dirty = false;
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Marks progress as dirty and auto-saves if enabled.
   */
  private markDirty(): void {
    this.dirty = true;
    if (this.autoSave) {
      this.save();
    }
  }

  /**
   * Validates and migrates progress data.
   */
  private validateAndMigrate(data: PlayerProgress): boolean {
    // Check required fields exist
    if (!data.version || !data.playerId) {
      return false;
    }

    // Migrate if needed
    if (data.version < SCHEMA_VERSION) {
      this.migrate(data);
    }

    return true;
  }

  /**
   * Migrates old schema to current version.
   */
  private migrate(data: PlayerProgress): void {
    // Future migrations would go here
    data.version = SCHEMA_VERSION;
  }

  // ============ Level Management ============

  /**
   * Checks if a level is unlocked.
   */
  isLevelUnlocked(levelId: number): boolean {
    return this.progress.unlockedLevels.includes(levelId);
  }

  /**
   * Unlocks a level.
   */
  unlockLevel(levelId: number): void {
    if (!this.progress.unlockedLevels.includes(levelId)) {
      this.progress.unlockedLevels.push(levelId);
      this.progress.unlockedLevels.sort((a, b) => a - b);
      this.markDirty();
    }
  }

  /**
   * Gets all unlocked levels.
   */
  getUnlockedLevels(): number[] {
    return [...this.progress.unlockedLevels];
  }

  /**
   * Gets the highest unlocked level.
   */
  getHighestUnlockedLevel(): number {
    return Math.max(...this.progress.unlockedLevels, 1);
  }

  // ============ Pack Management ============

  /**
   * Checks if a pack is unlocked.
   */
  isPackUnlocked(packId: string): boolean {
    return this.progress.unlockedPacks.includes(packId);
  }

  /**
   * Unlocks a pack.
   */
  unlockPack(packId: string): void {
    if (!this.progress.unlockedPacks.includes(packId)) {
      this.progress.unlockedPacks.push(packId);
      this.markDirty();
    }
  }

  /**
   * Gets all unlocked packs.
   */
  getUnlockedPacks(): string[] {
    return [...this.progress.unlockedPacks];
  }

  // ============ Pack Stats ============

  /**
   * Gets stats for a pack.
   */
  getPackStats(packId: string): PackStats {
    if (!this.progress.packStats[packId]) {
      this.progress.packStats[packId] = createEmptyPackStats(packId);
    }
    return { ...this.progress.packStats[packId] };
  }

  /**
   * Records a game result for a pack.
   */
  recordPackGame(
    packId: string,
    events: number,
    correct: number,
    responseTimeMs: number
  ): void {
    if (!this.progress.packStats[packId]) {
      this.progress.packStats[packId] = createEmptyPackStats(packId);
    }

    const stats = this.progress.packStats[packId];
    stats.gamesPlayed++;
    stats.totalEvents += events;
    stats.correctCount += correct;
    stats.lastPlayed = Date.now();

    // Calculate accuracy
    const accuracy = events > 0 ? (correct / events) * 100 : 0;
    if (accuracy > stats.bestAccuracy) {
      stats.bestAccuracy = accuracy;
    }

    // Update response time
    if (responseTimeMs > 0) {
      stats.responseTimeSamples.push(responseTimeMs);
      // Keep last 100 samples
      if (stats.responseTimeSamples.length > 100) {
        stats.responseTimeSamples.shift();
      }
      // Recalculate average
      const sum = stats.responseTimeSamples.reduce((a, b) => a + b, 0);
      stats.averageResponseTimeMs = Math.round(sum / stats.responseTimeSamples.length);
    }

    this.markDirty();
  }

  /**
   * Updates streak for a pack.
   */
  updateStreak(packId: string, correct: boolean): void {
    if (!this.progress.packStats[packId]) {
      this.progress.packStats[packId] = createEmptyPackStats(packId);
    }

    const stats = this.progress.packStats[packId];

    if (correct) {
      stats.currentStreak++;
      if (stats.currentStreak > stats.bestStreak) {
        stats.bestStreak = stats.currentStreak;
      }
    } else {
      stats.currentStreak = 0;
    }

    this.markDirty();
  }

  /**
   * Records a confusion between two species.
   */
  recordConfusion(packId: string, speciesA: string, speciesB: string): void {
    if (!this.progress.packStats[packId]) {
      this.progress.packStats[packId] = createEmptyPackStats(packId);
    }

    const stats = this.progress.packStats[packId];

    // Normalize order for consistent pairing
    const [first, second] = [speciesA, speciesB].sort();

    // Find existing pair
    const pair = stats.confusionPairs.find(
      (p) => p.speciesA === first && p.speciesB === second
    );

    if (pair) {
      pair.count++;
      pair.lastConfused = Date.now();
    } else {
      stats.confusionPairs.push({
        speciesA: first,
        speciesB: second,
        count: 1,
        lastConfused: Date.now(),
      });
    }

    this.markDirty();
  }

  /**
   * Gets confusion pairs for a pack.
   */
  getConfusionPairs(packId: string): ConfusionPair[] {
    const stats = this.progress.packStats[packId];
    if (!stats) return [];
    return [...stats.confusionPairs].sort((a, b) => b.count - a.count);
  }

  /**
   * Gets confusion pairs with count >= threshold.
   */
  getSignificantConfusions(packId: string, threshold: number = 2): ConfusionPair[] {
    return this.getConfusionPairs(packId).filter((p) => p.count >= threshold);
  }

  // ============ Level Stats ============

  /**
   * Gets stats for a level.
   */
  getLevelStats(levelId: number): LevelStats {
    if (!this.progress.levelStats[levelId]) {
      this.progress.levelStats[levelId] = createEmptyLevelStats(levelId);
    }
    return { ...this.progress.levelStats[levelId] };
  }

  /**
   * Records a level attempt.
   */
  recordLevelAttempt(levelId: number, completed: boolean, score: number, accuracy: number): void {
    if (!this.progress.levelStats[levelId]) {
      this.progress.levelStats[levelId] = createEmptyLevelStats(levelId);
    }

    const stats = this.progress.levelStats[levelId];
    stats.attempts++;
    stats.lastPlayed = Date.now();

    if (completed) {
      stats.completions++;

      if (score > stats.bestScore) {
        stats.bestScore = score;
      }

      if (accuracy > stats.bestAccuracy) {
        stats.bestAccuracy = accuracy;
      }
    }

    this.markDirty();
  }

  // ============ High Scores ============

  /**
   * Gets high scores.
   */
  getHighScores(): HighScores {
    return {
      campaign: { ...this.progress.highScores.campaign },
      challenge: this.progress.highScores.challenge,
      random: this.progress.highScores.random,
    };
  }

  /**
   * Updates campaign high score for a level.
   */
  updateCampaignHighScore(levelId: number, score: number): boolean {
    const current = this.progress.highScores.campaign[levelId] ?? 0;
    if (score > current) {
      this.progress.highScores.campaign[levelId] = score;
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Updates challenge mode high score.
   */
  updateChallengeHighScore(score: number): boolean {
    if (score > this.progress.highScores.challenge) {
      this.progress.highScores.challenge = score;
      this.markDirty();
      return true;
    }
    return false;
  }

  /**
   * Updates random mode high score.
   */
  updateRandomHighScore(score: number): boolean {
    if (score > this.progress.highScores.random) {
      this.progress.highScores.random = score;
      this.markDirty();
      return true;
    }
    return false;
  }

  // ============ Play Time ============

  /**
   * Adds play time.
   */
  addPlayTime(timeMs: number): void {
    this.progress.totalPlayTimeMs += timeMs;
    this.markDirty();
  }

  /**
   * Gets total play time in ms.
   */
  getTotalPlayTime(): number {
    return this.progress.totalPlayTimeMs;
  }

  // ============ Settings ============

  /**
   * Gets player settings.
   */
  getSettings(): PlayerSettings {
    return { ...this.progress.settings };
  }

  /**
   * Updates player settings.
   */
  updateSettings(settings: Partial<PlayerSettings>): void {
    this.progress.settings = {
      ...this.progress.settings,
      ...settings,
    };
    this.markDirty();
  }

  // ============ Export/Import ============

  /**
   * Exports progress as JSON string.
   */
  export(): string {
    return JSON.stringify(this.progress, null, 2);
  }

  /**
   * Exports progress as object.
   */
  exportAsObject(): PlayerProgress {
    return JSON.parse(JSON.stringify(this.progress));
  }

  /**
   * Imports progress from JSON string.
   */
  import(json: string): boolean {
    try {
      const data = JSON.parse(json) as PlayerProgress;
      if (this.validateAndMigrate(data)) {
        this.progress = data;
        this.markDirty();
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Imports progress from object.
   */
  importFromObject(data: PlayerProgress): boolean {
    if (this.validateAndMigrate(data)) {
      this.progress = JSON.parse(JSON.stringify(data));
      this.markDirty();
      return true;
    }
    return false;
  }

  // ============ Reset ============

  /**
   * Resets all progress.
   */
  reset(): void {
    this.progress = createEmptyProgress(this.progress.playerId);
    this.markDirty();
  }

  /**
   * Clears storage completely.
   */
  clear(): void {
    this.storage.removeItem(STORAGE_KEY);
    this.progress = createEmptyProgress(this.progress.playerId);
    this.dirty = false;
  }

  // ============ Getters ============

  /**
   * Gets the full progress object (read-only copy).
   */
  getProgress(): PlayerProgress {
    return JSON.parse(JSON.stringify(this.progress));
  }

  /**
   * Checks if there are unsaved changes.
   */
  isDirty(): boolean {
    return this.dirty;
  }

  /**
   * Gets the player ID.
   */
  getPlayerId(): string {
    return this.progress.playerId;
  }

  /**
   * Gets the schema version.
   */
  getVersion(): number {
    return this.progress.version;
  }
}
