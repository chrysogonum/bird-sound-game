/**
 * ChannelMixer - Stereo panning implementation for SoundField: Birds
 *
 * Provides channel-based stereo panning for mono audio clips.
 * Audio is panned hard left (-1) or hard right (+1) based on channel assignment.
 */

import type { Channel } from './types.js';

/** Panning value for hard left */
export const PAN_LEFT = -1;

/** Panning value for hard right */
export const PAN_RIGHT = 1;

/** Panning value for center */
export const PAN_CENTER = 0;

/**
 * ChannelMixer creates and manages stereo panning nodes for the Web Audio API.
 */
export class ChannelMixer {
  private readonly audioContext: AudioContext;
  private readonly masterGain: GainNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.masterGain = audioContext.createGain();
    this.masterGain.connect(audioContext.destination);
  }

  /**
   * Gets the master output node for connecting audio sources
   */
  get output(): GainNode {
    return this.masterGain;
  }

  /**
   * Sets the master volume
   * @param volume Volume level (0-1)
   */
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setValueAtTime(clampedVolume, this.audioContext.currentTime);
  }

  /**
   * Creates a stereo panner node configured for the specified channel
   * @param channel The channel to pan to ('left' or 'right')
   * @returns A configured StereoPannerNode
   */
  createPanner(channel: Channel): StereoPannerNode {
    const panner = this.audioContext.createStereoPanner();
    panner.pan.value = this.getPanValue(channel);
    panner.connect(this.masterGain);
    return panner;
  }

  /**
   * Creates a gain node for individual playback volume control
   * @param volume Initial volume (0-1, default: 1)
   * @returns A configured GainNode
   */
  createGainNode(volume: number = 1): GainNode {
    const gain = this.audioContext.createGain();
    gain.gain.value = Math.max(0, Math.min(1, volume));
    return gain;
  }

  /**
   * Gets the pan value for a channel
   * @param channel The channel ('left' or 'right')
   * @returns Pan value (-1 for left, +1 for right)
   */
  getPanValue(channel: Channel): number {
    return channel === 'left' ? PAN_LEFT : PAN_RIGHT;
  }

  /**
   * Creates a complete audio routing chain for a playback:
   * source -> gain -> panner -> master
   * @param channel The channel to route to
   * @param volume Individual volume for this playback
   * @returns Object containing the gain and panner nodes
   */
  createPlaybackChain(channel: Channel, volume: number = 1): {
    gainNode: GainNode;
    pannerNode: StereoPannerNode;
  } {
    const gainNode = this.createGainNode(volume);
    const pannerNode = this.createPanner(channel);
    gainNode.connect(pannerNode);
    return { gainNode, pannerNode };
  }

  /**
   * Disconnects all nodes and cleans up resources
   */
  dispose(): void {
    this.masterGain.disconnect();
  }
}
