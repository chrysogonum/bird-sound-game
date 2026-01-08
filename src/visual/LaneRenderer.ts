/**
 * LaneRenderer - Scrolling spectrogram display for SoundField: Birds
 *
 * Renders:
 * - Two lanes (left/right) for stereo audio visualization
 * - Scrolling spectrogram tiles approaching hit zone
 * - Hit zone indicator with timing feedback
 * - Species labels on tiles
 */

import type { GameEvent, SpectrogramMode } from '../game/types.js';
import type { ClipMetadata } from '../audio/types.js';
import type {
  LaneRendererConfig,
  LanePosition,
  RenderState,
  LaneRenderState,
  RenderCallback,
  FeedbackType,
  SpectrogramTile,
} from './types.js';
import {
  DEFAULT_LANE_CONFIG,
  VISUAL_COLORS,
} from './types.js';
import { TileManager } from './TileManager.js';
import { HitZoneIndicator } from './HitZoneIndicator.js';

/**
 * Manages the visual rendering of scrolling spectrogram lanes.
 */
export class LaneRenderer {
  private readonly config: Required<LaneRendererConfig>;
  private readonly tileManager: TileManager;
  private readonly hitZone: HitZoneIndicator;
  private readonly renderCallbacks: Set<RenderCallback> = new Set();

  private clipLookup: Map<string, ClipMetadata> = new Map();
  private events: GameEvent[] = [];
  private currentTimeMs: number = 0;
  private isRunning: boolean = false;

  constructor(config: LaneRendererConfig = {}) {
    this.config = {
      scrollSpeedPxPerMs: config.scrollSpeedPxPerMs ?? DEFAULT_LANE_CONFIG.scrollSpeedPxPerMs,
      laneWidthPx: config.laneWidthPx ?? DEFAULT_LANE_CONFIG.laneWidthPx,
      laneHeightPx: config.laneHeightPx ?? DEFAULT_LANE_CONFIG.laneHeightPx,
      tileHeightPx: config.tileHeightPx ?? DEFAULT_LANE_CONFIG.tileHeightPx,
      laneGapPx: config.laneGapPx ?? DEFAULT_LANE_CONFIG.laneGapPx,
      hitZoneY: config.hitZoneY ?? DEFAULT_LANE_CONFIG.hitZoneY,
      approachTimeMs: config.approachTimeMs ?? DEFAULT_LANE_CONFIG.approachTimeMs,
      spectrogramMode: config.spectrogramMode ?? DEFAULT_LANE_CONFIG.spectrogramMode,
    };

    this.tileManager = new TileManager({
      preloadMs: this.config.approachTimeMs + 1000,
    });

    this.hitZone = new HitZoneIndicator({
      y: this.config.hitZoneY,
    });
  }

  /**
   * Initializes the renderer with clip metadata and events.
   */
  initialize(clips: ClipMetadata[], events: GameEvent[]): void {
    // Build clip lookup
    this.clipLookup.clear();
    for (const clip of clips) {
      this.clipLookup.set(clip.clip_id, clip);
    }

    // Store events
    this.events = [...events].sort((a, b) => a.scheduled_time_ms - b.scheduled_time_ms);

    // Reset state
    this.currentTimeMs = 0;
    this.tileManager.reset();
    this.hitZone.reset();
  }

  /**
   * Starts the renderer.
   */
  start(): void {
    this.isRunning = true;
    this.hitZone.setAllActive(true);
  }

  /**
   * Stops the renderer.
   */
  stop(): void {
    this.isRunning = false;
    this.hitZone.setAllActive(false);
  }

  /**
   * Updates the renderer with the current time.
   */
  update(currentTimeMs: number): void {
    this.currentTimeMs = currentTimeMs;

    // Preload upcoming tiles
    this.tileManager.preloadTiles(
      this.events,
      currentTimeMs,
      (clipId) => this.getSpectrogramPath(clipId)
    );

    // Update tile positions and states
    this.tileManager.update(currentTimeMs, this.config.approachTimeMs);

    // Update hit zone
    this.hitZone.update(currentTimeMs);

    // Notify render callbacks
    this.notifyRenderCallbacks();
  }

  /**
   * Gets the spectrogram path for a clip.
   */
  private getSpectrogramPath(clipId: string): string | null {
    const clip = this.clipLookup.get(clipId);
    return clip?.spectrogram_path ?? null;
  }

  /**
   * Triggers visual feedback for scoring.
   */
  showFeedback(lane: LanePosition, feedbackType: FeedbackType, eventId: string): void {
    // Flash the hit zone
    this.hitZone.flash(lane, feedbackType, this.currentTimeMs);

    // Mark the tile as scored
    this.tileManager.markScored(eventId);
  }

  /**
   * Shows perfect feedback.
   */
  showPerfect(lane: LanePosition, eventId: string): void {
    this.showFeedback(lane, 'perfect', eventId);
  }

  /**
   * Shows good feedback.
   */
  showGood(lane: LanePosition, eventId: string): void {
    this.showFeedback(lane, 'good', eventId);
  }

  /**
   * Shows miss feedback.
   */
  showMiss(lane: LanePosition, eventId: string): void {
    this.showFeedback(lane, 'miss', eventId);
  }

