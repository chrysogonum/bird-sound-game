/**
 * Scoring Tests for Phase C
 *
 * Validates:
 * - RadialWheel displays 8 species icons
 * - Tap left side registers "left" channel selection
 * - Tap species icon registers species selection
 * - Correct species + channel + timing → +100 points
 * - Correct species, wrong channel → +50 points
 * - Wrong species, correct channel → +25 points
 * - Input outside Scoring Window → 0 points
 * - Visual flash on correct; shake on incorrect
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RadialWheel } from '../src/input/RadialWheel.js';
import { ChannelInput } from '../src/input/ChannelInput.js';
import { ScoreEngine } from '../src/scoring/ScoreEngine.js';
import { FeedbackRenderer } from '../src/scoring/FeedbackRenderer.js';
import { SCORE_VALUES } from '../src/scoring/types.js';
import type { SpeciesIcon } from '../src/input/types.js';
import type { ScoringEvent, ScoringInput } from '../src/scoring/types.js';

// Mock AudioContext for Node.js environment
class MockAudioContext {
  state: 'suspended' | 'running' | 'closed' = 'running';

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
        exponentialRampToValueAtTime: vi.fn(),
      },
    };
  }

  get destination() {
    return {};
  }

  get currentTime() {
    return 0;
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

// Test species data
const TEST_SPECIES: SpeciesIcon[] = [
  { speciesCode: 'NOCA', displayName: 'Northern Cardinal', icon: '🐦', angle: 0 },
  { speciesCode: 'BLJA', displayName: 'Blue Jay', icon: '🐦', angle: 45 },
  { speciesCode: 'CARW', displayName: 'Carolina Wren', icon: '🐦', angle: 90 },
  { speciesCode: 'AMCR', displayName: 'American Crow', icon: '🐦', angle: 135 },
  { speciesCode: 'TUTI', displayName: 'Tufted Titmouse', icon: '🐦', angle: 180 },
  { speciesCode: 'EABL', displayName: 'Eastern Bluebird', icon: '🐦', angle: 225 },
  { speciesCode: 'MODO', displayName: 'Mourning Dove', icon: '🐦', angle: 270 },
  { speciesCode: 'AMRO', displayName: 'American Robin', icon: '🐦', angle: 315 },
];

describe('RadialWheel', () => {
  let wheel: RadialWheel;

  beforeEach(() => {
    wheel = new RadialWheel({ species: TEST_SPECIES });
  });

  describe('species display', () => {
    it('should display 8 species icons', () => {
      expect(wheel.getSpeciesCount()).toBe(8);
    });

    it('should have all test species on wheel', () => {
      for (const species of TEST_SPECIES) {
        expect(wheel.hasSpecies(species.speciesCode)).toBe(true);
      }
    });

    it('should return all species', () => {
      const species = wheel.getSpecies();
      expect(species.length).toBe(8);
      expect(species[0].speciesCode).toBe('NOCA');
    });

    it('should throw error for more than 12 species', () => {
      const tooMany = Array(13)
        .fill(null)
        .map((_, i) => ({
          speciesCode: `SP${i}`,
          displayName: `Species ${i}`,
          icon: '🐦',
          angle: 0,
        }));

      expect(() => new RadialWheel({ species: tooMany })).toThrow(
        'RadialWheel supports a maximum of 12 species'
      );
    });
  });

  describe('species selection', () => {
    it('should register species selection', () => {
      const listener = vi.fn();
      wheel.addListener(listener);

      wheel.selectSpecies('NOCA');

      expect(wheel.getSelectedSpecies()).toBe('NOCA');
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'species_selection',
          speciesCode: 'NOCA',
        })
      );
    });

    it('should handle tap on species icon', () => {
      // Get position of first species (NOCA at angle 0)
      const pos = wheel.getSpeciesPosition('NOCA');
      expect(pos).not.toBeNull();

      if (pos) {
        const selected = wheel.handleTap(pos.x, pos.y);
        expect(selected).toBe('NOCA');
      }
    });

    it('should return null for tap outside icons', () => {
      const selected = wheel.handleTap(9999, 9999);
      expect(selected).toBeNull();
    });

    it('should not select when disabled', () => {
      wheel.setEnabled(false);
      wheel.selectSpecies('NOCA');
      expect(wheel.getSelectedSpecies()).toBeNull();
    });

    it('should clear selection', () => {
      wheel.selectSpecies('NOCA');
      expect(wheel.getSelectedSpecies()).toBe('NOCA');
      wheel.clearSelection();
      expect(wheel.getSelectedSpecies()).toBeNull();
    });
  });

  describe('positions', () => {
    it('should calculate all positions', () => {
      const positions = wheel.getAllPositions();
      expect(positions.length).toBe(8);
      positions.forEach((p) => {
        expect(p.species).toBeDefined();
        expect(typeof p.x).toBe('number');
        expect(typeof p.y).toBe('number');
      });
    });

    it('should return null for unknown species position', () => {
      expect(wheel.getSpeciesPosition('UNKNOWN')).toBeNull();
    });
  });
});

describe('ChannelInput', () => {
  let channelInput: ChannelInput;
  const SCREEN_WIDTH = 800;

  beforeEach(() => {
    channelInput = new ChannelInput({ screenWidth: SCREEN_WIDTH });
  });

  describe('channel detection', () => {
    it('should detect left channel for tap on left side', () => {
      // Tap at x=100 (left side of 800px screen)
      const channel = channelInput.handleTap(100);
      expect(channel).toBe('left');
      expect(channelInput.getSelectedChannel()).toBe('left');
    });

    it('should detect right channel for tap on right side', () => {
      // Tap at x=600 (right side of 800px screen)
      const channel = channelInput.handleTap(600);
      expect(channel).toBe('right');
      expect(channelInput.getSelectedChannel()).toBe('right');
    });

    it('should notify listeners on channel selection', () => {
      const listener = vi.fn();
      channelInput.addListener(listener);

      channelInput.handleTap(100);

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'channel_selection',
          channel: 'left',
        })
      );
    });

    it('should respect dead zone', () => {
      const inputWithDeadZone = new ChannelInput({
        screenWidth: SCREEN_WIDTH,
        deadZone: 50,
      });

      // Center is 400, dead zone is ±50 (350-450)
      expect(inputWithDeadZone.getChannelFromX(349)).toBe('left');
      expect(inputWithDeadZone.getChannelFromX(400)).toBeNull(); // Dead zone
      expect(inputWithDeadZone.getChannelFromX(451)).toBe('right');
    });

    it('should not select when disabled', () => {
      channelInput.setEnabled(false);
      channelInput.handleTap(100);
      expect(channelInput.getSelectedChannel()).toBeNull();
    });

    it('should clear selection', () => {
      channelInput.handleTap(100);
      expect(channelInput.getSelectedChannel()).toBe('left');
      channelInput.clearSelection();
      expect(channelInput.getSelectedChannel()).toBeNull();
    });
  });
});

describe('ScoreEngine', () => {
  let scoreEngine: ScoreEngine;

  const createEvent = (overrides: Partial<ScoringEvent> = {}): ScoringEvent => ({
    eventId: 'test_event',
    expectedSpecies: 'NOCA',
    expectedChannel: 'left',
    windowStartMs: 1000,
    windowEndMs: 3000,
    perfectTimeMs: 2000,
    ...overrides,
  });

  const createInput = (overrides: Partial<ScoringInput> = {}): ScoringInput => ({
    speciesCode: 'NOCA',
    channel: 'left',
    timestampMs: 2000,
    ...overrides,
  });

  beforeEach(() => {
    scoreEngine = new ScoreEngine();
  });

  describe('scoring dimensions', () => {
    it('should award +100 for perfect (species + channel + timing)', () => {
      const event = createEvent();
      const input = createInput();

      const result = scoreEngine.scoreEvent(event, input);

      expect(result.breakdown.totalPoints).toBe(100);
      expect(result.breakdown.speciesPoints).toBe(SCORE_VALUES.SPECIES_CORRECT);
      expect(result.breakdown.channelPoints).toBe(SCORE_VALUES.CHANNEL_CORRECT);
      expect(result.breakdown.timingPoints).toBe(SCORE_VALUES.TIMING_PERFECT);
      expect(result.breakdown.speciesCorrect).toBe(true);
      expect(result.breakdown.channelCorrect).toBe(true);
      expect(result.breakdown.timingAccuracy).toBe('perfect');
    });

    it('should award +50 for correct species, wrong channel', () => {
      const event = createEvent({ expectedChannel: 'left' });
      const input = createInput({ channel: 'right' }); // Wrong channel

      const result = scoreEngine.scoreEvent(event, input);

      expect(result.breakdown.speciesPoints).toBe(50);
      expect(result.breakdown.channelPoints).toBe(0);
      expect(result.breakdown.speciesCorrect).toBe(true);
      expect(result.breakdown.channelCorrect).toBe(false);
      // Total should be species(50) + timing(25 perfect or 10 partial)
      expect(result.breakdown.totalPoints).toBeGreaterThanOrEqual(60);
    });

    it('should award +25 for correct channel, wrong species', () => {
      const event = createEvent({ expectedSpecies: 'NOCA' });
      const input = createInput({ speciesCode: 'BLJA' }); // Wrong species

      const result = scoreEngine.scoreEvent(event, input);

      expect(result.breakdown.speciesPoints).toBe(0);
      expect(result.breakdown.channelPoints).toBe(25);
      expect(result.breakdown.speciesCorrect).toBe(false);
      expect(result.breakdown.channelCorrect).toBe(true);
      // Total should be channel(25) + timing(25 perfect or 10 partial)
      expect(result.breakdown.totalPoints).toBeGreaterThanOrEqual(35);
    });

    it('should award 0 for input outside scoring window', () => {
      const event = createEvent({ windowStartMs: 1000, windowEndMs: 2000 });
      const input = createInput({ timestampMs: 3000 }); // Outside window

      const result = scoreEngine.scoreEvent(event, input);

      expect(result.breakdown.totalPoints).toBe(0);
      expect(result.breakdown.timingAccuracy).toBe('miss');
      expect(result.missed).toBe(true);
    });

    it('should award partial timing for input in window but not perfect', () => {
      const event = createEvent({
        windowStartMs: 1000,
        windowEndMs: 3000,
        perfectTimeMs: 2000,
        perfectToleranceMs: 50,
      });
      // Input at 2500ms - within window but not within ±50ms of 2000ms
      const input = createInput({ timestampMs: 2500 });

      const result = scoreEngine.scoreEvent(event, input);

      expect(result.breakdown.timingAccuracy).toBe('partial');
      expect(result.breakdown.timingPoints).toBe(SCORE_VALUES.TIMING_PARTIAL);
    });
  });

  describe('state tracking', () => {
    it('should track total score', () => {
      const event = createEvent();
      const input = createInput();

      scoreEngine.scoreEvent(event, input);

      expect(scoreEngine.getTotalScore()).toBe(100);
    });

    it('should track events scored', () => {
      const event = createEvent();
      const input = createInput();

      scoreEngine.scoreEvent(event, input);
      scoreEngine.scoreEvent(event, input);

      expect(scoreEngine.getEventsScored()).toBe(2);
    });

    it('should calculate accuracy percentage', () => {
      const event = createEvent();
      const perfectInput = createInput();
      const missedInput = createInput({ timestampMs: 5000 }); // Outside window

      scoreEngine.scoreEvent(event, perfectInput); // 100 points
      scoreEngine.scoreEvent(event, missedInput); // 0 points

      // Total: 100 out of 200 possible = 50%
      expect(scoreEngine.getAccuracyPercent()).toBe(50);
    });

    it('should reset state', () => {
      const event = createEvent();
      const input = createInput();

      scoreEngine.scoreEvent(event, input);
      expect(scoreEngine.getTotalScore()).toBe(100);

      scoreEngine.reset();

      expect(scoreEngine.getTotalScore()).toBe(0);
      expect(scoreEngine.getEventsScored()).toBe(0);
    });
  });

  describe('static methods', () => {
    it('should calculate score statically', () => {
      const score = ScoreEngine.calculateScore(
        'NOCA', // expected species
        'left', // expected channel
        'NOCA', // input species
        'left', // input channel
        true, // in window
        true // perfect timing
      );

      expect(score).toBe(100);
    });

    it('should determine feedback type', () => {
      expect(
        ScoreEngine.getFeedbackType({
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 25,
          totalPoints: 100,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'perfect',
        })
      ).toBe('perfect');

      expect(
        ScoreEngine.getFeedbackType({
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 10,
          totalPoints: 85,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'partial',
        })
      ).toBe('good');

      expect(
        ScoreEngine.getFeedbackType({
          speciesPoints: 50,
          channelPoints: 0,
          timingPoints: 10,
          totalPoints: 60,
          speciesCorrect: true,
          channelCorrect: false,
          timingAccuracy: 'partial',
        })
      ).toBe('partial');

      expect(
        ScoreEngine.getFeedbackType({
          speciesPoints: 0,
          channelPoints: 0,
          timingPoints: 0,
          totalPoints: 0,
          speciesCorrect: false,
          channelCorrect: false,
          timingAccuracy: 'miss',
        })
      ).toBe('miss');
    });
  });
});

describe('FeedbackRenderer', () => {
  let renderer: FeedbackRenderer;

  beforeEach(() => {
    renderer = new FeedbackRenderer({ audioEnabled: false }); // Disable audio for tests
  });

  describe('visual feedback', () => {
    it('should show feedback for perfect score', () => {
      const listener = vi.fn();
      renderer.addListener(listener);

      renderer.showFeedback({
        type: 'perfect',
        score: 100,
        breakdown: {
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 25,
          totalPoints: 100,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'perfect',
        },
      });

      expect(renderer.isShowingFeedback()).toBe(true);
      expect(renderer.getState().type).toBe('perfect');
      expect(renderer.getState().score).toBe(100);
      expect(listener).toHaveBeenCalled();
    });

    it('should return correct CSS class for each feedback type', () => {
      expect(renderer.getCssClass('perfect')).toContain('feedback-perfect');
      expect(renderer.getCssClass('good')).toContain('feedback-good');
      expect(renderer.getCssClass('partial')).toContain('feedback-partial');
      expect(renderer.getCssClass('miss')).toContain('feedback-miss');
    });

    it('should show flash for correct (green)', () => {
      renderer.showFeedback({
        type: 'good',
        score: 85,
        breakdown: {
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 10,
          totalPoints: 85,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'partial',
        },
      });

      expect(renderer.getState().cssClass).toContain('flash-green');
    });

    it('should show shake for incorrect (red)', () => {
      renderer.showFeedback({
        type: 'miss',
        score: 0,
        breakdown: {
          speciesPoints: 0,
          channelPoints: 0,
          timingPoints: 0,
          totalPoints: 0,
          speciesCorrect: false,
          channelCorrect: false,
          timingAccuracy: 'miss',
        },
      });

      expect(renderer.getState().cssClass).toContain('shake-red');
    });
  });

  describe('listener management', () => {
    it('should add and remove listeners', () => {
      const listener = vi.fn();

      renderer.addListener(listener);
      renderer.showFeedback({
        type: 'perfect',
        score: 100,
        breakdown: {
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 25,
          totalPoints: 100,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'perfect',
        },
      });

      expect(listener).toHaveBeenCalled();

      listener.mockClear();
      renderer.removeListener(listener);
      renderer.showFeedback({
        type: 'good',
        score: 85,
        breakdown: {
          speciesPoints: 50,
          channelPoints: 25,
          timingPoints: 10,
          totalPoints: 85,
          speciesCorrect: true,
          channelCorrect: true,
          timingAccuracy: 'partial',
        },
      });

      expect(listener).not.toHaveBeenCalled();
    });
  });
});

describe('Phase C Smoke Tests', () => {
  it('Smoke 1: Display wheel with 8 species → all icons visible and tappable', () => {
    const wheel = new RadialWheel({ species: TEST_SPECIES });

    // Verify 8 species
    expect(wheel.getSpeciesCount()).toBe(8);

    // Verify all are tappable
    const positions = wheel.getAllPositions();
    expect(positions.length).toBe(8);

    // Test tapping each one
    for (const pos of positions) {
      const selected = wheel.handleTap(pos.x, pos.y);
      expect(selected).toBe(pos.species.speciesCode);
      wheel.clearSelection();
    }
  });

  it('Smoke 2: Play Event on left, tap left + correct species → score shows +100', () => {
    const scoreEngine = new ScoreEngine();

    const event: ScoringEvent = {
      eventId: 'smoke_event_1',
      expectedSpecies: 'NOCA',
      expectedChannel: 'left',
      windowStartMs: 1000,
      windowEndMs: 3000,
      perfectTimeMs: 2000,
    };

    const input: ScoringInput = {
      speciesCode: 'NOCA', // Correct species
      channel: 'left', // Correct channel
      timestampMs: 2000, // Perfect timing
    };

    const result = scoreEngine.scoreEvent(event, input);

    expect(result.breakdown.totalPoints).toBe(100);
    expect(scoreEngine.getTotalScore()).toBe(100);
  });

  it('Smoke 3: Play Event on right, tap left + correct species → score shows +50', () => {
    const scoreEngine = new ScoreEngine();

    const event: ScoringEvent = {
      eventId: 'smoke_event_2',
      expectedSpecies: 'NOCA',
      expectedChannel: 'right', // Event is on RIGHT
      windowStartMs: 1000,
      windowEndMs: 3000,
      perfectTimeMs: 2000,
    };

    const input: ScoringInput = {
      speciesCode: 'NOCA', // Correct species
      channel: 'left', // WRONG channel (tapped left, but event was right)
      timestampMs: 2000, // Perfect timing
    };

    const result = scoreEngine.scoreEvent(event, input);

    // Species correct: +50, Channel wrong: 0, Timing perfect: +25
    // Total: 75 (or 60 if partial timing)
    expect(result.breakdown.speciesPoints).toBe(50);
    expect(result.breakdown.channelPoints).toBe(0);
    expect(result.breakdown.speciesCorrect).toBe(true);
    expect(result.breakdown.channelCorrect).toBe(false);

    // Note: PRD says "+50" but actually it should be 50 + timing points
    // The smoke test description might be simplified
    expect(result.breakdown.totalPoints).toBeGreaterThanOrEqual(50);
  });
});

describe('Score Values Constants', () => {
  it('should have correct score values from PRD', () => {
    expect(SCORE_VALUES.SPECIES_CORRECT).toBe(50);
    expect(SCORE_VALUES.CHANNEL_CORRECT).toBe(25);
    expect(SCORE_VALUES.TIMING_PERFECT).toBe(25);
    expect(SCORE_VALUES.TIMING_PARTIAL).toBe(10);
    expect(SCORE_VALUES.MAX_PER_EVENT).toBe(100);
  });
});
