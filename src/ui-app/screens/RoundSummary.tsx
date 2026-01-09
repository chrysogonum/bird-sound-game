import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface SpeciesResult {
  code: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
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
}

function RoundSummary() {
  const navigate = useNavigate();
  const [results, setResults] = useState<RoundResults | null>(null);
  const [speciesBreakdown, setSpeciesBreakdown] = useState<SpeciesResult[]>([]);

  useEffect(() => {
    // Load results from localStorage
    const saved = localStorage.getItem('soundfield_round_results');
    if (saved) {
      try {
        const parsed: RoundResults = JSON.parse(saved);
        setResults(parsed);

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
      } catch (e) {
        console.error('Failed to parse round results:', e);
      }
    }
  }, []);

  const overallAccuracy = results && results.totalEvents > 0
    ? Math.round((results.eventsScored / results.totalEvents) * 100)
    : 0;

  return (
    <div className="screen screen-center">
      <h1>ROUND COMPLETE</h1>

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

      <div className="flex-row gap-md" style={{ width: '100%', maxWidth: '320px' }}>
        <button className="btn-primary" onClick={() => navigate('/gameplay')} style={{ flex: 1 }}>
          Play Again
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')} style={{ flex: 1 }}>
          Menu
        </button>
      </div>
    </div>
  );
}

export default RoundSummary;
