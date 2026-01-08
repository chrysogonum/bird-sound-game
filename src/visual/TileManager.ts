/**
 * TileManager - Manages spectrogram tiles for SoundField: Birds
 *
 * Handles:
 * - Tile creation and lifecycle management
 * - Preloading tiles ahead of playback
 * - Memory management and tile disposal
 * - Tile state transitions
 */

import type { GameEvent } from '../game/types.js';
import type {
  SpectrogramTile,
  TileState,
  LanePosition,
  TileManagerConfig,
  TileEventCallback,
} from './types.js';
import { DEFAULT_TILE_CONFIG, VISUAL_ANIMATIONS } from './types.js';

/**
 * Manages the lifecycle of spectrogram tiles.
 */
export class TileManager {
  private readonly config: Required<TileManagerConfig>;
  private tiles: Map<string, SpectrogramTile> = new Map();
  private imageCache: Map<string, HTMLImageElement | null> = new Map();
  private onTileReady: Set<TileEventCallback> = new Set();
  private onTileDisposed: Set<TileEventCallback> = new Set();

  constructor(config: TileManagerConfig = {}) {
    this.config = {
      maxTiles: config.maxTiles ?? DEFAULT_TILE_CONFIG.maxTiles,
      preloadMs: config.preloadMs ?? DEFAULT_TILE_CONFIG.preloadMs,
      disposeMs: config.disposeMs ?? DEFAULT_TILE_CONFIG.disposeMs,
    };
  }

  /**
   * Creates a tile from a game event.
   */
  createTile(event: GameEvent, spectrogramPath: string | null): SpectrogramTile {
    const tile: SpectrogramTile = {
      tileId: `tile_${event.event_id}`,
      eventId: event.event_id,
      speciesCode: event.species_code,
      lane: event.channel as LanePosition,
      spectrogramPath,
      scheduledTimeMs: event.scheduled_time_ms,
      durationMs: event.duration_ms,
      state: 'loading',
      normalizedY: 1.0, // Start at top
      opacity: 0, // Start invisible
      scored: false,
    };

    this.tiles.set(tile.tileId, tile);

    // Start loading the image if available
    if (spectrogramPath) {
      this.loadImage(tile);
    } else {
      // No spectrogram, mark as ready immediately
      this.setTileState(tile.tileId, 'ready');
    }

    return tile;
  }

  /**
   * Loads the spectrogram image for a tile.
   */
  private loadImage(tile: SpectrogramTile): void {
    if (!tile.spectrogramPath) {
      this.setTileState(tile.tileId, 'ready');
      return;
    }

    // Check cache first
    if (this.imageCache.has(tile.spectrogramPath)) {
      this.setTileState(tile.tileId, 'ready');
      return;
    }

    // In browser environment, load the image
    if (typeof Image !== 'undefined') {
      const img = new Image();
      img.onload = () => {
        this.imageCache.set(tile.spectrogramPath!, img);
        this.setTileState(tile.tileId, 'ready');
      };
      img.onerror = () => {
        // Mark as ready even on error (will render without spectrogram)
        this.imageCache.set(tile.spectrogramPath!, null);
        this.setTileState(tile.tileId, 'ready');
      };
      img.src = tile.spectrogramPath;
    } else {
      // Not in browser, mark as ready
      this.setTileState(tile.tileId, 'ready');
    }
  }

  /**
   * Gets a tile by ID.
   */
  getTile(tileId: string): SpectrogramTile | undefined {
    return this.tiles.get(tileId);
  }

  /**
   * Gets a tile by event ID.
   */
  getTileByEventId(eventId: string): SpectrogramTile | undefined {
    for (const tile of this.tiles.values()) {
      if (tile.eventId === eventId) {
        return tile;
      }
    }
    return undefined;
  }

  /**
   * Gets all tiles.
   */
  getAllTiles(): SpectrogramTile[] {
    return Array.from(this.tiles.values());
  }

  /**
   * Gets tiles for a specific lane.
   */
  getTilesForLane(lane: LanePosition): SpectrogramTile[] {
    return Array.from(this.tiles.values()).filter((t) => t.lane === lane);
  }

  /**
   * Gets visible tiles (state = 'visible').
   */
  getVisibleTiles(): SpectrogramTile[] {
    return Array.from(this.tiles.values()).filter((t) => t.state === 'visible');
  }

  /**
   * Gets tiles that are ready or visible.
   */
  getActiveTiles(): SpectrogramTile[] {
    return Array.from(this.tiles.values()).filter(
      (t) => t.state === 'ready' || t.state === 'visible'
    );
  }

  /**
   * Sets the state of a tile.
   */
  setTileState(tileId: string, state: TileState): void {
    const tile = this.tiles.get(tileId);
    if (!tile) return;

    const previousState = tile.state;
    tile.state = state;

    // Trigger callbacks
    if (state === 'ready' && previousState === 'loading') {
      for (const callback of this.onTileReady) {
        callback(tile);
      }
    } else if (state === 'disposed') {
      for (const callback of this.onTileDisposed) {
        callback(tile);
      }
    }
  }

  /**
   * Updates tile positions and states based on current time.
   */
  update(currentTimeMs: number, approachTimeMs: number): void {
    for (const tile of this.tiles.values()) {
      // Calculate normalized Y position (1 = top, 0 = hit zone)
      const timeToHit = tile.scheduledTimeMs - currentTimeMs;
      tile.normalizedY = Math.max(0, Math.min(1, timeToHit / approachTimeMs));

      // Update opacity based on state
      this.updateTileOpacity(tile, currentTimeMs);

      // Transition states
      this.updateTileState(tile, currentTimeMs);
    }

    // Clean up old tiles
    this.cleanupTiles(currentTimeMs);
  }

