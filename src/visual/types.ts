/**
 * Visual system types for SoundField: Birds
 *
 * Types for scrolling spectrogram display, tile management, and hit zone indicators.
 */

import type { Channel } from '../audio/types.js';
import type { GameEvent, SpectrogramMode } from '../game/types.js';

/** Lane position (left or right channel) */
export type LanePosition = 'left' | 'right';

/** Tile state in the rendering pipeline */
export type TileState = 'loading' | 'ready' | 'visible' | 'exiting' | 'disposed';

/** Spectrogram tile representing a single event's visual */
export interface SpectrogramTile {
  /** Unique tile identifier */
  tileId: string;
  /** Associated event ID */
  eventId: string;
  /** Species code for labeling */
  speciesCode: string;
  /** Lane position (left/right) */
  lane: LanePosition;
  /** Path to spectrogram image */
  spectrogramPath: string | null;
  /** Scheduled time in ms from round start */
  scheduledTimeMs: number;
  /** Duration of the tile in ms */
  durationMs: number;
  /** Current tile state */
  state: TileState;
  /** Current Y position (0-1, where 1 = top, 0 = hit zone) */
  normalizedY: number;
  /** Opacity (0-1) */
  opacity: number;
  /** Whether this tile has been scored */
  scored: boolean;
}

/** Lane renderer configuration */
export interface LaneRendererConfig {
  /** Scroll speed in pixels per ms */
  scrollSpeedPxPerMs?: number;
  /** Lane width in pixels */
  laneWidthPx?: number;
  /** Lane height in pixels */
  laneHeightPx?: number;
  /** Tile height in pixels */
  tileHeightPx?: number;
  /** Gap between lanes in pixels */
  laneGapPx?: number;
  /** Hit zone Y position (0-1 from bottom) */
  hitZoneY?: number;
  /** Approach time in ms (how long tiles take to scroll to hit zone) */
  approachTimeMs?: number;
  /** Spectrogram visibility mode */
  spectrogramMode?: SpectrogramMode;
}

/** Hit zone configuration */
export interface HitZoneConfig {
  /** Hit zone Y position (0-1 from bottom) */
  y?: number;
  /** Hit zone height in pixels */
  heightPx?: number;
  /** Perfect timing window (fraction of total window, centered) */
  perfectWindow?: number;
  /** Good timing window (fraction of total window) */
  goodWindow?: number;
}

/** Hit zone state */
export interface HitZoneState {
  /** Whether hit zone is active */
  active: boolean;
  /** Current flash state (for feedback) */
  flashState: 'none' | 'perfect' | 'good' | 'miss';
  /** Flash end time */
  flashEndMs: number;
}

/** Tile manager configuration */
export interface TileManagerConfig {
  /** Maximum tiles to keep in memory */
  maxTiles?: number;
  /** Preload distance in ms (how far ahead to load tiles) */
  preloadMs?: number;
  /** Dispose distance in ms (how long after scoring to dispose) */
  disposeMs?: number;
}

/** Lane render state for a single frame */
export interface LaneRenderState {
  /** Lane position */
  lane: LanePosition;
  /** Visible tiles sorted by Y position */
  tiles: SpectrogramTile[];
  /** Hit zone state */
  hitZone: HitZoneState;
}

/** Full render state for both lanes */
export interface RenderState {
  /** Current time in ms from round start */
  currentTimeMs: number;
  /** Left lane state */
  leftLane: LaneRenderState;
  /** Right lane state */
  rightLane: LaneRenderState;
  /** Spectrogram mode */
  spectrogramMode: SpectrogramMode;
}

/** Tile event callback */
export type TileEventCallback = (tile: SpectrogramTile) => void;

/** Render callback for frame updates */
export type RenderCallback = (state: RenderState) => void;

/** Visual feedback types */
export type FeedbackType = 'perfect' | 'good' | 'miss';

/** Visual colors for lanes and feedback */
export const VISUAL_COLORS = {
  // Lane colors
  LANE_LEFT: '#3B82F6',      // Blue-500
  LANE_RIGHT: '#10B981',     // Emerald-500
  LANE_BACKGROUND: '#1F2937', // Gray-800

  // Hit zone colors
  HIT_ZONE_BORDER: '#F59E0B', // Amber-500
  HIT_ZONE_FILL: 'rgba(245, 158, 11, 0.1)', // Amber-500 @ 10%

  // Feedback colors
  FEEDBACK_PERFECT: '#22C55E', // Green-500
  FEEDBACK_GOOD: '#EAB308',    // Yellow-500
  FEEDBACK_MISS: '#EF4444',    // Red-500

  // Tile colors
  TILE_BORDER: '#6B7280',     // Gray-500
  TILE_SCORED: '#9CA3AF',     // Gray-400
} as const;

/** Visual animation constants */
export const VISUAL_ANIMATIONS = {
  /** Flash duration for hit feedback in ms */
  FLASH_DURATION_MS: 200,
  /** Fade out duration for exiting tiles in ms */
  FADE_OUT_MS: 300,
  /** Tile entrance fade in duration in ms */
  FADE_IN_MS: 150,
} as const;

/** Default lane renderer configuration */
export const DEFAULT_LANE_CONFIG: Required<LaneRendererConfig> = {
  scrollSpeedPxPerMs: 0.3,
  laneWidthPx: 200,
  laneHeightPx: 600,
  tileHeightPx: 60,
  laneGapPx: 40,
  hitZoneY: 0.15,
  approachTimeMs: 2000,
  spectrogramMode: 'full',
};

/** Default hit zone configuration */
export const DEFAULT_HIT_ZONE_CONFIG: Required<HitZoneConfig> = {
  y: 0.15,
  heightPx: 40,
  perfectWindow: 0.3,
  goodWindow: 0.7,
};

/** Default tile manager configuration */
export const DEFAULT_TILE_CONFIG: Required<TileManagerConfig> = {
  maxTiles: 50,
  preloadMs: 3000,
  disposeMs: 1000,
};
