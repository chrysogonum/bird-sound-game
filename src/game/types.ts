/**
 * Game system types for SoundField: Birds
 */

import type { Channel, ClipMetadata } from '../audio/types.js';

/** Event density levels */
export type EventDensity = 'low' | 'medium' | 'high';

/** Spectrogram visibility modes */
export type SpectrogramMode = 'full' | 'fading' | 'none';

/** Game modes */
export type GameMode = 'campaign' | 'practice' | 'challenge' | 'random';

/** Level configuration from levels.json */
export interface LevelConfig {
  level_id: number;
  pack_id: string;
  mode: GameMode;
  round_duration_sec: number;
  species_count: number;
  event_density: EventDensity;
  overlap_probability: number;
  scoring_window_ms: number;
  spectrogram_mode: SpectrogramMode;
}

/** Runtime game event */
export interface GameEvent {
  /** Unique event identifier */
  event_id: string;
  /** Reference to the clip */
  clip_id: string;
  /** Species code for this event */
  species_code: string;
  /** Channel assignment */
  channel: Channel;
  /** Scheduled playback time (ms from round start) */
  scheduled_time_ms: number;
  /** Scoring window start (ms from round start) */
  scoring_window_start_ms: number;
  /** Scoring window end (ms from round start) */
  scoring_window_end_ms: number;
  /** Duration of the clip in ms */
  duration_ms: number;
  /** Vocalization type (song or call) */
  vocalization_type?: 'song' | 'call';
}

/** Event density configuration (events per second) */
export const EVENT_DENSITY_CONFIG: Record<EventDensity, { minGapMs: number; maxGapMs: number }> = {
  low: { minGapMs: 3000, maxGapMs: 5000 },
  medium: { minGapMs: 1500, maxGapMs: 3000 },
  high: { minGapMs: 800, maxGapMs: 1500 },
};

/** Round state */
export type RoundState = 'idle' | 'countdown' | 'playing' | 'ended';

/** Round statistics */
export interface RoundStats {
  totalEvents: number;
  eventsScored: number;
  totalScore: number;
  accuracy: number;
  perfectCount: number;
  missCount: number;
  speciesCorrectCount: number;
  channelCorrectCount: number;
}

/** Round update callback */
export type RoundUpdateCallback = (timeMs: number, state: RoundState) => void;

/** Round event callback */
export type RoundEventCallback = (event: GameEvent) => void;

/** Round end callback */
export type RoundEndCallback = (stats: RoundStats) => void;

/** Species selection for a level */
export interface SpeciesSelection {
  speciesCode: string;
  commonName: string;
  clips: ClipMetadata[];
}
