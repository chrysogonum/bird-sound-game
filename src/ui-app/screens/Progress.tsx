import { useNavigate } from 'react-router-dom';

interface SpeciesStat {
  code: string;
  name: string;
  accuracy: number;
  attempts: number;
}

const MOCK_STATS: SpeciesStat[] = [
  { code: 'NOCA', name: 'Northern Cardinal', accuracy: 92, attempts: 45 },
  { code: 'BLJA', name: 'Blue Jay', accuracy: 88, attempts: 38 },
  { code: 'CARW', name: 'Carolina Wren', accuracy: 76, attempts: 29 },
  { code: 'AMCR', name: 'American Crow', accuracy: 95, attempts: 22 },
  { code: 'TUTI', name: 'Tufted Titmouse', accuracy: 71, attempts: 18 },
];

function Progress() {
  const navigate = useNavigate();

  const totalAccuracy = Math.round(
    MOCK_STATS.reduce((sum, s) => sum + s.accuracy, 0) / MOCK_STATS.length
  );

  return (
    <div className="screen">
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>Progress</h2>
      </div>

      {/* Overall Stats */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div className="flex-row justify-between items-center">
          <div>
            <div className="text-muted" style={{ fontSize: '14px' }}>Overall Accuracy</div>
            <div style={{ fontSize: '32px', fontWeight: 700 }} className="text-success">
              {totalAccuracy}%
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="text-muted" style={{ fontSize: '14px' }}>Total Attempts</div>
            <div style={{ fontSize: '24px', fontWeight: 600 }}>
              {MOCK_STATS.reduce((sum, s) => sum + s.attempts, 0)}
            </div>
          </div>
        </div>
      </div>

      {/* Session Stats */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <h3>This Session</h3>
        <div className="flex-row justify-between" style={{ marginTop: '12px' }}>
          <div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Rounds</div>
            <div style={{ fontSize: '20px' }}>5</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Score</div>
            <div style={{ fontSize: '20px' }} className="text-accent">12,450</div>
          </div>
          <div>
            <div className="text-muted" style={{ fontSize: '12px' }}>Best Streak</div>
            <div style={{ fontSize: '20px' }}>18</div>
          </div>
        </div>
      </div>

      {/* Species Breakdown */}
      <div className="card">
        <h3 style={{ marginBottom: '16px' }}>Species Accuracy</h3>
        {MOCK_STATS.map((stat) => (
          <div key={stat.code} style={{ marginBottom: '12px' }}>
            <div className="flex-row justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ fontSize: '14px' }}>
                {stat.code} <span className="text-muted">({stat.attempts})</span>
              </span>
              <span
                style={{ fontSize: '14px' }}
                className={stat.accuracy >= 80 ? 'text-success' : stat.accuracy >= 60 ? 'text-accent' : 'text-error'}
              >
                {stat.accuracy}%
              </span>
            </div>
            <div
              style={{
                height: '6px',
                backgroundColor: 'var(--color-background)',
                borderRadius: '3px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${stat.accuracy}%`,
                  height: '100%',
                  backgroundColor:
                    stat.accuracy >= 80
                      ? 'var(--color-success)'
                      : stat.accuracy >= 60
                        ? 'var(--color-accent)'
                        : 'var(--color-error)',
                  borderRadius: '3px',
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Confusion Matrix Link */}
      <div className="card" style={{ marginTop: '24px' }}>
        <button className="btn-secondary" style={{ width: '100%' }}>
          View Confusion Matrix
        </button>
      </div>
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export default Progress;
