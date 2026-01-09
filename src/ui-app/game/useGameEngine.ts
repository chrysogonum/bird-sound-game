/**
 * useGameEngine - React hook that wires AudioEngine, EventScheduler, and ScoreEngine to the UI
 *
 * This hook manages the game lifecycle and provides all state/callbacks needed for gameplay.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel } from '@engine/audio/types';
import type { GameEvent, LevelConfig, RoundState } from '@engine/game/types';
import type { ScoreBreakdown, FeedbackType } from '@engine/scoring/types';
import { SCORE_VALUES } from '@engine/scoring/types';

/** Clip metadata from clips.json */
export interface ClipMetadata {
  clip_id: string;
  species_code: string;
  common_name: string;
  vocalization_type: 'song' | 'call';
  duration_ms: number;
  quality_score: number;
  source: string;
  source_id: string;
  file_path: string;
  spectrogram_path: string | null;
  /** If true, this is the canonical/beginner sound for this species */
  canonical?: boolean;
  /** If true, this clip is excluded from gameplay (quality issues, etc.) */
  rejected?: boolean;
}

/** Species data for UI display */
export interface SpeciesInfo {
  code: string;
  name: string;
  color?: string;
}

/** Active event with UI state */
export interface ActiveEvent extends GameEvent {
  isActive: boolean;
  hasBeenScored: boolean;
}

/** Feedback event for visual display */
export interface FeedbackData {
  id: string;
  type: FeedbackType;
  score: number;
  breakdown: ScoreBreakdown;
  channel: Channel;
  timestamp: number;
}

/** Confusion data for round summary */
export interface ConfusionEntry {
  expectedSpecies: string;
  guessedSpecies: string | null;
  channel: Channel;
}

/** Scheduled event with clip metadata for rendering */
export interface ScheduledEvent extends GameEvent {
  spectrogramPath: string | null;
  filePath: string;
}

/** Game engine state */
export interface GameEngineState {
  roundState: RoundState;
  score: number;
  streak: number;
  timeRemaining: number;
  totalTime: number;
  eventsScored: number;
  speciesCorrect: number;
  channelCorrect: number;
  perfectCount: number;
  missCount: number;
  activeEvents: ActiveEvent[];
  scheduledEvents: ScheduledEvent[];
  roundStartTime: number;
  scrollSpeed: number;
  currentFeedback: FeedbackData | null;
  species: SpeciesInfo[];
  isAudioReady: boolean;
}

/** Game engine actions */
export interface GameEngineActions {
  initialize: () => Promise<void>;
  startRound: () => Promise<void>;
  endRound: () => void;
  submitInput: (speciesCode: string, channel: Channel) => void;
  reset: () => void;
}

/** Scroll speed based on difficulty (pixels per second) */
const SCROLL_SPEED_BY_DENSITY: Record<string, number> = {
  low: 100,      // Beginner: slow and leisurely
  medium: 150,   // Intermediate
  high: 200,     // Expert: fast-paced
};

/** Default level config for testing */
const DEFAULT_LEVEL: LevelConfig = {
  level_id: 1,
  pack_id: 'common_se_birds',
  mode: 'campaign',
  round_duration_sec: 30,
  species_count: 5,
  event_density: 'low',
  overlap_probability: 0,  // No overlaps for beginners
  scoring_window_ms: 2000,
  spectrogram_mode: 'full',
};

/** Species colors for UI */
const SPECIES_COLORS: Record<string, string> = {
  // Original 5
  NOCA: '#E57373',
  CARW: '#81C784',
  BLJA: '#4FC3F7',
  AMCR: '#424242',
  TUTI: '#FFD54F',
  // Expanded pack
  BEKI: '#00BCD4',
  RSHA: '#8D6E63',
  AMGO: '#FFEB3B',
  CACH: '#B0BEC5',
  PIWA: '#AED581',
  WTSP: '#BCAAA4',
  HOFI: '#EF9A9A',
  EABL: '#64B5F6',
  AMRO: '#FF8A65',
  HETH: '#D7CCC8',
  BHNU: '#A1887F',
  BRCR: '#8D6E63',
  WBNU: '#80CBC4',
  YBSA: '#FFF59D',
  RBWO: '#CE93D8',
  DOWO: '#90A4AE',
  HAWO: '#CFD8DC',
  NOFL: '#FFCC80',
  PIWO: '#B39DDB',
  BRTH: '#A1887F',
  GRCA: '#78909C',
  MODO: '#BCAAA4',
};

/**
 * Creates a seeded random number generator
 */
function createSeededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

/**
 * useGameEngine hook - integrates game engine with React UI
 */
