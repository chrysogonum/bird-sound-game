/**
 * HitZoneIndicator - Visual feedback for hit timing in ChipNotes!
 *
 * Displays:
 * - Hit zone bar across both lanes
 * - Perfect/good timing regions
 * - Visual feedback flashes on scoring
 */

import type {
  HitZoneConfig,
  HitZoneState,
  LanePosition,
  FeedbackType,
} from './types.js';
import {
  DEFAULT_HIT_ZONE_CONFIG,
  VISUAL_COLORS,
  VISUAL_ANIMATIONS,
} from './types.js';

/**
 * Manages the hit zone visual indicator.
 */
export class HitZoneIndicator {
  private readonly config: Required<HitZoneConfig>;
  private leftState: HitZoneState;
  private rightState: HitZoneState;

  constructor(config: HitZoneConfig = {}) {
    this.config = {
      y: config.y ?? DEFAULT_HIT_ZONE_CONFIG.y,
      heightPx: config.heightPx ?? DEFAULT_HIT_ZONE_CONFIG.heightPx,
      perfectWindow: config.perfectWindow ?? DEFAULT_HIT_ZONE_CONFIG.perfectWindow,
      goodWindow: config.goodWindow ?? DEFAULT_HIT_ZONE_CONFIG.goodWindow,
    };

    this.leftState = this.createInitialState();
    this.rightState = this.createInitialState();
  }

  /**
   * Creates the initial hit zone state.
   */
  private createInitialState(): HitZoneState {
    return {
      active: true,
      flashState: 'none',
      flashEndMs: 0,
    };
  }

  /**
   * Gets the hit zone Y position (0-1 from bottom).
   */
  getY(): number {
    return this.config.y;
  }

  /**
   * Gets the hit zone height in pixels.
   */
  getHeightPx(): number {
    return this.config.heightPx;
  }

  /**
   * Gets the perfect window fraction (centered in hit zone).
   */
  getPerfectWindow(): number {
    return this.config.perfectWindow;
  }

  /**
   * Gets the good window fraction.
   */
  getGoodWindow(): number {
    return this.config.goodWindow;
  }

  /**
   * Gets the state for a lane.
   */
  getState(lane: LanePosition): HitZoneState {
    return lane === 'left' ? { ...this.leftState } : { ...this.rightState };
  }

  /**
   * Gets both lane states.
   */
  getBothStates(): { left: HitZoneState; right: HitZoneState } {
    return {
      left: { ...this.leftState },
      right: { ...this.rightState },
    };
  }

  /**
   * Triggers a flash for feedback.
   */
  flash(lane: LanePosition, feedbackType: FeedbackType, currentTimeMs: number): void {
    const state = lane === 'left' ? this.leftState : this.rightState;
    state.flashState = feedbackType;
    state.flashEndMs = currentTimeMs + VISUAL_ANIMATIONS.FLASH_DURATION_MS;
  }

  /**
   * Triggers a perfect flash.
   */
  flashPerfect(lane: LanePosition, currentTimeMs: number): void {
    this.flash(lane, 'perfect', currentTimeMs);
  }

  /**
   * Triggers a good flash.
   */
  flashGood(lane: LanePosition, currentTimeMs: number): void {
    this.flash(lane, 'good', currentTimeMs);
  }

  /**
   * Triggers a miss flash.
   */
  flashMiss(lane: LanePosition, currentTimeMs: number): void {
    this.flash(lane, 'miss', currentTimeMs);
  }

  /**
   * Updates the hit zone state based on current time.
   */
  update(currentTimeMs: number): void {
    this.updateState(this.leftState, currentTimeMs);
    this.updateState(this.rightState, currentTimeMs);
  }

  /**
   * Updates a single lane state.
   */
  private updateState(state: HitZoneState, currentTimeMs: number): void {
    // Clear flash if expired
    if (state.flashState !== 'none' && currentTimeMs >= state.flashEndMs) {
      state.flashState = 'none';
    }
  }

