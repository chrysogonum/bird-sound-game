import { useNavigate } from 'react-router-dom';

interface SpeciesResult {
  code: string;
  name: string;
  accuracy: number;
}

const MOCK_RESULTS: SpeciesResult[] = [
  { code: 'NOCA', name: 'Northern Cardinal', accuracy: 95 },
  { code: 'CARW', name: 'Carolina Wren', accuracy: 75 },
  { code: 'BLJA', name: 'Blue Jay', accuracy: 60 },
];

function RoundSummary() {
  const navigate = useNavigate();

  return (
    <div className="screen screen-center">
      <h1>ROUND COMPLETE</h1>

      <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Score</span>
          <span className="text-accent" style={{ fontFamily: 'var(--font-mono)', fontSize: '24px' }}>
            2450
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '16px' }}>
          <span>Accuracy</span>
          <span className="text-success">87%</span>
        </div>
        <div className="flex-row justify-between">
          <span>Best Streak</span>
          <span>12</span>
        </div>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
        <h3 style={{ marginBottom: '12px' }}>Species Breakdown</h3>
        {MOCK_RESULTS.map((result) => (
          <div key={result.code} style={{ marginBottom: '8px' }}>
            <div className="flex-row justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>{result.code}</span>
              <span style={{ fontSize: '14px' }}>{result.accuracy}%</span>
            </div>
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
                      : result.accuracy >= 60
                        ? 'var(--color-accent)'
                        : 'var(--color-error)',
                  borderRadius: '4px',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '320px', marginBottom: '24px' }}>
        <div className="text-muted" style={{ fontSize: '14px', marginBottom: '8px' }}>
          Confused Pair
        </div>
        <div style={{ marginBottom: '12px' }}>CARW ↔ TUTI</div>
        <button className="btn-secondary" style={{ width: '100%' }}>
          Drill This Pair
        </button>
      </div>

      <div className="flex-row gap-md" style={{ width: '100%', maxWidth: '320px' }}>
        <button className="btn-primary" onClick={() => navigate('/gameplay')}>
          Retry
        </button>
        <button className="btn-primary" onClick={() => navigate('/gameplay')}>
          Next
        </button>
        <button className="btn-secondary" onClick={() => navigate('/')}>
          Menu
        </button>
      </div>
    </div>
  );
}

export default RoundSummary;
