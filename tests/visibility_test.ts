/**
 * Visibility Tests for Phase M
 *
 * Validates:
 * - VisibilityController manages spectrogram modes (full, fading, none)
 * - Opacity calculations work correctly for each mode
 * - VisualSettings provides UI for mode selection
 * - Transitions between modes work smoothly
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  VisibilityController,
  VISIBILITY_MODE_INFO,
} from '../src/visual/VisibilityController.js';
import {
  VisualSettings,
  SCROLL_SPEED_PRESETS,
  HIT_ZONE_PRESETS,
} from '../src/ui/VisualSettings.js';
import type { SpectrogramTile } from '../src/visual/types.js';

// Helper to create test tiles
function createTestTile(normalizedY: number, opacity: number = 1): SpectrogramTile {
  return {
    tileId: 'test_tile',
    eventId: 'test_event',
    speciesCode: 'NOCA',
    lane: 'left',
    spectrogramPath: 'data/spectrograms/test.png',
    scheduledTimeMs: 5000,
    durationMs: 2000,
    state: 'visible',
    normalizedY,
    opacity,
    scored: false,
  };
}

describe('VisibilityController', () => {
  let controller: VisibilityController;

  beforeEach(() => {
    controller = new VisibilityController();
  });

  describe('initialization', () => {
    it('should initialize with default mode (full)', () => {
      expect(controller.getMode()).toBe('full');
    });

    it('should accept custom initial mode', () => {
      controller = new VisibilityController({ initialMode: 'fading' });
      expect(controller.getMode()).toBe('fading');
    });
  });

  describe('mode changes', () => {
    it('should change mode immediately when specified', () => {
      controller.setMode('fading', true);
      expect(controller.getMode()).toBe('fading');
      expect(controller.isTransitioning()).toBe(false);
    });

    it('should start transition when changing mode', () => {
      controller.setMode('fading', false);
      expect(controller.getTargetMode()).toBe('fading');
      expect(controller.isTransitioning()).toBe(true);
    });

    it('should cycle through modes', () => {
      expect(controller.getMode()).toBe('full');

      controller.cycleMode();
      controller.update(Date.now() + 1000); // Fast-forward transition
      expect(controller.getMode()).toBe('fading');

      controller.cycleMode();
      controller.update(Date.now() + 1000);
      expect(controller.getMode()).toBe('none');

      controller.cycleMode();
      controller.update(Date.now() + 1000);
      expect(controller.getMode()).toBe('full');
    });
  });

  describe('opacity calculations - full mode', () => {
    beforeEach(() => {
      controller.setMode('full', true);
    });

    it('should return full opacity for tiles at top', () => {
      const tile = createTestTile(1.0);
      expect(controller.getSpectrogramOpacity(tile)).toBe(1.0);
    });

    it('should return full opacity for tiles near hit zone', () => {
      const tile = createTestTile(0.1);
      expect(controller.getSpectrogramOpacity(tile)).toBe(1.0);
    });

    it('should respect tile base opacity', () => {
      const tile = createTestTile(0.5, 0.5);
      expect(controller.getSpectrogramOpacity(tile)).toBe(0.5);
    });
  });

  describe('opacity calculations - fading mode', () => {
    beforeEach(() => {
      controller = new VisibilityController({
        initialMode: 'fading',
        fadeStartY: 0.8,
        fadeEndY: 0.2,
        fadeMinOpacity: 0.3,
      });
    });

    it('should return full opacity above fade start', () => {
      const tile = createTestTile(0.9);
      expect(controller.getSpectrogramOpacity(tile)).toBe(1.0);
    });

    it('should return reduced opacity in fade zone', () => {
      const tile = createTestTile(0.5); // Middle of fade zone
      const opacity = controller.getSpectrogramOpacity(tile);
      expect(opacity).toBeGreaterThan(0.3);
      expect(opacity).toBeLessThan(1.0);
    });

    it('should return minimum opacity below fade end', () => {
      const tile = createTestTile(0.1);
      expect(controller.getSpectrogramOpacity(tile)).toBeCloseTo(0.3, 1);
    });
  });

  describe('opacity calculations - none mode', () => {
    beforeEach(() => {
      controller.setMode('none', true);
    });

    it('should return 0 opacity for spectrograms', () => {
      const tile = createTestTile(0.5);
      expect(controller.getSpectrogramOpacity(tile)).toBe(0);
    });

    it('should return label opacity if configured', () => {
      controller = new VisibilityController({
        initialMode: 'none',
        showLabelsInNoneMode: true,
        noneModeLabeOpacity: 0.8,
      });

      const tile = createTestTile(0.5);
      expect(controller.getLabelOpacity(tile)).toBe(0.8);
    });
  });

  describe('difficulty levels', () => {
    it('should report correct difficulty for full mode', () => {
      controller.setMode('full', true);
      expect(controller.getDifficulty()).toBe('easy');
    });

    it('should report correct difficulty for fading mode', () => {
      controller.setMode('fading', true);
      expect(controller.getDifficulty()).toBe('medium');
    });

    it('should report correct difficulty for none mode', () => {
      controller.setMode('none', true);
      expect(controller.getDifficulty()).toBe('hard');
    });
  });

  describe('difficulty adjustments', () => {
    it('should increase difficulty from full to fading', () => {
      controller.setMode('full', true);
      const newMode = controller.increaseDifficulty();
      expect(newMode).toBe('fading');
    });

    it('should increase difficulty from fading to none', () => {
      controller.setMode('fading', true);
      const newMode = controller.increaseDifficulty();
      expect(newMode).toBe('none');
    });

    it('should stay at none when increasing from none', () => {
      controller.setMode('none', true);
      const newMode = controller.increaseDifficulty();
      expect(newMode).toBe('none');
    });

    it('should decrease difficulty from none to fading', () => {
      controller.setMode('none', true);
      const newMode = controller.decreaseDifficulty();
      expect(newMode).toBe('fading');
    });
  });

  describe('visibility checks', () => {
    it('should report spectrograms visible in full mode', () => {
      controller.setMode('full', true);
      expect(controller.areSpectrogramsVisible()).toBe(true);
    });

    it('should report spectrograms visible in fading mode', () => {
      controller.setMode('fading', true);
      expect(controller.areSpectrogramsVisible()).toBe(true);
    });

    it('should report spectrograms not visible in none mode', () => {
      controller.setMode('none', true);
      expect(controller.areSpectrogramsVisible()).toBe(false);
    });
  });

  describe('listeners', () => {
    it('should notify listeners on mode change', () => {
      const callback = vi.fn();
      controller.addListener(callback);

      controller.setMode('fading', true);

      expect(callback).toHaveBeenCalledWith('fading');
    });

    it('should remove listeners', () => {
      const callback = vi.fn();
      controller.addListener(callback);
      controller.removeListener(callback);

      controller.setMode('fading', true);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset to initial mode', () => {
      controller = new VisibilityController({ initialMode: 'full' });
      controller.setMode('none', true);

      controller.reset();

      expect(controller.getMode()).toBe('full');
    });
  });
});

describe('VISIBILITY_MODE_INFO', () => {
  it('should define info for all modes', () => {
    expect(VISIBILITY_MODE_INFO.full).toBeDefined();
    expect(VISIBILITY_MODE_INFO.fading).toBeDefined();
    expect(VISIBILITY_MODE_INFO.none).toBeDefined();
  });

  it('should have labels for all modes', () => {
    expect(VISIBILITY_MODE_INFO.full.label).toBe('Full');
    expect(VISIBILITY_MODE_INFO.fading.label).toBe('Fading');
    expect(VISIBILITY_MODE_INFO.none.label).toBe('Audio Only');
  });

  it('should have difficulty levels for all modes', () => {
    expect(VISIBILITY_MODE_INFO.full.difficulty).toBe('easy');
    expect(VISIBILITY_MODE_INFO.fading.difficulty).toBe('medium');
    expect(VISIBILITY_MODE_INFO.none.difficulty).toBe('hard');
  });
});

describe('VisualSettings', () => {
  let settings: VisualSettings;

  beforeEach(() => {
    settings = new VisualSettings();
  });

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const state = settings.getState();
      expect(state.spectrogramMode).toBe('full');
      expect(state.scrollSpeedMultiplier).toBe(1.0);
      expect(state.hitZoneY).toBe(0.15);
    });

    it('should accept custom initial settings', () => {
      settings = new VisualSettings({
        initialMode: 'fading',
        initialScrollSpeed: 1.3,
        initialHitZoneY: 0.2,
      });

      const state = settings.getState();
      expect(state.spectrogramMode).toBe('fading');
      expect(state.scrollSpeedMultiplier).toBe(1.3);
      expect(state.hitZoneY).toBe(0.2);
    });
  });

  describe('visibility', () => {
    it('should toggle settings panel', () => {
      expect(settings.isVisible()).toBe(false);

      settings.open();
      expect(settings.isVisible()).toBe(true);

      settings.close();
      expect(settings.isVisible()).toBe(false);

      settings.toggle();
      expect(settings.isVisible()).toBe(true);
    });
  });

  describe('spectrogram mode', () => {
    it('should get current mode', () => {
      expect(settings.getSpectrogramMode()).toBe('full');
    });

    it('should set mode', () => {
      settings.setSpectrogramMode('fading');
      expect(settings.getSpectrogramMode()).toBe('fading');
    });

    it('should cycle modes', () => {
      expect(settings.cycleSpectrogramMode()).toBe('fading');
      expect(settings.cycleSpectrogramMode()).toBe('none');
      expect(settings.cycleSpectrogramMode()).toBe('full');
    });

    it('should provide mode options', () => {
      const modes = settings.getSpectrogramModes();
      expect(modes.length).toBe(3);
      expect(modes[0].mode).toBe('full');
      expect(modes[0].isSelected).toBe(true);
    });
  });

  describe('scroll speed', () => {
    it('should get current scroll speed', () => {
      expect(settings.getScrollSpeed()).toBe(1.0);
    });

    it('should set scroll speed', () => {
      settings.setScrollSpeed(1.5);
      expect(settings.getScrollSpeed()).toBe(1.5);
    });

    it('should clamp scroll speed to valid range', () => {
      settings.setScrollSpeed(0.1);
      expect(settings.getScrollSpeed()).toBe(0.5);

      settings.setScrollSpeed(3.0);
      expect(settings.getScrollSpeed()).toBe(2.0);
    });

    it('should set speed from preset', () => {
      settings.setScrollSpeedPreset('fast');
      expect(settings.getScrollSpeed()).toBe(SCROLL_SPEED_PRESETS.fast.value);
    });

    it('should provide speed presets', () => {
      const presets = settings.getScrollSpeedPresets();
      expect(presets.length).toBe(4);
      expect(presets.find((p) => p.key === 'normal')?.isSelected).toBe(true);
    });
  });

  describe('hit zone position', () => {
    it('should get current hit zone Y', () => {
      expect(settings.getHitZoneY()).toBe(0.15);
    });

    it('should set hit zone Y', () => {
      settings.setHitZoneY(0.2);
      expect(settings.getHitZoneY()).toBe(0.2);
    });

    it('should clamp hit zone Y to valid range', () => {
      settings.setHitZoneY(0.05);
      expect(settings.getHitZoneY()).toBe(0.1);

      settings.setHitZoneY(0.5);
      expect(settings.getHitZoneY()).toBe(0.3);
    });

    it('should set from preset', () => {
      settings.setHitZonePreset('high');
      expect(settings.getHitZoneY()).toBe(HIT_ZONE_PRESETS.high.value);
    });
  });

  describe('accessibility', () => {
    it('should toggle high contrast mode', () => {
      expect(settings.isHighContrastMode()).toBe(false);

      settings.toggleHighContrastMode();
      expect(settings.isHighContrastMode()).toBe(true);

      settings.setHighContrastMode(false);
      expect(settings.isHighContrastMode()).toBe(false);
    });

    it('should toggle reduced motion', () => {
      expect(settings.isReducedMotion()).toBe(false);

      settings.toggleReducedMotion();
      expect(settings.isReducedMotion()).toBe(true);
    });
  });

  describe('listeners', () => {
    it('should notify on settings change', () => {
      const callback = vi.fn();
      settings.addListener(callback);

      settings.setSpectrogramMode('fading');

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ spectrogramMode: 'fading' })
      );
    });

    it('should remove listeners', () => {
      const callback = vi.fn();
      settings.addListener(callback);
      settings.removeListener(callback);

      settings.setScrollSpeed(1.5);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('persistence', () => {
    it('should export settings', () => {
      settings.setSpectrogramMode('fading');
      settings.setScrollSpeed(1.3);

      const exported = settings.exportSettings();

      expect(exported.spectrogramMode).toBe('fading');
      expect(exported.scrollSpeedMultiplier).toBe(1.3);
    });

    it('should import settings', () => {
      settings.importSettings({
        spectrogramMode: 'none',
        scrollSpeedMultiplier: 1.5,
        highContrastMode: true,
      });

      expect(settings.getSpectrogramMode()).toBe('none');
      expect(settings.getScrollSpeed()).toBe(1.5);
      expect(settings.isHighContrastMode()).toBe(true);
    });
  });

  describe('reset', () => {
    it('should reset to initial settings', () => {
      settings.setSpectrogramMode('none');
      settings.setScrollSpeed(1.5);
      settings.setHighContrastMode(true);

      settings.reset();

      expect(settings.getSpectrogramMode()).toBe('full');
      expect(settings.getScrollSpeed()).toBe(1.0);
      expect(settings.isHighContrastMode()).toBe(false);
    });
  });

  describe('render data', () => {
    it('should provide render data', () => {
      const data = settings.getRenderData();

      expect(data.isOpen).toBe(false);
      expect(data.state).toBeDefined();
      expect(data.spectrogramModes.length).toBe(3);
      expect(data.scrollSpeedPresets.length).toBe(4);
      expect(data.hitZonePresets.length).toBe(3);
    });
  });

  describe('summary', () => {
    it('should provide settings summary', () => {
      const summary = settings.getSummary();
      expect(summary).toContain('Full');
      expect(summary).toContain('Normal');
    });
  });
});

describe('Phase M Smoke Tests', () => {
  it('Smoke 1: Full mode shows spectrograms at 100% opacity', () => {
    const controller = new VisibilityController({ initialMode: 'full' });

    const tile = createTestTile(0.5);
    const opacity = controller.getSpectrogramOpacity(tile);

    expect(opacity).toBe(1.0);
    expect(controller.areSpectrogramsVisible()).toBe(true);
  });

  it('Smoke 2: Fading mode reduces opacity as tiles approach', () => {
    const controller = new VisibilityController({
      initialMode: 'fading',
      fadeStartY: 0.8,
      fadeEndY: 0.2,
    });

    const tileTop = createTestTile(0.9);
    const tileMid = createTestTile(0.5);
    const tileBottom = createTestTile(0.1);

    const topOpacity = controller.getSpectrogramOpacity(tileTop);
    const midOpacity = controller.getSpectrogramOpacity(tileMid);
    const bottomOpacity = controller.getSpectrogramOpacity(tileBottom);

    // Top should have higher opacity than mid, mid higher than bottom
    expect(topOpacity).toBeGreaterThan(midOpacity);
    expect(midOpacity).toBeGreaterThan(bottomOpacity);
  });

  it('Smoke 3: None mode hides spectrograms completely', () => {
    const controller = new VisibilityController({ initialMode: 'none' });

    const tile = createTestTile(0.5);
    const opacity = controller.getSpectrogramOpacity(tile);

    expect(opacity).toBe(0);
    expect(controller.areSpectrogramsVisible()).toBe(false);
  });

  it('Smoke 4: VisualSettings allows mode selection', () => {
    const settings = new VisualSettings();
    const callback = vi.fn();
    settings.addListener(callback);

    // Select each mode
    settings.setSpectrogramMode('full');
    expect(settings.getSpectrogramMode()).toBe('full');

    settings.setSpectrogramMode('fading');
    expect(settings.getSpectrogramMode()).toBe('fading');

    settings.setSpectrogramMode('none');
    expect(settings.getSpectrogramMode()).toBe('none');

    // Callback should have been called at least once for each change
    expect(callback).toHaveBeenCalled();
    expect(callback.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('Smoke 5: Difficulty maps correctly to modes', () => {
    const controller = new VisibilityController();

    controller.setMode('full', true);
    expect(controller.getDifficulty()).toBe('easy');
    expect(controller.isEasiestMode()).toBe(true);

    controller.setMode('fading', true);
    expect(controller.getDifficulty()).toBe('medium');

    controller.setMode('none', true);
    expect(controller.getDifficulty()).toBe('hard');
    expect(controller.isHardestMode()).toBe(true);
  });

  it('Smoke 6: Settings persist through export/import', () => {
    const settings = new VisualSettings();

    // Configure custom settings
    settings.setSpectrogramMode('fading');
    settings.setScrollSpeed(1.3);
    settings.setHitZoneY(0.2);
    settings.setHighContrastMode(true);

    // Export
    const exported = settings.exportSettings();

    // Create new instance and import
    const settings2 = new VisualSettings();
    settings2.importSettings(exported);

    // Verify
    expect(settings2.getSpectrogramMode()).toBe('fading');
    expect(settings2.getScrollSpeed()).toBe(1.3);
    expect(settings2.getHitZoneY()).toBe(0.2);
    expect(settings2.isHighContrastMode()).toBe(true);
  });
});