  /**
   * Sets whether the hit zone is active.
   */
  setActive(lane: LanePosition, active: boolean): void {
    const state = lane === 'left' ? this.leftState : this.rightState;
    state.active = active;
  }

  /**
   * Sets both lanes active state.
   */
  setAllActive(active: boolean): void {
    this.leftState.active = active;
    this.rightState.active = active;
  }

  /**
   * Gets whether a lane is flashing.
   */
  isFlashing(lane: LanePosition): boolean {
    const state = lane === 'left' ? this.leftState : this.rightState;
    return state.flashState !== 'none';
  }

  /**
   * Gets the current flash type for a lane.
   */
  getFlashType(lane: LanePosition): FeedbackType | null {
    const state = lane === 'left' ? this.leftState : this.rightState;
    return state.flashState === 'none' ? null : state.flashState;
  }

  /**
   * Gets the flash color for a lane.
   */
  getFlashColor(lane: LanePosition): string | null {
    const flashType = this.getFlashType(lane);
    if (!flashType) return null;

    switch (flashType) {
      case 'perfect':
        return VISUAL_COLORS.FEEDBACK_PERFECT;
      case 'good':
        return VISUAL_COLORS.FEEDBACK_GOOD;
      case 'miss':
        return VISUAL_COLORS.FEEDBACK_MISS;
    }
  }

  /**
   * Gets render data for the hit zone.
   */
  getRenderData(): {
    y: number;
    heightPx: number;
    perfectWindow: number;
    goodWindow: number;
    leftState: HitZoneState;
    rightState: HitZoneState;
    leftFlashColor: string | null;
    rightFlashColor: string | null;
    colors: typeof VISUAL_COLORS;
  } {
    return {
      y: this.config.y,
      heightPx: this.config.heightPx,
      perfectWindow: this.config.perfectWindow,
      goodWindow: this.config.goodWindow,
      leftState: { ...this.leftState },
      rightState: { ...this.rightState },
      leftFlashColor: this.getFlashColor('left'),
      rightFlashColor: this.getFlashColor('right'),
      colors: VISUAL_COLORS,
    };
  }

  /**
   * Calculates the perfect zone bounds within the hit zone.
   * Returns Y positions as fractions (0-1) where perfect timing should occur.
   */
  getPerfectZoneBounds(): { top: number; bottom: number } {
    const halfPerfect = this.config.perfectWindow / 2;
    return {
      top: this.config.y + halfPerfect * this.config.y,
      bottom: this.config.y - halfPerfect * this.config.y,
    };
  }

  /**
   * Calculates the good zone bounds within the hit zone.
   */
  getGoodZoneBounds(): { top: number; bottom: number } {
    const halfGood = this.config.goodWindow / 2;
    return {
      top: this.config.y + halfGood * this.config.y,
      bottom: this.config.y - halfGood * this.config.y,
    };
  }

  /**
   * Checks if a normalized Y position is in the perfect zone.
   */
  isInPerfectZone(normalizedY: number): boolean {
    const bounds = this.getPerfectZoneBounds();
    return normalizedY <= bounds.top && normalizedY >= bounds.bottom;
  }

  /**
   * Checks if a normalized Y position is in the good zone.
   */
  isInGoodZone(normalizedY: number): boolean {
    const bounds = this.getGoodZoneBounds();
    return normalizedY <= bounds.top && normalizedY >= bounds.bottom;
  }

  /**
   * Checks if a normalized Y position is in the hit zone.
   */
  isInHitZone(normalizedY: number): boolean {
    return normalizedY <= this.config.y + 0.1 && normalizedY >= 0;
  }

  /**
   * Resets the hit zone to initial state.
   */
  reset(): void {
    this.leftState = this.createInitialState();
    this.rightState = this.createInitialState();
  }

  /**
   * Gets configuration.
   */
  getConfig(): Required<HitZoneConfig> {
    return { ...this.config };
  }
}
