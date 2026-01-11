/**
 * CrossBrowserAudioAdapter - Provides cross-browser stereo panning
 *
 * Chrome on iOS has restricted StereoPannerNode support, causing audio to fail.
 * This adapter detects browser capabilities and provides fallback panning
 * using gain-based channel routing when StereoPanner isn't available.
 */

import type { Channel } from './types.js';

/**
 * Interface for panner implementations (allows swapping StereoPanner vs fallback)
 */
export interface PannerNode {
  /** The output node to connect to destination */
  readonly output: AudioNode;
  /** Set the pan value (-1 = left, 0 = center, +1 = right) */
  setPan(value: number): void;
  /** Disconnect and clean up */
  disconnect(): void;
}

/**
 * Wrapper around native StereoPannerNode
 */
class StereoPannerWrapper implements PannerNode {
  private readonly panner: StereoPannerNode;

  constructor(ctx: AudioContext) {
    this.panner = ctx.createStereoPanner();
  }

  get output(): AudioNode {
    return this.panner;
  }

  setPan(value: number): void {
    this.panner.pan.value = Math.max(-1, Math.min(1, value));
  }

  disconnect(): void {
    this.panner.disconnect();
  }
}

/**
 * Fallback panner using gain nodes for browsers without StereoPanner support.
 * Routes audio to left/right channels using a splitter and merger.
 *
 * For hard panning:
 * - Left (pan = -1): left gain = 1, right gain = 0
 * - Right (pan = +1): left gain = 0, right gain = 1
 * - Center (pan = 0): both gains = 0.707 (equal power)
 */
class GainBasedPanner implements PannerNode {
  private readonly ctx: AudioContext;
  private readonly inputGain: GainNode;
  private readonly leftGain: GainNode;
  private readonly rightGain: GainNode;
  private readonly merger: ChannelMergerNode;

  constructor(ctx: AudioContext) {
    this.ctx = ctx;

    // Input gain node (audio source connects here)
    this.inputGain = ctx.createGain();

    // Separate gain nodes for left and right channels
    this.leftGain = ctx.createGain();
    this.rightGain = ctx.createGain();

    // Merger combines left/right into stereo output
    this.merger = ctx.createChannelMerger(2);

    // Connect: input -> both gains -> merger
    this.inputGain.connect(this.leftGain);
    this.inputGain.connect(this.rightGain);
    this.leftGain.connect(this.merger, 0, 0);  // Left gain -> merger left channel
    this.rightGain.connect(this.merger, 0, 1); // Right gain -> merger right channel

    // Default to center
    this.setPan(0);
  }

  get output(): AudioNode {
    // Return input gain as the connection point for audio sources
    // The merger is what gets connected to destination
    return this.inputGain;
  }

  /**
   * Get the final output node (merger) for connecting to destination
   */
  get destination(): AudioNode {
    return this.merger;
  }

  setPan(value: number): void {
    const pan = Math.max(-1, Math.min(1, value));

    // Equal power panning law
    // At center (0): both channels at ~0.707 (-3dB)
    // At hard left (-1): left = 1, right = 0
    // At hard right (+1): left = 0, right = 1
    const angle = (pan + 1) * Math.PI / 4; // 0 to PI/2
    const leftLevel = Math.cos(angle);
    const rightLevel = Math.sin(angle);

    this.leftGain.gain.setValueAtTime(leftLevel, this.ctx.currentTime);
    this.rightGain.gain.setValueAtTime(rightLevel, this.ctx.currentTime);
  }

  disconnect(): void {
    this.inputGain.disconnect();
    this.leftGain.disconnect();
    this.rightGain.disconnect();
    this.merger.disconnect();
  }
}

/**
 * Detects browser audio capabilities
 */
export interface AudioCapabilities {
  supportsStereoPanner: boolean;
  supportsWebAudio: boolean;
  isIOSChrome: boolean;
  isIOS: boolean;
  browserInfo: string;
}

/**
 * CrossBrowserAudioAdapter - Main class for cross-browser audio support
 */
export class CrossBrowserAudioAdapter {
  private readonly capabilities: AudioCapabilities;

  constructor() {
    this.capabilities = this.detectCapabilities();
    console.log('Audio capabilities:', this.capabilities);
  }

  /**
   * Detect browser audio capabilities
   */
  private detectCapabilities(): AudioCapabilities {
    const ua = navigator.userAgent;

    // Detect iOS
    const isIOS = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // Detect Chrome on iOS (CriOS)
    const isIOSChrome = isIOS && /CriOS/.test(ua);

    // Detect Firefox on iOS (FxiOS)
    const isIOSFirefox = isIOS && /FxiOS/.test(ua);

    // Detect Edge on iOS
    const isIOSEdge = isIOS && /EdgiOS/.test(ua);

    // Check Web Audio API support
    const supportsWebAudio = typeof AudioContext !== 'undefined' ||
      typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';

    // StereoPanner is problematic on non-Safari iOS browsers
    // Safari on iOS works fine, but Chrome/Firefox/Edge on iOS use WebKit with restrictions
    const supportsStereoPanner = supportsWebAudio &&
      typeof StereoPannerNode !== 'undefined' &&
      !isIOSChrome && !isIOSFirefox && !isIOSEdge;

    return {
      supportsStereoPanner,
      supportsWebAudio,
      isIOSChrome,
      isIOS,
      browserInfo: `iOS: ${isIOS}, Chrome: ${isIOSChrome}, StereoPanner: ${supportsStereoPanner}`,
    };
  }

  /**
   * Get detected capabilities
   */
  getCapabilities(): AudioCapabilities {
    return { ...this.capabilities };
  }

  /**
   * Check if the browser supports proper stereo panning
   */
  supportsStereoPanner(): boolean {
    return this.capabilities.supportsStereoPanner;
  }

  /**
   * Check if this is Chrome on iOS
   */
  isIOSChrome(): boolean {
    return this.capabilities.isIOSChrome;
  }

  /**
   * Create a panner node appropriate for this browser
   */
  createPanner(ctx: AudioContext): PannerNode {
    if (this.capabilities.supportsStereoPanner) {
      return new StereoPannerWrapper(ctx);
    }
    return new GainBasedPanner(ctx);
  }

  /**
   * Create a panner pre-configured for a specific channel
   */
  createChannelPanner(ctx: AudioContext, channel: Channel): PannerNode {
    const panner = this.createPanner(ctx);
    panner.setPan(channel === 'left' ? -1 : 1);
    return panner;
  }

  /**
   * Connect a panner to the audio destination.
   * Handles the different connection patterns for StereoPanner vs GainBased.
   */
  connectPannerToDestination(panner: PannerNode, destination: AudioNode): void {
    if (panner instanceof GainBasedPanner) {
      // GainBasedPanner needs its merger connected to destination
      (panner as GainBasedPanner).destination.connect(destination);
    } else {
      // StereoPanner just connects its output
      panner.output.connect(destination);
    }
  }
}

// Singleton instance for consistent detection across the app
let adapterInstance: CrossBrowserAudioAdapter | null = null;

/**
 * Get the singleton audio adapter instance
 */
export function getAudioAdapter(): CrossBrowserAudioAdapter {
  if (!adapterInstance) {
    adapterInstance = new CrossBrowserAudioAdapter();
  }
  return adapterInstance;
}

/**
 * Helper to check if we need fallback audio (for quick checks)
 */
export function needsAudioFallback(): boolean {
  return !getAudioAdapter().supportsStereoPanner();
}
