/**
 * LaneContainer - PixiJS container for managing a scrolling lane of tiles
 *
 * Features:
 * - Manages tiles for left or right lane
 * - Handles tile creation, positioning, and removal
 * - Renders hit zone and lane background
 * - Provides feedback when tiles are scored
 */

import * as PIXI from 'pixi.js';
import { TileSprite, TileConfig, TileFeedbackType } from './TileSprite';

/** Lane configuration */
export interface LaneConfig {
  /** Lane side ('left' or 'right') */
  channel: 'left' | 'right';
  /** Lane width */
  width: number;
  /** Lane height */
  height: number;
  /** X offset for lane positioning */
  xOffset: number;
  /** Scroll speed in pixels per second */
  scrollSpeed: number;
  /** Hit zone Y position (percentage from top, 0-1) */
  hitZonePosition: number;
}

/** Event data for creating tiles */
export interface TileEventData {
  eventId: string;
  speciesCode: string;
  spectrogramPath: string | null;
  scheduledTimeMs: number;
  durationMs: number;
}

/** Colors from design system */
const COLORS = {
  background: 0x1a1a2e,
  surface: 0x2d2d44,
  hitZone: 0xf5a623,
  laneLeft: 0x2d5a27,
  laneRight: 0x4a90d9,
  text: 0xffffff,
  textMuted: 0xa0a0b0,
};

/**
 * LaneContainer class for managing a scrolling lane
 */
export class LaneContainer extends PIXI.Container {
  private config: LaneConfig;
  private tiles: Map<string, TileSprite> = new Map();
  private background: PIXI.Graphics;
  private hitZone: PIXI.Graphics;
  private hitZoneGlow: PIXI.Graphics;
  private label: PIXI.Text;
  private laneMask: PIXI.Graphics;

  private hitZoneY: number;
  private laneCenterX: number;
  private tileWidth: number;
  private tileHeight: number;

  /** Hit zone flash state */
  private isFlashing = false;
  private flashStartTime = 0;
  private flashColor = 0xffffff;

