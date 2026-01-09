import { useNavigate, useSearchParams } from 'react-router-dom';

interface Pack {
  id: string;
  name: string;
  speciesCount: number;
  isUnlocked: boolean;
}

const PACKS: Pack[] = [
  { id: 'starter_birds', name: '5 Common Backyard Birds', speciesCount: 5, isUnlocked: true },
  { id: 'expanded_backyard', name: 'Expanded Backyard Birds', speciesCount: 27, isUnlocked: true },
];

function PackSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'campaign';

  const handlePackSelect = (pack: Pack) => {
    if (pack.isUnlocked) {
      // Pass mode and pack to gameplay
      navigate(`/gameplay?mode=${mode}&pack=${pack.id}`);
    }
  };

  return (
    <div className="screen">
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>Select Pack</h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
        }}
      >
        {PACKS.map((pack) => (
          <button
            key={pack.id}
            className="card"
            onClick={() => handlePackSelect(pack)}
            style={{
              textAlign: 'left',
              opacity: pack.isUnlocked ? 1 : 0.5,
              cursor: pack.isUnlocked ? 'pointer' : 'not-allowed',
            }}
          >
            <div className="flex-row justify-between items-center">
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{pack.name}</span>
              <span style={{ fontSize: '20px' }}>{pack.isUnlocked ? '🔓' : '🔒'}</span>
            </div>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              {pack.speciesCount} species
            </div>
          </button>
        ))}
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

export default PackSelect;
