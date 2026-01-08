/**
 * LevelLoader - Parse and apply Level configs for SoundField: Birds
 *
 * Loads level configurations from levels.json and provides methods
 * to access and validate level data.
 */

import type { LevelConfig, SpeciesSelection } from './types.js';
import type { ClipMetadata } from '../audio/types.js';

/**
 * LevelLoader manages loading and accessing level configurations.
 */
export class LevelLoader {
  private levels: Map<number, LevelConfig> = new Map();
  private clips: ClipMetadata[] = [];
  private loaded: boolean = false;

  /**
   * Loads level configurations from JSON data.
   * @param levelsData Array of level configurations
   */
  loadLevels(levelsData: LevelConfig[]): void {
    this.levels.clear();
    for (const level of levelsData) {
      this.validateLevel(level);
      this.levels.set(level.level_id, level);
    }
    this.loaded = true;
  }

  /**
   * Loads clip metadata for species selection.
   * @param clipsData Array of clip metadata
   */
  loadClips(clipsData: ClipMetadata[]): void {
    this.clips = [...clipsData];
  }

  /**
   * Loads levels from a URL (for browser environment).
   * @param url URL to levels.json
   */
  async loadLevelsFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load levels from ${url}`);
    }
    const data = await response.json();
    this.loadLevels(data);
  }

  /**
   * Loads clips from a URL (for browser environment).
   * @param url URL to clips.json
   */
  async loadClipsFromUrl(url: string): Promise<void> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load clips from ${url}`);
    }
    const data = await response.json();
    this.loadClips(data);
  }

  /**
   * Gets a level configuration by ID.
   * @param levelId The level ID
   * @returns The level configuration, or undefined if not found
   */
  getLevel(levelId: number): LevelConfig | undefined {
    return this.levels.get(levelId);
  }

  /**
   * Gets all loaded levels.
   */
  getAllLevels(): LevelConfig[] {
    return Array.from(this.levels.values()).sort((a, b) => a.level_id - b.level_id);
  }

  /**
   * Gets the total number of levels.
   */
  getLevelCount(): number {
    return this.levels.size;
  }

  /**
   * Checks if levels have been loaded.
   */
  isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * Gets species available for a level based on species_count.
   * Randomly selects species from available clips.
   * @param levelId The level ID
   * @param seed Optional random seed for deterministic selection
   * @returns Array of species selections
   */
  getSpeciesForLevel(levelId: number, seed?: number): SpeciesSelection[] {
    const level = this.getLevel(levelId);
    if (!level) {
      throw new Error(`Level ${levelId} not found`);
    }

    // Group clips by species
    const speciesMap = new Map<string, ClipMetadata[]>();
    for (const clip of this.clips) {
      const existing = speciesMap.get(clip.species_code) || [];
      existing.push(clip);
      speciesMap.set(clip.species_code, existing);
    }

    // Get unique species
    const allSpecies = Array.from(speciesMap.entries()).map(([code, clips]) => ({
      speciesCode: code,
      commonName: clips[0].common_name,
      clips,
    }));

    // Select species up to the level's species_count
    const count = Math.min(level.species_count, allSpecies.length);

    // Use seeded random if provided, otherwise shuffle
    const shuffled = this.shuffleArray(allSpecies, seed);
    return shuffled.slice(0, count);
  }

  /**
   * Gets all available species from loaded clips.
   */
  getAllSpecies(): SpeciesSelection[] {
    const speciesMap = new Map<string, ClipMetadata[]>();
    for (const clip of this.clips) {
      const existing = speciesMap.get(clip.species_code) || [];
      existing.push(clip);
      speciesMap.set(clip.species_code, existing);
    }

    return Array.from(speciesMap.entries()).map(([code, clips]) => ({
      speciesCode: code,
      commonName: clips[0].common_name,
      clips,
    }));
  }

  /**
   * Gets the number of unique species available.
   */
  getAvailableSpeciesCount(): number {
    const species = new Set(this.clips.map((c) => c.species_code));
    return species.size;
  }

  /**
   * Gets all clips for a specific species.
   * @param speciesCode The species code
   */
  getClipsForSpecies(speciesCode: string): ClipMetadata[] {
    return this.clips.filter((c) => c.species_code === speciesCode);
  }

  /**
   * Gets a random clip for a species.
   * @param speciesCode The species code
   * @param seed Optional random seed
   */
  getRandomClipForSpecies(speciesCode: string, seed?: number): ClipMetadata | undefined {
    const clips = this.getClipsForSpecies(speciesCode);
    if (clips.length === 0) return undefined;

    const index = seed !== undefined
      ? Math.abs(seed) % clips.length
      : Math.floor(Math.random() * clips.length);
    return clips[index];
  }

  /**
   * Validates a level configuration.
   */
  private validateLevel(level: LevelConfig): void {
    if (level.level_id < 1) {
      throw new Error(`Invalid level_id: ${level.level_id}`);
    }
    if (level.round_duration_sec < 10 || level.round_duration_sec > 60) {
      throw new Error(`Invalid round_duration_sec: ${level.round_duration_sec}`);
    }
    if (level.species_count < 4 || level.species_count > 12) {
      throw new Error(`Invalid species_count: ${level.species_count}`);
    }
    if (level.overlap_probability < 0 || level.overlap_probability > 0.75) {
      throw new Error(`Invalid overlap_probability: ${level.overlap_probability}`);
    }
    if (level.scoring_window_ms < 300 || level.scoring_window_ms > 2000) {
      throw new Error(`Invalid scoring_window_ms: ${level.scoring_window_ms}`);
    }
  }

  /**
   * Shuffles an array using Fisher-Yates algorithm.
   * @param array Array to shuffle
   * @param seed Optional random seed for deterministic shuffling
   */
  private shuffleArray<T>(array: T[], seed?: number): T[] {
    const result = [...array];
    const random = seed !== undefined ? this.seededRandom(seed) : Math.random;

    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }

  /**
   * Creates a seeded random number generator.
   */
  private seededRandom(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
  }
}
