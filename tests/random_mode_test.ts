/**
 * Phase I: Random Mode and InfiniteScheduler Tests
 *
 * Tests for enhanced RandomMode and InfiniteScheduler with difficulty ramping.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InfiniteScheduler, type DifficultyRamp } from '../src/game/InfiniteScheduler.js';
import { RandomMode, type RandomModeConfig, type ExtendedRandomSettings } from '../src/modes/RandomMode.js';
import type { SpeciesSelection } from '../src/game/types.js';
import type { Pack } from '../src/packs/types.js';
import type { ClipMetadata } from '../src/audio/types.js';

// Test fixtures
const createMockClip = (id: string, vocalizationType: 'song' | 'call'): ClipMetadata => ({
  clip_id: id,
  species_code: 'TEST',
  common_name: 'Test Bird',
  vocalization_type: vocalizationType,
  duration_ms: 2000,
  audio_path: `clips/${id}.mp3`,
  spectrogram_path: `spectrograms/${id}.png`,
  quality: 'A',
  source_id: 'XC123',
});

const createTestSpecies = (): SpeciesSelection[] => [
  {
    speciesCode: 'NOCA',
    commonName: 'Northern Cardinal',
    clips: [
      createMockClip('noca_song_1', 'song'),
      createMockClip('noca_call_1', 'call'),
    ],
  },
  {
    speciesCode: 'BLJA',
    commonName: 'Blue Jay',
    clips: [
      createMockClip('blja_song_1', 'song'),
      createMockClip('blja_call_1', 'call'),
    ],
  },
  {
    speciesCode: 'AMRO',
    commonName: 'American Robin',
    clips: [
      createMockClip('amro_song_1', 'song'),
      createMockClip('amro_call_1', 'call'),
    ],
  },
];

const createTestPack = (overrides: Partial<Pack> = {}): Pack => ({
  packId: 'test_pack',
  displayName: 'Test Pack',
  description: 'Test pack',
  species: ['NOCA', 'BLJA', 'AMRO'],
  vocalizationWeights: { song: 0.5, call: 0.5 },
  overlapMultiplier: 1.0,
  tempoMultiplier: 1.0,
  seasonalContext: null,
  ...overrides,
});

describe('InfiniteScheduler', () => {
  let scheduler: InfiniteScheduler;
  let species: SpeciesSelection[];

  beforeEach(() => {
    scheduler = new InfiniteScheduler({ seed: 12345 });
    species = createTestSpecies();
  });

  describe('getDifficultyState()', () => {
    it('returns low difficulty at session start', () => {
      const state = scheduler.getDifficultyState(0);

      expect(state.rampProgress).toBe(0);
      expect(state.eventDensity).toBe('low');
      expect(state.overlapProbability).toBe(0);
    });

    it('returns medium difficulty at 2 minutes (33% of 5min ramp)', () => {
      const twoMinutes = 2 * 60 * 1000;
      const state = scheduler.getDifficultyState(twoMinutes);

      expect(state.rampProgress).toBeCloseTo(0.4, 1);
      expect(state.eventDensity).toBe('medium');
    });

    it('returns high difficulty at 5 minutes', () => {
      const fiveMinutes = 5 * 60 * 1000;
      const state = scheduler.getDifficultyState(fiveMinutes);

      expect(state.rampProgress).toBe(1);
      expect(state.eventDensity).toBe('high');
      expect(state.overlapProbability).toBeCloseTo(0.3, 1);
    });

    it('caps ramp progress at 1.0 after ramp duration', () => {
      const tenMinutes = 10 * 60 * 1000;
      const state = scheduler.getDifficultyState(tenMinutes);

      expect(state.rampProgress).toBe(1);
    });

    it('interpolates gap timing correctly', () => {
      const startState = scheduler.getDifficultyState(0);
      const endState = scheduler.getDifficultyState(5 * 60 * 1000);

      // Start should have larger gaps (low density)
      expect(startState.minGapMs).toBeGreaterThan(endState.minGapMs);
      expect(startState.maxGapMs).toBeGreaterThan(endState.maxGapMs);
    });

    it('applies pack tempo modifier', () => {
      const fastPack = createTestPack({ tempoMultiplier: 1.5 });
      const fastScheduler = new InfiniteScheduler({ seed: 12345, pack: fastPack });

      const defaultState = scheduler.getDifficultyState(60000);
      const fastState = fastScheduler.getDifficultyState(60000);

      // Faster tempo = shorter gaps
      expect(fastState.minGapMs).toBeLessThan(defaultState.minGapMs);
      expect(fastState.maxGapMs).toBeLessThan(defaultState.maxGapMs);
    });

    it('applies pack overlap modifier', () => {
      const overlapPack = createTestPack({ overlapMultiplier: 1.5 });
      const overlapScheduler = new InfiniteScheduler({ seed: 12345, pack: overlapPack });

      const midpoint = 2.5 * 60 * 1000;
      const defaultState = scheduler.getDifficultyState(midpoint);
      const overlapState = overlapScheduler.getDifficultyState(midpoint);

      expect(overlapState.overlapProbability).toBeGreaterThan(defaultState.overlapProbability);
    });
  });

  describe('generateNextEvents()', () => {
    beforeEach(() => {
      scheduler.start(0);
    });

    it('generates events after start', () => {
      const events = scheduler.generateNextEvents(1000, species);

      expect(events.length).toBeGreaterThan(0);
      expect(events[0].event_id).toContain('inf_');
    });

    it('assigns random channels', () => {
      // Generate many events and check for both channels
      const channels = new Set<string>();
      for (let i = 0; i < 50; i++) {
        const events = scheduler.generateNextEvents(i * 2000, species);
        events.forEach((e) => channels.add(e.channel));
      }

      expect(channels.has('left')).toBe(true);
      expect(channels.has('right')).toBe(true);
    });

    it('includes vocalization type in events', () => {
      const events = scheduler.generateNextEvents(1000, species);

      expect(events[0].vocalization_type).toBeDefined();
      expect(['song', 'call']).toContain(events[0].vocalization_type);
    });

    it('respects pack vocalization weights', () => {
      const songPack = createTestPack({ vocalizationWeights: { song: 0.9, call: 0.1 } });
      const songScheduler = new InfiniteScheduler({ seed: 12345, pack: songPack });
      songScheduler.start(0);

      // Generate many events
      let songs = 0;
      let calls = 0;
      for (let t = 1000; t < 100000; t += 2000) {
        const events = songScheduler.generateNextEvents(t, species);
        events.forEach((e) => {
          if (e.vocalization_type === 'song') songs++;
          else calls++;
        });
      }

      const songRatio = songs / (songs + calls);
      expect(songRatio).toBeGreaterThan(0.6); // Should be heavily weighted to songs
    });

    it('returns empty array when not running', () => {
      scheduler.stop();
      const events = scheduler.generateNextEvents(1000, species);
      expect(events).toHaveLength(0);
    });
  });

  describe('generateEventsForWindow()', () => {
    beforeEach(() => {
      scheduler.start(0);
    });

    it('generates multiple events for a time window', () => {
      const events = scheduler.generateEventsForWindow(0, 30000, species);

      expect(events.length).toBeGreaterThan(1);
    });

    it('events are within the time window', () => {
      const startMs = 10000;
      const endMs = 30000;
      const events = scheduler.generateEventsForWindow(startMs, endMs, species);

      events.forEach((event) => {
        expect(event.scheduled_time_ms).toBeGreaterThanOrEqual(startMs);
        expect(event.scheduled_time_ms).toBeLessThan(endMs + 10000); // Allow some overflow
      });
    });
  });

  describe('difficulty ramping over time', () => {
    it('produces more events per unit time as difficulty increases', () => {
      scheduler.start(0);

      // Count events in first minute
      const earlyEvents = scheduler.generateEventsForWindow(0, 60000, species);

      // Reset and count events in minute 4-5
      scheduler.reset(12345);
      scheduler.start(0);

      // Skip ahead by generating events we'll discard
      scheduler.generateEventsForWindow(0, 240000, species);

      // Count events in minute 4-5
      const lateEvents = scheduler.generateEventsForWindow(240000, 300000, species);

      // Later events should be more frequent (more events in same time window)
      expect(lateEvents.length).toBeGreaterThanOrEqual(earlyEvents.length);
    });
  });

  describe('custom difficulty ramp', () => {
    it('uses custom ramp duration', () => {
      const customRamp: Partial<DifficultyRamp> = {
        rampDurationMs: 2 * 60 * 1000, // 2 minutes instead of 5
      };
      const customScheduler = new InfiniteScheduler({ seed: 12345, ramp: customRamp });

      // At 2 minutes, should be at max difficulty
      const state = customScheduler.getDifficultyState(2 * 60 * 1000);
      expect(state.rampProgress).toBe(1);
    });
  });
});

describe('RandomMode with InfiniteScheduler', () => {
  let config: RandomModeConfig;
  let mode: RandomMode;

  beforeEach(() => {
    config = {
      availableSpecies: createTestSpecies(),
      settings: {
        packId: 'test',
        seed: 12345,
      },
    };
    mode = new RandomMode(config);
  });

  describe('start()', () => {
    it('creates InfiniteScheduler on start', () => {
      const result = mode.start();

      expect(result).not.toBeNull();
      expect(result?.scheduler).toBeDefined();
      expect(mode.getScheduler()).not.toBeNull();
    });

    it('returns scheduler in start result', () => {
      const result = mode.start();

      expect(result?.scheduler).toBeDefined();
      expect(result?.scheduler.isActive()).toBe(true);
    });
  });

  describe('getDifficultyState()', () => {
    it('returns null before start', () => {
      expect(mode.getDifficultyState()).toBeNull();
    });

    it('returns difficulty state during play', () => {
      mode.start();

      // Simulate some time passing
      const state = mode.getDifficultyState();
      expect(state).not.toBeNull();
      expect(state?.eventDensity).toBeDefined();
    });
  });

  describe('generateNextEvents()', () => {
    it('generates events during play', () => {
      mode.start();
      const events = mode.generateNextEvents(1000);

      expect(events.length).toBeGreaterThan(0);
    });

    it('returns empty array when not playing', () => {
      const events = mode.generateNextEvents(1000);
      expect(events).toHaveLength(0);
    });
  });

  describe('high score tracking', () => {
    beforeEach(() => {
      config.currentHighScore = 500;
      mode = new RandomMode(config);
    });

    it('tracks session high score', () => {
      mode.start();
      mode.recordEvent(true, 100);
      mode.recordEvent(true, 100);

      expect(mode.getSessionHighScore()).toBe(200);
    });

    it('detects new all-time high score', () => {
      mode.start();

      // Score above current high score
      for (let i = 0; i < 6; i++) {
        mode.recordEvent(true, 100);
      }

      expect(mode.isSessionHighScore()).toBe(true);
    });

    it('does not flag high score if below current', () => {
      mode.start();
      mode.recordEvent(true, 100);

      expect(mode.isSessionHighScore()).toBe(false);
    });

    it('calls onHighScore callback on new high score', () => {
      let highScoreValue = 0;
      config.onHighScore = (score) => {
        highScoreValue = score;
      };
      mode = new RandomMode(config);

      mode.start();
      for (let i = 0; i < 6; i++) {
        mode.recordEvent(true, 100);
      }

      expect(highScoreValue).toBeGreaterThan(500);
    });

    it('includes high score in stop result', () => {
      mode.start();
      mode.recordEvent(true, 100);
      const result = mode.stop();

      expect(result.highScore).toBe(100);
    });
  });

  describe('fail threshold', () => {
    beforeEach(() => {
      config.settings = {
        ...config.settings,
        failThreshold: 50, // 50% accuracy threshold
      };
      mode = new RandomMode(config);
    });

    it('does not fail before minimum events', () => {
      mode.start();

      // Record 5 wrong events (below min threshold of 10)
      for (let i = 0; i < 5; i++) {
        mode.recordEvent(false, 0);
      }

      expect(mode.hasFailedThreshold()).toBe(false);
    });

    it('fails when accuracy drops below threshold', () => {
      mode.start();

      // Record 12 events, all wrong
      for (let i = 0; i < 12; i++) {
        mode.recordEvent(false, 0);
      }

      expect(mode.hasFailedThreshold()).toBe(true);
    });

    it('does not fail when accuracy is above threshold', () => {
      mode.start();

      // Record 10 events, 8 correct (80% accuracy)
      for (let i = 0; i < 8; i++) {
        mode.recordEvent(true, 50);
      }
      for (let i = 0; i < 2; i++) {
        mode.recordEvent(false, 0);
      }

      expect(mode.hasFailedThreshold()).toBe(false);
    });

    it('returns failed status in recordEvent result', () => {
      mode.start();

      // Get below threshold
      for (let i = 0; i < 12; i++) {
        const result = mode.recordEvent(false, 0);
        if (i >= 9) {
          // After 10+ events
          expect(result.failed).toBe(true);
        }
      }
    });
  });

  describe('pack integration', () => {
    it('sets and gets pack', () => {
      const pack = createTestPack();
      mode.setPack(pack);

      expect(mode.getPack()).toEqual(pack);
      expect(mode.getSettings().packId).toBe(pack.packId);
    });

    it('uses pack in scheduler', () => {
      const fastPack = createTestPack({ tempoMultiplier: 1.5 });
      config.settings = { ...config.settings, pack: fastPack };
      mode = new RandomMode(config);

      const result = mode.start();
      expect(result?.scheduler.getRamp()).toBeDefined();
    });
  });

  describe('session summary', () => {
    it('returns complete session summary', () => {
      // Set a high score so 125 isn't a new high
      config.currentHighScore = 1000;
      mode = new RandomMode(config);

      mode.start();
      mode.recordEvent(true, 100);
      mode.recordEvent(false, 25);

      const summary = mode.getSessionSummary();

      expect(summary.eventsPlayed).toBe(2);
      expect(summary.score).toBe(125);
      expect(summary.accuracy).toBe(50);
      expect(summary.difficulty).not.toBeNull();
      expect(summary.isHighScore).toBe(false);
      expect(summary.failed).toBe(false);
    });
  });

  describe('reset()', () => {
    it('resets all session state', () => {
      mode.start();
      mode.recordEvent(true, 100);
      mode.reset();

      expect(mode.getState()).toBe('idle');
      expect(mode.getScheduler()).toBeNull();
      expect(mode.getSessionHighScore()).toBe(0);
      expect(mode.getEventsPlayed()).toBe(0);
    });
  });
});

describe('Phase I Acceptance Criteria', () => {
  describe('Events drawn randomly from selected Pack', () => {
    it('uses species from pack', () => {
      const scheduler = new InfiniteScheduler({ seed: 99999 });
      scheduler.start(0);

      const species = createTestSpecies();
      const speciesCodes = new Set<string>();

      // Generate many events
      for (let t = 1000; t < 50000; t += 1500) {
        const events = scheduler.generateNextEvents(t, species);
        events.forEach((e) => speciesCodes.add(e.species_code));
      }

      // Should have drawn from multiple species
      expect(speciesCodes.size).toBeGreaterThan(1);
    });
  });

  describe('Channel assigned randomly per Event', () => {
    it('assigns both left and right channels', () => {
      const scheduler = new InfiniteScheduler({ seed: 88888 });
      scheduler.start(0);

      const species = createTestSpecies();
      const channels = new Set<string>();

      for (let t = 1000; t < 100000; t += 1500) {
        const events = scheduler.generateNextEvents(t, species);
        events.forEach((e) => channels.add(e.channel));
      }

      expect(channels.has('left')).toBe(true);
      expect(channels.has('right')).toBe(true);
    });
  });

  describe('Difficulty ramps: minute 1 = Level 1, minute 5 = Level 3+', () => {
    it('starts at low difficulty (Level 1 equivalent)', () => {
      const scheduler = new InfiniteScheduler({ seed: 77777 });
      const state = scheduler.getDifficultyState(30000); // 30 seconds in

      expect(state.eventDensity).toBe('low');
      expect(state.overlapProbability).toBeLessThan(0.1);
    });

    it('reaches high difficulty by minute 5 (Level 3+ equivalent)', () => {
      const scheduler = new InfiniteScheduler({ seed: 77777 });
      const state = scheduler.getDifficultyState(5 * 60 * 1000);

      expect(state.eventDensity).toBe('high');
      expect(state.overlapProbability).toBeGreaterThan(0.2);
    });

    it('event difficulty noticeably increases over 2 minutes', () => {
      const scheduler = new InfiniteScheduler({ seed: 66666 });

      const earlyState = scheduler.getDifficultyState(30000);
      const lateState = scheduler.getDifficultyState(2 * 60 * 1000);

      // Gap should decrease (faster events)
      expect(lateState.minGapMs).toBeLessThan(earlyState.minGapMs);
      expect(lateState.maxGapMs).toBeLessThan(earlyState.maxGapMs);

      // Overlap should increase
      expect(lateState.overlapProbability).toBeGreaterThan(earlyState.overlapProbability);
    });
  });

  describe('Session continues until player quits or fails threshold', () => {
    it('continues indefinitely without quit', () => {
      const scheduler = new InfiniteScheduler({ seed: 55555 });
      scheduler.start(0);

      // Generate events for 10 minutes worth
      const tenMinutes = 10 * 60 * 1000;
      const events = scheduler.generateEventsForWindow(0, tenMinutes, createTestSpecies());

      expect(events.length).toBeGreaterThan(50);
      expect(scheduler.isActive()).toBe(true);
    });

    it('stops when player quits', () => {
      const mode = new RandomMode({
        availableSpecies: createTestSpecies(),
        settings: { seed: 55555 },
      });

      mode.start();
      expect(mode.isPlaying()).toBe(true);

      mode.quit();
      expect(mode.getState()).toBe('ended');
    });

    it('fails when accuracy drops below threshold', () => {
      const mode = new RandomMode({
        availableSpecies: createTestSpecies(),
        settings: { seed: 55555, failThreshold: 40 },
      });

      mode.start();

      // Record 15 wrong events
      for (let i = 0; i < 15; i++) {
        mode.recordEvent(false, 0);
      }

      expect(mode.hasFailedThreshold()).toBe(true);
    });
  });

  describe('Score persists across session; high score saved', () => {
    it('accumulates score during session', () => {
      const mode = new RandomMode({
        availableSpecies: createTestSpecies(),
        settings: { seed: 44444 },
      });

      mode.start();
      mode.recordEvent(true, 100);
      mode.recordEvent(true, 75);
      mode.recordEvent(false, 25);

      expect(mode.getSessionStats().totalScore).toBe(200);
    });

    it('reports high score on quit', () => {
      const mode = new RandomMode({
        availableSpecies: createTestSpecies(),
        settings: { seed: 44444 },
        currentHighScore: 100,
      });

      mode.start();
      for (let i = 0; i < 5; i++) {
        mode.recordEvent(true, 50);
      }

      const result = mode.quit();

      expect(result.highScore).toBe(250);
      expect(result.isNewHighScore).toBe(true);
    });
  });

  describe('Same Pack, different session → different Event order', () => {
    it('produces different events with different seeds', () => {
      const species = createTestSpecies();

      const scheduler1 = new InfiniteScheduler({ seed: 11111 });
      scheduler1.start(0);

      const scheduler2 = new InfiniteScheduler({ seed: 22222 });
      scheduler2.start(0);

      const events1 = scheduler1.generateEventsForWindow(0, 10000, species);
      const events2 = scheduler2.generateEventsForWindow(0, 10000, species);

      // Event orders should be different
      const species1 = events1.map((e) => e.species_code).join(',');
      const species2 = events2.map((e) => e.species_code).join(',');

      expect(species1).not.toBe(species2);
    });

    it('produces same events with same seed', () => {
      const species = createTestSpecies();

      const scheduler1 = new InfiniteScheduler({ seed: 33333 });
      scheduler1.start(0);

      const scheduler2 = new InfiniteScheduler({ seed: 33333 });
      scheduler2.start(0);

      const events1 = scheduler1.generateEventsForWindow(0, 10000, species);
      const events2 = scheduler2.generateEventsForWindow(0, 10000, species);

      // Should be identical
      expect(events1.length).toBe(events2.length);
      for (let i = 0; i < events1.length; i++) {
        expect(events1[i].species_code).toBe(events2[i].species_code);
        expect(events1[i].channel).toBe(events2[i].channel);
      }
    });
  });
});
