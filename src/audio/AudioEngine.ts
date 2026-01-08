/**
 * AudioEngine - Core playback scheduler for SoundField: Birds
 *
 * Provides sample-accurate, stereo-panned, overlapping playback using the Web Audio API.
 *
 * Features:
 * - Sample-accurate scheduling (within ±5ms of scheduled time)
 * - Independent channel panning (left/right)
 * - Polyphonic playback (≥4 simultaneous clips)
 * - Audio buffer caching for performance
 */

import type {
  ScheduledEvent,
  ActivePlayback,
  PlaybackStatus,
  AudioEngineConfig,
  Channel,
} from './types.js';
import { ChannelMixer } from './ChannelMixer.js';

/** Default configuration */
const DEFAULT_CONFIG: Required<AudioEngineConfig> = {
  maxPolyphony: 8,
  masterVolume: 1.0,
};

/**
 * AudioEngine manages audio playback with precise timing and stereo panning.
 */
export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private channelMixer: ChannelMixer | null = null;
  private readonly config: Required<AudioEngineConfig>;

  /** Cache of loaded audio buffers keyed by file path */
  private readonly bufferCache: Map<string, AudioBuffer> = new Map();

  /** Currently active playbacks */
  private readonly activePlaybacks: Map<string, ActivePlayback> = new Map();

  /** Scheduled but not yet playing events */
  private readonly scheduledEvents: Map<string, ScheduledEvent> = new Map();

  /** Playback status history */
  private readonly playbackHistory: Map<string, PlaybackStatus> = new Map();

  /** Engine start time in AudioContext time */
  private engineStartTime: number = 0;

  /** Whether the engine is running */
  private isRunning: boolean = false;

  constructor(config: AudioEngineConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initializes the audio engine. Must be called after a user gesture.
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.audioContext = new AudioContext();
    this.channelMixer = new ChannelMixer(this.audioContext);
    this.channelMixer.setMasterVolume(this.config.masterVolume);
  }

  /**
   * Starts the engine timeline. All scheduled times are relative to this start.
   */
  start(): void {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized. Call initialize() first.');
    }

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }

    this.engineStartTime = this.audioContext.currentTime;
    this.isRunning = true;
  }

  /**
   * Stops the engine and cancels all scheduled playbacks.
   */
  stop(): void {
    this.isRunning = false;

    // Cancel all active playbacks
    for (const [eventId, playback] of this.activePlaybacks) {
      try {
        playback.source.stop();
      } catch {
        // Source may have already stopped
      }
      this.updateStatus(eventId, 'cancelled');
    }

    this.activePlaybacks.clear();
    this.scheduledEvents.clear();
  }

  /**
   * Loads an audio file into the buffer cache.
   * @param filePath Path to the audio file
   * @returns The loaded AudioBuffer
   */
  async loadClip(filePath: string): Promise<AudioBuffer> {
    if (!this.audioContext) {
      throw new Error('AudioEngine not initialized. Call initialize() first.');
    }

    // Return cached buffer if available
    const cached = this.bufferCache.get(filePath);
    if (cached) {
      return cached;
    }

    // Fetch and decode the audio file
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Failed to load audio file: ${filePath}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

    // Cache the buffer
    this.bufferCache.set(filePath, audioBuffer);
    return audioBuffer;
  }

  /**
   * Preloads multiple clips into the buffer cache.
   * @param filePaths Array of file paths to preload
   */
  async preloadClips(filePaths: string[]): Promise<void> {
    await Promise.all(filePaths.map((path) => this.loadClip(path)));
  }

  /**
   * Schedules an audio event for playback at a specific time.
   * @param event The event to schedule
   * @returns The event ID
   */
  async scheduleEvent(event: ScheduledEvent): Promise<string> {
    if (!this.audioContext || !this.channelMixer) {
      throw new Error('AudioEngine not initialized. Call initialize() first.');
    }

    if (!this.isRunning) {
      throw new Error('AudioEngine not running. Call start() first.');
    }

    // Ensure the clip is loaded
    const buffer = await this.loadClip(event.clipPath);

    // Check polyphony limit
    if (this.activePlaybacks.size >= this.config.maxPolyphony) {
      // Find and remove the oldest playback
      const oldest = this.findOldestPlayback();
      if (oldest) {
        this.cancelEvent(oldest);
      }
    }

    // Store the scheduled event
    this.scheduledEvents.set(event.eventId, event);
    this.updateStatus(event.eventId, 'scheduled', event.scheduledTimeMs);

    // Calculate the actual start time in AudioContext time
    const startTime = this.engineStartTime + event.scheduledTimeMs / 1000;

    // Create the audio routing chain
    const { gainNode, pannerNode } = this.channelMixer.createPlaybackChain(event.channel);

    // Create and configure the source
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(gainNode);

    // Store the active playback
    const playback: ActivePlayback = {
      event,
      source,
      gainNode,
      pannerNode,
      startTime,
    };
    this.activePlaybacks.set(event.eventId, playback);

    // Set up completion handler
    source.onended = () => {
      this.onPlaybackEnded(event.eventId);
    };

    // Schedule the playback
    const currentTime = this.audioContext.currentTime;
    if (startTime > currentTime) {
      // Schedule for future
      source.start(startTime);
    } else {
      // Play immediately (may be slightly late)
      source.start(0);
    }

    // Update status when playback actually starts
    this.scheduleStatusUpdate(event.eventId, startTime);

    return event.eventId;
  }

  /**
   * Plays a clip immediately on the specified channel.
   * @param clipPath Path to the audio clip
   * @param channel Channel to play on ('left' or 'right')
   * @returns The generated event ID
   */
  async playImmediate(clipPath: string, channel: Channel): Promise<string> {
    const eventId = this.generateEventId();
    const currentTimeMs = this.getCurrentTimeMs();

    const event: ScheduledEvent = {
      eventId,
      clipPath,
      channel,
      scheduledTimeMs: currentTimeMs,
      durationMs: 0, // Will be determined from buffer
    };

    await this.scheduleEvent(event);
    return eventId;
  }

  /**
   * Cancels a scheduled or playing event.
   * @param eventId The event ID to cancel
   */
  cancelEvent(eventId: string): void {
    const playback = this.activePlaybacks.get(eventId);
    if (playback) {
      try {
        playback.source.stop();
      } catch {
        // Source may have already stopped
      }
      playback.gainNode.disconnect();
      playback.pannerNode.disconnect();
      this.activePlaybacks.delete(eventId);
    }

    this.scheduledEvents.delete(eventId);
    this.updateStatus(eventId, 'cancelled');
  }

  /**
   * Gets the current engine time in milliseconds.
   */
  getCurrentTimeMs(): number {
    if (!this.audioContext || !this.isRunning) {
      return 0;
    }
    return (this.audioContext.currentTime - this.engineStartTime) * 1000;
  }

  /**
   * Gets the status of a playback event.
   * @param eventId The event ID
   */
  getPlaybackStatus(eventId: string): PlaybackStatus | undefined {
    return this.playbackHistory.get(eventId);
  }

  /**
   * Gets all currently active playback event IDs.
   */
  getActiveEventIds(): string[] {
    return Array.from(this.activePlaybacks.keys());
  }

  /**
   * Gets the number of currently active playbacks.
   */
  getActivePlaybackCount(): number {
    return this.activePlaybacks.size;
  }

  /**
   * Sets the master volume.
   * @param volume Volume level (0-1)
   */
  setMasterVolume(volume: number): void {
    if (this.channelMixer) {
      this.channelMixer.setMasterVolume(volume);
    }
  }

  /**
   * Checks if the engine is currently running.
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Gets the AudioContext for testing purposes.
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Cleans up and releases all resources.
   */
  async dispose(): Promise<void> {
    this.stop();

    if (this.channelMixer) {
      this.channelMixer.dispose();
      this.channelMixer = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    this.bufferCache.clear();
    this.playbackHistory.clear();
  }

  /**
   * Generates a unique event ID.
   */
  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Finds the oldest active playback.
   */
  private findOldestPlayback(): string | null {
    let oldest: string | null = null;
    let oldestTime = Infinity;

    for (const [eventId, playback] of this.activePlaybacks) {
      if (playback.startTime < oldestTime) {
        oldestTime = playback.startTime;
        oldest = eventId;
      }
    }

    return oldest;
  }

  /**
   * Handles playback completion.
   */
  private onPlaybackEnded(eventId: string): void {
    const playback = this.activePlaybacks.get(eventId);
    if (playback) {
      playback.gainNode.disconnect();
      playback.pannerNode.disconnect();
      this.activePlaybacks.delete(eventId);
    }

    this.scheduledEvents.delete(eventId);
    this.updateStatus(eventId, 'completed');
  }

  /**
   * Updates the status of an event.
   */
  private updateStatus(
    eventId: string,
    state: PlaybackStatus['state'],
    scheduledTimeMs?: number
  ): void {
    const existing = this.playbackHistory.get(eventId);
    this.playbackHistory.set(eventId, {
      eventId,
      state,
      scheduledTimeMs: scheduledTimeMs ?? existing?.scheduledTimeMs ?? 0,
      actualStartTimeMs: existing?.actualStartTimeMs,
    });
  }

  /**
   * Schedules a status update for when playback actually starts.
   */
  private scheduleStatusUpdate(eventId: string, startTime: number): void {
    if (!this.audioContext) return;

    const delay = Math.max(0, (startTime - this.audioContext.currentTime) * 1000);

    setTimeout(() => {
      const status = this.playbackHistory.get(eventId);
      if (status && status.state === 'scheduled') {
        this.playbackHistory.set(eventId, {
          ...status,
          state: 'playing',
          actualStartTimeMs: this.getCurrentTimeMs(),
        });
      }
    }, delay);
  }
}
