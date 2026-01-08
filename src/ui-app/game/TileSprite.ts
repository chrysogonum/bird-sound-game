/**
 * TileSprite - PixiJS sprite for rendering spectrogram tiles
 *
 * Features:
 * - Loads real spectrogram PNG images
 * - Scrolls toward hit zone
 * - Displays hit feedback (glow on correct, shake on miss)
 * - Score pop animation
 */

import * as PIXI from 'pixi.js';

/** Feedback types for tile animations */
export type TileFeedbackType = 'perfect' | 'good' | 'partial' | 'miss' | 'none';

/** Colors from design system */
const COLORS: Record<string, number> = {
  perfect: 0x4caf50,
  good: 0x4caf50,
  partial: 0xf5a623,
  miss: 0xe57373,
  none: 0xffffff,
  border: 0xffffff,
  text: 0xffffff,
};

/** Tile configuration */
export interface TileConfig {
  /** Unique event ID */
  eventId: string;
  /** Species code (e.g., 'NOCA') */
  speciesCode: string;
  /** Path to spectrogram image */
  spectrogramPath: string | null;
  /** Channel ('left' or 'right') */
  channel: 'left' | 'right';
  /** Scheduled time in ms from round start */
  scheduledTimeMs: number;
  /** Duration of the clip in ms */
  durationMs: number;
  /** Tile width */
  width: number;
  /** Tile height */
  height: number;
  /** Lane center X position */
  laneCenterX: number;
  /** Hit zone Y position */
  hitZoneY: number;
  /** Scroll speed in pixels per second */
  scrollSpeed: number;
}

/**
 * TileSprite class for rendering and animating spectrogram tiles
 */
export class TileSprite extends PIXI.Container {
  private config: TileConfig;
  private background: PIXI.Graphics;
  private spectrogram: PIXI.Sprite | null = null;
  private label: PIXI.Text;
  private glowOverlay: PIXI.Graphics;
  private scorePopText: PIXI.Text | null = null;

  private feedback: TileFeedbackType = 'none';
  private isAnimatingFeedback = false;
  private feedbackStartTime = 0;
  private shakeOffset = 0;
  private fadeOutProgress = 0;
  private isRemoved = false;

  /** Texture cache for spectrograms */
  private static textureCache: Map<string, PIXI.Texture> = new Map();

