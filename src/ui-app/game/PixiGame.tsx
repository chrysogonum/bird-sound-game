import { useEffect, useRef, useCallback, memo } from 'react';
import * as PIXI from 'pixi.js';
import type { ScheduledEvent, ActiveEvent, FeedbackData } from './useGameEngine';
import type { RoundState } from '@engine/game/types';

export interface PixiGameProps {
  width: number;
  height: number;
  scheduledEvents: ScheduledEvent[];
  activeEvents: ActiveEvent[];
  roundStartTime: number;
  roundState: RoundState;
  scrollSpeed: number;
  currentFeedback: FeedbackData | null;
  onChannelTap?: (channel: 'left' | 'right') => void;
  trainingMode?: boolean;
  spectrogramMode?: 'full' | 'fading' | 'none';
  highContrast?: boolean;
}

// Colors from design system
const COLORS = {
  background: 0x1a1a2e,
  surface: 0x2d2d44,
  accent: 0xf5a623,
  hitZone: 0xf5a623,
  laneLeft: 0x2d5a27,
  laneRight: 0x4a90d9,
  text: 0xffffff,
  textMuted: 0xa0a0b0,
  perfect: 0x4caf50,
  good: 0x4caf50,
  partial: 0xf5a623,
  miss: 0xe57373,
};

// Tile dimensions
const TILE_WIDTH_RATIO = 0.72; // Ratio of lane width (was 0.55)
const TILE_HEIGHT = 85; // (was 70)
const HIT_ZONE_Y_RATIO = 0.82; // 82% from top

interface TileState {
  container: PIXI.Container;
  eventId: string;
  scheduledTimeMs: number;
  enterTimeMs: number; // When tile should be at top of screen
  channel: 'left' | 'right';
  speciesCode: string;
  hasBeenScored: boolean;
  feedbackType: string | null;
  feedbackStartTime: number;
  spectrogramPath: string | null;
}

// Cache for loaded spectrogram textures
const textureCache = new Map<string, PIXI.Texture>();

