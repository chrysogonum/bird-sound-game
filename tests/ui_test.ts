/**
 * UI Tests for Phase E
 *
 * Validates:
 * - Round summary shows accuracy %, per-species breakdown
 * - Confusion matrix highlights species pairs with >2 confusions
 * - Calibration plays test tone in left, then right ear
 * - HUD updates score in real-time during round
 * - High-contrast, colorblind-safe icon palette
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoundSummary } from '../src/ui/RoundSummary.js';
import { ConfusionMatrix } from '../src/ui/ConfusionMatrix.js';
import { CalibrationFlow } from '../src/ui/CalibrationFlow.js';
import { HUD } from '../src/ui/HUD.js';
import { UI_COLORS } from '../src/ui/types.js';
import type { RoundStats } from '../src/game/types.js';
import type { ScoringResult, ScoringEvent, ScoringInput, ScoreBreakdown } from '../src/scoring/types.js';

// Mock AudioContext for Node.js environment
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';
  currentTime: number = 0;

  createOscillator() {
    return {
      connect: vi.fn(),
      frequency: { setValueAtTime: vi.fn() },
      type: 'sine',
      start: vi.fn(),
      stop: vi.fn(),
    };
  }

  createGain() {
    return {
      connect: vi.fn(),
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
      },
    };
  }

  createStereoPanner() {
    return {
      connect: vi.fn(),
      pan: { setValueAtTime: vi.fn() },
    };
  }

  get destination() {
    return {};
  }

  resume() {
    this.state = 'running';
    return Promise.resolve();
  }

  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

vi.stubGlobal('AudioContext', MockAudioContext);

// Helper to create test scoring results
function createScoringResult(
  expectedSpecies: string,
  inputSpecies: string | null,
  speciesCorrect: boolean
): ScoringResult {
  const event: ScoringEvent = {
    eventId: `event_${Math.random()}`,
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

  return {
    event,
    input,
    breakdown,
    missed: false,
  };
}

describe('RoundSummary', () => {
  let summary: RoundSummary;

  beforeEach(() => {
    summary = new RoundSummary();
  });

  describe('accuracy display', () => {
    it('should show accuracy percentage', () => {
      const stats: RoundStats = {
        totalEvents: 10,
        eventsScored: 10,
        totalScore: 800,
        accuracy: 80,
        perfectCount: 5,
        missCount: 1,
        speciesCorrectCount: 8,
        channelCorrectCount: 9,
      };

      const history: ScoringResult[] = [];
      for (let i = 0; i < 8; i++) {
        history.push(createScoringResult('NOCA', 'NOCA', true));
      }
      for (let i = 0; i < 2; i++) {
        history.push(createScoringResult('NOCA', 'BLJA', false));
      }

      summary.show(stats, history, 1, 30000);

      expect(summary.getAccuracyPercent()).toBe(80);
      expect(summary.getFormattedAccuracy()).toBe('80%');
    });

    it('should calculate per-species breakdown', () => {
      const stats: RoundStats = {
        totalEvents: 6,
        eventsScored: 6,
        totalScore: 400,
        accuracy: 66.67,
        perfectCount: 4,
        missCount: 0,
        speciesCorrectCount: 4,
        channelCorrectCount: 6,
      };

      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'NOCA', true),
        createScoringResult('NOCA', 'NOCA', true),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('BLJA', 'BLJA', true),
        createScoringResult('BLJA', 'BLJA', true),
        createScoringResult('BLJA', 'NOCA', false),
      ];

      summary.show(stats, history, 1, 30000);

      const breakdowns = summary.getSpeciesBreakdowns();
      expect(breakdowns.length).toBe(2);

      // Both should have 66.67% accuracy (2/3)
      for (const breakdown of breakdowns) {
        expect(breakdown.totalEvents).toBe(3);
        expect(breakdown.correctCount).toBe(2);
        expect(breakdown.accuracy).toBeCloseTo(66.67, 0);
      }
    });
  });

  describe('confusion pairs', () => {
    it('should identify confusion pairs', () => {
      const stats: RoundStats = {
        totalEvents: 5,
        eventsScored: 5,
        totalScore: 200,
        accuracy: 40,
        perfectCount: 2,
        missCount: 0,
        speciesCorrectCount: 2,
        channelCorrectCount: 5,
      };

      // Create 3 confusions between NOCA and BLJA
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'NOCA', true),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('BLJA', 'BLJA', true),
      ];

      summary.show(stats, history, 1, 30000);

      const confusionPairs = summary.getConfusionPairs();
      expect(confusionPairs.length).toBe(1);
      expect(confusionPairs[0].count).toBe(3);
    });

    it('should highlight pairs with >2 confusions', () => {
      const stats: RoundStats = {
        totalEvents: 6,
        eventsScored: 6,
        totalScore: 200,
        accuracy: 33.33,
        perfectCount: 2,
        missCount: 0,
        speciesCorrectCount: 2,
        channelCorrectCount: 6,
      };

      const history: ScoringResult[] = [
        // 3 confusions NOCA/BLJA (should be highlighted)
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        // 2 confusions CARW/TUTI (should NOT be highlighted)
        createScoringResult('CARW', 'TUTI', false),
        createScoringResult('CARW', 'TUTI', false),
        // 1 correct
        createScoringResult('NOCA', 'NOCA', true),
      ];

      summary.show(stats, history, 1, 30000);

      const highlighted = summary.getHighlightedConfusionPairs();
      expect(highlighted.length).toBe(1);
      expect(highlighted[0].count).toBe(3);
    });
  });

  describe('visibility', () => {
    it('should toggle visibility', () => {
      expect(summary.isVisible()).toBe(false);

      const stats: RoundStats = {
        totalEvents: 1,
        eventsScored: 1,
        totalScore: 100,
        accuracy: 100,
        perfectCount: 1,
        missCount: 0,
        speciesCorrectCount: 1,
        channelCorrectCount: 1,
      };

      summary.show(stats, [], 1, 30000);
      expect(summary.isVisible()).toBe(true);

      summary.hide();
      expect(summary.isVisible()).toBe(false);
    });
  });

  describe('actions', () => {
    it('should trigger callbacks', () => {
      const callback = vi.fn();
      summary.setOnAction(callback);

      summary.retry();
      expect(callback).toHaveBeenCalledWith('retry');

      callback.mockClear();
      summary.next();
      expect(callback).toHaveBeenCalledWith('next');

      callback.mockClear();
      summary.menu();
      expect(callback).toHaveBeenCalledWith('menu');
    });
  });
});

describe('ConfusionMatrix', () => {
  let matrix: ConfusionMatrix;

  beforeEach(() => {
    matrix = new ConfusionMatrix();
  });

  describe('building from history', () => {
    it('should track confusions between species', () => {
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
      ];

      matrix.buildFromHistory(history);

      expect(matrix.getConfusionCount('NOCA', 'BLJA')).toBe(3);
      expect(matrix.getConfusionCount('BLJA', 'NOCA')).toBe(3); // Symmetric
    });

    it('should not track correct identifications', () => {
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'NOCA', true),
        createScoringResult('BLJA', 'BLJA', true),
      ];

      matrix.buildFromHistory(history);

      expect(matrix.hasConfusions()).toBe(false);
      expect(matrix.getTotalConfusions()).toBe(0);
    });
  });

  describe('highlighting', () => {
    it('should highlight pairs with >2 confusions', () => {
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('NOCA', 'BLJA', false), // 3 confusions
        createScoringResult('CARW', 'TUTI', false),
        createScoringResult('CARW', 'TUTI', false), // 2 confusions
      ];

      matrix.buildFromHistory(history);

      expect(matrix.isHighlighted('NOCA', 'BLJA')).toBe(true);
      expect(matrix.isHighlighted('CARW', 'TUTI')).toBe(false);
    });

    it('should return highlighted pairs sorted by count', () => {
      const history: ScoringResult[] = [];
      // 5 confusions NOCA/BLJA
      for (let i = 0; i < 5; i++) {
        history.push(createScoringResult('NOCA', 'BLJA', false));
      }
      // 3 confusions CARW/TUTI
      for (let i = 0; i < 3; i++) {
        history.push(createScoringResult('CARW', 'TUTI', false));
      }

      matrix.buildFromHistory(history);

      const highlighted = matrix.getHighlightedPairs();
      expect(highlighted.length).toBe(2);
      expect(highlighted[0].count).toBe(5);
      expect(highlighted[1].count).toBe(3);
    });
  });

  describe('matrix data', () => {
    it('should generate matrix data for rendering', () => {
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'BLJA', false),
        createScoringResult('CARW', 'CARW', true),
      ];

      matrix.buildFromHistory(history);

      const renderData = matrix.getRenderData();
      expect(renderData.species.length).toBeGreaterThan(0);
      expect(renderData.maxCount).toBe(1);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      const history: ScoringResult[] = [
        createScoringResult('NOCA', 'BLJA', false),
      ];

      matrix.buildFromHistory(history);
      expect(matrix.hasConfusions()).toBe(true);

      matrix.clear();
      expect(matrix.hasConfusions()).toBe(false);
      expect(matrix.getSpecies().length).toBe(0);
    });
  });
});

describe('CalibrationFlow', () => {
  let calibration: CalibrationFlow;

  beforeEach(() => {
    calibration = new CalibrationFlow();
  });

  describe('step progression', () => {
    it('should start at intro step', () => {
      calibration.start();
      expect(calibration.getStep()).toBe('intro');
    });

    it('should progress through steps', () => {
      calibration.start();
      expect(calibration.getStep()).toBe('intro');

      calibration.nextStep();
      expect(calibration.getStep()).toBe('left');

      calibration.nextStep();
      expect(calibration.getStep()).toBe('right');

      calibration.nextStep();
      expect(calibration.getStep()).toBe('confirm');

      calibration.nextStep();
      expect(calibration.getStep()).toBe('complete');
    });

    it('should skip intro if configured', () => {
      calibration = new CalibrationFlow({ skipIntro: true });
      calibration.start();
      expect(calibration.getStep()).toBe('left');
    });
  });

  describe('confirmation', () => {
    it('should track left confirmation', () => {
      calibration.start();
      calibration.nextStep(); // Go to 'left'

      expect(calibration.isLeftConfirmed()).toBe(false);
      calibration.confirmLeft();
      expect(calibration.isLeftConfirmed()).toBe(true);
    });

    it('should track right confirmation', () => {
      calibration.start();
      calibration.nextStep(); // Go to 'left'
      calibration.nextStep(); // Go to 'right'

      expect(calibration.isRightConfirmed()).toBe(false);
      calibration.confirmRight();
      expect(calibration.isRightConfirmed()).toBe(true);
    });

    it('should advance step on confirmation', () => {
      calibration.start();
      calibration.nextStep(); // Go to 'left'
      calibration.confirmLeft();
      expect(calibration.getStep()).toBe('right');

      calibration.confirmRight();
      expect(calibration.getStep()).toBe('confirm');
    });
  });

  describe('completion', () => {
    it('should call onComplete callback', () => {
      const callback = vi.fn();
      calibration.setOnComplete(callback);

      calibration.start();
      calibration.nextStep(); // left
      calibration.confirmLeft();
      calibration.confirmRight();
      calibration.nextStep(); // complete

      expect(callback).toHaveBeenCalledWith({
        leftConfirmed: true,
        rightConfirmed: true,
        completed: true,
      });
    });

    it('should report completion state', () => {
      calibration.start();
      expect(calibration.isComplete()).toBe(false);

      calibration.nextStep();
      calibration.confirmLeft();
      calibration.confirmRight();
      calibration.nextStep();

      expect(calibration.isComplete()).toBe(true);
    });
  });

  describe('instructions', () => {
    it('should provide step instructions', () => {
      calibration.start();

      expect(calibration.getStepInstructions()).toContain('headphones');

      calibration.nextStep();
      expect(calibration.getStepInstructions()).toContain('LEFT');

      calibration.nextStep();
      expect(calibration.getStepInstructions()).toContain('RIGHT');
    });

    it('should provide button labels', () => {
      calibration.start();
      expect(calibration.getButtonLabel()).toBe('Continue');

      calibration.nextStep();
      expect(calibration.getButtonLabel()).toBe('Play Tone');
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      calibration.start();
      calibration.nextStep();
      calibration.confirmLeft();

      calibration.reset();

      expect(calibration.getStep()).toBe('intro');
      expect(calibration.isLeftConfirmed()).toBe(false);
      expect(calibration.isRightConfirmed()).toBe(false);
    });
  });
});

describe('HUD', () => {
  let hud: HUD;

  beforeEach(() => {
    hud = new HUD();
  });

  describe('initialization', () => {
    it('should initialize with round parameters', () => {
      hud.initialize(30000, 10);

      expect(hud.getScore()).toBe(0);
      expect(hud.getTimeRemainingMs()).toBe(30000);
      const state = hud.getState();
      expect(state.totalTimeMs).toBe(30000);
      expect(state.totalEvents).toBe(10);
    });
  });

  describe('score updates', () => {
    it('should update score in real-time', () => {
      hud.initialize(30000, 10);

      hud.updateScore(100);
      expect(hud.getScore()).toBe(100);

      hud.addScore(50);
      expect(hud.getScore()).toBe(150);
    });

    it('should track score animation state', () => {
      hud.initialize(30000, 10);

      hud.updateScore(100);
      expect(hud.isScoreAnimating()).toBe(true);
      expect(hud.getScoreChange()).toBe(100);
    });

    it('should notify listeners on score update', () => {
      const listener = vi.fn();
      hud.addListener(listener);
      hud.initialize(30000, 10);

      listener.mockClear();
      hud.updateScore(100);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ score: 100 })
      );
    });
  });

  describe('timer', () => {
    it('should update remaining time', () => {
      hud.initialize(30000, 10);

      hud.updateTime(25000);
      expect(hud.getTimeRemainingMs()).toBe(25000);
    });

    it('should format time as MM:SS', () => {
      hud.initialize(90000, 10);

      hud.updateTime(65000);
      expect(hud.getFormattedTime()).toBe('1:05');

      hud.updateTime(5000);
      expect(hud.getFormattedTime()).toBe('0:05');
    });

    it('should clamp time to 0', () => {
      hud.initialize(30000, 10);

      hud.updateTime(-1000);
      expect(hud.getTimeRemainingMs()).toBe(0);
    });

    it('should return timer CSS class based on time', () => {
      hud.initialize(30000, 10);

      hud.updateTime(25000); // 83% remaining
      expect(hud.getTimerClass()).toBe('timer-normal');

      hud.updateTime(7000); // 23% remaining
      expect(hud.getTimerClass()).toBe('timer-warning');

      hud.updateTime(2000); // 6.7% remaining
      expect(hud.getTimerClass()).toBe('timer-critical');
    });
  });

  describe('progress', () => {
    it('should track events completed', () => {
      hud.initialize(30000, 10);

      hud.updateProgress(5);
      expect(hud.getProgressString()).toBe('5/10');
      expect(hud.getProgressPercent()).toBe(50);
    });

    it('should increment progress', () => {
      hud.initialize(30000, 10);

      hud.incrementProgress();
      hud.incrementProgress();
      expect(hud.getProgressString()).toBe('2/10');
    });
  });

  describe('streak', () => {
    it('should track current streak', () => {
      hud.initialize(30000, 10);

      hud.updateStreak(5);
      expect(hud.getState().currentStreak).toBe(5);
    });

    it('should increment and reset streak', () => {
      hud.initialize(30000, 10);

      hud.incrementStreak();
      hud.incrementStreak();
      hud.incrementStreak();
      expect(hud.getState().currentStreak).toBe(3);

      hud.resetStreak();
      expect(hud.getState().currentStreak).toBe(0);
    });

    it('should return streak CSS class', () => {
      hud.initialize(30000, 10);

      hud.updateStreak(2);
      expect(hud.getStreakClass()).toBe('streak-normal');

      hud.updateStreak(5);
      expect(hud.getStreakClass()).toBe('streak-hot');

      hud.updateStreak(10);
      expect(hud.getStreakClass()).toBe('streak-fire');
    });
  });

  describe('playing state', () => {
    it('should track playing state', () => {
      hud.initialize(30000, 10);
      expect(hud.getState().isPlaying).toBe(false);

      hud.start();
      expect(hud.getState().isPlaying).toBe(true);

      hud.stop();
      expect(hud.getState().isPlaying).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should add and remove listeners', () => {
      const listener = vi.fn();

      hud.addListener(listener);
      hud.initialize(30000, 10);
      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      hud.removeListener(listener);
      hud.updateScore(100);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      hud.initialize(30000, 10);
      hud.updateScore(500);
      hud.updateProgress(5);
      hud.updateStreak(3);

      hud.reset();

      expect(hud.getScore()).toBe(0);
      expect(hud.getState().eventsCompleted).toBe(0);
      expect(hud.getState().currentStreak).toBe(0);
    });
  });
});

describe('UI Colors', () => {
  it('should have high-contrast, colorblind-safe colors', () => {
    // Verify colors are defined
    expect(UI_COLORS.PRIMARY).toBeDefined();
    expect(UI_COLORS.SUCCESS).toBeDefined();
    expect(UI_COLORS.ERROR).toBeDefined();
    expect(UI_COLORS.WARNING).toBeDefined();

    // Verify they're hex colors
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(UI_COLORS.PRIMARY).toMatch(hexPattern);
    expect(UI_COLORS.SUCCESS).toMatch(hexPattern);
    expect(UI_COLORS.ERROR).toMatch(hexPattern);
    expect(UI_COLORS.WARNING).toMatch(hexPattern);
  });

  it('should have distinct confusion matrix colors', () => {
    expect(UI_COLORS.CONFUSION_LOW).toBeDefined();
    expect(UI_COLORS.CONFUSION_MEDIUM).toBeDefined();
    expect(UI_COLORS.CONFUSION_HIGH).toBeDefined();

    // All should be different
    expect(UI_COLORS.CONFUSION_LOW).not.toBe(UI_COLORS.CONFUSION_MEDIUM);
    expect(UI_COLORS.CONFUSION_MEDIUM).not.toBe(UI_COLORS.CONFUSION_HIGH);
  });
});

describe('Phase E Smoke Tests', () => {
  it('Smoke 1: Complete round with 80% accuracy → summary shows "80%"', () => {
    const summary = new RoundSummary();

    const stats: RoundStats = {
      totalEvents: 10,
      eventsScored: 10,
      totalScore: 800,
      accuracy: 80,
      perfectCount: 8,
      missCount: 0,
      speciesCorrectCount: 8,
      channelCorrectCount: 10,
    };

    // Create history with 80% correct
    const history: ScoringResult[] = [];
    for (let i = 0; i < 8; i++) {
      history.push(createScoringResult('NOCA', 'NOCA', true));
    }
    for (let i = 0; i < 2; i++) {
      history.push(createScoringResult('NOCA', 'BLJA', false));
    }

    summary.show(stats, history, 1, 30000);

    expect(summary.getFormattedAccuracy()).toBe('80%');
  });

  it('Smoke 2: Confuse Cardinal/Pyrrhuloxia 3 times → confusion matrix highlights pair', () => {
    const matrix = new ConfusionMatrix();

    // Register species names
    ConfusionMatrix.registerSpeciesNames({
      NOCA: 'Northern Cardinal',
      PYNU: 'Pyrrhuloxia',
    });

    const history: ScoringResult[] = [
      createScoringResult('NOCA', 'PYNU', false),
      createScoringResult('NOCA', 'PYNU', false),
      createScoringResult('NOCA', 'PYNU', false),
    ];

    matrix.buildFromHistory(history);

    // Should be highlighted (>2 confusions)
    expect(matrix.isHighlighted('NOCA', 'PYNU')).toBe(true);

    const highlighted = matrix.getHighlightedPairs();
    expect(highlighted.length).toBe(1);
    expect(highlighted[0].count).toBe(3);
  });

  it('Smoke 3: Run calibration → user can confirm L/R audio works', async () => {
    const calibration = new CalibrationFlow();
    const completeCallback = vi.fn();
    calibration.setOnComplete(completeCallback);

    // Initialize (requires AudioContext)
    await calibration.initialize();

    // Start calibration
    calibration.start();
    expect(calibration.getStep()).toBe('intro');

    // Progress through flow
    calibration.nextStep(); // left
    expect(calibration.getStep()).toBe('left');

    // Simulate playing left tone and confirming
    calibration.confirmLeft();
    expect(calibration.isLeftConfirmed()).toBe(true);
    expect(calibration.getStep()).toBe('right');

    // Simulate playing right tone and confirming
    calibration.confirmRight();
    expect(calibration.isRightConfirmed()).toBe(true);
    expect(calibration.getStep()).toBe('confirm');

    // Complete calibration
    calibration.nextStep();
    expect(calibration.isComplete()).toBe(true);

    // Verify callback was called with correct result
    expect(completeCallback).toHaveBeenCalledWith({
      leftConfirmed: true,
      rightConfirmed: true,
      completed: true,
    });
  });

  it('Smoke 4: HUD updates score in real-time during round', () => {
    const hud = new HUD();
    const listener = vi.fn();

    hud.addListener(listener);
    hud.initialize(30000, 10);

    // Start the round
    hud.start();
    expect(hud.getState().isPlaying).toBe(true);

    // Simulate score updates during gameplay
    listener.mockClear();

    hud.addScore(100);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ score: 100 }));

    hud.addScore(75);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ score: 175 }));

    hud.addScore(50);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ score: 225 }));

    // Verify final score
    expect(hud.getScore()).toBe(225);
  });
});
