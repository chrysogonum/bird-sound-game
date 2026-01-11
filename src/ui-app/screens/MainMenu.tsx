import { useNavigate } from 'react-router-dom';

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="screen screen-center" style={{ position: 'relative' }}>
      {/* Decorative background birds */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '5%',
        opacity: 0.08,
        transform: 'rotate(-15deg)',
      }}>
        <BirdSilhouette size={120} />
      </div>
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '8%',
        opacity: 0.06,
        transform: 'rotate(20deg) scaleX(-1)',
      }}>
        <BirdSilhouette size={100} />
      </div>

      {/* Main content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '16px',
        zIndex: 1,
      }}>
        {/* Logo area */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px',
        }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #1a3d2a 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(45, 90, 39, 0.3)',
          }}>
            <HeadphonesIcon />
          </div>
        </div>

        <h1 style={{ margin: 0, fontSize: '36px', letterSpacing: '-1px' }}>
          SOUNDFIELD
        </h1>
        <div style={{
          fontSize: '18px',
          color: 'var(--color-accent)',
          fontWeight: 600,
          marginTop: '-12px',
          letterSpacing: '3px',
        }}>
          BIRDS
        </div>

        <p style={{
          color: 'var(--color-text-muted)',
          fontSize: '15px',
          maxWidth: '280px',
          textAlign: 'center',
          lineHeight: 1.5,
          marginTop: '8px',
        }}>
          Train your ear to identify birds by their songs and calls
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

        {/* How it works - compact */}
        <div style={{
          marginTop: '32px',
          padding: '16px 20px',
          background: 'var(--color-surface)',
          borderRadius: '12px',
          maxWidth: '300px',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-around',
            gap: '16px',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                <EarIcon />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Listen</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                <BrainIcon />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Identify</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '4px' }}>
                <TapIcon />
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>Tap</div>
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

function HeadphonesIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
      <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
      <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z" />
      <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z" />
    </svg>
  );
}

function EarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
      <path d="M6 8.5a6.5 6.5 0 1 1 13 0c0 6-6 6-6 10.5a3.5 3.5 0 1 1-7 0" />
      <path d="M15 8.5a2.5 2.5 0 0 0-5 0v1a2 2 0 0 0 4 0" />
    </svg>
  );
}

function BrainIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M12 5v14" />
    </svg>
  );
}

function TapIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
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

function BirdSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      <path d="M85 35c-5-3-12-2-18 1-3-8-10-14-19-16 2-3 3-7 2-11-1-5-5-8-9-7s-7 5-6 10c0 2 1 4 2 5-10 3-18 11-21 21-8-1-16 2-21 8-2 2-1 5 1 6s5 0 7-2c3-4 8-5 13-4 0 12 7 23 18 28l-8 12c-2 2-1 5 1 7 2 1 5 1 6-2l10-14c3 1 6 1 9 1 4 0 7-1 10-2l10 14c2 2 5 3 7 1s2-5 0-7l-8-12c11-5 18-16 18-28 5-1 10 0 13 4 2 2 5 3 7 2s3-4 1-6c-5-6-13-9-21-8z" />
    </svg>
  );
}

export default MainMenu;
