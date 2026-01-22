import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackExternalLinkClick } from '../utils/analytics';

type SpectrogramMode = 'full' | 'fading' | 'none';

// Storage keys
const STORAGE_KEYS = {
  SCROLL_SPEED: 'soundfield_scroll_speed',
  SPECTROGRAM_MODE: 'soundfield_spectrogram_mode',
  HIGH_CONTRAST: 'soundfield_high_contrast',
  CONTINUOUS_PLAY: 'soundfield_continuous_play',
  COOKIE_CONSENT: 'chipnotes_cookie_consent',
};

function Settings() {
  const navigate = useNavigate();

  // Load from localStorage on mount
  const [spectrogramMode, setSpectrogramMode] = useState<SpectrogramMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SPECTROGRAM_MODE);
    return (saved as SpectrogramMode) || 'full';
  });
  const [scrollSpeed, setScrollSpeed] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.SCROLL_SPEED);
    return saved ? parseFloat(saved) : 0.5;
  });
  const [continuousPlay, setContinuousPlay] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.CONTINUOUS_PLAY) === 'true';
  });
  const [analyticsConsent, setAnalyticsConsent] = useState(() => {
    const consent = localStorage.getItem(STORAGE_KEYS.COOKIE_CONSENT);
    return consent === 'accepted';
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SPECTROGRAM_MODE, spectrogramMode);
  }, [spectrogramMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCROLL_SPEED, scrollSpeed.toString());
  }, [scrollSpeed]);


  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTINUOUS_PLAY, continuousPlay.toString());
  }, [continuousPlay]);

  const handleAnalyticsToggle = (enabled: boolean) => {
    setAnalyticsConsent(enabled);
    localStorage.setItem(STORAGE_KEYS.COOKIE_CONSENT, enabled ? 'accepted' : 'declined');

    // Show alert to reload for changes to take effect
    if (enabled) {
      alert('Analytics enabled. Please refresh the page for changes to take effect.');
    } else {
      alert('Analytics disabled. Please refresh the page for changes to take effect.');
    }
  };

  const handleResetAllProgress = () => {
    const confirmed = confirm(
      'This will delete ALL your progress, settings, and custom packs. This cannot be undone. Are you sure?'
    );

    if (!confirmed) return;

    // Clear all localStorage
    localStorage.clear();

    // Clear service worker caches
    if ('caches' in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
        });
      });
    }

    // Reload to main menu
    alert('All data has been deleted. The app will now reload.');
    window.location.href = window.location.origin + import.meta.env.BASE_URL;
  };

  return (
    <div className="screen">
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/')}
          aria-label="Home"
          style={{ color: 'var(--color-accent)' }}
        >
          <HomeIcon />
        </button>
        <h2 style={{ margin: 0 }}>Settings</h2>
      </div>

      <div className="flex-col gap-lg">
        {/* Spectrogram Mode */}
        <div className="card">
          <h3>Spectrogram Mode</h3>
          <div className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
            Visual difficulty setting
          </div>
          <div className="flex-row gap-sm">
            {(['full', 'fading', 'none'] as SpectrogramMode[]).map((mode) => (
              <button
                key={mode}
                className={spectrogramMode === mode ? 'btn-primary' : 'btn-secondary'}
                onClick={() => setSpectrogramMode(mode)}
                style={{ flex: 1, textTransform: 'capitalize' }}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Scroll Speed */}
        <div className="card">
          <h3>Scroll Speed</h3>
          <div className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
            How fast tiles move: {scrollSpeed.toFixed(1)}x
          </div>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>

        {/* Continuous Play */}
        <div className="card">
          <div className="flex-row justify-between items-center">
            <div>
              <h3 style={{ marginBottom: '4px' }}>Continuous Play</h3>
              <div className="text-muted" style={{ fontSize: '14px' }}>
                No timer - play until all clips done
              </div>
            </div>
            <button
              className={continuousPlay ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setContinuousPlay(!continuousPlay)}
              style={{ width: '60px' }}
            >
              {continuousPlay ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Privacy & Analytics */}
        <div className="card">
          <div className="flex-row justify-between items-center" style={{ marginBottom: '8px' }}>
            <div>
              <h3 style={{ marginBottom: '0' }}>Analytics</h3>
            </div>
            <button
              className={analyticsConsent ? 'btn-primary' : 'btn-secondary'}
              onClick={() => handleAnalyticsToggle(!analyticsConsent)}
              style={{ width: '60px' }}
            >
              {analyticsConsent ? 'ON' : 'OFF'}
            </button>
          </div>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            I know I'm a stranger, but please accept my cookies! Analytics help me understand how many players I have, which birds everyone loves, and what features are most useful. I promise I'm just adding bird nerds to my LIFE LIST, not stalking you. Your IP is anonymized, no personal data collected, full GDPR/CCPA compliance.
          </div>
        </div>

        {/* Privacy Policy */}
        <div className="card">
          <h3 style={{ marginBottom: '8px' }}>Privacy Policy</h3>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            Learn about how your privacy is protected, what data is collected, and your rights.{' '}
            <button
              onClick={() => navigate('/privacy')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: '13px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View Privacy Policy →
            </button>
          </div>
        </div>

        {/* Help */}
        <div className="card">
          <h3 style={{ marginBottom: '8px' }}>How to Play</h3>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            New to ChipNotes? Learn about gameplay, scoring, packs, and tips.{' '}
            <button
              onClick={() => navigate('/help')}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
                fontSize: '13px',
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: 0,
              }}
            >
              View Help Guide →
            </button>
          </div>
        </div>

        {/* Feedback & Bug Reports */}
        <div className="card">
          <h3 style={{ marginBottom: '8px' }}>Feedback & Bug Reports</h3>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
            Found a bug? Have a feature idea? Email me at{' '}
            <a href="mailto:feedback@chipnotes.app" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
              feedback@chipnotes.app
            </a>
          </div>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            <span style={{ color: 'var(--color-text)' }}>Have a bird sound on your phone that you think should be in the game?</span> Send it to me! I'll add it and give you credit in the app.
          </div>
        </div>

        {/* Support */}
        <div className="card">
          <h3 style={{ marginBottom: '8px' }}>Support This Project</h3>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
            ChipNotes is free,{' '}
            <a
              href="https://github.com/chrysogonum/bird-sound-game"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
              onClick={() => trackExternalLinkClick('https://github.com/chrysogonum/bird-sound-game', 'github_repo', 'settings_page')}
            >
              open source
            </a>
            , and built as a passion project. If it's helped you level-up your birding skills, consider{' '}
            <a
              href="https://ko-fi.com/chipnotes"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}
              onClick={() => trackExternalLinkClick('https://ko-fi.com/chipnotes', 'donation', 'settings_page')}
            >
              supporting development
            </a>
            {' '}- your donations help me add new species, add features, and do more birding. Now, you go build something cool - it might be easier than you think! ;)
          </div>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
            Please also consider supporting the organizations that make this possible, and tell them ChipNotes! sent you:
          </div>
          <ul style={{ fontSize: '13px', lineHeight: '1.5', color: 'var(--color-text-muted)', marginBottom: '12px' }}>
            <li style={{ marginBottom: '8px' }}>
              <a href="https://www.birds.cornell.edu/home/support/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                https://www.birds.cornell.edu/home/support/
              </a>
              {' '}- Incredible bird sound archive
            </li>
            <li>
              <a href="https://xeno-canto.org/about/donate" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
                https://xeno-canto.org/about/donate
              </a>
              {' '}- Community-driven bird recording database
            </li>
          </ul>
          <div className="text-muted" style={{ fontSize: '13px', lineHeight: '1.5' }}>
            Thank you for learning with me! 🐦
          </div>
        </div>

        {/* Reset */}
        <div className="card">
          <button
            className="btn-secondary"
            onClick={handleResetAllProgress}
            style={{ width: '100%', color: 'var(--color-error)' }}
          >
            Reset All Progress
          </button>
        </div>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default Settings;