  /**
   * Gets the current render state.
   */
  getRenderState(): RenderState {
    const leftTiles = this.tileManager.getTilesForLane('left')
      .filter((t) => t.state === 'visible' || t.state === 'ready' || t.state === 'exiting')
      .sort((a, b) => b.normalizedY - a.normalizedY);

    const rightTiles = this.tileManager.getTilesForLane('right')
      .filter((t) => t.state === 'visible' || t.state === 'ready' || t.state === 'exiting')
      .sort((a, b) => b.normalizedY - a.normalizedY);

    const hitZoneStates = this.hitZone.getBothStates();

    return {
      currentTimeMs: this.currentTimeMs,
      leftLane: {
        lane: 'left',
        tiles: leftTiles,
        hitZone: hitZoneStates.left,
      },
      rightLane: {
        lane: 'right',
        tiles: rightTiles,
        hitZone: hitZoneStates.right,
      },
      spectrogramMode: this.config.spectrogramMode,
    };
  }

  /**
   * Gets the lane render state for a specific lane.
   */
  getLaneState(lane: LanePosition): LaneRenderState {
    const state = this.getRenderState();
    return lane === 'left' ? state.leftLane : state.rightLane;
  }

  /**
   * Gets visible tiles for a lane.
   */
  getVisibleTiles(lane: LanePosition): SpectrogramTile[] {
    return this.tileManager.getTilesForLane(lane)
      .filter((t) => t.state === 'visible');
  }

  /**
   * Gets the tile at the hit zone for a lane.
   */
  getTileAtHitZone(lane: LanePosition): SpectrogramTile | null {
    const tiles = this.getVisibleTiles(lane);
    for (const tile of tiles) {
      if (this.hitZone.isInHitZone(tile.normalizedY)) {
        return tile;
      }
    }
    return null;
  }

  /**
   * Calculates the pixel Y position for a normalized Y value.
   */
  normalizedYToPixels(normalizedY: number): number {
    const hitZonePixels = this.config.laneHeightPx * (1 - this.config.hitZoneY);
    return hitZonePixels - (normalizedY * (this.config.laneHeightPx - hitZonePixels));
  }

  /**
   * Gets the tile manager.
   */
  getTileManager(): TileManager {
    return this.tileManager;
  }

  /**
   * Gets the hit zone indicator.
   */
  getHitZone(): HitZoneIndicator {
    return this.hitZone;
  }

  /**
   * Adds a render callback.
   */
  addRenderCallback(callback: RenderCallback): void {
    this.renderCallbacks.add(callback);
  }

  /**
   * Removes a render callback.
   */
  removeRenderCallback(callback: RenderCallback): void {
    this.renderCallbacks.delete(callback);
  }

  /**
   * Notifies all render callbacks.
   */
  private notifyRenderCallbacks(): void {
    const state = this.getRenderState();
    for (const callback of this.renderCallbacks) {
      callback(state);
    }
  }

  /**
   * Sets the spectrogram mode.
   */
  setSpectrogramMode(mode: SpectrogramMode): void {
    (this.config as LaneRendererConfig).spectrogramMode = mode;
  }

  /**
   * Gets the spectrogram mode.
   */
  getSpectrogramMode(): SpectrogramMode {
    return this.config.spectrogramMode;
  }

  /**
   * Checks if spectrograms should be visible.
   */
  areSpectrogramsVisible(): boolean {
    return this.config.spectrogramMode !== 'none';
  }

  /**
   * Checks if spectrograms should fade with tile position.
   */
  shouldFadeSpectrograms(): boolean {
    return this.config.spectrogramMode === 'fading';
  }

  /**
   * Gets tile opacity including spectrogram mode.
   */
  getTileOpacity(tile: SpectrogramTile): number {
    let opacity = tile.opacity;

    if (this.config.spectrogramMode === 'fading') {
      // Fade based on Y position (more visible near hit zone)
      opacity *= 1 - (tile.normalizedY * 0.7);
    } else if (this.config.spectrogramMode === 'none') {
      // Only show species label, not spectrogram
      opacity = tile.scored ? 0.3 : 0.8;
    }

    return opacity;
  }

  /**
   * Gets render data for UI frameworks.
   */
  getRenderData(): {
    config: Required<LaneRendererConfig>;
    state: RenderState;
    hitZoneData: ReturnType<HitZoneIndicator['getRenderData']>;
    tileCount: number;
    isRunning: boolean;
    colors: typeof VISUAL_COLORS;
  } {
    return {
      config: { ...this.config },
      state: this.getRenderState(),
      hitZoneData: this.hitZone.getRenderData(),
      tileCount: this.tileManager.getTileCount(),
      isRunning: this.isRunning,
      colors: VISUAL_COLORS,
    };
  }

  /**
   * Gets the approach time in ms.
   */
  getApproachTimeMs(): number {
    return this.config.approachTimeMs;
  }

  /**
   * Gets the lane dimensions.
   */
  getLaneDimensions(): { width: number; height: number; gap: number } {
    return {
      width: this.config.laneWidthPx,
      height: this.config.laneHeightPx,
      gap: this.config.laneGapPx,
    };
  }

  /**
   * Gets the total width of both lanes including gap.
   */
  getTotalWidth(): number {
    return this.config.laneWidthPx * 2 + this.config.laneGapPx;
  }

  /**
   * Checks if the renderer is running.
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Resets the renderer for a new round.
   */
  reset(): void {
    this.currentTimeMs = 0;
    this.events = [];
    this.tileManager.reset();
    this.hitZone.reset();
    this.isRunning = false;
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<LaneRendererConfig> {
    return { ...this.config };
  }
}
