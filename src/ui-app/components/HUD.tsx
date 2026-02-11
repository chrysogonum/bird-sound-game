import { memo } from 'react';

export interface HUDProps {
  score: number;
  streak: number;
  timeRemaining: number;
  mode?: string;
  levelId?: number;
  levelTitle?: string;
}

const MODE_LABELS: Record<string, string> = {
  campaign: 'Learn',
  practice: 'Practice',
  challenge: 'Challenge',
  random: 'Random',
};

// Interpolate between ChipNotes gradient colors: yellow → orange → red
const STREAK_COLORS = [
  [255, 213, 79],   // #FFD54F
  [255, 138, 101],  // #FF8A65
  [229, 115, 115],  // #E57373
];

function getStreakColor(index: number, total: number): string {
  if (total <= 1) return `rgb(${STREAK_COLORS[0].join(',')})`;
  const t = index / (total - 1); // 0 to 1
  const pos = t * 2; // 0 to 2 (across 3 color stops)
  const seg = Math.min(Math.floor(pos), 1);
  const local = pos - seg;
  const c0 = STREAK_COLORS[seg];
  const c1 = STREAK_COLORS[seg + 1];
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * local);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * local);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * local);
  return `rgb(${r},${g},${b})`;
}

function HUD({ score, streak, timeRemaining, mode, levelId, levelTitle }: HUDProps) {
  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="hud">
      <div className="hud-score">
        <span className="hud-label">Score</span>
        <span className="hud-value">{score.toLocaleString()}</span>
      </div>

      <div className="hud-center">
        {mode === 'campaign' && levelId ? (
          <span className="hud-mode">Level {levelId}{levelTitle ? `: ${levelTitle}` : ''}</span>
        ) : mode ? (
          <span className="hud-mode">{MODE_LABELS[mode] || mode}</span>
        ) : null}
        <div className="hud-streak">
          {streak === 0 ? (
            <span className="streak-dot">○</span>
          ) : (
            Array.from({ length: streak }).map((_, i) => (
              <span key={i} className="streak-dot active" style={{ color: getStreakColor(i, streak) }}>●</span>
            ))
          )}
        </div>
      </div>

      <div className="hud-timer">
        <span className="hud-label">Time</span>
        <span className="hud-value">{timeString}</span>
      </div>

      <style>{`
        .hud {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          padding-top: calc(12px + var(--safe-area-top, 0px));
          background: linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.3) 100%);
          border-bottom: 1px solid var(--color-surface);
        }

        .hud-score, .hud-timer {
          display: flex;
          flex-direction: column;
          align-items: center;
          min-width: 80px;
        }

        .hud-label {
          font-size: 10px;
          text-transform: uppercase;
          color: var(--color-text-muted);
          letter-spacing: 0.5px;
        }

        .hud-value {
          font-family: var(--font-mono);
          font-size: 20px;
          font-weight: 600;
        }

        .hud-score .hud-value {
          color: #81C784;
        }

        .hud-timer .hud-value {
          color: #64B5F6;
        }

        .hud-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .hud-mode {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--color-text-muted);
          padding: 2px 8px;
          border-radius: 4px;
          background: rgba(255, 255, 255, 0.1);
        }

        .hud-streak {
          display: flex;
          gap: 4px;
          font-size: 12px;
        }

        .streak-dot {
          color: var(--color-text-muted);
          transition: color 0.2s, transform 0.2s;
        }

        .streak-dot.active {
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}

export default memo(HUD);
