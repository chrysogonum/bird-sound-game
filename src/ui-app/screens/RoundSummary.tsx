import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface SpeciesResult {
  code: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface ConfusionEntry {
  expectedSpecies: string;
  guessedSpecies: string | null;
  channel: 'left' | 'right';
}

interface RoundResults {
  score: number;
  eventsScored: number;
  totalEvents: number;
  speciesCorrect: number;
  channelCorrect: number;
  perfectCount: number;
  missCount: number;
  maxStreak: number;
  speciesResults: Record<string, { total: number; correct: number }>;
  species: Array<{ code: string; name: string }>;
  mode?: string;
  packId?: string;
  levelId?: number;
  levelTitle?: string;
  confusionData?: ConfusionEntry[];
}

// Total number of campaign levels per pack
const TOTAL_LEVELS = 6;

interface ConfusionSummaryItem {
  expectedSpecies: string;
  guessedSpecies: string | null;
  count: number;
}

function RoundSummary() {
  const navigate = useNavigate();
  const [results, setResults] = useState<RoundResults | null>(null);
  const [speciesBreakdown, setSpeciesBreakdown] = useState<SpeciesResult[]>([]);
  const [confusionSummary, setConfusionSummary] = useState<ConfusionSummaryItem[]>([]);
  const [showLevelPicker, setShowLevelPicker] = useState(false);

  useEffect(() => {
    // Load results from localStorage
    const saved = localStorage.getItem('soundfield_round_results');
    if (saved) {
      try {
        const parsed: RoundResults = JSON.parse(saved);
        setResults(parsed);

        // Save progress for campaign mode
        if (parsed.mode === 'campaign' && parsed.levelId) {
          const progressKey = 'soundfield_progress';
          const existingProgress = JSON.parse(localStorage.getItem(progressKey) || '{}');
          const levelKey = `level_${parsed.levelId}`;
          const existingBest = existingProgress[levelKey]?.bestScore || 0;

          existingProgress[levelKey] = {
            completed: true,
            bestScore: Math.max(existingBest, parsed.score),
            accuracy: parsed.totalEvents > 0
              ? Math.round((parsed.eventsScored / parsed.totalEvents) * 100)
              : 0,
          };
          localStorage.setItem(progressKey, JSON.stringify(existingProgress));
        }

        // Build species breakdown - only include species that were in this round
        const breakdown: SpeciesResult[] = [];
        for (const speciesInfo of parsed.species) {
          const data = parsed.speciesResults[speciesInfo.code] || { total: 0, correct: 0 };
          if (data.total > 0) {
            breakdown.push({
              code: speciesInfo.code,
              name: speciesInfo.name,
              total: data.total,
              correct: data.correct,
              accuracy: Math.round((data.correct / data.total) * 100),
            });
          }
        }
        breakdown.sort((a, b) => a.accuracy - b.accuracy);
        setSpeciesBreakdown(breakdown);

        // Build confusion summary
        if (parsed.confusionData && parsed.confusionData.length > 0) {
          const confusionMap = new Map<string, number>();

          for (const entry of parsed.confusionData) {
            if (entry.guessedSpecies === entry.expectedSpecies) continue;
            const key = `${entry.expectedSpecies}|${entry.guessedSpecies ?? 'MISS'}`;
            confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
          }

          const summary: ConfusionSummaryItem[] = [];
          for (const [key, count] of confusionMap.entries()) {
            const [expected, guessed] = key.split('|');
            summary.push({
              expectedSpecies: expected,
              guessedSpecies: guessed === 'MISS' ? null : guessed,
              count,
            });
          }
          summary.sort((a, b) => b.count - a.count);
          setConfusionSummary(summary);
        }
      } catch (e) {
        console.error('Failed to parse round results:', e);
      }
    }
  }, []);

  const overallAccuracy = results && results.totalEvents > 0
    ? Math.round((results.eventsScored / results.totalEvents) * 100)
    : 0;

  const isCampaign = results?.mode === 'campaign';
  const currentLevel = results?.levelId || 1;
  const packId = results?.packId || 'starter_birds';
  const hasPrevLevel = currentLevel > 1;
  const hasNextLevel = currentLevel < TOTAL_LEVELS;

  // Navigation helpers - all go through preview
  const goToLevel = (level: number) => {
    navigate(`/preview?pack=${packId}&level=${level}`);
  };

  const goToLevelSelect = () => {
    navigate(`/level-select?pack=${packId}`);
  };

  const goToPackSelect = () => {
    navigate('/pack-select');
  };

  const goToMenu = () => {
    navigate('/');
  };

  return (
    <div className="screen" style={{ paddingTop: '32px', paddingBottom: 'calc(24px + var(--safe-area-bottom, 0px))' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '8px' }}>ROUND COMPLETE</h1>
      {isCampaign && (
        <p className="text-muted" style={{ textAlign: 'center', marginBottom: '16px' }}>
          Level {currentLevel}: {results?.levelTitle || 'Campaign'}
        </p>
      )}

      {/* Stats Card */}
      <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Score</span>
          <span className="text-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px' }}>
            {results?.score || 0}
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Birds Identified</span>
          <span>{results?.eventsScored || 0} / {results?.totalEvents || 0}</span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Overall Accuracy</span>
          <span className={overallAccuracy >= 70 ? 'text-success' : overallAccuracy >= 50 ? 'text-accent' : 'text-error'}>
            {overallAccuracy}%
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Perfect Hits</span>
          <span className="text-success">{results?.perfectCount || 0}</span>
        </div>
        <div className="flex-row justify-between">
          <span>Best Streak</span>
          <span>{results?.maxStreak || 0}</span>
        </div>
      </div>

      {/* Species Breakdown */}
      {speciesBreakdown.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Species Breakdown</h3>
          {speciesBreakdown.map((result) => (
            <div key={result.code} style={{ marginBottom: '12px' }}>
              <div className="flex-row justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>
                  {result.code} <span className="text-muted">({result.name})</span>
                </span>
                <span style={{ fontSize: '14px' }}>
                  {result.correct}/{result.total} ({result.accuracy}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-background)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${result.accuracy}%`,
                  height: '100%',
                  backgroundColor: result.accuracy >= 80 ? 'var(--color-success)' : result.accuracy >= 50 ? 'var(--color-accent)' : 'var(--color-error)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confusion Summary */}
      {confusionSummary.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Confusion Summary</h3>
          {confusionSummary.map((item, index) => (
            <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
              {item.guessedSpecies === null ? (
                <span>
                  Missed <span className="text-accent">{item.expectedSpecies}</span>: {item.count}x
                </span>
              ) : (
                <span>
                  <span className="text-accent">{item.expectedSpecies}</span> → <span className="text-error">{item.guessedSpecies}</span>: {item.count}x
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
        {/* Level Navigation Row */}
        {isCampaign && (
          <div className="flex-row gap-md" style={{ marginBottom: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => goToLevel(currentLevel - 1)}
              disabled={!hasPrevLevel}
              style={{ flex: 1, opacity: hasPrevLevel ? 1 : 0.4 }}
            >
              <ChevronLeftIcon /> Prev
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowLevelPicker(!showLevelPicker)}
              style={{ flex: 1 }}
            >
              Level {currentLevel}/{TOTAL_LEVELS}
            </button>
            <button
              className="btn-secondary"
              onClick={() => goToLevel(currentLevel + 1)}
              disabled={!hasNextLevel}
              style={{ flex: 1, opacity: hasNextLevel ? 1 : 0.4 }}
            >
              Next <ChevronRightIcon />
            </button>
          </div>
        )}

        {/* Level Picker Dropdown */}
        {showLevelPicker && (
          <div className="card" style={{ marginBottom: '12px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              Jump to level:
            </div>
            <div className="flex-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setShowLevelPicker(false);
                    goToLevel(level);
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: level === currentLevel ? '2px solid var(--color-accent)' : '1px solid var(--color-text-muted)',
                    background: level === currentLevel ? 'var(--color-accent)' : 'var(--color-surface)',
                    color: level === currentLevel ? 'var(--color-background)' : 'var(--color-text)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Actions */}
        <div className="flex-col gap-md">
          <button
            className="btn-primary"
            onClick={() => goToLevel(currentLevel)}
            style={{ width: '100%' }}
          >
            Play Again
          </button>
          <div className="flex-row gap-md">
            <button className="btn-secondary" onClick={goToLevelSelect} style={{ flex: 1 }}>
              Levels
            </button>
            <button className="btn-secondary" onClick={goToPackSelect} style={{ flex: 1 }}>
              Packs
            </button>
            <button className="btn-secondary" onClick={goToMenu} style={{ flex: 1 }}>
              Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default RoundSummary;
