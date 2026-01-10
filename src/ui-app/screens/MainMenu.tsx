import { useNavigate } from 'react-router-dom';

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="screen screen-center">
      <h1>SOUNDFIELD: BIRDS</h1>

      {/* How it works intro */}
      <div
        style={{
          width: '100%',
          maxWidth: '320px',
          marginBottom: '24px',
          padding: '16px',
          background: 'var(--color-surface)',
          borderRadius: '12px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
          Train your ear to identify birds by sound
        </div>
        <div style={{ fontSize: '14px', lineHeight: 1.6, marginBottom: '12px' }}>
          <strong>Listen</strong> to bird calls in your left or right ear.{' '}
          <strong>Identify</strong> the species.{' '}
          <strong>Tap</strong> the correct side to score.
        </div>
        <button
          onClick={() => navigate('/help')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--color-accent)',
            fontSize: '13px',
            cursor: 'pointer',
            textDecoration: 'underline',
            padding: '4px',
          }}
        >
          Learn more about how to play
        </button>
      </div>

      <div className="flex-col gap-md" style={{ width: '100%', maxWidth: '320px' }}>
        <button
          className="btn-primary"
          onClick={() => navigate('/pack-select?mode=campaign')}
        >
          Learn
        </button>

        <button
          className="btn-primary"
          disabled
          style={{ opacity: 0.4, cursor: 'not-allowed' }}
        >
          Practice
          <span style={{ fontSize: '10px', display: 'block', opacity: 0.7 }}>Coming soon</span>
        </button>

        <button
          className="btn-primary"
          disabled
          style={{ opacity: 0.4, cursor: 'not-allowed' }}
        >
          Challenge
          <span style={{ fontSize: '10px', display: 'block', opacity: 0.7 }}>Coming soon</span>
        </button>

        <button
          className="btn-primary"
          disabled
          style={{ opacity: 0.4, cursor: 'not-allowed' }}
        >
          Random
          <span style={{ fontSize: '10px', display: 'block', opacity: 0.7 }}>Coming soon</span>
        </button>
      </div>

      <div className="flex-row gap-lg" style={{ marginTop: '48px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/help')}
          aria-label="How to Play"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
        >
          <HelpIcon />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Help</span>
        </button>

        <button
          className="btn-icon"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
        >
          <SettingsIcon />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Settings</span>
        </button>

        <button
          className="btn-icon"
          onClick={() => navigate('/progress')}
          aria-label="Progress"
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}
        >
          <StatsIcon />
          <span style={{ fontSize: '11px', opacity: 0.7 }}>Progress</span>
        </button>
      </div>
    </div>
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