function PixiGame({
  width,
  height,
  scheduledEvents,
  activeEvents,
  roundStartTime,
  roundState,
  scrollSpeed,
  currentFeedback,
  onChannelTap,
  trainingMode = false,
  spectrogramMode = 'full',
  highContrast = false,
}: PixiGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const tilesRef = useRef<Map<string, TileState>>(new Map());
  const tileContainerRef = useRef<PIXI.Container | null>(null);

  const handleTap = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!onChannelTap || !containerRef.current) return;

      let clientX: number;
      if ('touches' in e) {
        clientX = e.touches[0]?.clientX ?? 0;
      } else {
        clientX = e.clientX;
      }

      const rect = containerRef.current.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const centerX = rect.width / 2;

      // Dead zone in center (10% of width)
      const deadZoneWidth = rect.width * 0.1;
      if (Math.abs(relativeX - centerX) < deadZoneWidth / 2) {
        return;
      }

      const channel = relativeX < centerX ? 'left' : 'right';
      onChannelTap(channel);
    },
    [onChannelTap]
  );

  // Initialize PixiJS app
  useEffect(() => {
    if (!containerRef.current) return;

    const app = new PIXI.Application({
      width,
      height,
      backgroundColor: COLORS.background,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    containerRef.current.appendChild(app.view as HTMLCanvasElement);
    appRef.current = app;

    // Create static elements
    createLanes(app, width, height);
    createHitZones(app, width, height);
    createCenterDivider(app, width, height);

    // Create container for tiles
    const tileContainer = new PIXI.Container();
    app.stage.addChild(tileContainer);
    tileContainerRef.current = tileContainer;

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
      tilesRef.current.clear();
    };
  }, [width, height]);

  // Update on resize
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.resize(width, height);

      // Recreate static elements
      const app = appRef.current;
      // Remove all except tile container
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }

      createLanes(app, width, height);
      createHitZones(app, width, height);
      createCenterDivider(app, width, height);

      const tileContainer = new PIXI.Container();
      app.stage.addChild(tileContainer);
      tileContainerRef.current = tileContainer;

      // Recreate tiles
      tilesRef.current.clear();
    }
  }, [width, height]);

  // Add tiles for NEW scheduled events (don't recreate existing ones)
  useEffect(() => {
    const tileContainer = tileContainerRef.current;
    if (!tileContainer) return;

    if (roundState !== 'playing') {
      // Clear all tiles when not playing
      tileContainer.removeChildren();
      tilesRef.current.clear();
      return;
    }

    if (scheduledEvents.length === 0) return;

    const laneWidth = width / 2;
    const tileWidth = laneWidth * TILE_WIDTH_RATIO;
    const hitZoneY = height * HIT_ZONE_Y_RATIO;

    // Only create tiles for events that don't already have one
    for (const event of scheduledEvents) {
      if (tilesRef.current.has(event.event_id)) {
        continue; // Already has a tile, skip
      }

      const tile = createTile(
        event,
        laneWidth,
        tileWidth,
        TILE_HEIGHT,
        hitZoneY,
        event.spectrogramPath,
        trainingMode,
        spectrogramMode,
        highContrast
      );

      // Set initial Y position immediately (tile enters at top)
      tile.container.y = -TILE_HEIGHT;

      tileContainer.addChild(tile.container);
      tilesRef.current.set(event.event_id, tile);
    }
  }, [scheduledEvents, roundState, width, height, trainingMode, spectrogramMode, highContrast]);

  // Animation loop
  useEffect(() => {
    if (roundState !== 'playing' || !appRef.current) return;

    const hitZoneY = height * HIT_ZONE_Y_RATIO;
    let animationId: number;

    const animate = () => {
      const currentTime = performance.now();
      const elapsedMs = currentTime - roundStartTime;

      // Update each tile's position
      for (const tile of tilesRef.current.values()) {
        if (tile.hasBeenScored && tile.feedbackType) {
          // Animate feedback
          const feedbackElapsed = currentTime - tile.feedbackStartTime;
          if (feedbackElapsed > 500) {
            // Fade out and remove
            tile.container.alpha = Math.max(0, 1 - (feedbackElapsed - 500) / 200);
            if (tile.container.alpha <= 0) {
              tile.container.visible = false;
            }
          }
        } else {
          // Calculate Y position based on progress from enter to hit zone
          // Tile enters at enterTimeMs (y = -TILE_HEIGHT, above screen)
          // Tile hits zone at scheduledTimeMs (y = hitZoneY)
          const totalTravelTime = tile.scheduledTimeMs - tile.enterTimeMs;
          const timeSinceEnter = elapsedMs - tile.enterTimeMs;
          const progress = Math.max(0, timeSinceEnter / totalTravelTime);

          // Start above screen, end at hit zone
          const startY = -TILE_HEIGHT;
          const endY = hitZoneY;
          tile.container.y = startY + progress * (endY - startY);

          // Fading mode: fade out spectrogram as tile approaches hit zone
          if (spectrogramMode === 'fading') {
            const spectrogramSprite = tile.container.getChildByName('spectrogram') as PIXI.Sprite | null;
            if (spectrogramSprite) {
              // Start fading at 30% progress, fully faded by 80%
              if (progress < 0.3) {
                spectrogramSprite.alpha = 1;
              } else if (progress < 0.8) {
                spectrogramSprite.alpha = 1 - (progress - 0.3) / 0.5;
              } else {
                spectrogramSprite.alpha = 0;
              }
            }
          }

          // Hide if past hit zone by too much
          if (tile.container.y > hitZoneY + 100) {
            tile.container.alpha = Math.max(0, 1 - (tile.container.y - hitZoneY - 100) / 50);
          }
        }
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [roundState, roundStartTime, height, scrollSpeed, spectrogramMode]);

  // Handle feedback - update tiles when scored
  useEffect(() => {
    if (!currentFeedback) return;

    // Find the tile that was just scored
    // Look for active events that match the feedback channel
    for (const activeEvent of activeEvents) {
      if (activeEvent.hasBeenScored && activeEvent.channel === currentFeedback.channel) {
        const tile = tilesRef.current.get(activeEvent.event_id);
        if (tile && !tile.feedbackType) {
          tile.hasBeenScored = true;
          tile.feedbackType = currentFeedback.type;
          tile.feedbackStartTime = performance.now();

          // Species correctly identified: Quick flash and immediate removal
          // This includes perfect, good, and partial where species was right
          const speciesCorrect = currentFeedback.breakdown?.speciesCorrect;
          if (speciesCorrect) {
            // Success flash with score display
            updateTileFeedback(tile, currentFeedback.type, currentFeedback.score);
            // Scale up briefly then hide - give player time to see score
            tile.container.scale.set(1.3);
            setTimeout(() => {
              tile.container.visible = false;
            }, 400); // Long enough to see score at high speeds
          } else {
            // Species wrong: Show feedback animation (slower fade)
            updateTileFeedback(tile, currentFeedback.type, currentFeedback.score);
          }
        }
      }
    }
  }, [currentFeedback, activeEvents]);

  return (
    <div
      ref={containerRef}
      className="pixi-game-container"
      onClick={handleTap}
      onTouchStart={handleTap}
      style={{
        width: '100%',
        height: '100%',
        touchAction: 'none',
        userSelect: 'none',
      }}
    />
  );
}

function createTile(
  event: ScheduledEvent,
  laneWidth: number,
  tileWidth: number,
  tileHeight: number,
  _hitZoneY: number,
  spectrogramPath: string | null,
  trainingMode: boolean = false,
  spectrogramMode: 'full' | 'fading' | 'none' = 'full',
  highContrast: boolean = false
): TileState {
  const container = new PIXI.Container();

  // Position at lane center
  const x = event.channel === 'left' ? laneWidth / 2 : laneWidth + laneWidth / 2;
  container.x = x;

  // Background color based on channel
  const bgColor = event.channel === 'left' ? COLORS.laneLeft : COLORS.laneRight;

  // Tile background - higher opacity and thicker border in high contrast mode
  const background = new PIXI.Graphics();
  const bgAlpha = highContrast ? 0.7 : 0.4;
  const borderWidth = highContrast ? 4 : 2;
  const borderAlpha = highContrast ? 1.0 : 0.8;
  background.beginFill(bgColor, bgAlpha);
  background.lineStyle(borderWidth, bgColor, borderAlpha);
  background.drawRoundedRect(-tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight, 8);
  background.endFill();
  container.addChild(background);

  let spectrogramSprite: PIXI.Sprite | null = null;

  // Show spectrogram based on mode
  const showSpectrogram = spectrogramMode !== 'none' && spectrogramPath;

  if (showSpectrogram) {
    // Check cache first
    let texture = textureCache.get(spectrogramPath);
    if (!texture) {
      // Load texture (async but we'll add it when ready)
      texture = PIXI.Texture.from(`${import.meta.env.BASE_URL}${spectrogramPath}`);
      textureCache.set(spectrogramPath, texture);
    }

    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.position.set(0, 0);
    // Scale to fit within tile with some padding
    const maxWidth = tileWidth - 16;
    const maxHeight = tileHeight - 16;
    sprite.width = maxWidth;
    sprite.height = maxHeight;
    sprite.name = 'spectrogram'; // Name it so we can find it later for fading
    container.addChild(sprite);
    spectrogramSprite = sprite;
  } else {
    // No spectrogram: show placeholder lines
    const lines = new PIXI.Graphics();
    for (let i = 0; i < 6; i++) {
      const lineY = -tileHeight / 2 + 10 + i * 10;
      const lineW = (Math.random() * 0.4 + 0.4) * tileWidth;
      const lineX = -lineW / 2 + (Math.random() - 0.5) * 20;
      lines.beginFill(0xffffff, 0.2 + Math.random() * 0.2);
      lines.drawRect(lineX, lineY, lineW, 2);
      lines.endFill();
    }
    container.addChild(lines);

    // Question mark to indicate "identify me!"
    const questionStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 18,
      fill: 0xffffff,
      fontWeight: '700',
    });

    const question = new PIXI.Text('?', questionStyle);
    question.anchor.set(0.5);
    question.position.set(0, 0);
    question.alpha = 0.4;
    container.addChild(question);
  }

  // Training mode: show bird icon and code
  if (trainingMode) {
    // Load bird icon
    const iconPath = `${import.meta.env.BASE_URL}data/icons/${event.species_code}.png`;
    let iconTexture = textureCache.get(iconPath);
    if (!iconTexture) {
      iconTexture = PIXI.Texture.from(iconPath);
      textureCache.set(iconPath, iconTexture);
    }

    const iconSprite = new PIXI.Sprite(iconTexture);
    iconSprite.anchor.set(0.5);
    iconSprite.width = 32;
    iconSprite.height = 32;
    iconSprite.position.set(tileWidth / 2 - 20, -tileHeight / 2 + 20);
    iconSprite.alpha = 0.9;
    container.addChild(iconSprite);

    // Species code label
    const codeStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 10,
      fill: 0xffffff,
      fontWeight: '700',
    });
    const codeLabel = new PIXI.Text(event.species_code, codeStyle);
    codeLabel.anchor.set(0.5);
    codeLabel.position.set(tileWidth / 2 - 20, -tileHeight / 2 + 44);
    codeLabel.alpha = 0.8;
    container.addChild(codeLabel);
  }

  return {
    container,
    eventId: event.event_id,
    scheduledTimeMs: event.scheduled_time_ms,
    enterTimeMs: event.scoring_window_start_ms,
    channel: event.channel,
    speciesCode: event.species_code,
    hasBeenScored: false,
    feedbackType: null,
    feedbackStartTime: 0,
    spectrogramPath,
  };
}