  constructor(config: TileConfig) {
    super();
    this.config = config;

    // Create background
    this.background = new PIXI.Graphics();
    this.drawBackground();
    this.addChild(this.background);

    // Create glow overlay (initially invisible)
    this.glowOverlay = new PIXI.Graphics();
    this.glowOverlay.alpha = 0;
    this.addChild(this.glowOverlay);

    // Create species label
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 12,
      fill: COLORS.text,
      fontWeight: '700',
    });
    this.label = new PIXI.Text(config.speciesCode, labelStyle);
    this.label.anchor.set(0.5);
    this.label.position.set(0, config.height / 2 + 16);
    this.addChild(this.label);

    // Position at lane center
    this.position.x = config.laneCenterX;

    // Load spectrogram if available
    if (config.spectrogramPath) {
      this.loadSpectrogram(config.spectrogramPath);
    }
  }

  /**
   * Draw the background rectangle
   */
  private drawBackground(): void {
    const { width, height, channel } = this.config;
    const color = channel === 'left' ? 0x2d5a27 : 0x4a90d9;

    this.background.clear();
    this.background.beginFill(color, 0.3);
    this.background.lineStyle(2, color, 0.6);
    this.background.drawRoundedRect(-width / 2, -height / 2, width, height, 8);
    this.background.endFill();
  }

  /**
   * Load the spectrogram texture
   */
  private async loadSpectrogram(path: string): Promise<void> {
    try {
      // Check cache first
      let texture = TileSprite.textureCache.get(path);

      if (!texture) {
        // Load texture
        const loaded = await PIXI.Assets.load(`/${path}`);
        if (!loaded) {
          console.warn(`Failed to load spectrogram texture: ${path}`);
          return;
        }
        texture = loaded as PIXI.Texture;
        TileSprite.textureCache.set(path, texture);
      }

      // Create sprite
      this.spectrogram = new PIXI.Sprite(texture);
      this.spectrogram.anchor.set(0.5);
      this.spectrogram.width = this.config.width - 8;
      this.spectrogram.height = this.config.height - 8;
      this.spectrogram.position.set(0, 0);

      // Add behind the glow overlay
      this.addChildAt(this.spectrogram, 1);
    } catch (error) {
      console.warn(`Failed to load spectrogram: ${path}`, error);
    }
  }

  /**
   * Calculate the Y position based on current time
   * @param currentTimeMs Current round time in ms
   */
  calculateY(currentTimeMs: number): number {
    const { scheduledTimeMs, hitZoneY, scrollSpeed } = this.config;

    // Time until the tile should reach hit zone (in seconds)
    const timeToHitMs = scheduledTimeMs - currentTimeMs;
    const timeToHitSec = timeToHitMs / 1000;

    // Position relative to hit zone
    const distanceFromHitZone = timeToHitSec * scrollSpeed;
    return hitZoneY - distanceFromHitZone + this.shakeOffset;
  }

  /**
   * Update position based on current time
   */
  updatePosition(currentTimeMs: number): void {
    if (this.isRemoved) return;

    const newY = this.calculateY(currentTimeMs);
    this.position.y = newY;

    // Apply fade out if in progress
    if (this.fadeOutProgress > 0) {
      this.alpha = 1 - this.fadeOutProgress;
    }
  }

  /**
   * Show feedback animation
   */
  showFeedback(type: TileFeedbackType, score: number): void {
    this.feedback = type;
    this.isAnimatingFeedback = true;
    this.feedbackStartTime = performance.now();

    // Draw glow overlay
    const { width, height } = this.config;
    const color = COLORS[type] || COLORS.partial;

    this.glowOverlay.clear();
    this.glowOverlay.beginFill(color, 0.4);
    this.glowOverlay.drawRoundedRect(-width / 2, -height / 2, width, height, 8);
    this.glowOverlay.endFill();
    this.glowOverlay.alpha = 1;

    // Create score pop text
    if (score > 0) {
      const scoreStyle = new PIXI.TextStyle({
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 24,
        fontWeight: '700',
        fill: color,
        stroke: 0x000000,
        strokeThickness: 3,
      });

      this.scorePopText = new PIXI.Text(`+${score}`, scoreStyle);
      this.scorePopText.anchor.set(0.5);
      this.scorePopText.position.set(0, -height / 2 - 20);
      this.addChild(this.scorePopText);
    }

    // Update label color based on feedback
    this.label.style.fill = color;
  }

  /**
   * Update feedback animation
   * @returns true if animation is complete
   */
  updateFeedback(): boolean {
    if (!this.isAnimatingFeedback) return true;

    const elapsed = performance.now() - this.feedbackStartTime;
    const duration = 500; // 500ms animation

    if (elapsed >= duration) {
      this.isAnimatingFeedback = false;
      this.fadeOutProgress = 1;
      return true;
    }

    const progress = elapsed / duration;

    // Animate based on feedback type
    if (this.feedback === 'miss') {
      // Shake animation for miss
      const shakeIntensity = 8 * (1 - progress);
      this.shakeOffset = Math.sin(elapsed * 0.05) * shakeIntensity;
    } else {
      // Glow fade for correct answers
      this.glowOverlay.alpha = 1 - progress * 0.5;

      // Scale up slightly for perfect/good
      if (this.feedback === 'perfect' || this.feedback === 'good') {
        const scale = 1 + 0.1 * Math.sin(progress * Math.PI);
        this.scale.set(scale);
      }
    }

    // Score pop animation
    if (this.scorePopText) {
      // Float up
      this.scorePopText.position.y = -this.config.height / 2 - 20 - progress * 30;
      // Fade out in last half
      this.scorePopText.alpha = progress > 0.5 ? 1 - (progress - 0.5) * 2 : 1;
    }

    // Start fade out in last 20%
    if (progress > 0.8) {
      this.fadeOutProgress = (progress - 0.8) / 0.2;
    }

    return false;
  }

  /**
   * Check if tile should be removed
   */
  shouldRemove(): boolean {
    return this.fadeOutProgress >= 1 || this.isRemoved;
  }

  /**
   * Mark tile for removal
   */
  markForRemoval(): void {
    this.isRemoved = true;
  }

  /**
   * Check if tile is past the hit zone without being scored
   */
  isPastHitZone(currentTimeMs: number, buffer: number = 500): boolean {
    return currentTimeMs > this.config.scheduledTimeMs + buffer;
  }

  /**
   * Get the event ID
   */
  getEventId(): string {
    return this.config.eventId;
  }

  /**
   * Get the channel
   */
  getChannel(): 'left' | 'right' {
    return this.config.channel;
  }

  /**
   * Get the species code
   */
  getSpeciesCode(): string {
    return this.config.speciesCode;
  }

  /**
   * Check if feedback animation is in progress
   */
  isAnimating(): boolean {
    return this.isAnimatingFeedback;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.scorePopText) {
      this.removeChild(this.scorePopText);
      this.scorePopText.destroy();
    }
    super.destroy({ children: true });
  }

  /**
   * Clear the texture cache (call on scene cleanup)
   */
  static clearCache(): void {
    TileSprite.textureCache.clear();
  }
}

export default TileSprite;
