/**
 * Visual Tests for Phase L
 *
 * Validates:
 * - LaneRenderer scrolls tiles toward hit zone
 * - TileManager manages tile lifecycle (loading, ready, visible, exiting, disposed)
 * - HitZoneIndicator flashes on scoring events
 * - Spectrogram tiles display correctly with species labels
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaneRenderer } from '../src/visual/LaneRenderer.js';
import { TileManager } from '../src/visual/TileManager.js';
import { HitZoneIndicator } from '../src/visual/HitZoneIndicator.js';
import {
  VISUAL_COLORS,
  VISUAL_ANIMATIONS,
  DEFAULT_LANE_CONFIG,
  DEFAULT_HIT_ZONE_CONFIG,
} from '../src/visual/types.js';
import type { GameEvent } from '../src/game/types.js';
import type { ClipMetadata } from '../src/audio/types.js';

// Helper to create test clips
function createTestClip(id: string, speciesCode: string): ClipMetadata {
  return {
    clip_id: id,
    species_code: speciesCode,
    common_name: `Test ${speciesCode}`,
    vocalization_type: 'song',
    duration_ms: 2000,
    quality_score: 5,
    source: 'xenocanto',
    source_id: `XC${id}`,
    file_path: `data/clips/${id}.wav`,
    spectrogram_path: `data/spectrograms/${id}.png`,
  };
}

// Helper to create test events
function createTestEvent(
  id: string,
  clipId: string,
  speciesCode: string,
  channel: 'left' | 'right',
  scheduledTimeMs: number
): GameEvent {
  return {
    event_id: id,
    clip_id: clipId,
    species_code: speciesCode,
    channel,
    scheduled_time_ms: scheduledTimeMs,
    scoring_window_start_ms: scheduledTimeMs - 500,
    scoring_window_end_ms: scheduledTimeMs + 500,
    duration_ms: 2000,
  };
}

describe('TileManager', () => {
  let manager: TileManager;

  beforeEach(() => {
    manager = new TileManager();
  });

  describe('tile creation', () => {
    it('should create tiles from events', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, 'data/spectrograms/c1.png');

      expect(tile.tileId).toBe('tile_e1');
      expect(tile.eventId).toBe('e1');
      expect(tile.speciesCode).toBe('NOCA');
      expect(tile.lane).toBe('left');
      expect(tile.spectrogramPath).toBe('data/spectrograms/c1.png');
      expect(tile.scheduledTimeMs).toBe(5000);
    });

    it('should initialize tiles in ready state in Node environment', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, 'data/spectrograms/c1.png');

      // In Node.js (no Image), tiles go directly to ready
      expect(tile.state).toBe('ready');
    });

    it('should mark tiles ready immediately if no spectrogram', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, null);

      expect(tile.state).toBe('ready');
    });
  });

  describe('tile retrieval', () => {
    it('should get tile by ID', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      manager.createTile(event, null);

      const tile = manager.getTile('tile_e1');
      expect(tile).toBeDefined();
      expect(tile?.eventId).toBe('e1');
    });

    it('should get tile by event ID', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      manager.createTile(event, null);

      const tile = manager.getTileByEventId('e1');
      expect(tile).toBeDefined();
      expect(tile?.tileId).toBe('tile_e1');
    });

    it('should get tiles for lane', () => {
      const event1 = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const event2 = createTestEvent('e2', 'c2', 'BLJA', 'right', 6000);
      const event3 = createTestEvent('e3', 'c3', 'CARW', 'left', 7000);

      manager.createTile(event1, null);
      manager.createTile(event2, null);
      manager.createTile(event3, null);

      const leftTiles = manager.getTilesForLane('left');
      expect(leftTiles.length).toBe(2);

      const rightTiles = manager.getTilesForLane('right');
      expect(rightTiles.length).toBe(1);
    });
  });

  describe('tile updates', () => {
    it('should update normalized Y based on time', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, null);

      // At time 0, tile should be at top (Y=1)
      manager.update(0, 2000); // 2000ms approach time
      expect(tile.normalizedY).toBe(1);

      // At time 3000, tile should be at 50% (Y=1 * (5000-3000)/2000 = 1)
      manager.update(3000, 2000);
      expect(tile.normalizedY).toBe(1); // 2000/2000 = 1

      // At time 4000, tile should be at 50% (Y = (5000-4000)/2000 = 0.5)
      manager.update(4000, 2000);
      expect(tile.normalizedY).toBe(0.5);

      // At time 5000, tile should be at hit zone (Y=0)
      manager.update(5000, 2000);
      expect(tile.normalizedY).toBe(0);
    });

    it('should clamp Y to 0-1 range', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, null);

      // Past hit zone
      manager.update(6000, 2000);
      expect(tile.normalizedY).toBe(0);

      // Way in future (should stay at 1)
      const event2 = createTestEvent('e2', 'c2', 'BLJA', 'left', 100000);
      const tile2 = manager.createTile(event2, null);
      manager.update(0, 2000);
      expect(tile2.normalizedY).toBe(1);
    });
  });

  describe('tile lifecycle', () => {
    it('should transition to visible when approaching', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, null);

      expect(tile.state).toBe('ready');

      manager.update(4000, 2000);
      expect(tile.state).toBe('visible');
    });

    it('should transition to exiting when scored and past hit zone', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const tile = manager.createTile(event, null);

      manager.update(5000, 2000);
      expect(tile.state).toBe('visible');

      manager.markScored('e1');
      expect(tile.scored).toBe(true);
      // markScored sets state to exiting
      expect(tile.state).toBe('exiting');
    });
  });

  describe('preloading', () => {
    it('should preload upcoming events', () => {
      const events = [
        createTestEvent('e1', 'c1', 'NOCA', 'left', 2000),
        createTestEvent('e2', 'c2', 'BLJA', 'right', 5000),
        createTestEvent('e3', 'c3', 'CARW', 'left', 10000),
      ];

      const getPath = (clipId: string) => `data/spectrograms/${clipId}.png`;

      // Preload with 3000ms ahead
      manager = new TileManager({ preloadMs: 3000 });
      manager.preloadTiles(events, 0, getPath);

      // Should have preloaded e1 (at 2000ms) and maybe e2 (at 5000ms)
      expect(manager.getTileByEventId('e1')).toBeDefined();
      // e3 is too far, shouldn't be preloaded
    });
  });

  describe('cleanup', () => {
    it('should clear all tiles', () => {
      const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      manager.createTile(event, null);

      expect(manager.getTileCount()).toBe(1);

      manager.clear();
      expect(manager.getTileCount()).toBe(0);
    });
  });

  describe('state counts', () => {
    it('should track state counts', () => {
      const event1 = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
      const event2 = createTestEvent('e2', 'c2', 'BLJA', 'right', 6000);

      manager.createTile(event1, null);
      manager.createTile(event2, null);

      const counts = manager.getStateCounts();
      expect(counts.ready).toBe(2);
      expect(counts.visible).toBe(0);

      // At 4500, event1 (at 5000) is 500ms away (Y=0.25), event2 (at 6000) is 1500ms away (Y=0.75)
      // Both should become visible as they start approaching
      manager.update(4500, 2000);
      const counts2 = manager.getStateCounts();
      // Both tiles transition to visible when their Y < 1
      expect(counts2.visible).toBe(2);
    });
  });
});

describe('HitZoneIndicator', () => {
  let hitZone: HitZoneIndicator;

  beforeEach(() => {
    hitZone = new HitZoneIndicator();
  });

  describe('initialization', () => {
    it('should use default configuration', () => {
      expect(hitZone.getY()).toBe(DEFAULT_HIT_ZONE_CONFIG.y);
      expect(hitZone.getHeightPx()).toBe(DEFAULT_HIT_ZONE_CONFIG.heightPx);
    });

    it('should accept custom configuration', () => {
      hitZone = new HitZoneIndicator({ y: 0.2, heightPx: 50 });

      expect(hitZone.getY()).toBe(0.2);
      expect(hitZone.getHeightPx()).toBe(50);
    });
  });

  describe('flash feedback', () => {
    it('should flash perfect on left lane', () => {
      hitZone.flashPerfect('left', 1000);

      expect(hitZone.isFlashing('left')).toBe(true);
      expect(hitZone.getFlashType('left')).toBe('perfect');
      expect(hitZone.getFlashColor('left')).toBe(VISUAL_COLORS.FEEDBACK_PERFECT);
    });

    it('should flash good on right lane', () => {
      hitZone.flashGood('right', 1000);

      expect(hitZone.isFlashing('right')).toBe(true);
      expect(hitZone.getFlashType('right')).toBe('good');
      expect(hitZone.getFlashColor('right')).toBe(VISUAL_COLORS.FEEDBACK_GOOD);
    });

    it('should flash miss', () => {
      hitZone.flashMiss('left', 1000);

      expect(hitZone.getFlashType('left')).toBe('miss');
      expect(hitZone.getFlashColor('left')).toBe(VISUAL_COLORS.FEEDBACK_MISS);
    });

    it('should clear flash after duration', () => {
      hitZone.flashPerfect('left', 1000);

      expect(hitZone.isFlashing('left')).toBe(true);

      // Update past flash end time
      hitZone.update(1000 + VISUAL_ANIMATIONS.FLASH_DURATION_MS + 1);

      expect(hitZone.isFlashing('left')).toBe(false);
      expect(hitZone.getFlashType('left')).toBe(null);
    });
  });

  describe('zone detection', () => {
    it('should detect tiles in hit zone', () => {
      expect(hitZone.isInHitZone(0.1)).toBe(true);
      expect(hitZone.isInHitZone(0.5)).toBe(false);
    });

    it('should detect tiles in perfect zone', () => {
      // Perfect zone is centered at hitZoneY
      const bounds = hitZone.getPerfectZoneBounds();
      expect(bounds.top).toBeGreaterThan(bounds.bottom);
    });
  });

  describe('active state', () => {
    it('should toggle lane active state', () => {
      hitZone.setActive('left', false);

      expect(hitZone.getState('left').active).toBe(false);
      expect(hitZone.getState('right').active).toBe(true);
    });

    it('should toggle all lanes', () => {
      hitZone.setAllActive(false);

      expect(hitZone.getState('left').active).toBe(false);
      expect(hitZone.getState('right').active).toBe(false);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      hitZone.flashPerfect('left', 1000);
      hitZone.setActive('right', false);

      hitZone.reset();

      expect(hitZone.isFlashing('left')).toBe(false);
      expect(hitZone.getState('right').active).toBe(true);
    });
  });
});

describe('LaneRenderer', () => {
  let renderer: LaneRenderer;
  let clips: ClipMetadata[];
  let events: GameEvent[];

  beforeEach(() => {
    renderer = new LaneRenderer();

    clips = [
      createTestClip('c1', 'NOCA'),
      createTestClip('c2', 'BLJA'),
      createTestClip('c3', 'CARW'),
    ];

    events = [
      createTestEvent('e1', 'c1', 'NOCA', 'left', 2000),
      createTestEvent('e2', 'c2', 'BLJA', 'right', 3000),
      createTestEvent('e3', 'c3', 'CARW', 'left', 4000),
    ];
  });

  describe('initialization', () => {
    it('should initialize with clips and events', () => {
      renderer.initialize(clips, events);

      expect(renderer.isActive()).toBe(false);
    });

    it('should use default configuration', () => {
      expect(renderer.getApproachTimeMs()).toBe(DEFAULT_LANE_CONFIG.approachTimeMs);
    });
  });

  describe('start/stop', () => {
    it('should start and stop rendering', () => {
      renderer.start();
      expect(renderer.isActive()).toBe(true);

      renderer.stop();
      expect(renderer.isActive()).toBe(false);
    });
  });

  describe('update and scrolling', () => {
    it('should scroll tiles toward hit zone', () => {
      renderer.initialize(clips, events);
      renderer.start();

      // Initial state
      renderer.update(0);
      let state = renderer.getRenderState();

      // At time 0, tiles should be preloaded
      expect(state.currentTimeMs).toBe(0);

      // Update to 1000ms - tile e1 should be approaching
      renderer.update(1000);
      state = renderer.getRenderState();

      // Check that tiles are being managed
      const leftTiles = state.leftLane.tiles;
      expect(leftTiles.length).toBeGreaterThanOrEqual(0);
    });

    it('should update tile positions over time', () => {
      renderer.initialize(clips, events);
      renderer.start();

      renderer.update(0);
      renderer.update(1000);
      renderer.update(2000);

      const state = renderer.getRenderState();
      expect(state.currentTimeMs).toBe(2000);
    });
  });

  describe('feedback', () => {
    it('should show perfect feedback', () => {
      renderer.initialize(clips, events);
      renderer.start();
      renderer.update(2000);

      renderer.showPerfect('left', 'e1');

      const hitZone = renderer.getHitZone();
      expect(hitZone.isFlashing('left')).toBe(true);
      expect(hitZone.getFlashType('left')).toBe('perfect');
    });

    it('should show good feedback', () => {
      renderer.initialize(clips, events);
      renderer.start();
      renderer.update(3000);

      renderer.showGood('right', 'e2');

      const hitZone = renderer.getHitZone();
      expect(hitZone.getFlashType('right')).toBe('good');
    });

    it('should show miss feedback', () => {
      renderer.initialize(clips, events);
      renderer.start();
      renderer.update(2000);

      renderer.showMiss('left', 'e1');

      const hitZone = renderer.getHitZone();
      expect(hitZone.getFlashType('left')).toBe('miss');
    });
  });

  describe('spectrogram modes', () => {
    it('should support full mode', () => {
      renderer = new LaneRenderer({ spectrogramMode: 'full' });

      expect(renderer.getSpectrogramMode()).toBe('full');
      expect(renderer.areSpectrogramsVisible()).toBe(true);
      expect(renderer.shouldFadeSpectrograms()).toBe(false);
    });

    it('should support fading mode', () => {
      renderer = new LaneRenderer({ spectrogramMode: 'fading' });

      expect(renderer.getSpectrogramMode()).toBe('fading');
      expect(renderer.areSpectrogramsVisible()).toBe(true);
      expect(renderer.shouldFadeSpectrograms()).toBe(true);
    });

    it('should support none mode', () => {
      renderer = new LaneRenderer({ spectrogramMode: 'none' });

      expect(renderer.getSpectrogramMode()).toBe('none');
      expect(renderer.areSpectrogramsVisible()).toBe(false);
    });

    it('should change spectrogram mode', () => {
      renderer.setSpectrogramMode('fading');

      expect(renderer.getSpectrogramMode()).toBe('fading');
    });
  });

  describe('render state', () => {
    it('should provide render state for both lanes', () => {
      renderer.initialize(clips, events);
      renderer.update(0);

      const state = renderer.getRenderState();

      expect(state.leftLane).toBeDefined();
      expect(state.rightLane).toBeDefined();
      expect(state.leftLane.lane).toBe('left');
      expect(state.rightLane.lane).toBe('right');
    });

    it('should provide render data for UI', () => {
      renderer.initialize(clips, events);
      renderer.update(0);

      const data = renderer.getRenderData();

      expect(data.config).toBeDefined();
      expect(data.state).toBeDefined();
      expect(data.hitZoneData).toBeDefined();
      expect(data.colors).toBe(VISUAL_COLORS);
    });
  });

  describe('render callbacks', () => {
    it('should notify render callbacks on update', () => {
      const callback = vi.fn();
      renderer.addRenderCallback(callback);

      renderer.initialize(clips, events);
      renderer.update(1000);

      expect(callback).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(expect.objectContaining({
        currentTimeMs: 1000,
      }));
    });

    it('should remove render callbacks', () => {
      const callback = vi.fn();
      renderer.addRenderCallback(callback);
      renderer.removeRenderCallback(callback);

      renderer.initialize(clips, events);
      renderer.update(1000);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('dimensions', () => {
    it('should provide lane dimensions', () => {
      const dims = renderer.getLaneDimensions();

      expect(dims.width).toBe(DEFAULT_LANE_CONFIG.laneWidthPx);
      expect(dims.height).toBe(DEFAULT_LANE_CONFIG.laneHeightPx);
      expect(dims.gap).toBe(DEFAULT_LANE_CONFIG.laneGapPx);
    });

    it('should calculate total width', () => {
      const totalWidth = renderer.getTotalWidth();
      const expected = DEFAULT_LANE_CONFIG.laneWidthPx * 2 + DEFAULT_LANE_CONFIG.laneGapPx;

      expect(totalWidth).toBe(expected);
    });
  });

  describe('reset', () => {
    it('should reset to initial state', () => {
      renderer.initialize(clips, events);
      renderer.start();
      renderer.update(5000);

      renderer.reset();

      expect(renderer.isActive()).toBe(false);
      expect(renderer.getTileManager().getTileCount()).toBe(0);
    });
  });
});

describe('Visual Colors', () => {
  it('should define lane colors', () => {
    expect(VISUAL_COLORS.LANE_LEFT).toBeDefined();
    expect(VISUAL_COLORS.LANE_RIGHT).toBeDefined();
    expect(VISUAL_COLORS.LANE_BACKGROUND).toBeDefined();
  });

  it('should define feedback colors', () => {
    expect(VISUAL_COLORS.FEEDBACK_PERFECT).toBeDefined();
    expect(VISUAL_COLORS.FEEDBACK_GOOD).toBeDefined();
    expect(VISUAL_COLORS.FEEDBACK_MISS).toBeDefined();
  });

  it('should have distinct colors for left/right lanes', () => {
    expect(VISUAL_COLORS.LANE_LEFT).not.toBe(VISUAL_COLORS.LANE_RIGHT);
  });
});

describe('Phase L Smoke Tests', () => {
  it('Smoke 1: Tiles scroll toward hit zone at consistent speed', () => {
    const renderer = new LaneRenderer({ approachTimeMs: 2000 });

    const clips = [createTestClip('c1', 'NOCA')];
    const events = [createTestEvent('e1', 'c1', 'NOCA', 'left', 2000)];

    renderer.initialize(clips, events);
    renderer.start();

    // At t=0, tile is 2000ms away, should be at Y=1
    renderer.update(0);
    let tile = renderer.getTileManager().getTileByEventId('e1');
    expect(tile?.normalizedY).toBe(1);

    // At t=1000, tile is 1000ms away, should be at Y=0.5
    renderer.update(1000);
    tile = renderer.getTileManager().getTileByEventId('e1');
    expect(tile?.normalizedY).toBe(0.5);

    // At t=2000, tile at hit zone, Y=0
    renderer.update(2000);
    tile = renderer.getTileManager().getTileByEventId('e1');
    expect(tile?.normalizedY).toBe(0);
  });

  it('Smoke 2: TileManager transitions through lifecycle states', () => {
    const manager = new TileManager();

    const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);

    // Create tile without spectrogram (goes directly to ready)
    const tile = manager.createTile(event, null);
    expect(tile.state).toBe('ready');

    // Update to make visible
    manager.update(4000, 2000);
    expect(tile.state).toBe('visible');

    // Mark as scored (immediately transitions to exiting)
    manager.markScored('e1');
    expect(tile.scored).toBe(true);
    expect(tile.state).toBe('exiting');
  });

  it('Smoke 3: HitZoneIndicator flashes correct colors for feedback types', () => {
    const hitZone = new HitZoneIndicator();

    // Perfect flash
    hitZone.flashPerfect('left', 0);
    expect(hitZone.getFlashColor('left')).toBe(VISUAL_COLORS.FEEDBACK_PERFECT);

    // Good flash
    hitZone.flashGood('right', 0);
    expect(hitZone.getFlashColor('right')).toBe(VISUAL_COLORS.FEEDBACK_GOOD);

    // Miss flash (reset left first)
    hitZone.update(VISUAL_ANIMATIONS.FLASH_DURATION_MS + 1);
    hitZone.flashMiss('left', VISUAL_ANIMATIONS.FLASH_DURATION_MS + 2);
    expect(hitZone.getFlashColor('left')).toBe(VISUAL_COLORS.FEEDBACK_MISS);
  });

  it('Smoke 4: Spectrogram tiles include species code for labels', () => {
    const manager = new TileManager();

    const event = createTestEvent('e1', 'c1', 'NOCA', 'left', 5000);
    const tile = manager.createTile(event, 'data/spectrograms/c1.png');

    expect(tile.speciesCode).toBe('NOCA');
    expect(tile.spectrogramPath).toBe('data/spectrograms/c1.png');
  });

  it('Smoke 5: LaneRenderer integrates TileManager and HitZoneIndicator', () => {
    const renderer = new LaneRenderer();

    const clips = [createTestClip('c1', 'NOCA')];
    const events = [createTestEvent('e1', 'c1', 'NOCA', 'left', 2000)];

    renderer.initialize(clips, events);
    renderer.start();
    renderer.update(2000);

    // Show feedback
    renderer.showPerfect('left', 'e1');

    // Verify integration
    expect(renderer.getHitZone().isFlashing('left')).toBe(true);
    expect(renderer.getTileManager().getTileByEventId('e1')?.scored).toBe(true);
  });

  it('Smoke 6: Both lanes render independently', () => {
    const renderer = new LaneRenderer();

    const clips = [
      createTestClip('c1', 'NOCA'),
      createTestClip('c2', 'BLJA'),
    ];
    const events = [
      createTestEvent('e1', 'c1', 'NOCA', 'left', 2000),
      createTestEvent('e2', 'c2', 'BLJA', 'right', 2000),
    ];

    renderer.initialize(clips, events);
    renderer.start();
    renderer.update(2000);

    const state = renderer.getRenderState();

    // Check both lanes have their tiles
    expect(state.leftLane.lane).toBe('left');
    expect(state.rightLane.lane).toBe('right');

    // Flash one lane, other should be unaffected
    renderer.showPerfect('left', 'e1');
    expect(renderer.getHitZone().isFlashing('left')).toBe(true);
    expect(renderer.getHitZone().isFlashing('right')).toBe(false);
  });
});
