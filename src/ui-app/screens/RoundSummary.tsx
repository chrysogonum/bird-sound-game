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

// Total number of campaign levels (should match levels.json)
const TOTAL_CAMPAIGN_LEVELS = 6;

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

        // Build species breakdown with names - include ALL species from the pack
        const breakdown: SpeciesResult[] = [];
        for (const speciesInfo of parsed.species) {
          const data = parsed.speciesResults[speciesInfo.code] || { total: 0, correct: 0 };
          breakdown.push({
            code: speciesInfo.code,
            name: speciesInfo.name,
            total: data.total,
            correct: data.correct,
            accuracy: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
          });
        }
        // Sort: species with encounters first (by accuracy), then species with no encounters
        breakdown.sort((a, b) => {
          // Put species with no encounters at the end
          if (a.total === 0 && b.total > 0) return 1;
          if (b.total === 0 && a.total > 0) return -1;
          // Both have encounters: sort by accuracy (worst first)
          if (a.total > 0 && b.total > 0) return a.accuracy - b.accuracy;
          // Both have no encounters: alphabetical
          return a.code.localeCompare(b.code);
        });
        setSpeciesBreakdown(breakdown);

        // Build confusion summary - only include mistakes and misses
        if (parsed.confusionData && parsed.confusionData.length > 0) {
          const confusionMap = new Map<string, number>();

          for (const entry of parsed.confusionData) {
            // Skip correct identifications
            if (entry.guessedSpecies === entry.expectedSpecies) continue;

            // Create a key for this confusion pair
            const key = `${entry.expectedSpecies}|${entry.guessedSpecies ?? 'MISS'}`;
            confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
          }

          // Convert to array and sort by count (most common first)
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
  const hasNextLevel = isCampaign && currentLevel < TOTAL_CAMPAIGN_LEVELS;

  return (
    <div className="screen screen-center">
      <h1>ROUND COMPLETE</h1>
      {isCampaign && (
        <p className="text-muted" style={{ marginTop: '-8px', marginBottom: '16px' }}>
          Level {currentLevel}: {results?.levelTitle || 'Campaign'}
        </p>
      )}

      <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Score</span>
          <span className="text-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px' }}>
            {results?.score || 0}
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Birds Identified</span>
          <span>{results?.eventsScored || 0} / {results?.totalEvents || 0}</span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Overall Accuracy</span>
          <span className={overallAccuracy >= 70 ? 'text-success' : overallAccuracy >= 50 ? 'text-accent' : 'text-error'}>
            {overallAccuracy}%
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Perfect Hits</span>
          <span className="text-success">{results?.perfectCount || 0}</span>
        </div>
        <div className="flex-row justify-between">
          <span>Best Streak</span>
          <span>{results?.maxStreak || 0}</span>
        </div>
      </div>

      {speciesBreakdown.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Species Breakdown</h3>
          {speciesBreakdown.map((result) => (
            <div key={result.code} style={{ marginBottom: '12px', opacity: result.total === 0 ? 0.5 : 1 }}>
              <div className="flex-row justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>
                  {result.code} <span className="text-muted">({result.name})</span>
                </span>
                <span style={{ fontSize: '14px' }}>
                  {result.total === 0 ? (
                    <span className="text-muted">Not in round</span>
                  ) : (
                    <>{result.correct}/{result.total} ({result.accuracy}%)</>
                  )}
                </span>
              </div>
              {result.total > 0 && (
                <div
                  style={{
                    height: '8px',
                    backgroundColor: 'var(--color-background)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${result.accuracy}%`,
                      height: '100%',
                      backgroundColor:
                        result.accuracy >= 80
                          ? 'var(--color-success)'
                          : result.accuracy >= 50
                            ? 'var(--color-accent)'
                            : 'var(--color-error)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {confusionSummary.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '12px' }}>Confusion Summary</h3>
          {confusionSummary.map((item, index) => (
            <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
              {item.guessedSpecies === null ? (
                <span>
                  You missed <span className="text-accent">{item.expectedSpecies}</span>: {item.count} time{item.count !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>
                  You heard <span className="text-accent">{item.expectedSpecies}</span> but picked{' '}
                  <span className="text-error">{item.guessedSpecies}</span>: {item.count} time{item.count !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex-col gap-md" style={{ width: '100%', maxWidth: '320px' }}>
        {hasNextLevel && (
          <button
            className="btn-primary"
            onClick={() => {
              const pack = results?.packId || 'common_se_birds';
              navigate(`/gameplay?mode=campaign&pack=${pack}&level=${currentLevel + 1}`);
            }}
            style={{ width: '100%' }}
          >
            Next Level
          </button>
        )}
        <div className="flex-row gap-md">
          <button
            className={hasNextLevel ? 'btn-secondary' : 'btn-primary'}
            onClick={() => {
              const mode = results?.mode || 'campaign';
              const pack = results?.packId || 'common_se_birds';
              const level = results?.levelId || 1;
              navigate(`/gameplay?mode=${mode}&pack=${pack}&level=${level}`);
            }}
            style={{ flex: 1 }}
          >
            Play Again
          </button>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ flex: 1 }}>
            Menu
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoundSummary;
