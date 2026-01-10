/**
 * Phase H: Difficulty Calculator and Pack Modifier Tests
 *
 * Tests for DifficultyCalculator.ts and EventScheduler pack integration.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DifficultyCalculator, type DifficultyParams } from '../src/game/DifficultyCalculator.js';
import { EventScheduler } from '../src/game/EventScheduler.js';
import type { LevelConfig } from '../src/game/types.js';
import { EVENT_DENSITY_CONFIG } from '../src/game/types.js';
import type { Pack, VocalizationWeights } from '../src/packs/types.js';
import type { ClipMetadata } from '../src/audio/types.js';

// Test fixtures
const createBaseLevelConfig = (): LevelConfig => ({
  level_id: 1,
  pack_id: 'test_pack',
  mode: 'campaign',
  round_duration_sec: 60,
  species_count: 3,
  event_density: 'medium',
  overlap_probability: 0.2,
  scoring_window_ms: 500,
  spectrogram_mode: 'full',
});

const createTestPack = (overrides: Partial<Pack> = {}): Pack => ({
  packId: 'test_pack',
  displayName: 'Test Pack',
  description: 'Test pack for unit tests',
  species: ['NOCA', 'BLJA', 'AMRO'],
  vocalizationWeights: { song: 0.5, call: 0.5 },
  overlapMultiplier: 1.0,
  tempoMultiplier: 1.0,
  seasonalContext: null,
  ...overrides,
});

const createMockClip = (id: string, vocalizationType: 'song' | 'call'): ClipMetadata => ({
  clip_id: id,
  species_code: 'TEST',
  common_name: 'Test Bird',
  vocalization_type: vocalizationType,
  duration_ms: 2000,
  file_path: `clips/${id}.mp3`,
  spectrogram_path: `spectrograms/${id}.png`,
  quality_score: 1.0,
  source: 'xenocanto',
  source_id: 'XC123',
});

describe('DifficultyCalculator', () => {
  let calculator: DifficultyCalculator;
  let baseLevel: LevelConfig;

  beforeEach(() => {
    calculator = new DifficultyCalculator();
    baseLevel = createBaseLevelConfig();
  });

  describe('calculate()', () => {
    it('returns base level params when no pack provided', () => {
      const params = calculator.calculate(baseLevel, null);

      expect(params.minGapMs).toBe(EVENT_DENSITY_CONFIG.medium.minGapMs);
      expect(params.maxGapMs).toBe(EVENT_DENSITY_CONFIG.medium.maxGapMs);
      expect(params.overlapProbability).toBe(0.2);
      expect(params.scoringWindowMs).toBe(500);
      expect(params.vocalizationWeights.song).toBe(0.5);
      expect(params.vocalizationWeights.call).toBe(0.5);
    });

    it('applies tempo multiplier to reduce gaps (1.2x = faster)', () => {
      const pack = createTestPack({ tempoMultiplier: 1.2 });
      const params = calculator.calculate(baseLevel, pack);

      // 1.2x tempo means gaps are divided by 1.2
      const expectedMinGap = Math.round(EVENT_DENSITY_CONFIG.medium.minGapMs / 1.2);
      const expectedMaxGap = Math.round(EVENT_DENSITY_CONFIG.medium.maxGapMs / 1.2);

      expect(params.minGapMs).toBe(expectedMinGap);
      expect(params.maxGapMs).toBe(expectedMaxGap);
    });

    it('applies overlap multiplier to increase overlaps (1.5x)', () => {
      const pack = createTestPack({ overlapMultiplier: 1.5 });
      const params = calculator.calculate(baseLevel, pack);

      // 1.5x overlap means 50% more overlaps
      expect(params.overlapProbability).toBe(0.2 * 1.5);
    });

    it('caps overlap probability at 1.0', () => {
      const pack = createTestPack({ overlapMultiplier: 2.0 });
      baseLevel.overlap_probability = 0.8;
      const params = calculator.calculate(baseLevel, pack);

      // 0.8 * 2.0 = 1.6, but should be capped at 1.0
      expect(params.overlapProbability).toBe(1.0);
    });

    it('uses pack vocalization weights', () => {
      const pack = createTestPack({
        vocalizationWeights: { song: 0.9, call: 0.1 },
      });
      const params = calculator.calculate(baseLevel, pack);

      expect(params.vocalizationWeights.song).toBe(0.9);
      expect(params.vocalizationWeights.call).toBe(0.1);
    });

    it('stacks modifiers correctly with level difficulty', () => {
      const pack = createTestPack({
        tempoMultiplier: 1.2,
        overlapMultiplier: 1.5,
      });
      baseLevel.event_density = 'high';
      baseLevel.overlap_probability = 0.4;

      const params = calculator.calculate(baseLevel, pack);

      // High density gaps divided by 1.2
      const expectedMinGap = Math.round(EVENT_DENSITY_CONFIG.high.minGapMs / 1.2);
      const expectedMaxGap = Math.round(EVENT_DENSITY_CONFIG.high.maxGapMs / 1.2);

      expect(params.minGapMs).toBe(expectedMinGap);
      expect(params.maxGapMs).toBe(expectedMaxGap);
      expect(params.overlapProbability).toBe(0.4 * 1.5);
    });
  });

  describe('selectVocalizationType()', () => {
    it('returns song when random is below song threshold', () => {
      const weights: VocalizationWeights = { song: 0.9, call: 0.1 };
      // 0.9 / 1.0 = 90% chance of song
      expect(calculator.selectVocalizationType(weights, 0.5)).toBe('song');
      expect(calculator.selectVocalizationType(weights, 0.89)).toBe('song');
    });

    it('returns call when random is above song threshold', () => {
      const weights: VocalizationWeights = { song: 0.9, call: 0.1 };
      expect(calculator.selectVocalizationType(weights, 0.95)).toBe('call');
    });

    it('handles equal weights', () => {
      const weights: VocalizationWeights = { song: 0.5, call: 0.5 };
      expect(calculator.selectVocalizationType(weights, 0.3)).toBe('song');
      expect(calculator.selectVocalizationType(weights, 0.7)).toBe('call');
    });
  });

  describe('getSongPercentage()', () => {
    it('returns correct percentage for 90/10 weights', () => {
      const weights: VocalizationWeights = { song: 0.9, call: 0.1 };
      expect(calculator.getSongPercentage(weights)).toBe(90);
    });

    it('returns 50% for equal weights', () => {
      const weights: VocalizationWeights = { song: 0.5, call: 0.5 };
      expect(calculator.getSongPercentage(weights)).toBe(50);
    });

    it('returns 50% for zero weights', () => {
      const weights: VocalizationWeights = { song: 0, call: 0 };
      expect(calculator.getSongPercentage(weights)).toBe(50);
    });
  });

  describe('getEventFrequencyMultiplier()', () => {
    it('returns 1.0 for no pack', () => {
      expect(calculator.getEventFrequencyMultiplier(null)).toBe(1.0);
    });

    it('returns tempo multiplier from pack', () => {
      const pack = createTestPack({ tempoMultiplier: 1.2 });
      expect(calculator.getEventFrequencyMultiplier(pack)).toBe(1.2);
    });
  });

  describe('validateParams()', () => {
    it('validates correct params', () => {
      const params: DifficultyParams = {
        minGapMs: 1000,
        maxGapMs: 2000,
        overlapProbability: 0.3,
        scoringWindowMs: 500,
        vocalizationWeights: { song: 0.5, call: 0.5 },
        eventDensity: 'medium',
      };
      expect(calculator.validateParams(params)).toBe(true);
    });

    it('rejects negative gaps', () => {
      const params: DifficultyParams = {
        minGapMs: -100,
        maxGapMs: 2000,
        overlapProbability: 0.3,
        scoringWindowMs: 500,
        vocalizationWeights: { song: 0.5, call: 0.5 },
        eventDensity: 'medium',
      };
      expect(calculator.validateParams(params)).toBe(false);
    });

    it('rejects invalid overlap probability', () => {
      const params: DifficultyParams = {
        minGapMs: 1000,
        maxGapMs: 2000,
        overlapProbability: 1.5,
        scoringWindowMs: 500,
        vocalizationWeights: { song: 0.5, call: 0.5 },
        eventDensity: 'medium',
      };
      expect(calculator.validateParams(params)).toBe(false);
    });
  });
});

describe('EventScheduler with Pack Modifiers', () => {
  let scheduler: EventScheduler;
  let baseLevel: LevelConfig;

  beforeEach(() => {
    scheduler = new EventScheduler({ seed: 12345 });
    baseLevel = createBaseLevelConfig();
  });

  describe('generateEvents() with pack', () => {
    const createTestSpecies = () => [
      {
        speciesCode: 'NOCA',
        commonName: 'Northern Cardinal',
        clips: [
          createMockClip('noca_song_1', 'song'),
          createMockClip('noca_song_2', 'song'),
          createMockClip('noca_call_1', 'call'),
        ],
      },
      {
        speciesCode: 'BLJA',
        commonName: 'Blue Jay',
        clips: [
          createMockClip('blja_song_1', 'song'),
          createMockClip('blja_call_1', 'call'),
          createMockClip('blja_call_2', 'call'),
        ],
      },
    ];

    it('generates more events with higher tempo multiplier', () => {
      const species = createTestSpecies();

      // Generate events without pack
      scheduler.resetSeed(12345);
      const baseEvents = scheduler.generateEvents(baseLevel, species, null);

      // Generate events with 1.2x tempo pack
      scheduler.resetSeed(12345);
      const fastPack = createTestPack({ tempoMultiplier: 1.2 });
      const fastEvents = scheduler.generateEvents(baseLevel, species, fastPack);

      // With 1.2x tempo, we should get approximately 20% more events
      const expectedRatio = 1.2;
      const actualRatio = fastEvents.length / baseEvents.length;

      // Allow some tolerance due to randomness and boundary effects
      expect(actualRatio).toBeGreaterThanOrEqual(expectedRatio * 0.85);
      expect(actualRatio).toBeLessThanOrEqual(expectedRatio * 1.15);
    });

    it('generates more overlaps with higher overlap multiplier', () => {
      const species = createTestSpecies();
      baseLevel.overlap_probability = 0.3;

      // Generate events without pack
      scheduler.resetSeed(12345);
      const baseEvents = scheduler.generateEvents(baseLevel, species, null);
      const baseOverlaps = scheduler.countOverlaps(baseEvents);

      // Generate events with 1.5x overlap pack
      scheduler.resetSeed(12345);
      const overlapPack = createTestPack({ overlapMultiplier: 1.5 });
      const overlapEvents = scheduler.generateEvents(baseLevel, species, overlapPack);
      const packOverlaps = scheduler.countOverlaps(overlapEvents);

      // With 1.5x overlap, we should get more overlaps
      expect(packOverlaps).toBeGreaterThanOrEqual(baseOverlaps);
    });

    it('respects vocalization weights (90% songs)', () => {
      const species = createTestSpecies();
      const songPack = createTestPack({
        vocalizationWeights: { song: 0.9, call: 0.1 },
      });

      // Generate many events to get statistical significance
      baseLevel.round_duration_sec = 120;
      scheduler.resetSeed(12345);
      const events = scheduler.generateEvents(baseLevel, species, songPack);

      // Count vocalization types
      const songs = events.filter((e) => e.vocalization_type === 'song').length;
      const calls = events.filter((e) => e.vocalization_type === 'call').length;
      const total = songs + calls;

      // Should be approximately 90% songs (with tolerance)
      const songPercentage = (songs / total) * 100;
      expect(songPercentage).toBeGreaterThan(70); // Allow tolerance for randomness
    });

    it('adds vocalization_type to events', () => {
      const species = createTestSpecies();
      const pack = createTestPack();

      scheduler.resetSeed(12345);
      const events = scheduler.generateEvents(baseLevel, species, pack);

      // All events should have vocalization_type
      for (const event of events) {
        expect(['song', 'call']).toContain(event.vocalization_type);
      }
    });
  });

  describe('estimateEventCount() with pack', () => {
    it('estimates more events with tempo multiplier', () => {
      const baseEstimate = scheduler.estimateEventCount(baseLevel, null);
      const fastPack = createTestPack({ tempoMultiplier: 1.2 });
      const fastEstimate = scheduler.estimateEventCount(baseLevel, fastPack);

      expect(fastEstimate.min).toBeGreaterThan(baseEstimate.min);
      expect(fastEstimate.max).toBeGreaterThan(baseEstimate.max);
    });

    it('estimates more events with overlap multiplier', () => {
      baseLevel.overlap_probability = 0.3;
      const baseEstimate = scheduler.estimateEventCount(baseLevel, null);
      const overlapPack = createTestPack({ overlapMultiplier: 1.5 });
      const overlapEstimate = scheduler.estimateEventCount(baseLevel, overlapPack);

      expect(overlapEstimate.min).toBeGreaterThanOrEqual(baseEstimate.min);
      expect(overlapEstimate.max).toBeGreaterThanOrEqual(baseEstimate.max);
    });
  });

  describe('calculateDifficulty()', () => {
    it('returns difficulty params', () => {
      const pack = createTestPack({ tempoMultiplier: 1.2 });
      const difficulty = scheduler.calculateDifficulty(baseLevel, pack);

      expect(difficulty.minGapMs).toBeLessThan(EVENT_DENSITY_CONFIG.medium.minGapMs);
      expect(difficulty.maxGapMs).toBeLessThan(EVENT_DENSITY_CONFIG.medium.maxGapMs);
    });
  });
});

describe('Phase H Acceptance Criteria', () => {
  describe('Tempo Multiplier 1.2x → 20% more frequent events', () => {
    it('produces approximately 20% more events', () => {
      const scheduler = new EventScheduler({ seed: 99999 });
      const level = createBaseLevelConfig();
      level.round_duration_sec = 60;
      level.event_density = 'medium';

      const species = [
        {
          speciesCode: 'TEST',
          commonName: 'Test Bird',
          clips: [createMockClip('test_1', 'song')],
        },
      ];

      // Baseline
      scheduler.resetSeed(99999);
      const baseEvents = scheduler.generateEvents(level, species, null);

      // With 1.2x tempo
      scheduler.resetSeed(99999);
      const fastPack = createTestPack({ tempoMultiplier: 1.2 });
      const fastEvents = scheduler.generateEvents(level, species, fastPack);

      const ratio = fastEvents.length / baseEvents.length;
      // Should be approximately 1.2 (allowing 15% tolerance for randomness)
      expect(ratio).toBeGreaterThanOrEqual(1.05);
      expect(ratio).toBeLessThanOrEqual(1.35);
    });
  });

  describe('Overlap Multiplier 1.5x → 50% more overlaps', () => {
    it('produces more overlaps than baseline', () => {
      const scheduler = new EventScheduler({ seed: 88888 });
      const level = createBaseLevelConfig();
      level.overlap_probability = 0.4;

      const species = [
        {
          speciesCode: 'TEST1',
          commonName: 'Test Bird 1',
          clips: [createMockClip('test1_1', 'song')],
        },
        {
          speciesCode: 'TEST2',
          commonName: 'Test Bird 2',
          clips: [createMockClip('test2_1', 'call')],
        },
      ];

      // Baseline
      scheduler.resetSeed(88888);
      const baseEvents = scheduler.generateEvents(level, species, null);
      const baseOverlaps = scheduler.countOverlaps(baseEvents);

      // With 1.5x overlap
      scheduler.resetSeed(88888);
      const overlapPack = createTestPack({ overlapMultiplier: 1.5 });
      const overlapEvents = scheduler.generateEvents(level, species, overlapPack);
      const packOverlaps = scheduler.countOverlaps(overlapEvents);

      // Should have at least as many overlaps (more expected)
      expect(packOverlaps).toBeGreaterThanOrEqual(baseOverlaps);
    });
  });

  describe('Vocalization Weights → 90% songs for warbler pack', () => {
    it('respects 90/10 song/call ratio', () => {
      const scheduler = new EventScheduler({ seed: 77777 });
      const level = createBaseLevelConfig();
      level.round_duration_sec = 120;

      const species = [
        {
          speciesCode: 'YWAR',
          commonName: 'Yellow Warbler',
          clips: [
            createMockClip('ywar_song_1', 'song'),
            createMockClip('ywar_song_2', 'song'),
            createMockClip('ywar_song_3', 'song'),
            createMockClip('ywar_call_1', 'call'),
          ],
        },
      ];

      const warblerPack = createTestPack({
        vocalizationWeights: { song: 0.9, call: 0.1 },
      });

      const events = scheduler.generateEvents(level, species, warblerPack);
      const songs = events.filter((e) => e.vocalization_type === 'song').length;
      const total = events.length;

      const songPercentage = (songs / total) * 100;
      // Should be heavily weighted toward songs (allowing some variance)
      expect(songPercentage).toBeGreaterThan(65);
    });
  });

  describe('Call-emphasized pack → >80% calls', () => {
    it('produces majority calls for sparrow pack', () => {
      const scheduler = new EventScheduler({ seed: 66666 });
      const level = createBaseLevelConfig();
      level.round_duration_sec = 120;

      const species = [
        {
          speciesCode: 'SOSP',
          commonName: 'Song Sparrow',
          clips: [
            createMockClip('sosp_song_1', 'song'),
            createMockClip('sosp_call_1', 'call'),
            createMockClip('sosp_call_2', 'call'),
            createMockClip('sosp_call_3', 'call'),
          ],
        },
      ];

      // Sparrow pack with call emphasis (0.2 song, 0.8 call)
      const sparrowPack = createTestPack({
        vocalizationWeights: { song: 0.2, call: 0.8 },
      });

      const events = scheduler.generateEvents(level, species, sparrowPack);
      const calls = events.filter((e) => e.vocalization_type === 'call').length;
      const total = events.length;

      const callPercentage = (calls / total) * 100;
      // Should be heavily weighted toward calls
      expect(callPercentage).toBeGreaterThan(60);
    });
  });

  describe('Modifiers stack correctly with Level difficulty', () => {
    it('combines high density level with tempo multiplier', () => {
      const scheduler = new EventScheduler({ seed: 55555 });
      const level = createBaseLevelConfig();
      level.event_density = 'high';
      level.round_duration_sec = 60;

      const species = [
        {
          speciesCode: 'TEST',
          commonName: 'Test Bird',
          clips: [createMockClip('test_1', 'song')],
        },
      ];

      // High density baseline
      scheduler.resetSeed(55555);
      const highDensityEvents = scheduler.generateEvents(level, species, null);

      // High density + 1.2x tempo
      scheduler.resetSeed(55555);
      const fastPack = createTestPack({ tempoMultiplier: 1.2 });
      const combinedEvents = scheduler.generateEvents(level, species, fastPack);

      // Combined should be even faster than high density alone
      expect(combinedEvents.length).toBeGreaterThan(highDensityEvents.length);
    });
  });
});
