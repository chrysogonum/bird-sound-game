/**
 * ChannelInput - Left/right tap detection for SoundField: Birds
 *
 * Detects which side of the screen the player taps to select a channel.
 * Left side = left channel, right side = right channel.
 */

import type { Channel } from '../audio/types.js';
import type { InputListener, ChannelSelectionEvent } from './types.js';

/** Channel input configuration */
export interface ChannelInputConfig {
  /** Screen width for determining left/right boundary */
  screenWidth: number;
  /** Optional dead zone in center (pixels from center on each side) */
  deadZone?: number;
}

/**
 * ChannelInput detects left/right channel selections from tap coordinates.
 */
export class ChannelInput {
  private readonly screenWidth: number;
  private readonly deadZone: number;
  private readonly listeners: Set<InputListener> = new Set();
  private selectedChannel: Channel | null = null;
  private enabled: boolean = true;

  /** Reference time for input timestamps */
  private referenceTimeMs: number = 0;

  constructor(config: ChannelInputConfig) {
    this.screenWidth = config.screenWidth;
    this.deadZone = config.deadZone ?? 0;
  }

  /**
   * Sets the reference time for input timestamps.
   * @param timeMs Reference time in milliseconds
   */
  setReferenceTime(timeMs: number): void {
    this.referenceTimeMs = timeMs;
  }

  /**
   * Determines the channel from an X coordinate.
   * @param x X coordinate of tap
   * @returns The channel ('left' or 'right'), or null if in dead zone
   */
  getChannelFromX(x: number): Channel | null {
    const center = this.screenWidth / 2;
    const leftBoundary = center - this.deadZone;
    const rightBoundary = center + this.deadZone;

    if (x < leftBoundary) {
      return 'left';
    } else if (x > rightBoundary) {
      return 'right';
    }

    // In dead zone
    return null;
  }

  /**
   * Handles a tap at the specified X coordinate.
   * @param x X coordinate of tap
   * @returns The selected channel, or null if in dead zone or disabled
   */
  handleTap(x: number): Channel | null {
    if (!this.enabled) return null;

    const channel = this.getChannelFromX(x);
    if (channel) {
      this.selectChannel(channel);
    }

    return channel;
  }

  /**
   * Directly selects a channel.
   * @param channel The channel to select
   */
  selectChannel(channel: Channel): void {
    if (!this.enabled) return;

    this.selectedChannel = channel;

    const event: ChannelSelectionEvent = {
      type: 'channel_selection',
      channel,
      timestampMs: Date.now() - this.referenceTimeMs,
    };

    this.notifyListeners(event);
  }

  /**
   * Gets the currently selected channel.
   */
  getSelectedChannel(): Channel | null {
    return this.selectedChannel;
  }

  /**
   * Clears the current channel selection.
   */
  clearSelection(): void {
    this.selectedChannel = null;
  }

  /**
   * Enables or disables channel input.
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Checks if channel input is enabled.
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Adds an input listener.
   */
  addListener(listener: InputListener): void {
    this.listeners.add(listener);
  }

  /**
   * Removes an input listener.
   */
  removeListener(listener: InputListener): void {
    this.listeners.delete(listener);
  }

  /**
   * Gets the screen width.
   */
  getScreenWidth(): number {
    return this.screenWidth;
  }

  /**
   * Gets the dead zone size.
   */
  getDeadZone(): number {
    return this.deadZone;
  }

  /**
   * Notifies all listeners of a channel selection event.
   */
  private notifyListeners(event: ChannelSelectionEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}