function updateTileFeedback(tile: TileState, type: string, score: number) {
  const container = tile.container;

  // Get feedback color
  const color = type === 'perfect' || type === 'good'
    ? COLORS.perfect
    : type === 'partial'
    ? COLORS.partial
    : COLORS.miss;

  // Add glow overlay
  const glow = new PIXI.Graphics();
  const tileWidth = 100; // approximate
  const tileHeight = 70;
  glow.beginFill(color, 0.5);
  glow.drawRoundedRect(-tileWidth / 2, -tileHeight / 2, tileWidth, tileHeight, 8);
  glow.endFill();
  container.addChildAt(glow, 1);

  // Add score popup
  if (score > 0) {
    const scoreStyle = new PIXI.TextStyle({
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 20,
      fontWeight: '700',
      fill: color,
      stroke: 0x000000,
      strokeThickness: 3,
    });

    const scoreText = new PIXI.Text(`+${score}`, scoreStyle);
    scoreText.anchor.set(0.5);
    scoreText.position.set(0, -tileHeight / 2 - 15);
    container.addChild(scoreText);
  }

  // Scale effect
  container.scale.set(1.1);
  setTimeout(() => {
    container.scale.set(1);
  }, 100);
}

function createLanes(app: PIXI.Application, width: number, height: number) {
  const laneWidth = width / 2;

  // Left lane background
  const leftLane = new PIXI.Graphics();
  leftLane.beginFill(COLORS.background, 1);
  leftLane.drawRect(0, 0, laneWidth - 1, height);
  leftLane.endFill();
  app.stage.addChild(leftLane);

  // Right lane background
  const rightLane = new PIXI.Graphics();
  rightLane.beginFill(COLORS.background, 1);
  rightLane.drawRect(laneWidth + 1, 0, laneWidth - 1, height);
  rightLane.endFill();
  app.stage.addChild(rightLane);

  // Lane labels
  const labelStyle = new PIXI.TextStyle({
    fontFamily: 'Inter, sans-serif',
    fontSize: 14,
    fill: COLORS.textMuted,
    fontWeight: '600',
  });

  const leftLabel = new PIXI.Text('LEFT', labelStyle);
  leftLabel.anchor.set(0.5);
  leftLabel.position.set(laneWidth / 2, 30);
  leftLabel.alpha = 0.5;
  app.stage.addChild(leftLabel);

  const rightLabel = new PIXI.Text('RIGHT', labelStyle);
  rightLabel.anchor.set(0.5);
  rightLabel.position.set(laneWidth + laneWidth / 2, 30);
  rightLabel.alpha = 0.5;
  app.stage.addChild(rightLabel);
}

