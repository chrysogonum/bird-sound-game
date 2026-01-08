import { useNavigate } from 'react-router-dom';

interface Pack {
  id: string;
  name: string;
  speciesCount: number;
  isUnlocked: boolean;
}

const PACKS: Pack[] = [
  { id: 'common_se_birds', name: 'Common SE Birds', speciesCount: 31, isUnlocked: true },
  { id: 'spring_warblers', name: 'Spring Warblers', speciesCount: 6, isUnlocked: true },
  { id: 'sparrows', name: 'Sparrows', speciesCount: 6, isUnlocked: false },
  { id: 'woodpeckers', name: 'Woodpeckers', speciesCount: 4, isUnlocked: false },
];

function PackSelect() {
  const navigate = useNavigate();

  const handlePackSelect = (pack: Pack) => {
    if (pack.isUnlocked) {
      navigate('/gameplay');
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
