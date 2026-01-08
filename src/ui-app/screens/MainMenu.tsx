import { useNavigate } from 'react-router-dom';

function MainMenu() {
  const navigate = useNavigate();

  return (
    <div className="screen screen-center">
      <h1>SOUNDFIELD: BIRDS</h1>

      <div className="flex-col gap-md" style={{ width: '100%', maxWidth: '320px' }}>
        <button
          className="btn-primary"
          onClick={() => navigate('/pack-select')}
        >
          Campaign
        </button>

        <button
          className="btn-primary"
          onClick={() => navigate('/pack-select')}
        >
          Practice
        </button>

        <button
          className="btn-primary"
          onClick={() => navigate('/pack-select')}
        >
          Challenge
        </button>

        <button
          className="btn-primary"
          onClick={() => navigate('/gameplay')}
        >
          Random
        </button>
      </div>

      <div className="flex-row gap-lg" style={{ marginTop: '48px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/settings')}
          aria-label="Settings"
        >
          <SettingsIcon />
        </button>

        <button
          className="btn-icon"
          onClick={() => navigate('/progress')}
          aria-label="Progress"
        >
          <StatsIcon />
        </button>
      </div>
    </div>
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