export function useGameEngine(level: LevelConfig = DEFAULT_LEVEL): [GameEngineState, GameEngineActions] {
  // Audio context and state
  const audioContextRef = useRef<AudioContext | null>(null);
  const bufferCacheRef = useRef<Map<string, AudioBuffer>>(new Map());
  const activeSourcesRef = useRef<Map<string, AudioBufferSourceNode>>(new Map());
  const activeGainsRef = useRef<Map<string, GainNode>>(new Map());
  const activeEventTimesRef = useRef<Map<string, number>>(new Map()); // eventId -> scheduled hit time
  const volumeUpdateRef = useRef<number | null>(null);

  // Clips and species data
  const [clips, setClips] = useState<ClipMetadata[]>([]);
  const [species, setSpecies] = useState<SpeciesInfo[]>([]);

  // Game state
  const [roundState, setRoundState] = useState<RoundState>('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(level.round_duration_sec);
  const [eventsScored, setEventsScored] = useState(0);
  const [speciesCorrect, setSpeciesCorrect] = useState(0);
  const [channelCorrect, setChannelCorrect] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [roundStartTime, setRoundStartTime] = useState(0);
  // Speed multiplier ref - tracks current setting for dynamic calculations
  // Declared before scrollSpeed since useState initializer uses it
  const speedMultiplierRef = useRef<number>(1.0);

  // Base audio lead time at 1.0x speed
  // At higher speeds, tiles travel faster so lead time decreases
  const BASE_AUDIO_LEAD_TIME_MS = 5000;

  const [scrollSpeed, setScrollSpeed] = useState(() => {
    // Base speed from difficulty
    const baseSpeed = SCROLL_SPEED_BY_DENSITY[level.event_density] || 100;
    // Multiplier from settings (0.5x to 2.0x)
    const savedMultiplier = localStorage.getItem('soundfield_scroll_speed');
    const multiplier = savedMultiplier ? parseFloat(savedMultiplier) : 1.0;
    // Initialize ref with current multiplier
    speedMultiplierRef.current = multiplier;
    return baseSpeed * multiplier;
  });
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Refs for timer and event scheduling
  const timerRef = useRef<number | null>(null);
  const eventTimersRef = useRef<number[]>([]);
  const roundStartTimeRef = useRef<number>(0);
  const generatedEventsRef = useRef<GameEvent[]>([]);
  const scoredEventsRef = useRef<Set<string>>(new Set()); // Track event IDs that were scored
  // Refs to avoid stale closure issues when saving results
  const perfectCountRef = useRef<number>(0);
  const scoreRef = useRef<number>(0);
  const speciesCorrectRef = useRef<number>(0);
  const channelCorrectRef = useRef<number>(0);
  const missCountRef = useRef<number>(0);
  const maxStreakRef = useRef<number>(0);
  const confusionDataRef = useRef<ConfusionEntry[]>([]);

  // Dynamic event spawning
  const eventQueueRef = useRef<GameEvent[]>([]);
  const currentEventIndexRef = useRef<number>(0);

  // Single mode: one event at a time (legacy refs for backwards compatibility)
  const currentEventIdRef = useRef<string | null>(null);
  const currentEventTimerRef = useRef<number | null>(null);

  // Offset mode: per-channel tracking
  const channelEventIdRef = useRef<{ left: string | null; right: string | null }>({ left: null, right: null });
  const channelTimerRef = useRef<{ left: number | null; right: number | null }>({ left: null, right: null });

  /**
   * Load clips.json data
   */
  const loadClips = useCallback(async () => {
    try {
      const response = await fetch('/data/clips.json');
      if (!response.ok) {
        throw new Error('Failed to load clips.json');
      }
      const data: ClipMetadata[] = await response.json();
      setClips(data);

      // Filter by species_pool if level specifies it
      const speciesPool = level.species_pool;
      const allowedSpecies = speciesPool ? new Set(speciesPool) : null;

      // Extract unique species (filtered by species_pool if present)
      const speciesMap = new Map<string, SpeciesInfo>();
      for (const clip of data) {
        // Skip if we have a species_pool and this species isn't in it
        if (allowedSpecies && !allowedSpecies.has(clip.species_code)) {
          continue;
        }
        if (!speciesMap.has(clip.species_code)) {
          speciesMap.set(clip.species_code, {
            code: clip.species_code,
            name: clip.common_name,
            color: SPECIES_COLORS[clip.species_code],
          });
        }
      }
      setSpecies(Array.from(speciesMap.values()));
    } catch (error) {
      console.error('Error loading clips:', error);
    }
  }, [level.species_pool]);

  /**
   * Initialize audio context
   */
  const initializeAudio = useCallback(async () => {
    if (audioContextRef.current) {
      return;
    }

    const ctx = new AudioContext();
    audioContextRef.current = ctx;

    // Resume if suspended (for iOS Safari)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    setIsAudioReady(true);
  }, []);

  /**
   * Load an audio buffer
   */
  const loadAudioBuffer = useCallback(async (filePath: string): Promise<AudioBuffer> => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      throw new Error('Audio context not initialized');
    }

    // Check cache
    const cached = bufferCacheRef.current.get(filePath);
    if (cached) {
      console.log('loadAudioBuffer: Using cached buffer for', filePath);
      return cached;
    }

    console.log('loadAudioBuffer: Fetching', filePath);

    // Fetch and decode
    const response = await fetch(`/${filePath}`);
    if (!response.ok) {
      console.error('loadAudioBuffer: Fetch failed', response.status, response.statusText);
      throw new Error(`Failed to load audio: ${filePath}`);
    }

    console.log('loadAudioBuffer: Fetch OK, decoding...');
    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    console.log('loadAudioBuffer: Decoded OK, duration:', audioBuffer.duration);

    // Cache it
    bufferCacheRef.current.set(filePath, audioBuffer);
    return audioBuffer;
  }, []);

  /**
   * Play audio on a specific channel
   * Audio starts quiet and gets louder as tile approaches hit zone
   */
  const playAudio = useCallback(async (
    filePath: string,
    channel: Channel,
    eventId: string,
    scheduledHitTimeMs: number
  ) => {
    const ctx = audioContextRef.current;
    if (!ctx) {
      console.error('playAudio: No AudioContext!');
      return;
    }

    console.log('playAudio:', filePath, 'ctx.state:', ctx.state);

    try {
      // Ensure context is running (iOS fix)
      if (ctx.state === 'suspended') {
        console.log('playAudio: Context suspended, trying to resume...');
        await ctx.resume();
      }

      const buffer = await loadAudioBuffer(filePath);
      console.log('playAudio: Buffer loaded, duration:', buffer.duration);

      // Create audio nodes
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panner = ctx.createStereoPanner();

      // Start at very low volume - ramps up dramatically as tile approaches hit zone
      gainNode.gain.value = 0.05;

      // Set up panning (-1 for left, 1 for right)
      panner.pan.value = channel === 'left' ? -1 : 1;

      // Connect chain: source -> gain -> panner -> destination
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(ctx.destination);

      // Loop the audio until tile reaches hit zone
      source.loop = true;

      // Track active source, gain, and timing
      activeSourcesRef.current.set(eventId, source);
      activeGainsRef.current.set(eventId, gainNode);
      activeEventTimesRef.current.set(eventId, scheduledHitTimeMs);

      // Clean up when done (only called when we explicitly stop it)
      source.onended = () => {
        activeSourcesRef.current.delete(eventId);
        activeGainsRef.current.delete(eventId);
        activeEventTimesRef.current.delete(eventId);
      };

      // Play immediately
      source.start();
      console.log('playAudio: Started playing');
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [loadAudioBuffer]);

  /**
   * Stop audio for a specific event
   */
  const stopAudio = useCallback((eventId: string) => {
    const source = activeSourcesRef.current.get(eventId);
    if (source) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    activeSourcesRef.current.delete(eventId);
    activeGainsRef.current.delete(eventId);
    activeEventTimesRef.current.delete(eventId);
  }, []);

  /**
   * Select clips for a species based on clip_selection mode.
   * - "canonical": only canonical clips
   * - number (e.g., 3): canonical + up to (N-1) non-canonical clips
   * - "all": all non-rejected clips
   */
  const selectClipsForSpecies = useCallback((
    speciesCode: string,
    allClips: ClipMetadata[],
    clipSelection: 'canonical' | number | 'all',
    random: () => number
  ): ClipMetadata[] => {
    // Get all non-rejected clips for this species
    const speciesClips = allClips.filter(
      (c) => c.species_code === speciesCode && !c.rejected
    );

    if (speciesClips.length === 0) return [];

    // Find canonical clip(s)
    const canonicalClips = speciesClips.filter((c) => c.canonical);
    const nonCanonicalClips = speciesClips.filter((c) => !c.canonical);

    if (clipSelection === 'canonical') {
      // Only canonical clips
      return canonicalClips.length > 0 ? canonicalClips : speciesClips.slice(0, 1);
    }

    if (clipSelection === 'all') {
      // All clips for this species
      return speciesClips;
    }

    // Number mode: canonical + up to (N-1) others
    const maxClips = clipSelection as number;
    const result: ClipMetadata[] = [];

    // Always include canonical first
    if (canonicalClips.length > 0) {
      result.push(...canonicalClips);
    }

    // Shuffle non-canonical and add up to (maxClips - canonical count)
    const shuffledNonCanonical = [...nonCanonicalClips];
    for (let i = shuffledNonCanonical.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [shuffledNonCanonical[i], shuffledNonCanonical[j]] = [shuffledNonCanonical[j], shuffledNonCanonical[i]];
    }

    const slotsRemaining = maxClips - result.length;
    result.push(...shuffledNonCanonical.slice(0, slotsRemaining));

    return result;
  }, []);

  /**
   * Generate event templates for the round.
   * With dynamic spawning, timing is calculated when events spawn, not upfront.
   * We generate plenty of events so fast players don't run out.
   */
  const generateEvents = useCallback((): GameEvent[] => {
    const events: GameEvent[] = [];
    const seed = Date.now();
    const random = createSeededRandom(seed);

    // Determine clip selection mode (new field takes precedence over legacy)
    const clipSelection = level.clip_selection ?? (level.canonical_only ? 'canonical' : 'all');

    // Determine species pool
    let selectedSpecies: string[];
    if (level.species_pool && level.species_pool.length > 0) {
      // Use fixed species pool from level config
      selectedSpecies = [...level.species_pool];
    } else {
      // Get all available species from clips
      const allSpecies = new Set<string>();
      for (const clip of clips) {
        if (!clip.rejected) {
          allSpecies.add(clip.species_code);
        }
      }
      // Shuffle and select
      const speciesArray = Array.from(allSpecies);
      for (let i = speciesArray.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [speciesArray[i], speciesArray[j]] = [speciesArray[j], speciesArray[i]];
      }
      selectedSpecies = speciesArray.slice(0, level.species_count);
    }

    // Build clip pools for each selected species
    const speciesClips = new Map<string, ClipMetadata[]>();
    for (const speciesCode of selectedSpecies) {
      const clipsForSpecies = selectClipsForSpecies(speciesCode, clips, clipSelection, random);
      if (clipsForSpecies.length > 0) {
        speciesClips.set(speciesCode, clipsForSpecies);
      }
    }

    // Filter to only species that have clips available
    selectedSpecies = selectedSpecies.filter((s) => speciesClips.has(s));

    if (selectedSpecies.length === 0) {
      console.error('No species with available clips!');
      return [];
    }

    // Debug logging
    console.log('generateEvents:', {
      clipSelection,
      selectedSpecies,
      clipsPerSpecies: Object.fromEntries(
        Array.from(speciesClips.entries()).map(([k, v]) => [k, v.map(c => c.clip_id)])
      ),
    });

    // Generate plenty of events - with fast identification, players could go through many
    // Assume minimum ~2 seconds per bird, so 30 second round = max ~15 birds
    // Generate extra to be safe
    const maxEvents = Math.ceil(level.round_duration_sec / 2) + 5;

    for (let eventIndex = 0; eventIndex < maxEvents; eventIndex++) {
      // Select random species
      const speciesCode = selectedSpecies[Math.floor(random() * selectedSpecies.length)];
      const speciesClipList = speciesClips.get(speciesCode) || [];
      const clip = speciesClipList[Math.floor(random() * speciesClipList.length)];

      if (!clip) continue;

      // Select random channel
      const channel: Channel = random() < 0.5 ? 'left' : 'right';

      // Timing is placeholder - will be set dynamically when event spawns
      events.push({
        event_id: `evt_${eventIndex}_${seed}`,
        clip_id: clip.clip_id,
        species_code: speciesCode,
        channel,
        scheduled_time_ms: 0, // Will be set when spawned
        scoring_window_start_ms: 0,
        scoring_window_end_ms: 0,
        duration_ms: clip.duration_ms,
        vocalization_type: clip.vocalization_type,
      });
    }

    return events;
  }, [clips, level, selectClipsForSpecies]);

  /**
   * Get clip metadata by ID
   */
  const getClipById = useCallback((clipId: string): ClipMetadata | undefined => {
    return clips.find((c) => c.clip_id === clipId);
  }, [clips]);

  /**
   * Spawn the next event from the queue.
   * @param targetChannel - For offset mode, which channel to spawn on.
   *                        For single mode, ignored (uses event's assigned channel).
   */
  const spawnNextEvent = useCallback((targetChannel?: Channel) => {
    const queue = eventQueueRef.current;
    const index = currentEventIndexRef.current;
    const channelMode = level.channel_mode || 'single';

    // Calculate audio lead time based on current speed multiplier
    // Higher speed = shorter lead time (tiles move faster)
    const audioLeadTimeMs = BASE_AUDIO_LEAD_TIME_MS / speedMultiplierRef.current;

    // Check if there are more events
    if (index >= queue.length) {
      // No more events - round will end when timer expires
      if (channelMode === 'single') {
        currentEventIdRef.current = null;
      } else if (targetChannel) {
        channelEventIdRef.current[targetChannel] = null;
      }
      return;
    }

    // Calculate timing based on NOW
    const now = performance.now();
    const roundStart = roundStartTimeRef.current;
    const elapsedMs = now - roundStart;
    const roundDurationMs = level.round_duration_sec * 1000;
    const remainingMs = roundDurationMs - elapsedMs;

    // Don't spawn if there's not enough time for a meaningful play
    const minPlayableTimeMs = 2000;
    if (remainingMs < minPlayableTimeMs) {
      if (channelMode === 'single') {
        currentEventIdRef.current = null;
      } else if (targetChannel) {
        channelEventIdRef.current[targetChannel] = null;
      }
      return;
    }

    // Get next event template
    const eventTemplate = queue[index];
    currentEventIndexRef.current = index + 1;

    // Determine the channel for this event
    let eventChannel: Channel;
    if (channelMode === 'offset' && targetChannel) {
      // In offset mode, use the target channel
      eventChannel = targetChannel;
    } else {
      // In single mode, use the event's pre-assigned channel
      eventChannel = eventTemplate.channel;
    }

    // Cancel any pending timer for this channel (single mode) or specific channel (offset mode)
    if (channelMode === 'single') {
      if (currentEventTimerRef.current !== null) {
        clearTimeout(currentEventTimerRef.current);
        currentEventTimerRef.current = null;
      }
    } else {
      const existingTimer = channelTimerRef.current[eventChannel];
      if (existingTimer !== null) {
        clearTimeout(existingTimer);
        channelTimerRef.current[eventChannel] = null;
      }
    }

    // Tile should enter NOW, hit zone in audioLeadTimeMs
    const tileEnterTimeMs = elapsedMs;
    const hitZoneTimeMs = elapsedMs + audioLeadTimeMs;

    // Create the actual event with real timing and correct channel
    const event: GameEvent = {
      ...eventTemplate,
      channel: eventChannel,
      scheduled_time_ms: hitZoneTimeMs,
      scoring_window_start_ms: tileEnterTimeMs,
      scoring_window_end_ms: hitZoneTimeMs + 500, // 500ms grace after hit zone
    };

    // Track this as the current event
    if (channelMode === 'single') {
      currentEventIdRef.current = event.event_id;
    } else {
      channelEventIdRef.current[eventChannel] = event.event_id;
    }

    // Add to scheduled events for PixiGame rendering
    const clip = getClipById(event.clip_id);

    if (!clip) {
      console.error('spawnNextEvent: clip not found for clip_id:', event.clip_id, 'species:', event.species_code);
      // Skip this event and try the next one
      if (channelMode === 'single') {
        spawnNextEvent();
      } else if (targetChannel) {
        spawnNextEvent(targetChannel);
      }
      return;
    }

    // Add to generated events for results tracking (only if clip exists)
    generatedEventsRef.current.push(event);

    const scheduledEvent: ScheduledEvent = {
      ...event,
      spectrogramPath: clip.spectrogram_path || null,
      filePath: clip.file_path,
    };
    setScheduledEvents((prev) => [...prev, scheduledEvent]);

    // Start audio immediately (tile is entering now)
    playAudio(clip.file_path, eventChannel, event.event_id, event.scheduled_time_ms);

    // Add to active events (scoring window opens immediately)
    setActiveEvents((prev) => [
      ...prev,
      {
        ...event,
        isActive: true,
        hasBeenScored: false,
      },
    ]);

    // Set up scoring window end (when tile passes hit zone)
    const windowDuration = audioLeadTimeMs + 500; // Full scroll + grace period
    const eventId = event.event_id; // Capture for closure
    const eventChannelCapture = eventChannel; // Capture channel for closure
    const eventSpeciesCapture = event.species_code; // Capture species for miss tracking

    const timerId = window.setTimeout(() => {
      // Verify this event is still the current one for its channel
      if (channelMode === 'single') {
        if (currentEventIdRef.current !== eventId) return;
        currentEventTimerRef.current = null;
      } else {
        if (channelEventIdRef.current[eventChannelCapture] !== eventId) return;
        channelTimerRef.current[eventChannelCapture] = null;
      }

      // Stop the looping audio
      stopAudio(eventId);

      setActiveEvents((prev) =>
        prev.map((e) =>
          e.event_id === eventId ? { ...e, isActive: false } : e
        )
      );

      // Check if this event was never scored (miss)
      setActiveEvents((prev) => {
        const ev = prev.find((e) => e.event_id === eventId);
        if (ev && !ev.hasBeenScored) {
          setMissCount((m) => m + 1);
          missCountRef.current += 1;
          setStreak(0);
          // Record miss in confusion data
          confusionDataRef.current.push({
            expectedSpecies: eventSpeciesCapture,
            guessedSpecies: null,
            channel: eventChannelCapture,
          });
        }
        return prev;
      });

      // Spawn next event after a brief delay (so miss feedback is visible)
      window.setTimeout(() => {
        if (channelMode === 'single') {
          spawnNextEvent();
        } else {
          spawnNextEvent(eventChannelCapture);
        }
      }, 200);
    }, windowDuration);

    // Store timer reference
    if (channelMode === 'single') {
      currentEventTimerRef.current = timerId;
    } else {
      channelTimerRef.current[eventChannel] = timerId;
    }
  }, [getClipById, playAudio, stopAudio, level.round_duration_sec, level.channel_mode]);

  /**
   * Called when player correctly identifies a bird - spawn next immediately
   */
  const onEventCompleted = useCallback((eventId: string, channel: Channel) => {
    const channelMode = level.channel_mode || 'single';

    if (channelMode === 'single') {
      // Single mode: verify this is the current event
      if (currentEventIdRef.current !== eventId) return;

      // Cancel the timeout for this event
      if (currentEventTimerRef.current !== null) {
        clearTimeout(currentEventTimerRef.current);
        currentEventTimerRef.current = null;
      }

      // Clear current event reference
      currentEventIdRef.current = null;

      // Stop audio for this event
      stopAudio(eventId);

      // Spawn next event immediately (no delay for successful IDs)
      spawnNextEvent();
    } else {
      // Offset mode: verify this event is current for its channel
      if (channelEventIdRef.current[channel] !== eventId) return;

      // Cancel the timeout for this channel
      const existingTimer = channelTimerRef.current[channel];
      if (existingTimer !== null) {
        clearTimeout(existingTimer);
        channelTimerRef.current[channel] = null;
      }

      // Clear channel event reference
      channelEventIdRef.current[channel] = null;

      // Stop audio for this event
      stopAudio(eventId);

      // Spawn next event on this channel immediately
      spawnNextEvent(channel);
    }
  }, [stopAudio, spawnNextEvent, level.channel_mode]);

  /**
   * Initialize the engine (load clips, set up audio)
   */
  const initialize = useCallback(async () => {
    await loadClips();
    await initializeAudio();
  }, [loadClips, initializeAudio]);

  /**
   * Start a new round
   */
  const startRound = useCallback(async () => {
    if (roundState !== 'idle' || clips.length === 0) return;

    // CRITICAL for iOS: Create/resume AudioContext during user gesture (tap)
    let ctx = audioContextRef.current;
    if (!ctx) {
      // Create AudioContext during user tap (required for iOS)
      ctx = new AudioContext();
      audioContextRef.current = ctx;
      console.log('AudioContext created during tap');
    }

    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
        console.log('AudioContext resumed, state:', ctx.state);
      } catch (e) {
        console.error('Failed to resume AudioContext:', e);
      }
    }

    // Double-check it's running
    console.log('AudioContext state:', ctx.state);
    setIsAudioReady(true);

    // Re-read scroll speed from settings (in case user changed it)
    const baseSpeed = SCROLL_SPEED_BY_DENSITY[level.event_density] || 100;
    const savedMultiplier = localStorage.getItem('soundfield_scroll_speed');
    const multiplier = savedMultiplier ? parseFloat(savedMultiplier) : 1.0;
    speedMultiplierRef.current = multiplier;
    setScrollSpeed(baseSpeed * multiplier);

    // Reset state
    setScore(0);
    setStreak(0);
    setEventsScored(0);
    setSpeciesCorrect(0);
    setChannelCorrect(0);
    setPerfectCount(0);
    setMissCount(0);
    setActiveEvents([]);
    setScheduledEvents([]); // Start empty - events added dynamically
    setCurrentFeedback(null);
    setTimeRemaining(level.round_duration_sec);
    scoredEventsRef.current.clear();
    // Reset all tracking refs
    perfectCountRef.current = 0;
    scoreRef.current = 0;
    speciesCorrectRef.current = 0;
    channelCorrectRef.current = 0;
    missCountRef.current = 0;
    maxStreakRef.current = 0;
    confusionDataRef.current = [];
    generatedEventsRef.current = []; // Will be populated as events spawn

    // Generate event templates (species, clip, channel - but not timing)
    const eventTemplates = generateEvents();
    eventQueueRef.current = eventTemplates;
    currentEventIndexRef.current = 0;

    // Reset single mode refs
    currentEventIdRef.current = null;
    if (currentEventTimerRef.current !== null) {
      clearTimeout(currentEventTimerRef.current);
      currentEventTimerRef.current = null;
    }

    // Reset offset mode refs
    channelEventIdRef.current = { left: null, right: null };
    if (channelTimerRef.current.left !== null) {
      clearTimeout(channelTimerRef.current.left);
    }
    if (channelTimerRef.current.right !== null) {
      clearTimeout(channelTimerRef.current.right);
    }
    channelTimerRef.current = { left: null, right: null };

    // Start the round
    const startTime = performance.now();
    setRoundState('playing');
    setRoundStartTime(startTime);
    roundStartTimeRef.current = startTime;

    const channelMode = level.channel_mode || 'single';

    if (channelMode === 'single') {
      // Spawn one event
      spawnNextEvent();
    } else {
      // Offset mode: spawn events on both channels with staggered start
      // First channel starts immediately, second channel delayed so player
      // can process the first bird before the second appears
      spawnNextEvent('left');
      const staggerDelayMs = 1500; // 1.5 second delay for second channel
      const staggerTimerId = window.setTimeout(() => {
        spawnNextEvent('right');
      }, staggerDelayMs);
      eventTimersRef.current.push(staggerTimerId);
    }

    // Start countdown timer
    timerRef.current = window.setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          endRound();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Round ends when timer expires (dynamic spawning means we don't know exact end)
    const roundEndTimerId = window.setTimeout(() => {
      endRound();
    }, level.round_duration_sec * 1000);
    eventTimersRef.current.push(roundEndTimerId);
  }, [roundState, clips.length, level.round_duration_sec, level.channel_mode, generateEvents, spawnNextEvent]);

  /**
   * End the current round
   */
  const endRound = useCallback(() => {
    setRoundState('ended');

    // Clear the countdown timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Clear single mode event timer
    if (currentEventTimerRef.current !== null) {
      clearTimeout(currentEventTimerRef.current);
      currentEventTimerRef.current = null;
    }
    currentEventIdRef.current = null;

    // Clear offset mode channel timers
    if (channelTimerRef.current.left !== null) {
      clearTimeout(channelTimerRef.current.left);
    }
    if (channelTimerRef.current.right !== null) {
      clearTimeout(channelTimerRef.current.right);
    }
    channelTimerRef.current = { left: null, right: null };
    channelEventIdRef.current = { left: null, right: null };

    // Clear all other pending timers
    for (const timerId of eventTimersRef.current) {
      clearTimeout(timerId);
    }
    eventTimersRef.current = [];

    // Stop ALL playing audio immediately
    for (const source of activeSourcesRef.current.values()) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    activeSourcesRef.current.clear();
    activeGainsRef.current.clear();
    activeEventTimesRef.current.clear();

    // Compile and save round results for summary screen
    const speciesResults: Record<string, { total: number; correct: number }> = {};

    // Count results per species from all generated events
    for (const event of generatedEventsRef.current) {
      const speciesCode = event.species_code;
      if (!speciesResults[speciesCode]) {
        speciesResults[speciesCode] = { total: 0, correct: 0 };
      }
      speciesResults[speciesCode].total++;

      // Check if this event was scored correctly (using ref, not stale state)
      if (scoredEventsRef.current.has(event.event_id)) {
        speciesResults[speciesCode].correct++;
      }
    }

    const totalScored = scoredEventsRef.current.size;

    // Save to localStorage for summary screen
    // Use refs to avoid stale closure issue with React state
    const roundResults = {
      score: scoreRef.current,
      eventsScored: totalScored,
      totalEvents: generatedEventsRef.current.length,
      speciesCorrect: speciesCorrectRef.current,
      channelCorrect: channelCorrectRef.current,
      perfectCount: perfectCountRef.current,
      missCount: missCountRef.current,
      maxStreak: maxStreakRef.current,
      speciesResults,
      species: species.map(s => ({ code: s.code, name: s.name })),
      // Save mode/pack/level so "Play Again" and "Next Level" work
      mode: level.mode,
      packId: level.pack_id,
      levelId: level.level_id,
      levelTitle: level.title,
      // Confusion data for summary
      confusionData: confusionDataRef.current,
    };
    localStorage.setItem('soundfield_round_results', JSON.stringify(roundResults));
  }, [species, level.mode, level.pack_id, level.level_id, level.title]);

  /**
   * Calculate score breakdown
   * SCORING: Based on screen position when identified
   * - Top 25% of screen: 100% of points
   * - 25-50%: 75% of points
   * - 50-75%: 50% of points
   * - Bottom 25%: 25% of points
   *
   * Base points: Species correct (required) + Channel correct (bonus)
   */
  const calculateBreakdown = useCallback((
    event: ActiveEvent,
    inputSpecies: string,
    inputChannel: Channel,
    inputTime: number
  ): ScoreBreakdown => {
    const speciesCorrectResult = inputSpecies === event.species_code;
    const channelCorrectResult = inputChannel === event.channel;

    // Calculate position on screen (1.0 = top, 0.0 = hit zone)
    // inputTime is ms since round start
    // event.scheduled_time_ms is when tile hits the finish line
    // scoring_window_start_ms is when tile entered screen
    const hitZoneTime = event.scheduled_time_ms;
    const enterTime = event.scoring_window_start_ms;
    const totalWindow = hitZoneTime - enterTime;
    const timeBeforeHitZone = hitZoneTime - inputTime;
    const positionRatio = Math.max(0, Math.min(1, timeBeforeHitZone / totalWindow));

    // Determine timing multiplier based on which quarter of screen
    // Top 25% (positionRatio >= 0.75): 100%
    // 25-50% (positionRatio >= 0.50): 75%
    // 50-75% (positionRatio >= 0.25): 50%
    // Bottom 25% (positionRatio < 0.25): 25%
    let timingMultiplier: number;
    let timingAccuracy: 'perfect' | 'partial' | 'miss';

    if (positionRatio >= 0.75) {
      timingMultiplier = 1.0;
      timingAccuracy = 'perfect';
    } else if (positionRatio >= 0.50) {
      timingMultiplier = 0.75;
      timingAccuracy = 'perfect';
    } else if (positionRatio >= 0.25) {
      timingMultiplier = 0.50;
      timingAccuracy = 'partial';
    } else {
      timingMultiplier = 0.25;
      timingAccuracy = 'partial';
    }

    // Calculate base points (what you'd get with perfect timing)
    // Species MUST be correct to get any points
    // Channel is a bonus only if species is also correct
    const baseSpeciesPoints = speciesCorrectResult ? SCORE_VALUES.SPECIES_CORRECT : 0;
    const baseChannelPoints = (speciesCorrectResult && channelCorrectResult) ? SCORE_VALUES.CHANNEL_CORRECT : 0;
    const baseTotal = baseSpeciesPoints + baseChannelPoints;

    // Apply timing multiplier to get actual points
    const totalPoints = Math.round(baseTotal * timingMultiplier);

    // For breakdown display, scale each component
    const speciesPoints = Math.round(baseSpeciesPoints * timingMultiplier);
    const channelPoints = Math.round(baseChannelPoints * timingMultiplier);
    const timingPoints = 0; // No longer a separate category

    return {
      speciesPoints,
      channelPoints,
      timingPoints,
      totalPoints,
      speciesCorrect: speciesCorrectResult,
      channelCorrect: channelCorrectResult,
      timingAccuracy,
    };
  }, []);

  /**
   * Submit player input
   */
  const submitInput = useCallback((speciesCode: string, channel: Channel) => {
    if (roundState !== 'playing') return;

    const currentTime = performance.now();
    const roundTime = currentTime - roundStartTimeRef.current;
    const channelMode = level.channel_mode || 'single';

    // Find the active event that matches this input
    // In offset mode, match by channel; in single mode, match any active event
    const matchingEvent = activeEvents.find((e) => {
      if (e.hasBeenScored) return false;
      if (roundTime < e.scoring_window_start_ms || roundTime > e.scoring_window_end_ms) return false;
      // In offset mode, only match events on the input channel
      if (channelMode === 'offset' && e.channel !== channel) return false;
      return true;
    });

    if (!matchingEvent) {
      // No active event - this is a spurious input, ignore
      return;
    }

    // Calculate score
    const breakdown = calculateBreakdown(matchingEvent, speciesCode, channel, roundTime);

    // Record confusion data for summary
    confusionDataRef.current.push({
      expectedSpecies: matchingEvent.species_code,
      guessedSpecies: speciesCode,
      channel: matchingEvent.channel,
    });

    // Track this event as scored (in ref for endRound to access)
    if (breakdown.speciesCorrect) {
      scoredEventsRef.current.add(matchingEvent.event_id);
    }
    // Move on to next bird immediately (whether correct or wrong)
    // This keeps the game flowing without awkward pauses
    onEventCompleted(matchingEvent.event_id, matchingEvent.channel);

    // Update state
    setActiveEvents((prev) =>
      prev.map((e) =>
        e.event_id === matchingEvent.event_id ? { ...e, hasBeenScored: true } : e
      )
    );

    setScore((s) => s + breakdown.totalPoints);
    scoreRef.current += breakdown.totalPoints; // Also update ref to avoid stale closure
    setEventsScored((e) => e + 1);

    if (breakdown.speciesCorrect) {
      setSpeciesCorrect((s) => s + 1);
      speciesCorrectRef.current += 1;
    }
    if (breakdown.channelCorrect) {
      setChannelCorrect((c) => c + 1);
      channelCorrectRef.current += 1;
    }
    const maxPossible = SCORE_VALUES.SPECIES_CORRECT + SCORE_VALUES.CHANNEL_CORRECT;
    if (breakdown.totalPoints === maxPossible) {
      setPerfectCount((p) => p + 1);
      perfectCountRef.current += 1;
      setStreak((s) => {
        const newStreak = s + 1;
        maxStreakRef.current = Math.max(maxStreakRef.current, newStreak);
        return newStreak;
      });
    } else if (breakdown.totalPoints > 0) {
      setStreak((s) => {
        const newStreak = s + 1;
        maxStreakRef.current = Math.max(maxStreakRef.current, newStreak);
        return newStreak;
      });
    } else {
      setStreak(0);
    }

    // Determine feedback type
    // Perfect: both correct AND top 25% of screen (full points)
    // Good: both correct but lower on screen
    // Partial: species correct, channel wrong
    // Miss: species wrong
    let feedbackType: FeedbackType;
    const maxPossiblePoints = SCORE_VALUES.SPECIES_CORRECT + SCORE_VALUES.CHANNEL_CORRECT; // 75
    if (breakdown.totalPoints === maxPossiblePoints) {
      feedbackType = 'perfect'; // Both correct + top 25%
    } else if (breakdown.speciesCorrect && breakdown.channelCorrect) {
      feedbackType = 'good'; // Both correct but not top 25%
    } else if (breakdown.speciesCorrect) {
      feedbackType = 'partial'; // Species right, channel wrong
    } else {
      feedbackType = 'miss'; // Species wrong
    }

    // Show feedback
    const feedback: FeedbackData = {
      id: `feedback_${Date.now()}`,
      type: feedbackType,
      score: breakdown.totalPoints,
      breakdown,
      channel: matchingEvent.channel,
      timestamp: currentTime,
    };

    setCurrentFeedback(feedback);

    // Clear feedback after animation
    setTimeout(() => {
      setCurrentFeedback((prev) => (prev?.id === feedback.id ? null : prev));
    }, 500);
  }, [roundState, activeEvents, calculateBreakdown, onEventCompleted, level.channel_mode]);

  /**
   * Reset to idle state
   */
  const reset = useCallback(() => {
    endRound();
    setRoundState('idle');
    setScore(0);
    setStreak(0);
    setEventsScored(0);
    setSpeciesCorrect(0);
    setChannelCorrect(0);
    setPerfectCount(0);
    setMissCount(0);
    setActiveEvents([]);
    setScheduledEvents([]);
    setRoundStartTime(0);
    setCurrentFeedback(null);
    setTimeRemaining(level.round_duration_sec);
  }, [endRound, level.round_duration_sec]);

  /**
   * Volume ramping loop - makes audio louder as tiles approach hit zone
   */
  useEffect(() => {
    if (roundState !== 'playing') {
      if (volumeUpdateRef.current) {
        cancelAnimationFrame(volumeUpdateRef.current);
        volumeUpdateRef.current = null;
      }
      return;
    }

    const updateVolumes = () => {
      const elapsed = performance.now() - roundStartTimeRef.current;
      // Calculate audio lead time based on current speed multiplier
      const audioLeadTimeMs = BASE_AUDIO_LEAD_TIME_MS / speedMultiplierRef.current;

      // Update gain for each active audio
      for (const [eventId, gainNode] of activeGainsRef.current.entries()) {
        const hitTimeMs = activeEventTimesRef.current.get(eventId);
        if (hitTimeMs === undefined) continue;

        // Calculate progress: 0 = audio just started, 1 = at hit zone
        const timeUntilHit = hitTimeMs - elapsed;
        const progress = Math.max(0, Math.min(1, 1 - (timeUntilHit / audioLeadTimeMs)));

        // Volume ramps from 0.05 (tile at top) to 1.0 (tile at hit zone)
        // This is a 20x increase - very dramatic
        const volume = 0.05 + (progress * 0.95);
        gainNode.gain.setValueAtTime(volume, audioContextRef.current?.currentTime || 0);
      }

      volumeUpdateRef.current = requestAnimationFrame(updateVolumes);
    };

    volumeUpdateRef.current = requestAnimationFrame(updateVolumes);

    return () => {
      if (volumeUpdateRef.current) {
        cancelAnimationFrame(volumeUpdateRef.current);
      }
    };
  }, [roundState]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (volumeUpdateRef.current) {
        cancelAnimationFrame(volumeUpdateRef.current);
      }
      for (const timerId of eventTimersRef.current) {
        clearTimeout(timerId);
      }
      for (const source of activeSourcesRef.current.values()) {
        try {
          source.stop();
        } catch {
          // Already stopped
        }
      }
    };
  }, []);

  // Assemble state and actions
  const state: GameEngineState = {
    roundState,
    score,
    streak,
    timeRemaining,
    totalTime: level.round_duration_sec,
    eventsScored,
    speciesCorrect,
    channelCorrect,
    perfectCount,
    missCount,
    activeEvents,
    scheduledEvents,
    roundStartTime,
    scrollSpeed,
    currentFeedback,
    species,
    isAudioReady,
  };

  const actions: GameEngineActions = {
    initialize,
    startRound,
    endRound,
    submitInput,
    reset,
  };

  return [state, actions];
}

export default useGameEngine;
