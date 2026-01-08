import { useEffect, useRef, useCallback, memo } from 'react';
import * as PIXI from 'pixi.js';

export interface PixiGameProps {
  width: number;
  height: number;
  onChannelTap?: (channel: 'left' | 'right') => void;
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
};

function PixiGame({ width, height, onChannelTap }: PixiGameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);

  const handleTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
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
      return; // Tap in dead zone
    }

    const channel = relativeX < centerX ? 'left' : 'right';
    onChannelTap(channel);
  }, [onChannelTap]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create PixiJS application (v7 API)
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

    // Create game elements
    createLanes(app, width, height);
    createHitZones(app, width, height);
    createCenterDivider(app, width, height);
    createPlaceholderTiles(app, width, height);

    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }
    };
  }, [width, height]);

  // Update on resize
  useEffect(() => {
    if (appRef.current) {
      appRef.current.renderer.resize(width, height);

      // Clear and recreate
      appRef.current.stage.removeChildren();
      createLanes(appRef.current, width, height);
      createHitZones(appRef.current, width, height);
      createCenterDivider(appRef.current, width, height);
      createPlaceholderTiles(appRef.current, width, height);
    }
  }, [width, height]);

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
  const hitZoneY = height * 0.85; // 85% from top
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

function createPlaceholderTiles(app: PIXI.Application, width: number, height: number) {
  const laneWidth = width / 2;
  const tileWidth = laneWidth * 0.6;
  const tileHeight = 80;

  // Create a few placeholder tiles in each lane
  const placeholderPositions = [
    { lane: 'left', y: 0.2 },
    { lane: 'left', y: 0.5 },
    { lane: 'right', y: 0.35 },
    { lane: 'right', y: 0.65 },
  ];

  placeholderPositions.forEach(({ lane, y: yPercent }) => {
    const x = lane === 'left' ? laneWidth / 2 : laneWidth + laneWidth / 2;
    const y = height * yPercent;
    const color = lane === 'left' ? COLORS.laneLeft : COLORS.laneRight;

    // Tile background (simulating spectrogram)
    const tile = new PIXI.Graphics();
    tile.beginFill(color, 0.3);
    tile.lineStyle(2, color, 0.6);
    tile.drawRoundedRect(x - tileWidth / 2, y, tileWidth, tileHeight, 8);
    tile.endFill();
    app.stage.addChild(tile);

    // Simulated spectrogram lines
    const lines = new PIXI.Graphics();
    for (let i = 0; i < 8; i++) {
      const lineY = y + 10 + i * 8;
      const lineW = (Math.random() * 0.5 + 0.3) * tileWidth;
      const lineX = x - lineW / 2 + (Math.random() - 0.5) * 20;
      lines.beginFill(0xffffff, 0.2 + Math.random() * 0.3);
      lines.drawRect(lineX, lineY, lineW, 2);
      lines.endFill();
    }
    app.stage.addChild(lines);

    // Species label on tile
    const labelStyle = new PIXI.TextStyle({
      fontFamily: 'Inter, sans-serif',
      fontSize: 11,
      fill: 0xffffff,
      fontWeight: '700',
    });

    const speciesCode = lane === 'left' ? 'NOCA' : 'BLJA';
    const label = new PIXI.Text(speciesCode, labelStyle);
    label.anchor.set(0.5);
    label.position.set(x, y + tileHeight + 12);
    label.alpha = 0.7;
    app.stage.addChild(label);
  });
}

export default memo(PixiGame);