  /**
   * Updates tile opacity based on its state and position.
   */
  private updateTileOpacity(tile: SpectrogramTile, currentTimeMs: number): void {
    switch (tile.state) {
      case 'loading':
        tile.opacity = 0;
        break;
      case 'ready':
        // Fade in
        tile.opacity = Math.min(1, tile.opacity + 0.1);
        break;
      case 'visible':
        tile.opacity = 1;
        break;
      case 'exiting':
        // Fade out
        tile.opacity = Math.max(0, tile.opacity - 0.1);
        break;
      case 'disposed':
        tile.opacity = 0;
        break;
    }
  }

  /**
   * Updates tile state based on position and time.
   */
  private updateTileState(tile: SpectrogramTile, currentTimeMs: number): void {
    // Ready -> Visible when approaching hit zone
    if (tile.state === 'ready' && tile.normalizedY < 1) {
      tile.state = 'visible';
    }

    // Visible -> Exiting when past hit zone and scored
    if (tile.state === 'visible' && tile.scored && tile.normalizedY <= 0) {
      tile.state = 'exiting';
    }
  }

  /**
   * Cleans up old tiles to manage memory.
   */
  private cleanupTiles(currentTimeMs: number): void {
    const tilesToRemove: string[] = [];

    for (const tile of this.tiles.values()) {
      // Remove tiles that have been exiting long enough
      if (tile.state === 'exiting' && tile.opacity <= 0) {
        tile.state = 'disposed';
        tilesToRemove.push(tile.tileId);
      }

      // Remove tiles that are way past their time (but not in exiting state)
      const timePastScheduled = currentTimeMs - tile.scheduledTimeMs;
      if (timePastScheduled > this.config.disposeMs + tile.durationMs + 500) {
        if (tile.state !== 'disposed' && tile.state !== 'exiting') {
          tile.state = 'disposed';
          tilesToRemove.push(tile.tileId);
        }
      }
    }

    // Remove disposed tiles
    for (const tileId of tilesToRemove) {
      const tile = this.tiles.get(tileId);
      if (tile) {
        for (const callback of this.onTileDisposed) {
          callback(tile);
        }
        this.tiles.delete(tileId);
      }
    }

    // Enforce max tiles limit
    if (this.tiles.size > this.config.maxTiles) {
      const sortedTiles = Array.from(this.tiles.values())
        .sort((a, b) => a.scheduledTimeMs - b.scheduledTimeMs);

      const excess = this.tiles.size - this.config.maxTiles;
      for (let i = 0; i < excess; i++) {
        const tile = sortedTiles[i];
        if (tile.state === 'exiting' || tile.state === 'disposed') {
          this.tiles.delete(tile.tileId);
        }
      }
    }
  }

  /**
   * Marks a tile as scored.
   */
  markScored(eventId: string): void {
    const tile = this.getTileByEventId(eventId);
    if (tile) {
      tile.scored = true;
      tile.state = 'exiting';
    }
  }

  /**
   * Gets the cached image for a spectrogram path.
   */
  getImage(spectrogramPath: string): HTMLImageElement | null | undefined {
    return this.imageCache.get(spectrogramPath);
  }

  /**
   * Preloads tiles for upcoming events.
   */
  preloadTiles(
    events: GameEvent[],
    currentTimeMs: number,
    getSpectrogramPath: (clipId: string) => string | null
  ): void {
    const preloadEnd = currentTimeMs + this.config.preloadMs;

    for (const event of events) {
      // Skip events already tiled
      if (this.getTileByEventId(event.event_id)) {
        continue;
      }

      // Skip events too far in the future
      if (event.scheduled_time_ms > preloadEnd) {
        continue;
      }

      // Skip events in the past
      if (event.scheduled_time_ms + event.duration_ms < currentTimeMs) {
        continue;
      }

      // Create tile
      const spectrogramPath = getSpectrogramPath(event.clip_id);
      this.createTile(event, spectrogramPath);
    }
  }

  /**
   * Adds a callback for when a tile becomes ready.
   */
  addOnTileReady(callback: TileEventCallback): void {
    this.onTileReady.add(callback);
  }

  /**
   * Removes a tile ready callback.
   */
  removeOnTileReady(callback: TileEventCallback): void {
    this.onTileReady.delete(callback);
  }

  /**
   * Adds a callback for when a tile is disposed.
   */
  addOnTileDisposed(callback: TileEventCallback): void {
    this.onTileDisposed.add(callback);
  }

  /**
   * Removes a tile disposed callback.
   */
  removeOnTileDisposed(callback: TileEventCallback): void {
    this.onTileDisposed.delete(callback);
  }

  /**
   * Gets the tile count.
   */
  getTileCount(): number {
    return this.tiles.size;
  }

  /**
   * Gets the count of tiles in each state.
   */
  getStateCounts(): Record<TileState, number> {
    const counts: Record<TileState, number> = {
      loading: 0,
      ready: 0,
      visible: 0,
      exiting: 0,
      disposed: 0,
    };

    for (const tile of this.tiles.values()) {
      counts[tile.state]++;
    }

    return counts;
  }

  /**
   * Clears all tiles and cache.
   */
  clear(): void {
    this.tiles.clear();
    this.imageCache.clear();
  }

  /**
   * Resets the manager for a new round.
   */
  reset(): void {
    this.clear();
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<TileManagerConfig> {
    return { ...this.config };
  }
}
