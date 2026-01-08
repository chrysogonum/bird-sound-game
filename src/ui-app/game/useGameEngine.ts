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
  maxStreak: number;
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
  currentFeedback: FeedbackData | null;
  species: SpeciesInfo[];
  isAudioReady: boolean;
}

/** Game engine actions */
export interface GameEngineActions {
  initialize: () => Promise<void>;
  startRound: () => void;
  endRound: () => void;
  submitInput: (speciesCode: string, channel: Channel) => void;
  reset: () => void;
}

/** Audio plays this many ms BEFORE the tile reaches the hit zone */
const AUDIO_LEAD_TIME_MS = 2500;

/** Default level config for testing */
const DEFAULT_LEVEL: LevelConfig = {
  level_id: 1,
  pack_id: 'common_se_birds',
  mode: 'campaign',
  round_duration_sec: 30,
  species_count: 5,
  event_density: 'low',
  overlap_probability: 0,
  scoring_window_ms: 2000,
  spectrogram_mode: 'full',
};

/** Species colors for UI */
const SPECIES_COLORS: Record<string, string> = {
  NOCA: '#E57373',
  BLJA: '#4FC3F7',
  CARW: '#81C784',
  AMCR: '#424242',
  TUTI: '#FFD54F',
  EABL: '#4A90D9',
  MODO: '#A1887F',
  AMRO: '#FF8A65',
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

  // Clips and species data
  const [clips, setClips] = useState<ClipMetadata[]>([]);
  const [species, setSpecies] = useState<SpeciesInfo[]>([]);

  // Game state
  const [roundState, setRoundState] = useState<RoundState>('idle');
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(level.round_duration_sec);
  const [eventsScored, setEventsScored] = useState(0);
  const [speciesCorrect, setSpeciesCorrect] = useState(0);
  const [channelCorrect, setChannelCorrect] = useState(0);
  const [perfectCount, setPerfectCount] = useState(0);
  const [missCount, setMissCount] = useState(0);
  const [activeEvents, setActiveEvents] = useState<ActiveEvent[]>([]);
  const [scheduledEvents, setScheduledEvents] = useState<ScheduledEvent[]>([]);
  const [roundStartTime, setRoundStartTime] = useState(0);
  const [currentFeedback, setCurrentFeedback] = useState<FeedbackData | null>(null);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Refs for timer and event scheduling
  const timerRef = useRef<number | null>(null);
  const eventTimersRef = useRef<number[]>([]);
  const roundStartTimeRef = useRef<number>(0);
  const generatedEventsRef = useRef<GameEvent[]>([]);

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

      // Extract unique species
      const speciesMap = new Map<string, SpeciesInfo>();
      for (const clip of data) {
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
  }, []);

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
      return cached;
    }

    // Fetch and decode
    const response = await fetch(`/${filePath}`);
    if (!response.ok) {
      throw new Error(`Failed to load audio: ${filePath}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

    // Cache it
    bufferCacheRef.current.set(filePath, audioBuffer);
    return audioBuffer;
  }, []);

  /**
   * Play audio on a specific channel
   */
  const playAudio = useCallback(async (filePath: string, channel: Channel, eventId: string) => {
    const ctx = audioContextRef.current;
    if (!ctx) return;

    try {
      const buffer = await loadAudioBuffer(filePath);

      // Create audio nodes
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      const panner = ctx.createStereoPanner();

      // Set up panning (-1 for left, 1 for right)
      panner.pan.value = channel === 'left' ? -1 : 1;

      // Connect chain: source -> gain -> panner -> destination
      source.buffer = buffer;
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(ctx.destination);

      // Track active source
      activeSourcesRef.current.set(eventId, source);

      // Clean up when done
      source.onended = () => {
        activeSourcesRef.current.delete(eventId);
      };

      // Play immediately
      source.start();
    } catch (error) {
      console.error('Error playing audio:', error);
    }
  }, [loadAudioBuffer]);

  /**
   * Generate events for the round
   */
  const generateEvents = useCallback((): GameEvent[] => {
    const roundDurationMs = level.round_duration_sec * 1000;
    const events: GameEvent[] = [];
    const seed = Date.now();
    const random = createSeededRandom(seed);

    // Get clips organized by species
    const speciesClips = new Map<string, ClipMetadata[]>();
    for (const clip of clips) {
      const existing = speciesClips.get(clip.species_code) || [];
      existing.push(clip);
      speciesClips.set(clip.species_code, existing);
    }

    // Select species for this level
    const availableSpecies = Array.from(speciesClips.keys());
    const selectedSpecies = availableSpecies.slice(0, level.species_count);

    // Gap timing based on density
    const gapConfig = {
      low: { min: 3000, max: 5000 },
      medium: { min: 1500, max: 3000 },
      high: { min: 800, max: 1500 },
    };
    const { min: minGap, max: maxGap } = gapConfig[level.event_density];
    const halfWindow = level.scoring_window_ms / 2;

    let currentTimeMs = 1000; // Start 1 second in
    let eventIndex = 0;

    while (currentTimeMs < roundDurationMs - 3000) {
      // Select random species
      const speciesCode = selectedSpecies[Math.floor(random() * selectedSpecies.length)];
      const speciesClipList = speciesClips.get(speciesCode) || [];
      const clip = speciesClipList[Math.floor(random() * speciesClipList.length)];

      if (!clip) continue;

      // Select random channel
      const channel: Channel = random() < 0.5 ? 'left' : 'right';

      events.push({
        event_id: `evt_${eventIndex}_${seed}`,
        clip_id: clip.clip_id,
        species_code: speciesCode,
        channel,
        scheduled_time_ms: currentTimeMs,
        scoring_window_start_ms: currentTimeMs - halfWindow,
        scoring_window_end_ms: currentTimeMs + halfWindow,
        duration_ms: clip.duration_ms,
        vocalization_type: clip.vocalization_type,
      });

      eventIndex++;

      // Add overlap event if configured
      if (level.overlap_probability > 0 && random() < level.overlap_probability) {
        const overlapSpecies = selectedSpecies[Math.floor(random() * selectedSpecies.length)];
        const overlapClips = speciesClips.get(overlapSpecies) || [];
        const overlapClip = overlapClips[Math.floor(random() * overlapClips.length)];

        if (overlapClip) {
          const overlapChannel: Channel = channel === 'left' ? 'right' : 'left';
          const offset = Math.floor(random() * 400) - 200;

          events.push({
            event_id: `evt_${eventIndex}_${seed}`,
            clip_id: overlapClip.clip_id,
            species_code: overlapSpecies,
            channel: overlapChannel,
            scheduled_time_ms: currentTimeMs + offset,
            scoring_window_start_ms: currentTimeMs + offset - halfWindow,
            scoring_window_end_ms: currentTimeMs + offset + halfWindow,
            duration_ms: overlapClip.duration_ms,
            vocalization_type: overlapClip.vocalization_type,
          });

          eventIndex++;
        }
      }

      // Calculate next event time
      const gap = minGap + Math.floor(random() * (maxGap - minGap));
      currentTimeMs += gap;
    }

    return events;
  }, [clips, level]);

  /**
   * Get clip metadata by ID
   */
  const getClipById = useCallback((clipId: string): ClipMetadata | undefined => {
    return clips.find((c) => c.clip_id === clipId);
  }, [clips]);

  /**
   * Schedule an event to play
   * Audio plays AUDIO_LEAD_TIME_MS before the tile reaches the hit zone,
   * giving the player time to hear and identify the bird.
   */
  const scheduleEvent = useCallback((event: GameEvent) => {
    const now = performance.now();
    const roundStart = roundStartTimeRef.current;

    // Audio plays earlier than scheduled_time (when tile hits zone)
    const audioPlayTime = event.scheduled_time_ms - AUDIO_LEAD_TIME_MS;
    const audioDelay = Math.max(0, audioPlayTime - (now - roundStart));

    // Schedule audio to play early (as tile scrolls down)
    const audioTimerId = window.setTimeout(() => {
      const clip = getClipById(event.clip_id);
      if (!clip) return;
      playAudio(clip.file_path, event.channel, event.event_id);
    }, audioDelay);
    eventTimersRef.current.push(audioTimerId);

    // Schedule scoring window to open at the hit zone time
    const hitZoneDelay = Math.max(0, event.scheduled_time_ms - (now - roundStart));
    const hitZoneTimerId = window.setTimeout(() => {
      // Add to active events (scoring window opens)
      setActiveEvents((prev) => [
        ...prev,
        {
          ...event,
          isActive: true,
          hasBeenScored: false,
        },
      ]);

      // Set up scoring window end
      const windowDuration = event.scoring_window_end_ms - event.scheduled_time_ms;
      window.setTimeout(() => {
        setActiveEvents((prev) =>
          prev.map((e) =>
            e.event_id === event.event_id ? { ...e, isActive: false } : e
          )
        );

        // Check if this event was never scored (miss)
        setActiveEvents((prev) => {
          const ev = prev.find((e) => e.event_id === event.event_id);
          if (ev && !ev.hasBeenScored) {
            setMissCount((m) => m + 1);
            setStreak(0);
          }
          return prev;
        });
      }, windowDuration);
    }, hitZoneDelay);
    eventTimersRef.current.push(hitZoneTimerId);
  }, [getClipById, playAudio]);

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
  const startRound = useCallback(() => {
    if (roundState !== 'idle' || clips.length === 0) return;

    // Reset state
    setScore(0);
    setStreak(0);
    setEventsScored(0);
    setSpeciesCorrect(0);
    setChannelCorrect(0);
    setPerfectCount(0);
    setMissCount(0);
    setActiveEvents([]);
    setCurrentFeedback(null);
    setTimeRemaining(level.round_duration_sec);

    // Generate events
    const events = generateEvents();
    generatedEventsRef.current = events;

    // Create scheduled events with clip metadata
    const scheduled: ScheduledEvent[] = events.map((event) => {
      const clip = getClipById(event.clip_id);
      return {
        ...event,
        spectrogramPath: clip?.spectrogram_path || null,
        filePath: clip?.file_path || '',
      };
    });
    setScheduledEvents(scheduled);

    // Start the round
    const startTime = performance.now();
    setRoundState('playing');
    setRoundStartTime(startTime);
    roundStartTimeRef.current = startTime;

    // Schedule all events
    for (const event of events) {
      scheduleEvent(event);
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
  }, [roundState, clips.length, level.round_duration_sec, generateEvents, scheduleEvent]);

  /**
   * End the current round
   */
  const endRound = useCallback(() => {
    setRoundState('ended');

    // Clear timers
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    for (const timerId of eventTimersRef.current) {
      clearTimeout(timerId);
    }
    eventTimersRef.current = [];

    // Stop all playing audio
    for (const source of activeSourcesRef.current.values()) {
      try {
        source.stop();
      } catch {
        // Already stopped
      }
    }
    activeSourcesRef.current.clear();
  }, []);

  /**
   * Calculate score breakdown
   */
  const calculateBreakdown = useCallback((
    event: ActiveEvent,
    inputSpecies: string,
    inputChannel: Channel,
    inputTime: number
  ): ScoreBreakdown => {
    const speciesCorrectResult = inputSpecies === event.species_code;
    const channelCorrectResult = inputChannel === event.channel;

    // Check timing - use the input time passed in
    const perfectTimeMs = event.scheduled_time_ms;
    const deviation = Math.abs(inputTime - perfectTimeMs);
    const isPerfect = deviation <= 100; // 100ms tolerance

    const speciesPoints = speciesCorrectResult ? SCORE_VALUES.SPECIES_CORRECT : 0;
    const channelPoints = channelCorrectResult ? SCORE_VALUES.CHANNEL_CORRECT : 0;
    const timingPoints = isPerfect ? SCORE_VALUES.TIMING_PERFECT : SCORE_VALUES.TIMING_PARTIAL;

    return {
      speciesPoints,
      channelPoints,
      timingPoints,
      totalPoints: speciesPoints + channelPoints + timingPoints,
      speciesCorrect: speciesCorrectResult,
      channelCorrect: channelCorrectResult,
      timingAccuracy: isPerfect ? 'perfect' : 'partial',
    };
  }, []);

  /**
   * Submit player input
   */
  const submitInput = useCallback((speciesCode: string, channel: Channel) => {
    if (roundState !== 'playing') return;

    const currentTime = performance.now();
    const roundTime = currentTime - roundStartTimeRef.current;

    // Find the active event that matches this input timing
    const matchingEvent = activeEvents.find((e) => {
      if (e.hasBeenScored) return false;
      return roundTime >= e.scoring_window_start_ms && roundTime <= e.scoring_window_end_ms;
    });

    if (!matchingEvent) {
      // No active event - this is a spurious input, ignore
      return;
    }

    // Calculate score
    const breakdown = calculateBreakdown(matchingEvent, speciesCode, channel, roundTime);

    // Update state
    setActiveEvents((prev) =>
      prev.map((e) =>
        e.event_id === matchingEvent.event_id ? { ...e, hasBeenScored: true } : e
      )
    );

    setScore((s) => s + breakdown.totalPoints);
    setEventsScored((e) => e + 1);

    if (breakdown.speciesCorrect) {
      setSpeciesCorrect((s) => s + 1);
    }
    if (breakdown.channelCorrect) {
      setChannelCorrect((c) => c + 1);
    }
    if (breakdown.totalPoints === SCORE_VALUES.MAX_PER_EVENT) {
      setPerfectCount((p) => p + 1);
      setStreak((s) => Math.min(s + 1, maxStreak));
    } else if (breakdown.totalPoints > 0) {
      setStreak((s) => Math.min(s + 1, maxStreak));
    } else {
      setStreak(0);
    }

    // Determine feedback type
    let feedbackType: FeedbackType;
    if (breakdown.totalPoints === SCORE_VALUES.MAX_PER_EVENT) {
      feedbackType = 'perfect';
    } else if (breakdown.speciesCorrect && breakdown.channelCorrect) {
      feedbackType = 'good';
    } else if (breakdown.totalPoints > 0) {
      feedbackType = 'partial';
    } else {
      feedbackType = 'miss';
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
  }, [roundState, activeEvents, calculateBreakdown, maxStreak]);

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
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
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
    maxStreak,
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
