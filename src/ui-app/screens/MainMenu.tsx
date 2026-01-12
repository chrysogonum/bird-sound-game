import { useNavigate } from 'react-router-dom';

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="screen screen-center" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* Main content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        zIndex: 1,
      }}>
        {/* Owl Professor hero image */}
        <img
          src={`${import.meta.env.BASE_URL}data/icons/OwlHeadphones.png`}
          alt="ChipNotes Owl Professor"
          style={{
            width: '180px',
            height: '180px',
            borderRadius: '50%',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            marginBottom: '8px',
          }}
        />

        {/* Title */}
        <h1 style={{
          margin: 0,
          fontSize: '44px',
          fontWeight: 800,
          letterSpacing: '-1px',
          background: 'linear-gradient(135deg, #FFD54F 0%, #FF8A65 50%, #E57373 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          ChipNotes!
        </h1>

        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '15px',
          maxWidth: '280px',
          textAlign: 'center',
          lineHeight: 1.5,
          marginTop: '4px',
        }}>
          Your gamified study guide to bird songs
        </p>

        {/* Main Play Button */}
        <button
          onClick={() => navigate('/pack-select')}
          style={{
            marginTop: '24px',
            padding: '18px 64px',
            fontSize: '20px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '16px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(45, 90, 39, 0.4)',
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 6px 20px rgba(45, 90, 39, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(45, 90, 39, 0.4)';
          }}
        >
          Play
        </button>

        {/* How it works - visual gameplay preview */}
        <div style={{
          marginTop: '32px',
          padding: '24px 32px',
          background: 'var(--color-surface)',
          borderRadius: '16px',
          maxWidth: '360px',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
          }}>
            {/* Step 1: Spectrogram representing sound */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '88px',
                height: '56px',
                background: 'linear-gradient(180deg, #1a1a2e 0%, #0d1520 100%)',
                borderRadius: '10px',
                padding: '6px',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: '2px',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.3)',
              }}>
                <SpectrogramMini />
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Hear a sound
              </div>
            </div>

            {/* Arrow */}
            <div style={{ color: 'var(--color-accent)', fontSize: '28px', marginTop: '-20px' }}>
              →
            </div>

            {/* Step 2: Bird options */}
            <div style={{ textAlign: 'center' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '6px',
              }}>
                {['NOCA', 'BLJA', 'TUTI', 'CAWR'].map((code, i) => (
                  <div
                    key={code}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      border: i === 0 ? '2px solid var(--color-accent)' : '2px solid transparent',
                      boxShadow: i === 0 ? '0 0 10px rgba(255, 152, 0, 0.4)' : 'none',
                    }}
                  >
                    <img
                      src={`${import.meta.env.BASE_URL}data/icons/${code}.png`}
                      alt={code}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '8px' }}>
                Match the bird!
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom nav icons */}
      <div style={{
        position: 'absolute',
        bottom: 'calc(24px + var(--safe-area-bottom, 0px))',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        gap: '32px',
      }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/help')}
          aria-label="How to Play"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <HelpIcon />
          <span style={{ fontSize: '10px', opacity: 0.6 }}>Help</span>
        </button>

        <button
          className="btn-icon"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <SettingsIcon />
          <span style={{ fontSize: '10px', opacity: 0.6 }}>Settings</span>
        </button>

        <button
          className="btn-icon"
          onClick={() => navigate('/progress')}
          aria-label="Progress"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
        >
          <StatsIcon />
          <span style={{ fontSize: '10px', opacity: 0.6 }}>Stats</span>
        </button>
      </div>
    </div>
  );
}

// Mini spectrogram visualization - looks like a bird song pattern
function SpectrogramMini() {
  // Heights simulate a rising bird song pattern
  const bars = [8, 16, 24, 32, 26, 34, 28, 36, 20, 12, 26, 32];

  return (
    <svg width="76" height="40" viewBox="0 0 76 40">
      {bars.map((height, i) => (
        <rect
          key={i}
          x={i * 6 + 2}
          y={40 - height}
          width="4"
          height={height}
          rx="1.5"
          fill={`hsl(${30 + i * 8}, 80%, ${50 + i * 2}%)`}
          opacity={0.8 + i * 0.015}
        />
      ))}
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
    </svg>
  );
}

function StatsIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 16l4-4 4 4 6-6" />
    </svg>
  );
}

export default MainMenu;
