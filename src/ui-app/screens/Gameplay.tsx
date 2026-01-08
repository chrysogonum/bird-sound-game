import { useNavigate } from 'react-router-dom';

function Gameplay() {
  const navigate = useNavigate();

  return (
    <div className="screen" style={{ padding: 0 }}>
      {/* HUD */}
      <div
        className="flex-row justify-between items-center"
        style={{
          padding: '16px',
          paddingTop: 'calc(16px + var(--safe-area-top))',
          backgroundColor: 'rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px' }}>
          Score: <span className="text-accent">0</span>
        </div>
        <div className="flex-row gap-sm">
          <span>●</span>
          <span>●</span>
          <span style={{ opacity: 0.3 }}>○</span>
          <span style={{ opacity: 0.3 }}>○</span>
          <span style={{ opacity: 0.3 }}>○</span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: '20px' }}>
          1:00
        </div>
      </div>

      {/* Lanes Area (placeholder) */}
      <div
        className="flex-1 flex-row"
        style={{ position: 'relative', borderTop: '1px solid var(--color-surface)' }}
      >
        {/* Left Lane */}
        <div
          className="flex-1 flex-col items-center justify-center"
          style={{ borderRight: '1px solid var(--color-surface)' }}
        >
          <div className="text-muted">LEFT LANE</div>
          <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.5 }}>
            (PixiJS canvas placeholder)
          </div>
        </div>

        {/* Right Lane */}
        <div className="flex-1 flex-col items-center justify-center">
          <div className="text-muted">RIGHT LANE</div>
          <div style={{ marginTop: '16px', fontSize: '12px', opacity: 0.5 }}>
            (PixiJS canvas placeholder)
          </div>
        </div>

        {/* Hit Zone Indicator */}
        <div
          style={{
            position: 'absolute',
            bottom: '180px',
            left: 0,
            right: 0,
            height: '4px',
            backgroundColor: 'var(--color-accent)',
            opacity: 0.8,
          }}
        />
      </div>

      {/* Species Wheel (placeholder) */}
      <div
        className="flex-col items-center justify-center"
        style={{
          height: '180px',
          paddingBottom: 'var(--safe-area-bottom)',
          backgroundColor: 'var(--color-surface)',
        }}
      >
        <div className="text-muted" style={{ marginBottom: '8px' }}>
          SPECIES WHEEL
        </div>
        <div className="flex-row gap-sm">
          {['NOCA', 'BLJA', 'CARW', 'AMCR', 'TUTI', 'EABL'].map((code) => (
            <div
              key={code}
              style={{
                width: '44px',
                height: '44px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-background)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '10px',
              }}
            >
              {code}
            </div>
          ))}
        </div>

        {/* Temporary back button for navigation testing */}
        <button
          className="btn-secondary"
          onClick={() => navigate('/summary')}
          style={{ marginTop: '16px', fontSize: '14px' }}
        >
          End Round (test)
        </button>
      </div>
    </div>
  );
}

export default Gameplay;
