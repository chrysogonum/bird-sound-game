import { memo } from 'react';

export interface HUDProps {
  score: number;
  streak: number;
  maxStreak: number;
  timeRemaining: number;
  mode?: string;
  levelId?: number;
  levelTitle?: string;
}

const MODE_LABELS: Record<string, string> = {
  campaign: 'Campaign',
  practice: 'Practice',
  challenge: 'Challenge',
  random: 'Random',
};

function HUD({ score, streak, maxStreak, timeRemaining, mode, levelId, levelTitle }: HUDProps) {
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
          {Array.from({ length: maxStreak }).map((_, i) => (
            <span
              key={i}
              className={`streak-dot ${i < streak ? 'active' : ''}`}
            >
              {i < streak ? '●' : '○'}
            </span>
          ))}
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
          color: var(--color-accent);
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
          color: var(--color-accent);
          transform: scale(1.2);
        }
      `}</style>
    </div>
  );
}

export default memo(HUD);