function createHitZones(app: PIXI.Application, width: number, height: number) {
  const laneWidth = width / 2;
  const hitZoneY = height * HIT_ZONE_Y_RATIO;
  const hitZoneHeight = 4;

  // Left hit zone
  const leftHitZone = new PIXI.Graphics();
  leftHitZone.beginFill(COLORS.hitZone, 0.8);
  leftHitZone.drawRect(20, hitZoneY, laneWidth - 40, hitZoneHeight);
  leftHitZone.endFill();
  app.stage.addChild(leftHitZone);

  // Right hit zone
  const rightHitZone = new PIXI.Graphics();
  rightHitZone.beginFill(COLORS.hitZone, 0.8);
  rightHitZone.drawRect(laneWidth + 20, hitZoneY, laneWidth - 40, hitZoneHeight);
  rightHitZone.endFill();
  app.stage.addChild(rightHitZone);

  // Hit zone glow effect
  const glowLeft = new PIXI.Graphics();
  glowLeft.beginFill(COLORS.hitZone, 0.2);
  glowLeft.drawRect(20, hitZoneY - 2, laneWidth - 40, hitZoneHeight + 4);
  glowLeft.endFill();
  app.stage.addChild(glowLeft);

  const glowRight = new PIXI.Graphics();
  glowRight.beginFill(COLORS.hitZone, 0.2);
  glowRight.drawRect(laneWidth + 20, hitZoneY - 2, laneWidth - 40, hitZoneHeight + 4);
  glowRight.endFill();
  app.stage.addChild(glowRight);
}

function createCenterDivider(app: PIXI.Application, width: number, height: number) {
  const centerX = width / 2;

  // Dashed center line
  const divider = new PIXI.Graphics();
  const dashLength = 20;
  const gapLength = 10;
  let y = 0;

  divider.beginFill(COLORS.surface, 0.5);
  while (y < height) {
    divider.drawRect(centerX - 1, y, 2, dashLength);
    y += dashLength + gapLength;
  }
  divider.endFill();

  app.stage.addChild(divider);
}

export default memo(PixiGame);
