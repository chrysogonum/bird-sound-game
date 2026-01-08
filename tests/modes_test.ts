/**
 * Mode Tests for Phase F
 *
 * Validates:
 * - Campaign: Complete Level 1 → unlocks Level 2
 * - Practice: Select single species → only that species plays
 * - Challenge: 60-second timed round → final score displayed
 * - Random: Continuous Events until player quits
 * - Daily seed: Same seed produces same Event sequence for all players
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CampaignMode } from '../src/modes/CampaignMode.js';
import { PracticeMode } from '../src/modes/PracticeMode.js';
import { ChallengeMode } from '../src/modes/ChallengeMode.js';
import { RandomMode } from '../src/modes/RandomMode.js';
import { ModeSelect } from '../src/ui/ModeSelect.js';
import { seedFromDateString } from '../src/modes/types.js';
import type { LevelConfig, RoundStats, SpeciesSelection } from '../src/game/types.js';
import type { ClipMetadata } from '../src/audio/types.js';

// Test data
const TEST_LEVELS: LevelConfig[] = [
  {
    level_id: 1,
    pack_id: 'test',
    mode: 'campaign',
    round_duration_sec: 30,
    species_count: 4,
    event_density: 'low',
    overlap_probability: 0,
    scoring_window_ms: 2000,
    spectrogram_mode: 'full',
  },
  {
    level_id: 2,
    pack_id: 'test',
    mode: 'campaign',
    round_duration_sec: 30,
    species_count: 6,
    event_density: 'low',
    overlap_probability: 0,
    scoring_window_ms: 1500,
    spectrogram_mode: 'full',
  },
  {
    level_id: 3,
    pack_id: 'test',
    mode: 'campaign',
    round_duration_sec: 45,
    species_count: 8,
    event_density: 'medium',
    overlap_probability: 0.1,
    scoring_window_ms: 1200,
    spectrogram_mode: 'fading',
  },
];

function createTestClip(speciesCode: string, id: number, type: 'song' | 'call' = 'song'): ClipMetadata {
  return {
    clip_id: `${speciesCode}_${id}`,
    species_code: speciesCode,
    common_name: `Test ${speciesCode}`,
    vocalization_type: type,
    duration_ms: 1500,
    quality_score: 4,
    source: 'xenocanto',
    source_id: `XC${id}`,
    file_path: `/clips/${speciesCode}_${id}.wav`,
    spectrogram_path: null,
  };
}

const TEST_SPECIES: SpeciesSelection[] = [
  {
    speciesCode: 'NOCA',
    commonName: 'Northern Cardinal',
    clips: [
      createTestClip('NOCA', 1, 'song'),
      createTestClip('NOCA', 2, 'call'),
    ],
  },
  {
    speciesCode: 'BLJA',
    commonName: 'Blue Jay',
    clips: [
      createTestClip('BLJA', 1, 'song'),
      createTestClip('BLJA', 2, 'call'),
    ],
  },
  {
    speciesCode: 'CARW',
    commonName: 'Carolina Wren',
    clips: [
      createTestClip('CARW', 1, 'song'),
      createTestClip('CARW', 2, 'song'),
    ],
  },
  {
    speciesCode: 'AMCR',
    commonName: 'American Crow',
    clips: [
      createTestClip('AMCR', 1, 'call'),
      createTestClip('AMCR', 2, 'call'),
    ],
  },
];

function createSuccessStats(accuracy: number = 80): RoundStats {
  return {
    totalEvents: 10,
    eventsScored: 10,
    totalScore: 800,
    accuracy,
    perfectCount: 8,
    missCount: 0,
    speciesCorrectCount: 8,
    channelCorrectCount: 10,
  };
}

function createFailStats(): RoundStats {
  return {
    totalEvents: 10,
    eventsScored: 10,
    totalScore: 300,
    accuracy: 30,
    perfectCount: 2,
    missCount: 3,
    speciesCorrectCount: 3,
    channelCorrectCount: 5,
  };
}

describe('CampaignMode', () => {
  let campaign: CampaignMode;

  beforeEach(() => {
    campaign = new CampaignMode({ levels: TEST_LEVELS });
  });

  describe('initialization', () => {
    it('should start with Level 1 unlocked', () => {
      expect(campaign.isLevelUnlocked(1)).toBe(true);
      expect(campaign.isLevelUnlocked(2)).toBe(false);
      expect(campaign.isLevelUnlocked(3)).toBe(false);
    });

    it('should start at Level 1', () => {
      expect(campaign.getCurrentLevelId()).toBe(1);
    });

    it('should have correct unlocked levels list', () => {
      expect(campaign.getUnlockedLevels()).toEqual([1]);
    });
  });

  describe('level progression', () => {
    it('should unlock Level 2 after completing Level 1 with sufficient accuracy', () => {
      campaign.startLevel(1);
      const result = campaign.completeLevel(createSuccessStats(80));

      expect(result.unlockedLevelId).toBe(2);
      expect(campaign.isLevelUnlocked(2)).toBe(true);
    });

    it('should NOT unlock Level 2 with low accuracy', () => {
      campaign.startLevel(1);
      const result = campaign.completeLevel(createFailStats());

      expect(result.unlockedLevelId).toBeUndefined();
      expect(campaign.isLevelUnlocked(2)).toBe(false);
    });

    it('should unlock Level 3 after completing Level 2', () => {
      // Complete Level 1
      campaign.startLevel(1);
      campaign.completeLevel(createSuccessStats());

      // Complete Level 2
      campaign.startLevel(2);
      const result = campaign.completeLevel(createSuccessStats());

      expect(result.unlockedLevelId).toBe(3);
      expect(campaign.isLevelUnlocked(3)).toBe(true);
    });

    it('should track current level progression', () => {
      campaign.startLevel(1);
      campaign.completeLevel(createSuccessStats());

      expect(campaign.getCurrentLevelId()).toBe(2);
    });
  });

  describe('level selection', () => {
    it('should allow starting unlocked levels', () => {
      const level = campaign.startLevel(1);
      expect(level).not.toBeNull();
      expect(level?.level_id).toBe(1);
    });

    it('should NOT allow starting locked levels', () => {
      const level = campaign.startLevel(2);
      expect(level).toBeNull();
    });

    it('should return correct level config', () => {
      const level = campaign.getLevel(1);
      expect(level?.level_id).toBe(1);
      expect(level?.species_count).toBe(4);
    });
  });

  describe('state management', () => {
    it('should track state changes', () => {
      const stateCallback = vi.fn();
      campaign.setCallbacks({ onStateChange: stateCallback });

      campaign.startLevel(1);
      expect(stateCallback).toHaveBeenCalledWith('playing');

      campaign.pause();
      expect(stateCallback).toHaveBeenCalledWith('paused');

      campaign.resume();
      expect(stateCallback).toHaveBeenCalledWith('playing');
    });

    it('should call onComplete when level completes', () => {
      const completeCallback = vi.fn();
      campaign.setCallbacks({ onComplete: completeCallback });

      campaign.startLevel(1);
      campaign.completeLevel(createSuccessStats());

      expect(completeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'campaign',
          levelId: 1,
          unlockedLevelId: 2,
        })
      );
    });
  });

  describe('progress persistence', () => {
    it('should export and import progress', () => {
      campaign.startLevel(1);
      campaign.completeLevel(createSuccessStats());

      const exported = campaign.exportProgress();

      const newCampaign = new CampaignMode({ levels: TEST_LEVELS });
      newCampaign.importProgress(exported);

      expect(newCampaign.isLevelUnlocked(2)).toBe(true);
      expect(newCampaign.getCurrentLevelId()).toBe(2);
    });
  });
});

describe('PracticeMode', () => {
  let practice: PracticeMode;

  beforeEach(() => {
    practice = new PracticeMode({ availableSpecies: TEST_SPECIES });
  });

  describe('species selection', () => {
    it('should list all available species', () => {
      const species = practice.getAvailableSpecies();
      expect(species.length).toBe(4);
    });

    it('should select a single species', () => {
      const result = practice.selectSpecies('NOCA');
      expect(result).toBe(true);
      expect(practice.getSelectedSpeciesCode()).toBe('NOCA');
    });

    it('should return false for invalid species', () => {
      const result = practice.selectSpecies('INVALID');
      expect(result).toBe(false);
    });

    it('should create species selection with only selected species', () => {
      practice.selectSpecies('NOCA');
      const selection = practice.createSpeciesSelection();

      expect(selection.length).toBe(1);
      expect(selection[0].speciesCode).toBe('NOCA');
    });
  });

  describe('vocalization filtering', () => {
    it('should filter by song only', () => {
      practice.selectSpecies('NOCA');
      practice.setVocalizationType('song');

      const clips = practice.getFilteredClips();
      expect(clips.every((c) => c.vocalization_type === 'song')).toBe(true);
    });

    it('should filter by call only', () => {
      practice.selectSpecies('NOCA');
      practice.setVocalizationType('call');

      const clips = practice.getFilteredClips();
      expect(clips.every((c) => c.vocalization_type === 'call')).toBe(true);
    });

    it('should include all with "both"', () => {
      practice.selectSpecies('NOCA');
      practice.setVocalizationType('both');

      const clips = practice.getFilteredClips();
      expect(clips.length).toBe(2);
    });
  });

  describe('settings', () => {
    it('should update settings', () => {
      practice.updateSettings({
        speciesCode: 'BLJA',
        eventDensity: 'high',
        roundDurationSec: 45,
      });

      const settings = practice.getSettings();
      expect(settings.speciesCode).toBe('BLJA');
      expect(settings.eventDensity).toBe('high');
      expect(settings.roundDurationSec).toBe(45);
    });
  });

  describe('level config', () => {
    it('should create appropriate level config', () => {
      practice.selectSpecies('NOCA');
      const config = practice.createLevelConfig();

      expect(config.mode).toBe('practice');
      expect(config.species_count).toBe(1);
      expect(config.overlap_probability).toBe(0);
    });
  });

  describe('starting', () => {
    it('should not start without species selected', () => {
      const result = practice.start();
      expect(result).toBeNull();
    });

    it('should start with species selected', () => {
      practice.selectSpecies('NOCA');
      const result = practice.start();

      expect(result).not.toBeNull();
      expect(result?.species.length).toBe(1);
      expect(result?.species[0].speciesCode).toBe('NOCA');
    });
  });
});

describe('ChallengeMode', () => {
  let challenge: ChallengeMode;

  beforeEach(() => {
    challenge = new ChallengeMode({ availableSpecies: TEST_SPECIES });
  });

  describe('configuration', () => {
    it('should default to 60 second duration', () => {
      expect(challenge.getDuration()).toBe(60);
    });

    it('should allow setting duration', () => {
      challenge.setDuration(90);
      expect(challenge.getDuration()).toBe(90);
    });

    it('should clamp duration to valid range', () => {
      challenge.setDuration(10);
      expect(challenge.getDuration()).toBe(30); // Min is 30

      challenge.setDuration(200);
      expect(challenge.getDuration()).toBe(120); // Max is 120
    });
  });

  describe('seed handling', () => {
    it('should set specific seed', () => {
      challenge.setSeed(12345);
      expect(challenge.getSeed()).toBe(12345);
    });

    it('should set daily seed from date string', () => {
      challenge.setDailySeed('2024-01-15');
      expect(challenge.isUsingDailySeed()).toBe(true);
      expect(challenge.getDailySeed()).toBe('2024-01-15');
    });

    it('should produce same seed for same date string', () => {
      const seed1 = seedFromDateString('2024-01-15');
      const seed2 = seedFromDateString('2024-01-15');
      expect(seed1).toBe(seed2);
    });

    it('should produce different seeds for different dates', () => {
      const seed1 = seedFromDateString('2024-01-15');
      const seed2 = seedFromDateString('2024-01-16');
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('starting', () => {
    it('should return level config with seed', () => {
      challenge.setSeed(12345);
      const result = challenge.start();

      expect(result.seed).toBe(12345);
      expect(result.level.mode).toBe('challenge');
      expect(result.level.round_duration_sec).toBe(60);
    });
  });

  describe('high score', () => {
    it('should track high score', () => {
      challenge.start();
      const result = challenge.complete(createSuccessStats());

      expect(result.highScore).toBe(800);
      expect(result.isNewHighScore).toBe(true);
    });

    it('should not mark as new high score if lower', () => {
      challenge.setHighScore(1000);
      challenge.start();
      const result = challenge.complete(createSuccessStats());

      expect(result.highScore).toBe(1000);
      expect(result.isNewHighScore).toBe(false);
    });

    it('should update high score when beaten', () => {
      challenge.setHighScore(500);
      challenge.start();
      challenge.complete(createSuccessStats());

      expect(challenge.getHighScore()).toBe(800);
    });
  });

  describe('completion', () => {
    it('should call onComplete with final score', () => {
      const completeCallback = vi.fn();
      challenge.setCallbacks({ onComplete: completeCallback });

      challenge.start();
      challenge.complete(createSuccessStats());

      expect(completeCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'challenge',
          stats: expect.objectContaining({ totalScore: 800 }),
        })
      );
    });
  });
});

describe('RandomMode', () => {
  let random: RandomMode;

  beforeEach(() => {
    random = new RandomMode({ availableSpecies: TEST_SPECIES });
  });

  describe('species selection', () => {
    it('should use all species by default', () => {
      const species = random.getSelectedSpecies();
      expect(species.length).toBe(4);
    });

    it('should filter to specific species', () => {
      random.setSpecies(['NOCA', 'BLJA']);
      const species = random.getSelectedSpecies();

      expect(species.length).toBe(2);
      expect(species.map((s) => s.speciesCode)).toContain('NOCA');
      expect(species.map((s) => s.speciesCode)).toContain('BLJA');
    });
  });

  describe('session', () => {
    it('should start session', () => {
      const result = random.start();
      expect(result).not.toBeNull();
      expect(random.isPlaying()).toBe(true);
    });

    it('should track events played', () => {
      random.start();

      random.recordEvent(true, 100);
      random.recordEvent(false, 25);
      random.recordEvent(true, 100);

      expect(random.getEventsPlayed()).toBe(3);
    });

    it('should track session stats', () => {
      random.start();

      random.recordEvent(true, 100);
      random.recordEvent(true, 100);
      random.recordEvent(false, 25);

      const stats = random.getSessionStats();
      expect(stats.eventsScored).toBe(3);
      expect(stats.totalScore).toBe(225);
      expect(stats.speciesCorrectCount).toBe(2);
    });

    it('should continue until quit', () => {
      random.start();
      expect(random.isPlaying()).toBe(true);

      const result = random.quit();
      expect(random.isPlaying()).toBe(false);
      expect(result.mode).toBe('random');
    });
  });

  describe('level config', () => {
    it('should create continuous level config', () => {
      const config = random.createLevelConfig();

      expect(config.mode).toBe('random');
      expect(config.round_duration_sec).toBe(3600); // 1 hour
    });
  });
});

describe('ModeSelect', () => {
  let modeSelect: ModeSelect;

  beforeEach(() => {
    modeSelect = new ModeSelect();
  });

  describe('modes', () => {
    it('should list all modes', () => {
      const modes = modeSelect.getModes();
      expect(modes.length).toBe(4);
      expect(modes.map((m) => m.mode)).toContain('campaign');
      expect(modes.map((m) => m.mode)).toContain('practice');
      expect(modes.map((m) => m.mode)).toContain('challenge');
      expect(modes.map((m) => m.mode)).toContain('random');
    });

    it('should have all modes unlocked by default', () => {
      const modes = modeSelect.getModes();
      expect(modes.every((m) => m.unlocked)).toBe(true);
    });
  });

  describe('selection', () => {
    it('should select unlocked mode', () => {
      const result = modeSelect.selectMode('campaign');
      expect(result).toBe(true);
      expect(modeSelect.getSelectedMode()).toBe('campaign');
    });

    it('should not select locked mode', () => {
      modeSelect.lockMode('challenge');
      const result = modeSelect.selectMode('challenge');

      expect(result).toBe(false);
      expect(modeSelect.getSelectedMode()).toBeNull();
    });

    it('should call onSelect callback', () => {
      const selectCallback = vi.fn();
      modeSelect.setOnSelect(selectCallback);

      modeSelect.selectMode('practice');

      expect(selectCallback).toHaveBeenCalledWith('practice');
    });
  });

  describe('locking', () => {
    it('should lock and unlock modes', () => {
      expect(modeSelect.isModeUnlocked('random')).toBe(true);

      modeSelect.lockMode('random');
      expect(modeSelect.isModeUnlocked('random')).toBe(false);

      modeSelect.unlockMode('random');
      expect(modeSelect.isModeUnlocked('random')).toBe(true);
    });
  });

  describe('visibility', () => {
    it('should toggle visibility', () => {
      expect(modeSelect.isVisible()).toBe(false);

      modeSelect.show();
      expect(modeSelect.isVisible()).toBe(true);

      modeSelect.hide();
      expect(modeSelect.isVisible()).toBe(false);
    });
  });
});

describe('Phase F Smoke Tests', () => {
  it('Smoke 1: Start Campaign → begin at Level 1; complete → Level 2 unlocked', () => {
    const campaign = new CampaignMode({ levels: TEST_LEVELS });

    // Start at Level 1
    expect(campaign.getCurrentLevelId()).toBe(1);
    expect(campaign.isLevelUnlocked(1)).toBe(true);
    expect(campaign.isLevelUnlocked(2)).toBe(false);

    // Start Level 1
    const level = campaign.startLevel(1);
    expect(level?.level_id).toBe(1);

    // Complete Level 1 with good accuracy
    const result = campaign.completeLevel(createSuccessStats(80));

    // Level 2 should now be unlocked
    expect(result.unlockedLevelId).toBe(2);
    expect(campaign.isLevelUnlocked(2)).toBe(true);
  });

  it('Smoke 2: Start Practice with "Cardinal" → only cardinal Clips play', () => {
    const practice = new PracticeMode({ availableSpecies: TEST_SPECIES });

    // Select Cardinal
    practice.selectSpecies('NOCA');

    // Start practice
    const result = practice.start();

    // Should only have Cardinal species
    expect(result).not.toBeNull();
    expect(result?.species.length).toBe(1);
    expect(result?.species[0].speciesCode).toBe('NOCA');
    expect(result?.species[0].commonName).toBe('Northern Cardinal');

    // All clips should be Cardinal clips
    const clips = result?.species[0].clips ?? [];
    expect(clips.every((c) => c.species_code === 'NOCA')).toBe(true);
  });

  it('Smoke 3: Start Challenge with daily seed "2024-01-15" → reproducible Event order', () => {
    // Create two challenge instances with same seed
    const challenge1 = new ChallengeMode({ availableSpecies: TEST_SPECIES });
    const challenge2 = new ChallengeMode({ availableSpecies: TEST_SPECIES });

    // Set same daily seed
    challenge1.setDailySeed('2024-01-15');
    challenge2.setDailySeed('2024-01-15');

    // Both should have same seed
    expect(challenge1.getSeed()).toBe(challenge2.getSeed());

    // Seeds should be deterministic
    const seed = seedFromDateString('2024-01-15');
    expect(challenge1.getSeed()).toBe(seed);

    // Start both - they should produce same configuration
    const result1 = challenge1.start();
    const result2 = challenge2.start();

    expect(result1.seed).toBe(result2.seed);
  });

  it('Smoke 4: Random mode continues until player quits', () => {
    const random = new RandomMode({ availableSpecies: TEST_SPECIES });

    // Start random mode
    random.start();
    expect(random.isPlaying()).toBe(true);

    // Simulate several events
    random.recordEvent(true, 100);
    random.recordEvent(true, 100);
    random.recordEvent(false, 25);
    random.recordEvent(true, 100);
    random.recordEvent(true, 100);

    // Still playing
    expect(random.isPlaying()).toBe(true);
    expect(random.getEventsPlayed()).toBe(5);

    // Quit
    const result = random.quit();

    // Should have stopped and returned stats
    expect(random.isPlaying()).toBe(false);
    expect(result.stats.eventsScored).toBe(5);
    expect(result.stats.totalScore).toBe(425);
  });
});
