/**
 * Confusion Analytics Tests for Phase N
 *
 * Validates:
 * - ConfusionTracker records and analyzes confusion patterns
 * - ConfusionDrillLauncher recommends and launches targeted drills
 * - Improvement tracking works correctly
 * - Drill recommendations prioritize problematic pairs
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConfusionTracker } from '../src/stats/ConfusionTracker.js';
import { ConfusionDrillLauncher } from '../src/ui/ConfusionDrillLauncher.js';
import type { ScoringResult, ScoringEvent, ScoringInput, ScoreBreakdown } from '../src/scoring/types.js';
import type { ClipMetadata } from '../src/audio/types.js';

// Helper to create scoring results
function createScoringResult(
  expectedSpecies: string,
  inputSpecies: string | null,
  speciesCorrect: boolean
): ScoringResult {
  const event: ScoringEvent = {
    eventId: `event_${Math.random().toString(36).substr(2, 9)}`,
    expectedSpecies,
    expectedChannel: 'left',
    windowStartMs: 1000,
    windowEndMs: 3000,
    perfectTimeMs: 2000,
  };

  const input: ScoringInput = {
    speciesCode: inputSpecies,
    channel: 'left',
    timestampMs: 2000,
  };

  const breakdown: ScoreBreakdown = {
    speciesPoints: speciesCorrect ? 50 : 0,
    channelPoints: 25,
    timingPoints: 25,
    totalPoints: speciesCorrect ? 100 : 50,
    speciesCorrect,
    channelCorrect: true,
    timingAccuracy: 'perfect',
  };

  return { event, input, breakdown, missed: false };
}

// Helper to create test clips
function createTestClip(speciesCode: string, clipNum: number): ClipMetadata {
  return {
    clip_id: `${speciesCode}_${clipNum}`,
    species_code: speciesCode,
    common_name: `Test ${speciesCode}`,
    vocalization_type: 'song',
    duration_ms: 2000,
    quality_score: 5,
    source: 'xenocanto',
    source_id: `XC${clipNum}`,
    file_path: `data/clips/${speciesCode}_${clipNum}.wav`,
    spectrogram_path: `data/spectrograms/${speciesCode}_${clipNum}.png`,
  };
}

describe('ConfusionTracker', () => {
  let tracker: ConfusionTracker;

  beforeEach(() => {
    tracker = new ConfusionTracker();
  });

  describe('recording confusions', () => {
    it('should record confusion from scoring result', () => {
      const result = createScoringResult('NOCA', 'BLJA', false);
      tracker.recordConfusion(result);

      expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(1);
    });

    it('should not record correct identifications', () => {
      const result = createScoringResult('NOCA', 'NOCA', true);
      tracker.recordConfusion(result);

      expect(tracker.getConfusionCount('NOCA', 'NOCA')).toBe(0);
    });

    it('should accumulate confusions for same pair', () => {
      for (let i = 0; i < 5; i++) {
        tracker.addConfusion('NOCA', 'BLJA');
      }

      expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(5);
    });

    it('should treat pairs symmetrically', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('BLJA', 'NOCA');

      expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(2);
      expect(tracker.getConfusionCount('BLJA', 'NOCA')).toBe(2);
    });
  });

  describe('highlighting', () => {
    it('should highlight pairs above threshold', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');
      expect(tracker.isHighlighted('NOCA', 'BLJA')).toBe(false);

      tracker.addConfusion('NOCA', 'BLJA');
      expect(tracker.isHighlighted('NOCA', 'BLJA')).toBe(true);
    });

    it('should return highlighted entries', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      // Add confusions for multiple pairs
      for (let i = 0; i < 5; i++) tracker.addConfusion('NOCA', 'BLJA');
      for (let i = 0; i < 3; i++) tracker.addConfusion('CARW', 'TUTI');
      tracker.addConfusion('AMCR', 'MODO'); // Below threshold

      const highlighted = tracker.getHighlightedEntries();
      expect(highlighted.length).toBe(2);
      expect(highlighted[0].count).toBe(5);
    });
  });

  describe('drill tracking', () => {
    it('should mark pairs as drilled', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');

      expect(tracker.getEntry('NOCA', 'BLJA')?.drilled).toBe(false);

      tracker.markDrilled('NOCA', 'BLJA');

      expect(tracker.getEntry('NOCA', 'BLJA')?.drilled).toBe(true);
    });

    it('should track undrilled entries', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      for (let i = 0; i < 4; i++) tracker.addConfusion('NOCA', 'BLJA');
      for (let i = 0; i < 3; i++) tracker.addConfusion('CARW', 'TUTI');

      tracker.markDrilled('NOCA', 'BLJA');

      const undrilled = tracker.getUndrilledEntries();
      expect(undrilled.length).toBe(1);
      expect(undrilled[0].speciesA).toBe('CARW');
    });
  });

  describe('improvement tracking', () => {
    it('should record improvement', () => {
      tracker.addConfusion('NOCA', 'BLJA');

      // Record positive improvement
      tracker.recordImprovement('NOCA', 'BLJA', true);
      let entry = tracker.getEntry('NOCA', 'BLJA');
      expect(entry?.improvement).toBeGreaterThan(0);

      // Record negative improvement
      tracker.recordImprovement('NOCA', 'BLJA', false);
      tracker.recordImprovement('NOCA', 'BLJA', false);
      tracker.recordImprovement('NOCA', 'BLJA', false);
      entry = tracker.getEntry('NOCA', 'BLJA');
      expect(entry?.improvement).toBeLessThan(0);
    });
  });

  describe('drill recommendations', () => {
    it('should recommend drills for problematic pairs', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      // Create various confusion patterns
      for (let i = 0; i < 8; i++) tracker.addConfusion('NOCA', 'BLJA');
      for (let i = 0; i < 4; i++) tracker.addConfusion('CARW', 'TUTI');
      tracker.addConfusion('AMCR', 'MODO');

      const recommendations = tracker.getDrillRecommendations(3);

      expect(recommendations.length).toBe(2); // Only 2 above threshold
      expect(recommendations[0].speciesA).toBe('BLJA'); // Sorted alphabetically in key
      expect(recommendations[0].speciesB).toBe('NOCA');
      expect(recommendations[0].count).toBe(8);
      expect(recommendations[0].priority).toBeGreaterThan(0);
    });

    it('should prioritize undrilled pairs', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      for (let i = 0; i < 5; i++) tracker.addConfusion('NOCA', 'BLJA');
      for (let i = 0; i < 5; i++) tracker.addConfusion('CARW', 'TUTI');

      tracker.markDrilled('NOCA', 'BLJA');

      const recommendations = tracker.getDrillRecommendations(2);

      // CARW/TUTI should be first because it's undrilled
      expect(recommendations[0].speciesA).toBe('CARW');
    });
  });

  describe('statistics', () => {
    it('should calculate stats', () => {
      tracker = new ConfusionTracker({ highlightThreshold: 2 });

      for (let i = 0; i < 5; i++) tracker.addConfusion('NOCA', 'BLJA');
      for (let i = 0; i < 3; i++) tracker.addConfusion('CARW', 'TUTI');

      const stats = tracker.getStats();

      expect(stats.totalConfusions).toBe(8);
      expect(stats.uniquePairs).toBe(2);
      expect(stats.highlightedPairs).toBe(2);
      expect(stats.mostConfusedPair?.count).toBe(5);
    });

    it('should identify most confused species', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'CARW');
      tracker.addConfusion('NOCA', 'TUTI');
      tracker.addConfusion('BLJA', 'CARW');

      const mostConfused = tracker.getMostConfusedSpecies();

      expect(mostConfused[0].speciesCode).toBe('NOCA');
      expect(mostConfused[0].confusionCount).toBe(3);
    });
  });

  describe('session tracking', () => {
    it('should track session confusions separately', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');

      expect(tracker.getSessionConfusionCount('NOCA', 'BLJA')).toBe(2);

      tracker.clearSession();

      expect(tracker.getSessionConfusionCount('NOCA', 'BLJA')).toBe(0);
      expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(2); // Total still there
    });
  });

  describe('import/export', () => {
    it('should export and import entries', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('CARW', 'TUTI');

      const exported = tracker.exportEntries();
      expect(exported.length).toBe(2);

      const tracker2 = new ConfusionTracker();
      tracker2.importEntries(exported);

      expect(tracker2.getConfusionCount('NOCA', 'BLJA')).toBe(2);
      expect(tracker2.getConfusionCount('CARW', 'TUTI')).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('CARW', 'TUTI');

      tracker.clear();

      expect(tracker.getAllEntries().length).toBe(0);
      expect(tracker.getStats().totalConfusions).toBe(0);
    });
  });
});

describe('ConfusionDrillLauncher', () => {
  let tracker: ConfusionTracker;
  let launcher: ConfusionDrillLauncher;
  let testClips: ClipMetadata[];

  beforeEach(() => {
    tracker = new ConfusionTracker({ highlightThreshold: 2 });
    launcher = new ConfusionDrillLauncher(tracker);

    testClips = [
      createTestClip('NOCA', 1),
      createTestClip('NOCA', 2),
      createTestClip('BLJA', 1),
      createTestClip('BLJA', 2),
      createTestClip('CARW', 1),
      createTestClip('TUTI', 1),
    ];

    launcher.initialize(testClips);
  });

  describe('initialization', () => {
    it('should initialize with clips', () => {
      expect(launcher.hasClipsForSpecies('NOCA')).toBe(true);
      expect(launcher.hasClipsForSpecies('BLJA')).toBe(true);
      expect(launcher.hasClipsForSpecies('UNKN')).toBe(false);
    });
  });

  describe('visibility', () => {
    it('should toggle visibility', () => {
      expect(launcher.getIsVisible()).toBe(false);

      launcher.show();
      expect(launcher.getIsVisible()).toBe(true);

      launcher.hide();
      expect(launcher.getIsVisible()).toBe(false);
    });
  });

  describe('process round results', () => {
    it('should auto-show when threshold exceeded', () => {
      const history = [
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'NOCA', true),
      ];

      const shouldShow = launcher.processRoundResults(history);

      expect(shouldShow).toBe(true);
      expect(launcher.getIsVisible()).toBe(true);
    });

    it('should not auto-show below threshold', () => {
      const history = [
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'NOCA', true),
      ];

      const shouldShow = launcher.processRoundResults(history);

      expect(shouldShow).toBe(false);
    });
  });

  describe('drill creation', () => {
    it('should create drill config', () => {
      const config = launcher.createDrillConfig('NOCA', 'BLJA');

      expect(config.speciesA).toBe('NOCA');
      expect(config.speciesB).toBe('BLJA');
      expect(config.durationSec).toBe(30);
      expect(config.drillType).toBe('comparison');
    });

    it('should create level config for drill', () => {
      const drillConfig = launcher.createDrillConfig('NOCA', 'BLJA');
      const levelConfig = launcher.createLevelConfig(drillConfig);

      expect(levelConfig.level_id).toBe(-1);
      expect(levelConfig.mode).toBe('practice');
      expect(levelConfig.species_count).toBe(2);
    });

    it('should create species selection for drill', () => {
      const drillConfig = launcher.createDrillConfig('NOCA', 'BLJA');
      const selection = launcher.createSpeciesSelection(drillConfig);

      expect(selection.length).toBe(2);
      expect(selection[0].speciesCode).toBe('NOCA');
      expect(selection[0].clips.length).toBe(2);
    });
  });

  describe('launching drills', () => {
    it('should launch drill and notify callback', () => {
      const onLaunch = vi.fn();
      launcher.setCallbacks({ onLaunch });

      const success = launcher.launchDrill('NOCA', 'BLJA');

      expect(success).toBe(true);
      expect(onLaunch).toHaveBeenCalled();
      expect(launcher.isDrillInProgress()).toBe(true);
      expect(launcher.getIsVisible()).toBe(false);
    });

    it('should fail to launch drill without clips', () => {
      const success = launcher.launchDrill('UNKN', 'NOCA');

      expect(success).toBe(false);
      expect(launcher.isDrillInProgress()).toBe(false);
    });

    it('should mark pair as drilled', () => {
      launcher.launchDrill('NOCA', 'BLJA');

      expect(tracker.getEntry('NOCA', 'BLJA')?.drilled).toBe(true);
    });
  });

  describe('completing drills', () => {
    it('should complete drill and calculate results', () => {
      const onComplete = vi.fn();
      launcher.setCallbacks({ onComplete });

      launcher.launchDrill('NOCA', 'BLJA');

      const history = [
        createScoringResult('NOCA', 'NOCA', true),
        createScoringResult('BLJA', 'BLJA', true),
        createScoringResult('NOCA', 'BLJA', false),
      ];

      const result = launcher.completeDrill(history);

      expect(result).not.toBeNull();
      expect(result?.totalEvents).toBe(3);
      expect(result?.correctCount).toBe(2);
      expect(result?.accuracy).toBeCloseTo(66.67, 0);
      expect(onComplete).toHaveBeenCalled();
    });

    it('should track drill history', () => {
      launcher.launchDrill('NOCA', 'BLJA');
      launcher.completeDrill([createScoringResult('NOCA', 'NOCA', true)]);

      launcher.launchDrill('CARW', 'TUTI');
      launcher.completeDrill([createScoringResult('CARW', 'CARW', true)]);

      const history = launcher.getDrillHistory();
      expect(history.length).toBe(2);
    });
  });

  describe('recommendations', () => {
    it('should get recommendations from tracker', () => {
      // Add confusions
      for (let i = 0; i < 5; i++) tracker.addConfusion('NOCA', 'BLJA');

      const recommendations = launcher.getRecommendations();

      expect(recommendations.length).toBe(1);
      expect(recommendations[0].speciesA).toBe('BLJA');
    });
  });

  describe('session confusions', () => {
    it('should get session confusions with names', () => {
      tracker.addConfusion('NOCA', 'BLJA');
      tracker.addConfusion('NOCA', 'BLJA');

      const sessionConfusions = launcher.getSessionConfusions();

      expect(sessionConfusions.length).toBe(1);
      expect(sessionConfusions[0].count).toBe(2);
      expect(sessionConfusions[0].speciesAName).toBeDefined();
    });
  });

  describe('render data', () => {
    it('should provide render data', () => {
      const data = launcher.getRenderData();

      expect(data.isVisible).toBe(false);
      expect(data.recommendations).toBeDefined();
      expect(data.sessionConfusions).toBeDefined();
      expect(data.stats).toBeDefined();
    });
  });
});

describe('Phase N Smoke Tests', () => {
  it('Smoke 1: ConfusionTracker records confusions from scoring history', () => {
    const tracker = new ConfusionTracker();

    const history = [
      createScoringResult('NOCA', 'BLJA', false),
      createScoringResult('NOCA', 'BLJA', false),
      createScoringResult('NOCA', 'BLJA', false),
      createScoringResult('CARW', 'TUTI', false),
      createScoringResult('NOCA', 'NOCA', true),
    ];

    tracker.recordFromHistory(history);

    expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(3);
    expect(tracker.getConfusionCount('CARW', 'TUTI')).toBe(1);
    expect(tracker.getStats().totalConfusions).toBe(4);
  });

  it('Smoke 2: Drill recommendations prioritize frequent confusions', () => {
    const tracker = new ConfusionTracker({ highlightThreshold: 2 });

    // NOCA/BLJA: 8 confusions
    for (let i = 0; i < 8; i++) tracker.addConfusion('NOCA', 'BLJA');
    // CARW/TUTI: 4 confusions
    for (let i = 0; i < 4; i++) tracker.addConfusion('CARW', 'TUTI');
    // AMCR/MODO: 1 confusion (below threshold)
    tracker.addConfusion('AMCR', 'MODO');

    const recommendations = tracker.getDrillRecommendations(5);

    // Only 2 above threshold
    expect(recommendations.length).toBe(2);
    // NOCA/BLJA should be first (highest count)
    expect(recommendations[0].count).toBe(8);
    expect(recommendations[0].priority).toBeGreaterThan(recommendations[1].priority);
  });

  it('Smoke 3: ConfusionDrillLauncher creates practice sessions for confused pairs', () => {
    const tracker = new ConfusionTracker();
    const launcher = new ConfusionDrillLauncher(tracker);

    const clips = [
      createTestClip('NOCA', 1),
      createTestClip('NOCA', 2),
      createTestClip('BLJA', 1),
      createTestClip('BLJA', 2),
    ];

    launcher.initialize(clips);

    // Record confusions
    for (let i = 0; i < 5; i++) tracker.addConfusion('NOCA', 'BLJA');

    // Launch drill
    const onLaunch = vi.fn();
    launcher.setCallbacks({ onLaunch });

    const success = launcher.launchDrill('NOCA', 'BLJA');

    expect(success).toBe(true);
    expect(onLaunch).toHaveBeenCalled();

    // Check drill config
    const [drillConfig, levelConfig, speciesSelection] = onLaunch.mock.calls[0];

    expect(drillConfig.speciesA).toBe('NOCA');
    expect(drillConfig.speciesB).toBe('BLJA');
    expect(levelConfig.species_count).toBe(2);
    expect(speciesSelection.length).toBe(2);
  });

  it('Smoke 4: Improvement tracking updates after drills', () => {
    const tracker = new ConfusionTracker();
    const launcher = new ConfusionDrillLauncher(tracker);

    const clips = [
      createTestClip('NOCA', 1),
      createTestClip('BLJA', 1),
    ];

    launcher.initialize(clips);
    tracker.addConfusion('NOCA', 'BLJA');

    // Launch and complete successful drill (>70% accuracy)
    launcher.launchDrill('NOCA', 'BLJA');

    const goodHistory = [
      createScoringResult('NOCA', 'NOCA', true),
      createScoringResult('BLJA', 'BLJA', true),
      createScoringResult('NOCA', 'NOCA', true),
    ];

    const result = launcher.completeDrill(goodHistory);

    expect(result?.improved).toBe(true);
    expect(tracker.getEntry('NOCA', 'BLJA')?.improvement).toBeGreaterThan(0);
  });

  it('Smoke 5: Session confusions are tracked separately from lifetime', () => {
    const tracker = new ConfusionTracker();

    // Session 1
    tracker.addConfusion('NOCA', 'BLJA');
    tracker.addConfusion('NOCA', 'BLJA');
    expect(tracker.getSessionConfusionCount('NOCA', 'BLJA')).toBe(2);

    tracker.clearSession();

    // Session 2
    tracker.addConfusion('NOCA', 'BLJA');
    expect(tracker.getSessionConfusionCount('NOCA', 'BLJA')).toBe(1);

    // But lifetime total is accumulated
    expect(tracker.getConfusionCount('NOCA', 'BLJA')).toBe(3);
  });

  it('Smoke 6: Auto-show threshold triggers drill launcher', () => {
    const tracker = new ConfusionTracker();
    const launcher = new ConfusionDrillLauncher(tracker, { autoShowThreshold: 2 });

    launcher.initialize([createTestClip('NOCA', 1), createTestClip('BLJA', 1)]);

    // Below threshold - should not show
    const history1 = [createScoringResult('NOCA', 'BLJA', false)];
    expect(launcher.processRoundResults(history1)).toBe(false);
    expect(launcher.getIsVisible()).toBe(false);

    // Clear and try with enough confusions
    tracker.clearSession();
    const history2 = [
      createScoringResult('NOCA', 'BLJA', false),
      createScoringResult('NOCA', 'BLJA', false),
    ];
    expect(launcher.processRoundResults(history2)).toBe(true);
    expect(launcher.getIsVisible()).toBe(true);
  });
});
