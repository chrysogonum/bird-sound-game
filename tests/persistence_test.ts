/**
 * Phase J: Progress Persistence Tests
 *
 * Tests for ProgressStore, StatsCalculator, and ProgressView.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProgressStore, MemoryStorage } from '../src/storage/ProgressStore.js';
import {
  createEmptyProgress,
  createEmptyPackStats,
  SCHEMA_VERSION,
  type PlayerProgress,
} from '../src/storage/types.js';
import { StatsCalculator } from '../src/stats/StatsCalculator.js';
import { MASTERY_THRESHOLDS } from '../src/stats/types.js';
import { ProgressView } from '../src/ui/ProgressView.js';

describe('ProgressStore', () => {
  let store: ProgressStore;
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    store = new ProgressStore({ storage });
  });

  describe('Level Management', () => {
    it('starts with level 1 unlocked', () => {
      expect(store.isLevelUnlocked(1)).toBe(true);
      expect(store.isLevelUnlocked(2)).toBe(false);
    });

    it('unlocks levels', () => {
      store.unlockLevel(2);
      store.unlockLevel(3);

      expect(store.isLevelUnlocked(2)).toBe(true);
      expect(store.isLevelUnlocked(3)).toBe(true);
      expect(store.getUnlockedLevels()).toEqual([1, 2, 3]);
    });

    it('gets highest unlocked level', () => {
      store.unlockLevel(3);
      store.unlockLevel(5);

      expect(store.getHighestUnlockedLevel()).toBe(5);
    });

    it('does not duplicate unlocked levels', () => {
      store.unlockLevel(2);
      store.unlockLevel(2);

      expect(store.getUnlockedLevels()).toEqual([1, 2]);
    });
  });

  describe('Pack Management', () => {
    it('starts with default pack unlocked', () => {
      expect(store.isPackUnlocked('common_se_birds')).toBe(true);
      expect(store.isPackUnlocked('spring_warblers')).toBe(false);
    });

    it('unlocks packs', () => {
      store.unlockPack('spring_warblers');

      expect(store.isPackUnlocked('spring_warblers')).toBe(true);
      expect(store.getUnlockedPacks()).toContain('spring_warblers');
    });
  });

  describe('Pack Stats', () => {
    it('records game results', () => {
      store.recordPackGame('test_pack', 20, 15, 500);

      const stats = store.getPackStats('test_pack');
      expect(stats.gamesPlayed).toBe(1);
      expect(stats.totalEvents).toBe(20);
      expect(stats.correctCount).toBe(15);
      expect(stats.averageResponseTimeMs).toBe(500);
    });

    it('accumulates stats over multiple games', () => {
      store.recordPackGame('test_pack', 10, 8, 400);
      store.recordPackGame('test_pack', 10, 7, 600);

      const stats = store.getPackStats('test_pack');
      expect(stats.gamesPlayed).toBe(2);
      expect(stats.totalEvents).toBe(20);
      expect(stats.correctCount).toBe(15);
      expect(stats.averageResponseTimeMs).toBe(500); // Average of 400 and 600
    });

    it('tracks best accuracy', () => {
      store.recordPackGame('test_pack', 10, 7, 400); // 70%
      store.recordPackGame('test_pack', 10, 9, 400); // 90%
      store.recordPackGame('test_pack', 10, 5, 400); // 50%

      const stats = store.getPackStats('test_pack');
      expect(stats.bestAccuracy).toBe(90);
    });
  });

  describe('Streak Tracking', () => {
    it('builds streak on correct answers', () => {
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);

      const stats = store.getPackStats('test_pack');
      expect(stats.currentStreak).toBe(3);
      expect(stats.bestStreak).toBe(3);
    });

    it('resets streak on wrong answer', () => {
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', false);

      const stats = store.getPackStats('test_pack');
      expect(stats.currentStreak).toBe(0);
      expect(stats.bestStreak).toBe(2);
    });

    it('preserves best streak', () => {
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true); // streak = 3
      store.updateStreak('test_pack', false); // reset
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true); // streak = 2

      const stats = store.getPackStats('test_pack');
      expect(stats.currentStreak).toBe(2);
      expect(stats.bestStreak).toBe(3);
    });
  });

  describe('Confusion Tracking', () => {
    it('records confusion pairs', () => {
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');

      const pairs = store.getConfusionPairs('test_pack');
      expect(pairs).toHaveLength(1);
      expect(pairs[0].speciesA).toBe('HOWR'); // Sorted alphabetically
      expect(pairs[0].speciesB).toBe('NOCA');
      expect(pairs[0].count).toBe(1);
    });

    it('increments confusion count', () => {
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'HOWR', 'NOCA'); // Same pair, reversed

      const pairs = store.getConfusionPairs('test_pack');
      expect(pairs).toHaveLength(1);
      expect(pairs[0].count).toBe(3);
    });

    it('normalizes pair order', () => {
      store.recordConfusion('test_pack', 'NOCA', 'BLJA');
      store.recordConfusion('test_pack', 'BLJA', 'NOCA');

      const pairs = store.getConfusionPairs('test_pack');
      expect(pairs).toHaveLength(1);
      expect(pairs[0].speciesA).toBe('BLJA');
      expect(pairs[0].speciesB).toBe('NOCA');
    });

    it('gets significant confusions', () => {
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'BLJA', 'AMRO');

      const significant = store.getSignificantConfusions('test_pack', 2);
      expect(significant).toHaveLength(1);
      expect(significant[0].speciesA).toBe('HOWR');
    });
  });

  describe('Level Stats', () => {
    it('records level attempts', () => {
      store.recordLevelAttempt(1, true, 500, 85);
      store.recordLevelAttempt(1, false, 200, 40);

      const stats = store.getLevelStats(1);
      expect(stats.attempts).toBe(2);
      expect(stats.completions).toBe(1);
      expect(stats.bestScore).toBe(500);
      expect(stats.bestAccuracy).toBe(85);
    });
  });

  describe('High Scores', () => {
    it('updates campaign high scores', () => {
      expect(store.updateCampaignHighScore(1, 500)).toBe(true);
      expect(store.updateCampaignHighScore(1, 400)).toBe(false);
      expect(store.updateCampaignHighScore(1, 600)).toBe(true);

      expect(store.getHighScores().campaign[1]).toBe(600);
    });

    it('updates challenge high score', () => {
      expect(store.updateChallengeHighScore(1000)).toBe(true);
      expect(store.updateChallengeHighScore(800)).toBe(false);

      expect(store.getHighScores().challenge).toBe(1000);
    });

    it('updates random high score', () => {
      expect(store.updateRandomHighScore(750)).toBe(true);

      expect(store.getHighScores().random).toBe(750);
    });
  });

  describe('Persistence', () => {
    it('persists across sessions', () => {
      store.unlockLevel(2);
      store.unlockLevel(3);
      store.unlockPack('spring_warblers');
      store.recordPackGame('test_pack', 10, 8, 500);
      store.save();

      // Create new store with same storage
      const store2 = new ProgressStore({ storage });

      expect(store2.isLevelUnlocked(2)).toBe(true);
      expect(store2.isLevelUnlocked(3)).toBe(true);
      expect(store2.isPackUnlocked('spring_warblers')).toBe(true);
      expect(store2.getPackStats('test_pack').gamesPlayed).toBe(1);
    });
  });

  describe('Export/Import', () => {
    it('exports as JSON', () => {
      store.unlockLevel(5);
      store.recordPackGame('test_pack', 10, 8, 500);

      const json = store.export();
      const parsed = JSON.parse(json);

      expect(parsed.unlockedLevels).toContain(5);
      expect(parsed.packStats.test_pack.gamesPlayed).toBe(1);
    });

    it('imports from JSON', () => {
      const progress = createEmptyProgress('imported');
      progress.unlockedLevels = [1, 2, 3, 4, 5];
      progress.unlockedPacks = ['pack_a', 'pack_b'];

      const json = JSON.stringify(progress);
      expect(store.import(json)).toBe(true);

      expect(store.isLevelUnlocked(5)).toBe(true);
      expect(store.isPackUnlocked('pack_a')).toBe(true);
    });

    it('validates imported data', () => {
      expect(store.import('invalid json')).toBe(false);
      expect(store.import('{}')).toBe(false);
    });
  });

  describe('Reset', () => {
    it('resets all progress', () => {
      store.unlockLevel(5);
      store.unlockPack('test_pack');
      store.recordPackGame('test_pack', 10, 8, 500);

      store.reset();

      expect(store.getUnlockedLevels()).toEqual([1]);
      expect(store.isPackUnlocked('test_pack')).toBe(false);
    });
  });
});

describe('StatsCalculator', () => {
  let calculator: StatsCalculator;

  beforeEach(() => {
    calculator = new StatsCalculator();
  });

  describe('Mastery Levels', () => {
    it('calculates novice level', () => {
      expect(calculator.calculateMasteryLevel(30)).toBe('novice');
    });

    it('calculates beginner level', () => {
      expect(calculator.calculateMasteryLevel(55)).toBe('beginner');
    });

    it('calculates intermediate level', () => {
      expect(calculator.calculateMasteryLevel(75)).toBe('intermediate');
    });

    it('calculates advanced level', () => {
      expect(calculator.calculateMasteryLevel(90)).toBe('advanced');
    });

    it('calculates expert level', () => {
      expect(calculator.calculateMasteryLevel(98)).toBe('expert');
    });
  });

  describe('Response Time Trend', () => {
    it('detects improving trend', () => {
      // Start slow, get faster
      const samples = [
        ...Array(10).fill(1000),
        ...Array(10).fill(700),
      ];
      expect(calculator.analyzeResponseTimeTrend(samples)).toBe('improving');
    });

    it('detects declining trend', () => {
      // Start fast, get slower
      const samples = [
        ...Array(10).fill(500),
        ...Array(10).fill(800),
      ];
      expect(calculator.analyzeResponseTimeTrend(samples)).toBe('declining');
    });

    it('detects stable trend', () => {
      const samples = Array(20).fill(500);
      expect(calculator.analyzeResponseTimeTrend(samples)).toBe('stable');
    });

    it('returns stable for insufficient samples', () => {
      expect(calculator.analyzeResponseTimeTrend([500, 600])).toBe('stable');
    });
  });

  describe('Response Time Analysis', () => {
    it('calculates full analysis', () => {
      const samples = [400, 500, 600, 700, 800];
      const analysis = calculator.analyzeResponseTime(samples);

      expect(analysis.average).toBe(600);
      expect(analysis.median).toBe(600);
      expect(analysis.min).toBe(400);
      expect(analysis.max).toBe(800);
    });

    it('handles empty samples', () => {
      const analysis = calculator.analyzeResponseTime([]);

      expect(analysis.average).toBe(0);
      expect(analysis.trend).toBe('stable');
    });
  });

  describe('Pack Mastery Summary', () => {
    it('generates pack summary', () => {
      const packStats = createEmptyPackStats('test_pack');
      packStats.totalEvents = 100;
      packStats.correctCount = 85;
      packStats.gamesPlayed = 5;
      packStats.bestStreak = 10;
      packStats.responseTimeSamples = Array(20).fill(500);
      packStats.confusionPairs = [
        { speciesA: 'NOCA', speciesB: 'HOWR', count: 3, lastConfused: Date.now() },
      ];

      const summary = calculator.getPackMasterySummary(packStats);

      expect(summary.overallAccuracy).toBe(85);
      expect(summary.masteryLevel).toBe('advanced');
      expect(summary.bestStreak).toBe(10);
      expect(summary.topConfusions).toHaveLength(1);
    });
  });

  describe('Player Stats Summary', () => {
    it('aggregates player stats', () => {
      const progress = createEmptyProgress('test');
      progress.packStats['pack1'] = createEmptyPackStats('pack1');
      progress.packStats['pack1'].gamesPlayed = 5;
      progress.packStats['pack1'].totalEvents = 50;
      progress.packStats['pack1'].correctCount = 40;
      progress.packStats['pack1'].bestStreak = 8;

      progress.packStats['pack2'] = createEmptyPackStats('pack2');
      progress.packStats['pack2'].gamesPlayed = 3;
      progress.packStats['pack2'].totalEvents = 30;
      progress.packStats['pack2'].correctCount = 27;
      progress.packStats['pack2'].bestStreak = 12;

      progress.levelStats[1] = { levelId: 1, attempts: 2, completions: 1, bestScore: 500, bestAccuracy: 80, lastPlayed: Date.now() };
      progress.levelStats[2] = { levelId: 2, attempts: 1, completions: 1, bestScore: 600, bestAccuracy: 90, lastPlayed: Date.now() };

      progress.totalPlayTimeMs = 60 * 60 * 1000; // 1 hour

      const summary = calculator.getPlayerStatsSummary(progress);

      expect(summary.totalGamesPlayed).toBe(8);
      expect(summary.totalEventsScored).toBe(80);
      expect(summary.overallAccuracy).toBeCloseTo(83.8, 0);
      expect(summary.longestStreak).toBe(12);
      expect(summary.levelsCompleted).toBe(2);
    });
  });

  describe('Confusion Analysis', () => {
    it('gets top confusion pairs', () => {
      const progress = createEmptyProgress('test');
      progress.packStats['pack1'] = createEmptyPackStats('pack1');
      progress.packStats['pack1'].confusionPairs = [
        { speciesA: 'A', speciesB: 'B', count: 5, lastConfused: Date.now() },
        { speciesA: 'C', speciesB: 'D', count: 3, lastConfused: Date.now() },
      ];

      progress.packStats['pack2'] = createEmptyPackStats('pack2');
      progress.packStats['pack2'].confusionPairs = [
        { speciesA: 'A', speciesB: 'B', count: 2, lastConfused: Date.now() }, // Same pair
        { speciesA: 'E', speciesB: 'F', count: 10, lastConfused: Date.now() },
      ];

      const top = calculator.getTopConfusionPairs(progress, 3);

      expect(top).toHaveLength(3);
      expect(top[0].speciesA).toBe('E');
      expect(top[0].count).toBe(10);
      expect(top[1].speciesA).toBe('A');
      expect(top[1].count).toBe(7); // Merged
    });

    it('gets species needing practice', () => {
      const progress = createEmptyProgress('test');
      progress.packStats['pack1'] = createEmptyPackStats('pack1');
      progress.packStats['pack1'].confusionPairs = [
        { speciesA: 'NOCA', speciesB: 'HOWR', count: 5, lastConfused: Date.now() },
        { speciesA: 'NOCA', speciesB: 'BLJA', count: 3, lastConfused: Date.now() },
        { speciesA: 'AMRO', speciesB: 'HOWR', count: 4, lastConfused: Date.now() },
      ];

      const needPractice = calculator.getSpeciesNeedingPractice(progress);

      // NOCA appears in 2 significant confusions (8 total), HOWR in 2 (9 total)
      expect(needPractice).toContain('NOCA');
      expect(needPractice).toContain('HOWR');
    });
  });

  describe('Utility Functions', () => {
    it('formats play time', () => {
      expect(calculator.formatPlayTime(30 * 60 * 1000)).toBe('30m');
      expect(calculator.formatPlayTime(90 * 60 * 1000)).toBe('1h 30m');
      expect(calculator.formatPlayTime(2.5 * 60 * 60 * 1000)).toBe('2h 30m');
    });

    it('estimates time to mastery', () => {
      const games = calculator.estimateTimeToMastery(50, 'intermediate', 2);
      expect(games).toBe(10); // Need 20% more, 2% per game = 10 games
    });
  });
});

describe('ProgressView', () => {
  let view: ProgressView;
  let progress: PlayerProgress;

  beforeEach(() => {
    progress = createEmptyProgress('test');
    progress.unlockedLevels = [1, 2, 3];
    progress.unlockedPacks = ['common_se_birds', 'spring_warblers'];

    progress.packStats['common_se_birds'] = createEmptyPackStats('common_se_birds');
    progress.packStats['common_se_birds'].gamesPlayed = 10;
    progress.packStats['common_se_birds'].totalEvents = 100;
    progress.packStats['common_se_birds'].correctCount = 80;

    progress.levelStats[1] = { levelId: 1, attempts: 3, completions: 2, bestScore: 500, bestAccuracy: 85, lastPlayed: Date.now() };
    progress.levelStats[2] = { levelId: 2, attempts: 2, completions: 1, bestScore: 450, bestAccuracy: 75, lastPlayed: Date.now() };

    view = new ProgressView({
      progress,
      packNames: {
        common_se_birds: 'Common SE Birds',
        spring_warblers: 'Spring Warblers',
      },
      totalLevels: 10,
      totalPacks: 4,
    });
  });

  describe('Overview', () => {
    it('gets overview stats', () => {
      const stats = view.getOverviewStats();

      expect(stats.totalGamesPlayed).toBe(10);
      expect(stats.overallAccuracy).toBe(80);
    });

    it('calculates progress percentages', () => {
      const percentages = view.getProgressPercentages();

      expect(percentages.levels).toBe(30); // 3 of 10
      expect(percentages.packs).toBe(50); // 2 of 4
      expect(percentages.mastery).toBe(80);
    });
  });

  describe('Levels', () => {
    it('gets level display info', () => {
      const levels = view.getLevelDisplayInfo();

      expect(levels).toHaveLength(10);
      expect(levels[0].unlocked).toBe(true);
      expect(levels[0].completed).toBe(true);
      expect(levels[0].bestScore).toBe(500);
      expect(levels[3].unlocked).toBe(false);
    });

    it('gets next level to unlock', () => {
      expect(view.getNextLevelToUnlock()).toBe(4);
    });
  });

  describe('Packs', () => {
    it('gets pack display info', () => {
      const packs = view.getPackDisplayInfo(['common_se_birds', 'spring_warblers']);

      expect(packs).toHaveLength(2);
      expect(packs[0].displayName).toBe('Common SE Birds');
      expect(packs[0].unlocked).toBe(true);
      expect(packs[0].accuracy).toBe(80);
    });

    it('gets pack mastery', () => {
      const mastery = view.getPackMastery('common_se_birds');

      expect(mastery).not.toBeNull();
      expect(mastery?.masteryLevel).toBe('intermediate');
    });
  });

  describe('Navigation', () => {
    it('gets and sets section', () => {
      expect(view.getSection()).toBe('overview');

      view.setSection('levels');
      expect(view.getSection()).toBe('levels');
    });

    it('toggles visibility', () => {
      expect(view.isVisible()).toBe(false);

      view.show();
      expect(view.isVisible()).toBe(true);

      view.hide();
      expect(view.isVisible()).toBe(false);
    });
  });

  describe('Render Data', () => {
    it('returns correct data for overview section', () => {
      view.setSection('overview');
      const data = view.getRenderData();

      expect(data.section).toBe('overview');
      expect(data.overview).toBeDefined();
    });

    it('returns correct data for levels section', () => {
      view.setSection('levels');
      const data = view.getRenderData();

      expect(data.section).toBe('levels');
      expect(data.levels).toHaveLength(10);
    });
  });
});

describe('Phase J Acceptance Criteria', () => {
  describe('Unlocked Levels persist across sessions', () => {
    it('levels persist after save and reload', () => {
      const storage = new MemoryStorage();
      const store1 = new ProgressStore({ storage });

      // Complete Level 2 -> unlock Level 3
      store1.unlockLevel(2);
      store1.unlockLevel(3);
      store1.recordLevelAttempt(2, true, 500, 80);
      store1.save();

      // Simulate app close and reopen
      const store2 = new ProgressStore({ storage });

      expect(store2.isLevelUnlocked(3)).toBe(true);
      expect(store2.getLevelStats(2).completions).toBe(1);
    });
  });

  describe('Unlocked Packs persist across sessions', () => {
    it('packs persist after save and reload', () => {
      const storage = new MemoryStorage();
      const store1 = new ProgressStore({ storage });

      store1.unlockPack('spring_warblers');
      store1.unlockPack('woodpeckers');
      store1.save();

      const store2 = new ProgressStore({ storage });

      expect(store2.isPackUnlocked('spring_warblers')).toBe(true);
      expect(store2.isPackUnlocked('woodpeckers')).toBe(true);
    });
  });

  describe('Per-Pack accuracy, streak, confusion pairs tracked', () => {
    it('tracks all pack metrics', () => {
      const store = new ProgressStore({ storage: new MemoryStorage() });

      // Play some games
      store.recordPackGame('test_pack', 10, 8, 500);
      store.recordPackGame('test_pack', 10, 9, 400);

      // Build streak
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);
      store.updateStreak('test_pack', true);

      // Record confusions
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');

      const stats = store.getPackStats('test_pack');

      expect(stats.gamesPlayed).toBe(2);
      expect(stats.bestAccuracy).toBe(90);
      expect(stats.currentStreak).toBe(3);
      expect(stats.bestStreak).toBe(3);
      expect(stats.confusionPairs[0].count).toBe(2);
    });
  });

  describe('Response time trends calculated and stored', () => {
    it('calculates response time trends', () => {
      const store = new ProgressStore({ storage: new MemoryStorage() });
      const calculator = new StatsCalculator();

      // Record games with improving response times
      for (let i = 0; i < 5; i++) {
        store.recordPackGame('test_pack', 10, 8, 1000 - i * 100);
      }
      for (let i = 0; i < 5; i++) {
        store.recordPackGame('test_pack', 10, 8, 500 - i * 50);
      }

      const stats = store.getPackStats('test_pack');
      const trend = calculator.analyzeResponseTimeTrend(stats.responseTimeSamples);

      expect(trend).toBe('improving');
    });
  });

  describe('Progress exportable as JSON', () => {
    it('exports valid JSON matching schema', () => {
      const store = new ProgressStore({ storage: new MemoryStorage() });

      store.unlockLevel(5);
      store.unlockPack('test_pack');
      store.recordPackGame('test_pack', 10, 8, 500);
      store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      store.updateCampaignHighScore(1, 500);

      const json = store.export();
      const parsed = JSON.parse(json) as PlayerProgress;

      // Validate structure
      expect(parsed.version).toBe(SCHEMA_VERSION);
      expect(parsed.playerId).toBeDefined();
      expect(parsed.unlockedLevels).toContain(5);
      expect(parsed.unlockedPacks).toContain('test_pack');
      expect(parsed.packStats.test_pack).toBeDefined();
      expect(parsed.packStats.test_pack.confusionPairs).toHaveLength(1);
      expect(parsed.highScores.campaign[1]).toBe(500);
    });

    it('can reimport exported JSON', () => {
      const store1 = new ProgressStore({ storage: new MemoryStorage() });

      store1.unlockLevel(5);
      store1.recordPackGame('test_pack', 10, 8, 500);

      const json = store1.export();

      const store2 = new ProgressStore({ storage: new MemoryStorage() });
      expect(store2.import(json)).toBe(true);

      expect(store2.isLevelUnlocked(5)).toBe(true);
      expect(store2.getPackStats('test_pack').gamesPlayed).toBe(1);
    });
  });

  describe('Smoke Test: Confuse Cardinal/Wren 5 times -> appears in stats', () => {
    it('confusion pair appears after 5 confusions', () => {
      const store = new ProgressStore({ storage: new MemoryStorage() });

      // Confuse Cardinal and Wren 5 times
      for (let i = 0; i < 5; i++) {
        store.recordConfusion('test_pack', 'NOCA', 'HOWR');
      }

      const confusions = store.getConfusionPairs('test_pack');
      const cardinalWren = confusions.find(
        (p) => (p.speciesA === 'HOWR' && p.speciesB === 'NOCA')
      );

      expect(cardinalWren).toBeDefined();
      expect(cardinalWren!.count).toBe(5);

      // Should appear in significant confusions
      const significant = store.getSignificantConfusions('test_pack', 3);
      expect(significant).toHaveLength(1);
    });
  });
});
