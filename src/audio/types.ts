/**
 * Audio system types for ChipNotes!
 */

/** Audio channel assignment */
export type Channel = 'left' | 'right';

/** Scheduled audio event */
export interface ScheduledEvent {
  /** Unique identifier for this event */
  eventId: string;
  /** Path to the audio clip file */
  clipPath: string;
  /** Channel to play the audio on */
  channel: Channel;
  /** Scheduled playback time in milliseconds from engine start */
  scheduledTimeMs: number;
  /** Duration of the clip in milliseconds */
  durationMs: number;
}

/** Active playback instance */
export interface ActivePlayback {
  /** The scheduled event being played */
  event: ScheduledEvent;
  /** Web Audio source node */
  source: AudioBufferSourceNode;
  /** Gain node for this playback */
  gainNode: GainNode;
  /** Stereo panner node */
  pannerNode: StereoPannerNode;
  /** Actual start time in AudioContext time */
  startTime: number;
}

/** Playback status for an event */
export interface PlaybackStatus {
  eventId: string;
  state: 'scheduled' | 'playing' | 'completed' | 'cancelled';
  actualStartTimeMs?: number;
  scheduledTimeMs: number;
}

/** Audio engine configuration */
export interface AudioEngineConfig {
  /** Maximum number of simultaneous playbacks (default: 8) */
  maxPolyphony?: number;
  /** Master volume (0-1, default: 1.0) */
  masterVolume?: number;
}

/** Clip metadata from clips.json */
export interface ClipMetadata {
  clip_id: string;
  species_code: string;
  common_name: string;
  vocalization_type: 'song' | 'call';
  duration_ms: number;
  quality_score: number;
  source: 'macaulay' | 'xenocanto';
  source_id: string;
  file_path: string;
  spectrogram_path: string | null;
}
