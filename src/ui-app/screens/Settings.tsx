import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

type SpectrogramMode = 'full' | 'fading' | 'none';

// Storage keys
const STORAGE_KEYS = {
  SCROLL_SPEED: 'soundfield_scroll_speed',
  SPECTROGRAM_MODE: 'soundfield_spectrogram_mode',
  HIGH_CONTRAST: 'soundfield_high_contrast',
  CONTINUOUS_PLAY: 'soundfield_continuous_play',
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
  const [highContrast, setHighContrast] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.HIGH_CONTRAST) === 'true';
  });
  const [continuousPlay, setContinuousPlay] = useState(() => {
    return localStorage.getItem(STORAGE_KEYS.CONTINUOUS_PLAY) === 'true';
  });

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SPECTROGRAM_MODE, spectrogramMode);
  }, [spectrogramMode]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.SCROLL_SPEED, scrollSpeed.toString());
  }, [scrollSpeed]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.HIGH_CONTRAST, highContrast.toString());
  }, [highContrast]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.CONTINUOUS_PLAY, continuousPlay.toString());
  }, [continuousPlay]);

  return (
    <div className="screen">
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
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

        {/* High Contrast */}
        <div className="card">
          <div className="flex-row justify-between items-center">
            <div>
              <h3 style={{ marginBottom: '4px' }}>High Contrast</h3>
              <div className="text-muted" style={{ fontSize: '14px' }}>
                Enhanced visibility
              </div>
            </div>
            <button
              className={highContrast ? 'btn-primary' : 'btn-secondary'}
              onClick={() => setHighContrast(!highContrast)}
              style={{ width: '60px' }}
            >
              {highContrast ? 'ON' : 'OFF'}
            </button>
          </div>
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

        {/* Audio */}
        <div className="card">
          <h3>Audio</h3>
          <div className="text-muted" style={{ fontSize: '14px', marginBottom: '12px' }}>
            Run headphone calibration
          </div>
          <button className="btn-secondary" style={{ width: '100%' }}>
            Calibrate Headphones
          </button>
        </div>

        {/* Reset */}
        <div className="card">
          <button
            className="btn-secondary"
            style={{ width: '100%', color: 'var(--color-error)' }}
          >
            Reset All Progress
          </button>
        </div>
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

export default Settings;