  constructor(config: LaneConfig) {
    super();
    this.config = config;

    // Calculate dimensions
    this.hitZoneY = config.height * config.hitZonePosition;
    this.laneCenterX = config.width / 2;
    this.tileWidth = config.width * 0.7;
    this.tileHeight = 80;

    // Create background
    this.background = new PIXI.Graphics();
    this.drawBackground();
    this.addChild(this.background);

    // Create mask to clip tiles
    this.laneMask = new PIXI.Graphics();
    this.laneMask.beginFill(0xffffff);
    this.laneMask.drawRect(0, 0, config.width, config.height);
    this.laneMask.endFill();
    this.addChild(this.laneMask);
    this.mask = this.laneMask;

    // Create hit zone glow (behind hit zone)
    this.hitZoneGlow = new PIXI.Graphics();
    this.drawHitZoneGlow();
    this.addChild(this.hitZoneGlow);

    // Create hit zone line
    this.hitZone = new PIXI.Graphics();
    this.drawHitZone();
    this.addChild(this.hitZone);

    // Create lane label
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 14,
      fill: COLORS.textMuted,
      fontWeight: '600',
    });
    const labelText = config.channel === 'left' ? 'LEFT' : 'RIGHT';
    this.label = new PIXI.Text(labelText, labelStyle);
    this.label.anchor.set(0.5);
    this.label.position.set(this.laneCenterX, 30);
    this.label.alpha = 0.5;
    this.addChild(this.label);

    // Position the container
    this.position.x = config.xOffset;
  }

  /**
   * Draw lane background
   */
  private drawBackground(): void {
    const { width, height } = this.config;
    this.background.clear();
    this.background.beginFill(COLORS.background, 1);
    this.background.drawRect(0, 0, width, height);
    this.background.endFill();
  }

  /**
   * Draw hit zone line
   */
  private drawHitZone(): void {
    const { width } = this.config;
    const padding = 20;

    this.hitZone.clear();
    this.hitZone.beginFill(COLORS.hitZone, 0.9);
    this.hitZone.drawRect(padding, this.hitZoneY - 2, width - padding * 2, 4);
    this.hitZone.endFill();
  }

  /**
   * Draw hit zone glow effect
   */
  private drawHitZoneGlow(): void {
    const { width } = this.config;
    const padding = 20;

    this.hitZoneGlow.clear();
    this.hitZoneGlow.beginFill(COLORS.hitZone, 0.15);
    this.hitZoneGlow.drawRect(padding, this.hitZoneY - 30, width - padding * 2, 60);
    this.hitZoneGlow.endFill();
  }

  /**
   * Add a tile to the lane
   */
  addTile(event: TileEventData): TileSprite {
    const tileConfig: TileConfig = {
      eventId: event.eventId,
      speciesCode: event.speciesCode,
      spectrogramPath: event.spectrogramPath,
      channel: this.config.channel,
      scheduledTimeMs: event.scheduledTimeMs,
      durationMs: event.durationMs,
      width: this.tileWidth,
      height: this.tileHeight,
      laneCenterX: this.laneCenterX,
      hitZoneY: this.hitZoneY,
      scrollSpeed: this.config.scrollSpeed,
    };

    const tile = new TileSprite(tileConfig);
    this.tiles.set(event.eventId, tile);
    this.addChild(tile);

    return tile;
  }

  /**
   * Remove a tile from the lane
   */
  removeTile(eventId: string): void {
    const tile = this.tiles.get(eventId);
    if (tile) {
      this.removeChild(tile);
      tile.destroy();
      this.tiles.delete(eventId);
    }
  }

  /**
   * Get a tile by event ID
   */
  getTile(eventId: string): TileSprite | undefined {
    return this.tiles.get(eventId);
  }

  /**
   * Show feedback for a tile
   */
  showTileFeedback(eventId: string, type: TileFeedbackType, score: number): void {
    const tile = this.tiles.get(eventId);
    if (tile) {
      tile.showFeedback(type, score);
      this.flashHitZone(type);
    }
  }

  /**
   * Flash the hit zone on feedback
   */
  private flashHitZone(type: TileFeedbackType): void {
    this.isFlashing = true;
    this.flashStartTime = performance.now();

    switch (type) {
      case 'perfect':
      case 'good':
        this.flashColor = 0x4caf50;
        break;
      case 'partial':
        this.flashColor = 0xf5a623;
        break;
      case 'miss':
        this.flashColor = 0xe57373;
        break;
      default:
        this.flashColor = 0xffffff;
    }
  }

  /**
   * Update all tiles and animations
   * @param currentTimeMs Current round time in ms
   */
  update(currentTimeMs: number): void {
    // Update each tile
    const tilesToRemove: string[] = [];

    for (const [eventId, tile] of this.tiles) {
      // Update position
      tile.updatePosition(currentTimeMs);

      // Update feedback animation
      if (tile.isAnimating()) {
        tile.updateFeedback();
      }

      // Check if tile should be removed
      if (tile.shouldRemove()) {
        tilesToRemove.push(eventId);
      } else if (tile.isPastHitZone(currentTimeMs, 1000)) {
        // Tile passed without being scored - mark as miss
        if (!tile.isAnimating()) {
          tile.showFeedback('miss', 0);
        }
      }
    }

    // Remove completed tiles
    for (const eventId of tilesToRemove) {
      this.removeTile(eventId);
    }

    // Update hit zone flash
    this.updateHitZoneFlash();
  }

  /**
   * Update hit zone flash animation
   */
  private updateHitZoneFlash(): void {
    if (!this.isFlashing) return;

    const elapsed = performance.now() - this.flashStartTime;
    const duration = 200; // 200ms flash

    if (elapsed >= duration) {
      this.isFlashing = false;
      this.drawHitZone(); // Reset to normal
      return;
    }

    const progress = elapsed / duration;
    const alpha = 0.9 + 0.1 * Math.sin(progress * Math.PI);

    this.hitZone.clear();
    this.hitZone.beginFill(this.flashColor, alpha);
    this.hitZone.drawRect(20, this.hitZoneY - 2, this.config.width - 40, 4);
    this.hitZone.endFill();
  }

  /**
   * Clear all tiles
   */
  clearTiles(): void {
    for (const [eventId] of this.tiles) {
      this.removeTile(eventId);
    }
  }

  /**
   * Get all active tile event IDs
   */
  getActiveTileIds(): string[] {
    return Array.from(this.tiles.keys());
  }

  /**
   * Get tile count
   */
  getTileCount(): number {
    return this.tiles.size;
  }

  /**
   * Resize the lane
   */
  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.hitZoneY = height * this.config.hitZonePosition;
    this.laneCenterX = width / 2;
    this.tileWidth = width * 0.7;

    // Redraw elements
    this.drawBackground();
    this.drawHitZone();
    this.drawHitZoneGlow();

    // Update mask
    this.laneMask.clear();
    this.laneMask.beginFill(0xffffff);
    this.laneMask.drawRect(0, 0, width, height);
    this.laneMask.endFill();

    // Update label position
    this.label.position.x = this.laneCenterX;
  }

  /**
   * Get the channel
   */
  getChannel(): 'left' | 'right' {
    return this.config.channel;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.clearTiles();
    TileSprite.clearCache();
    super.destroy({ children: true });
  }
}

export default LaneContainer;
