import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HUD from '../components/HUD';
import PixiGame from './PixiGame';
import { useGameEngine } from './useGameEngine';
import type { Channel } from '@engine/audio/types';
import type { LevelConfig, GameMode } from '@engine/game/types';
import { trackTrainingModeToggle, trackGameStart, trackRoundComplete } from '../utils/analytics';

// Bird icon component - shows icon with code label below
function BirdIcon({ code, size = 32, color }: { code: string; size?: number; color?: string }) {
  const [hasIcon, setHasIcon] = useState(true);
  const iconPath = `${import.meta.env.BASE_URL}data/icons/${code}.png`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '2px',
    }}>
      {hasIcon && (
        <span style={{
          fontSize: '10px',
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>
          {code}
        </span>
      )}
      {hasIcon ? (
        <img
          src={iconPath}
          alt={code}
          width={size}
          height={size}
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
          }}
          onError={() => setHasIcon(false)}
        />
      ) : (
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color || 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.35,
          fontWeight: 700,
        }}>
          {code}
        </div>
      )}
    </div>
  );
}

interface Species {
  code: string;
  name: string;
  color: string;
}

// Default colors for species that don't have one
const DEFAULT_COLORS = [
  '#E57373',
  '#4FC3F7',
  '#81C784',
  '#FFD54F',
  '#BA68C8',
  '#FF8A65',
  '#4DB6AC',
  '#A1887F',
];

// Level titles for custom pack
const LEVEL_TITLES: Record<number, string> = {
  1: 'Meet the Birds',
  2: 'Sound Variations',
  3: 'Full Repertoire',
  4: 'Both Ears',
  5: 'Variations + Both Ears',
  6: 'Master Birder',
};

// Get clip selection mode for level
function getLevelClipSelection(levelId: number): 'canonical' | number | 'all' {
  if (levelId === 1 || levelId === 4) return 'canonical';
  if (levelId === 2 || levelId === 5) return 3;
  return 'all';
}

// Get channel mode for level
function getLevelChannelMode(levelId: number): 'single' | 'offset' {
  return levelId >= 4 ? 'offset' : 'single';
}

// Fallback configs for non-campaign modes
const MODE_CONFIGS: Record<GameMode, Omit<LevelConfig, 'level_id' | 'pack_id'>> = {
  campaign: {
    mode: 'campaign',
    round_duration_sec: 30,
    species_count: 5,
    event_density: 'low',
    overlap_probability: 0,
    scoring_window_ms: 2000,
    spectrogram_mode: 'full',
    clip_selection: 'canonical',
    channel_mode: 'single',
  },
  practice: {
    mode: 'practice',
    round_duration_sec: 60,
    species_count: 3,
    event_density: 'low',
    overlap_probability: 0,
    scoring_window_ms: 3000,
    spectrogram_mode: 'full',
    clip_selection: 'canonical',
    channel_mode: 'single',
  },
  challenge: {
    mode: 'challenge',
    round_duration_sec: 60,
    species_count: 8,
    event_density: 'medium',
    overlap_probability: 0,
    scoring_window_ms: 1500,
    spectrogram_mode: 'fading',
    clip_selection: 'all',
    channel_mode: 'offset',
  },
  random: {
    mode: 'random',
    round_duration_sec: 45,
    species_count: 6,
    event_density: 'low',
    overlap_probability: 0,
    scoring_window_ms: 2000,
    spectrogram_mode: 'full',
    clip_selection: 'all',
    channel_mode: 'single',
  },
};

function GameplayScreen() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);
  const [campaignLevels, setCampaignLevels] = useState<LevelConfig[]>([]);
  const [showQuitConfirm, setShowQuitConfirm] = useState(false);

  // Training mode state (shows bird icons on tiles)
  const [trainingMode, setTrainingMode] = useState(() => {
    return localStorage.getItem('soundfield_training_mode') === 'true';
  });

  // Track if training mode was used at any point during the round
  const usedTrainingModeRef = useRef(false);

  // Spectrogram mode from settings (full, fading, none)
  const spectrogramModeSetting = useMemo(() => {
    const saved = localStorage.getItem('soundfield_spectrogram_mode');
    return (saved as 'full' | 'fading' | 'none') || 'full';
  }, []);


  // Persist training mode to localStorage and track usage
  useEffect(() => {
    localStorage.setItem('soundfield_training_mode', String(trainingMode));
    // If training mode is enabled, mark it as used for this round
    if (trainingMode) {
      usedTrainingModeRef.current = true;
    }
  }, [trainingMode]);

  // Read mode, pack, and level from URL params
  const mode = (searchParams.get('mode') || 'campaign') as GameMode;
  const packId = searchParams.get('pack') || 'common_se_birds';
  const levelId = parseInt(searchParams.get('level') || '1', 10);

  // Load campaign levels from levels.json
  useEffect(() => {
    console.log('Fetching levels.json...');
    fetch(`${import.meta.env.BASE_URL}data/levels.json`)
      .then((res) => res.json())
      .then((levels: LevelConfig[]) => {
        console.log('Loaded', levels.length, 'levels from levels.json');
        setCampaignLevels(levels);
      })
      .catch((err) => {
        console.error('Failed to load levels.json:', err);
      });
  }, []);

  // Build level config based on mode
  const levelConfig = useMemo((): LevelConfig => {
    console.log('levelConfig useMemo: mode =', mode, 'packId =', packId, 'campaignLevels.length =', campaignLevels.length);

    // Handle custom pack specially - build config from sessionStorage or localStorage
    if (packId === 'custom') {
      let customSpecies: string[] = [];
      try {
        // First try sessionStorage (set by preview screen)
        const sessionJson = sessionStorage.getItem('roundSpecies');
        if (sessionJson) {
          customSpecies = JSON.parse(sessionJson);
        } else {
          // Fallback to localStorage (persistent custom pack)
          const localJson = localStorage.getItem('soundfield_custom_pack');
          if (localJson) {
            customSpecies = JSON.parse(localJson);
            // Also set in sessionStorage for game engine to use
            sessionStorage.setItem('roundSpecies', localJson);
          }
        }
      } catch (e) {
        console.error('Failed to parse custom species:', e);
      }
      console.log('Custom pack: using species:', customSpecies, 'for level', levelId);

      return {
        level_id: levelId,
        pack_id: 'custom',
        mode: 'campaign',
        title: LEVEL_TITLES[levelId] || `Level ${levelId}`,
        round_duration_sec: 30,
        species_count: customSpecies.length,
        species_pool: customSpecies,
        clip_selection: getLevelClipSelection(levelId),
        channel_mode: getLevelChannelMode(levelId),
        event_density: 'low',
        overlap_probability: 0,
        scoring_window_ms: 2000,
        spectrogram_mode: spectrogramModeSetting,
      };
    }

    if (mode === 'campaign' && campaignLevels.length > 0) {
      // Find the requested level from levels.json (match both pack_id AND level_id)
      const level = campaignLevels.find((l) => l.pack_id === packId && l.level_id === levelId);
      if (level) {
        console.log('Found level from levels.json:', level.pack_id, level.title, 'species_pool:', level.species_pool?.length);
        // Apply user's spectrogram mode setting
        return { ...level, spectrogram_mode: spectrogramModeSetting };
      }
      // Fallback to first level for this pack if not found
      const packFirstLevel = campaignLevels.find((l) => l.pack_id === packId);
      if (packFirstLevel) {
        console.log('Using first level for pack:', packFirstLevel.pack_id, packFirstLevel.title);
        return { ...packFirstLevel, spectrogram_mode: spectrogramModeSetting };
      }
      // Ultimate fallback to first level
      console.log('Ultimate fallback to first level');
      return { ...campaignLevels[0], spectrogram_mode: spectrogramModeSetting };
    }

    // For non-campaign modes, use hardcoded configs
    console.log('Using hardcoded MODE_CONFIGS (no campaign levels loaded yet)');
    const modeConfig = MODE_CONFIGS[mode] || MODE_CONFIGS.campaign;
    return {
      level_id: 1,
      pack_id: packId,
      ...modeConfig,
      spectrogram_mode: spectrogramModeSetting,
    };
  }, [mode, packId, levelId, campaignLevels, spectrogramModeSetting]);

  // Use the game engine hook with the level config
  const [gameState, gameActions] = useGameEngine(levelConfig);

  // Initialize engine when level config is ready (wait for levels.json to load)
  const lastLevelKeyRef = useRef<string | null>(null);
  useEffect(() => {
    // Don't initialize until we have the real level config with species_pool
    // (except for custom pack which doesn't need levels.json)
    if (mode === 'campaign' && campaignLevels.length === 0 && packId !== 'custom') {
      console.log('Waiting for levels.json to load...');
      return;
    }

    // Include species_pool length in key so we reinitialize when real config loads
    const speciesPoolKey = levelConfig.species_pool?.length ?? 'none';
    const key = `${levelConfig.pack_id}-${levelConfig.level_id}-${speciesPoolKey}`;
    console.log('Init effect: key =', key, 'lastKey =', lastLevelKeyRef.current);
    if (lastLevelKeyRef.current !== key) {
      lastLevelKeyRef.current = key;
      console.log('Initializing for', key);
      gameActions.initialize();
      // Track game start
      trackGameStart(
        levelConfig.pack_id,
        levelConfig.level_id,
        levelConfig.species_pool?.length ?? 0
      );
    }
  }, [mode, campaignLevels.length, levelConfig.pack_id, levelConfig.level_id, levelConfig.species_pool, gameActions]);

  // Update dimensions on mount and resize
  useEffect(() => {
    const updateDimensions = () => {
      if (gameContainerRef.current) {
        const rect = gameContainerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Refs to track state for cleanup (avoids stale closure)
  const gameActionsRef = useRef(gameActions);
  gameActionsRef.current = gameActions;
  const roundStateRef = useRef(gameState.roundState);
  roundStateRef.current = gameState.roundState;

  // Cleanup on unmount - stop audio when navigating away (e.g., browser back button)
  // Only reset if still playing - don't overwrite results if round already ended
  useEffect(() => {
    return () => {
      if (roundStateRef.current === 'playing') {
        gameActionsRef.current.reset();
      }
    };
  }, []); // Empty deps - only runs on true unmount

  // Check if continuous mode is enabled
  const isContinuousMode = useMemo(() => {
    return localStorage.getItem('soundfield_continuous_play') === 'true';
  }, []);

  // Convert species from engine to RadialWheel format
  const speciesForWheel: Species[] = gameState.species.map((sp, index) => ({
    code: sp.code,
    name: sp.name,
    color: sp.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }));

  // Handle channel tap (left/right)
  const handleChannelTap = useCallback((channel: Channel) => {
    setSelectedChannel(channel);

    // Flash effect feedback
    const flashEl = document.getElementById(`flash-${channel}`);
    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 150);
    }

    // If species is already selected, submit the input
    if (selectedSpecies) {
      gameActions.submitInput(selectedSpecies, channel);
      setSelectedChannel(null);
      setSelectedSpecies(null);
    }
  }, [selectedSpecies, gameActions]);

  // Handle species selection
  const handleSpeciesSelect = useCallback((speciesCode: string) => {
    setSelectedSpecies(speciesCode);

    // If channel is already selected, submit the input
    if (selectedChannel) {
      gameActions.submitInput(speciesCode, selectedChannel);
      setSelectedChannel(null);
      setSelectedSpecies(null);
    }
  }, [selectedChannel, gameActions]);

  // Keyboard controls for laptop/desktop
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle keys during active gameplay
      if (gameState.roundState !== 'playing') return;

      // Left channel: A, ArrowLeft, or 1
      if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft' || e.key === '1') {
        handleChannelTap('left');
      }
      // Right channel: D, ArrowRight, or 2
      else if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight' || e.key === '2') {
        handleChannelTap('right');
      }
      // Species selection: number keys 3-9 or letter keys
      else if (e.key >= '3' && e.key <= '9') {
        const index = parseInt(e.key) - 3;
        if (index < speciesForWheel.length) {
          handleSpeciesSelect(speciesForWheel[index].code);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState.roundState, handleChannelTap, handleSpeciesSelect, speciesForWheel]);

  // Handle back button - return to level select
  const handleBack = useCallback(() => {
    gameActions.reset();
    navigate(-1); // Go back to level select
  }, [navigate, gameActions]);

  // Handle quit confirmation
  const handleQuitClick = useCallback(() => {
    setShowQuitConfirm(true);
  }, []);

  const handleQuitConfirm = useCallback(() => {
    gameActions.reset();
    navigate(-1); // Go back to previous screen (pack select or level select)
  }, [navigate, gameActions]);

  const handleQuitCancel = useCallback(() => {
    setShowQuitConfirm(false);
  }, []);

  // Handle start round
  const handleStart = useCallback(() => {
    console.log('handleStart clicked, isAudioReady:', gameState.isAudioReady, 'species.length:', gameState.species.length);
    if (gameState.isAudioReady && gameState.species.length > 0) {
      console.log('Calling startRound...');
      // Reset training mode tracking for new round (but keep current state)
      usedTrainingModeRef.current = trainingMode; // If already on, count it
      gameActions.startRound();
    } else {
      console.log('Not calling startRound - conditions not met');
    }
  }, [gameState.isAudioReady, gameState.species.length, gameActions, trainingMode]);

  // Handle end round (manual end via button)
  const handleEndRound = useCallback(() => {
    gameActions.endRound();
    // Add training mode flag before navigating (same as auto-end effect)
    try {
      const savedResults = localStorage.getItem('soundfield_round_results');
      if (savedResults) {
        const results = JSON.parse(savedResults);
        results.usedTrainingMode = usedTrainingModeRef.current;
        localStorage.setItem('soundfield_round_results', JSON.stringify(results));
      }
    } catch (e) {
      console.error('Failed to update results with training mode flag:', e);
    }
    navigate('/summary', { replace: true });
  }, [navigate, gameActions]);

  // Auto-navigate to summary when round ends
  useEffect(() => {
    if (gameState.roundState === 'ended') {
      // Add training mode usage flag to saved results
      try {
        const savedResults = localStorage.getItem('soundfield_round_results');
        if (savedResults) {
          const results = JSON.parse(savedResults);
          results.usedTrainingMode = usedTrainingModeRef.current;
          localStorage.setItem('soundfield_round_results', JSON.stringify(results));

          // Track round completion
          const accuracy = results.correctCount && results.totalEvents
            ? (results.correctCount / results.totalEvents) * 100
            : 0;
          const duration = results.duration ?? 0;
          trackRoundComplete(
            levelConfig.pack_id,
            levelConfig.level_id,
            gameState.score,
            accuracy,
            duration
          );
        }
      } catch (e) {
        console.error('Failed to update results with training mode flag:', e);
      }
      navigate('/summary', { replace: true });
    }
  }, [gameState.roundState, gameState.score, levelConfig.pack_id, levelConfig.level_id, navigate]);

  return (
    <div className="gameplay-screen">
      {/* HUD */}
      <HUD
        score={gameState.score}
        streak={gameState.streak}
        timeRemaining={gameState.timeRemaining}
        mode={mode}
        levelId={levelConfig.level_id}
        levelTitle={levelConfig.title}
      />

      {/* Back button overlay */}
      <button className="back-button" onClick={handleBack} aria-label="Back to menu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>

      {/* Quit button - only show during playing state */}
      {gameState.roundState === 'playing' && (
        <button
          className="quit-button"
          onClick={handleQuitClick}
          aria-label="Quit round"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}

      {/* Training mode toggle button */}
      <button
        className={`training-toggle ${trainingMode ? 'active' : ''}`}
        onClick={() => {
          const newMode = !trainingMode;
          setTrainingMode(newMode);
          trackTrainingModeToggle(newMode);
        }}
        aria-label={trainingMode ? 'Disable training mode' : 'Enable training mode'}
        title={trainingMode ? 'Training Mode ON - Icons visible' : 'Training Mode OFF'}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {/* Eye icon - open when training, closed when not */}
          {trainingMode ? (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          ) : (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          )}
        </svg>
      </button>

      {/* End Round button for continuous mode */}
      {isContinuousMode && gameState.roundState === 'playing' && (
        <button
          className="end-round-button"
          onClick={handleEndRound}
          aria-label="End round"
        >
          End Round
        </button>
      )}

      {/* Game area with PixiJS canvas */}
      <div ref={gameContainerRef} className="game-container">
        <PixiGame
          width={dimensions.width}
          height={dimensions.height}
          scheduledEvents={gameState.scheduledEvents}
          activeEvents={gameState.activeEvents}
          roundStartTime={gameState.roundStartTime}
          roundState={gameState.roundState}
          scrollSpeed={gameState.scrollSpeed}
          currentFeedback={gameState.currentFeedback}
          onChannelTap={handleChannelTap}
          trainingMode={trainingMode}
          spectrogramMode={levelConfig.spectrogram_mode}
        />

        {/* Channel flash overlays */}
        <div id="flash-left" className="channel-flash left" />
        <div id="flash-right" className="channel-flash right" />

        {/* Selected channel indicator */}
        {selectedChannel && (
          <div className={`channel-indicator ${selectedChannel}`}>
            {selectedChannel.toUpperCase()}
          </div>
        )}

        {/* Start overlay when idle */}
        {gameState.roundState === 'idle' && (
          <div className="start-overlay">
            <button
              className="start-button"
              onClick={handleStart}
              disabled={!gameState.isAudioReady || gameState.species.length === 0}
            >
              {gameState.isAudioReady && gameState.species.length > 0
                ? 'Start Round'
                : 'Loading...'}
            </button>
          </div>
        )}

        {/* Feedback overlay */}
        {gameState.currentFeedback && (
          <div className={`feedback-overlay ${gameState.currentFeedback.type} ${gameState.currentFeedback.channel}`}>
            <div className="feedback-score">+{gameState.currentFeedback.score}</div>
            <div className="feedback-type">{gameState.currentFeedback.type.toUpperCase()}</div>
            {gameState.currentFeedback.type === 'miss' && gameState.currentFeedback.expectedSpecies && (
              <div className="feedback-correct">Was: {gameState.currentFeedback.expectedSpecies}</div>
            )}
          </div>
        )}
      </div>

      {/* Dual species buttons - left and right columns */}
      <div className="dual-input-panel">
        <div className="input-column left">
          <div className="column-label">LEFT EAR</div>
          <div className="species-buttons">
            {speciesForWheel.map((sp) => (
              <button
                key={sp.code}
                className={`species-btn ${selectedSpecies === sp.code ? 'selected' : ''}`}
                style={{ backgroundColor: selectedSpecies === sp.code ? sp.color : undefined }}
                onClick={() => {
                  gameActions.submitInput(sp.code, 'left');
                  const flashEl = document.getElementById('flash-left');
                  if (flashEl) {
                    flashEl.classList.add('active');
                    setTimeout(() => flashEl.classList.remove('active'), 150);
                  }
                }}
                disabled={gameState.roundState !== 'playing'}
              >
                <BirdIcon code={sp.code} size={36} color={sp.color} />
              </button>
            ))}
          </div>
        </div>
        <div className="input-column right">
          <div className="column-label">RIGHT EAR</div>
          <div className="species-buttons">
            {speciesForWheel.map((sp) => (
              <button
                key={sp.code}
                className={`species-btn ${selectedSpecies === sp.code ? 'selected' : ''}`}
                style={{ backgroundColor: selectedSpecies === sp.code ? sp.color : undefined }}
                onClick={() => {
                  gameActions.submitInput(sp.code, 'right');
                  const flashEl = document.getElementById('flash-right');
                  if (flashEl) {
                    flashEl.classList.add('active');
                    setTimeout(() => flashEl.classList.remove('active'), 150);
                  }
                }}
                disabled={gameState.roundState !== 'playing'}
              >
                <BirdIcon code={sp.code} size={36} color={sp.color} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Quit confirmation modal */}
      {showQuitConfirm && (
        <div className="quit-modal-overlay">
          <div className="quit-modal">
            <h3 style={{ margin: 0, marginBottom: '16px', fontSize: '20px' }}>Quit Round?</h3>
            <p style={{ margin: 0, marginBottom: '24px', color: 'var(--color-text-muted)', fontSize: '14px' }}>
              Your progress will not be saved.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn-secondary"
                onClick={handleQuitCancel}
                style={{ flex: 1, padding: '12px' }}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleQuitConfirm}
                style={{ flex: 1, padding: '12px', background: 'var(--color-error)' }}
              >
                Quit
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .gameplay-screen {
          display: flex;
          flex-direction: column;
          height: 100%;
          background-color: var(--color-background);
          overflow: hidden;
        }

        .back-button {
          position: absolute;
          top: calc(12px + var(--safe-area-top, 0px));
          left: 8px;
          width: 40px;
          height: 40px;
          background: rgba(0, 0, 0, 0.3);
          border: none;
          border-radius: 50%;
          color: var(--color-accent);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          transition: background 0.2s;
        }

        .back-button:hover {
          background: rgba(0, 0, 0, 0.5);
        }

        .quit-button {
          position: absolute;
          top: calc(12px + var(--safe-area-top, 0px));
          right: 8px;
          width: 40px;
          height: 40px;
          background: rgba(229, 115, 115, 0.3);
          border: none;
          border-radius: 50%;
          color: var(--color-error);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          transition: background 0.2s;
        }

        .quit-button:hover {
          background: rgba(229, 115, 115, 0.5);
        }

        .quit-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: fadeIn 0.2s ease-out;
        }

        .quit-modal {
          background: var(--color-surface);
          border-radius: 16px;
          padding: 24px;
          max-width: 320px;
          width: 90%;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          animation: slideUp 0.2s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes slideUp {
          from {
            transform: translateY(20px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }

        .training-toggle {
          position: absolute;
          top: calc(12px + var(--safe-area-top, 0px));
          left: 56px;
          width: 40px;
          height: 40px;
          background: rgba(0, 0, 0, 0.3);
          border: 2px solid transparent;
          border-radius: 50%;
          color: var(--color-text-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 100;
          transition: all 0.2s;
        }

        .training-toggle:hover {
          background: rgba(0, 0, 0, 0.5);
        }

        .training-toggle.active {
          background: rgba(76, 175, 80, 0.3);
          border-color: rgba(76, 175, 80, 0.6);
          color: #81C784;
        }

        .end-round-button {
          position: absolute;
          top: calc(12px + var(--safe-area-top, 0px));
          right: 12px;
          padding: 8px 16px;
          background: rgba(229, 115, 115, 0.8);
          border: none;
          border-radius: 20px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          z-index: 100;
          transition: background 0.2s;
        }

        .end-round-button:hover {
          background: rgba(229, 115, 115, 1);
        }

        .game-container {
          flex: 1;
          position: relative;
          min-height: 0;
          overflow: hidden;
        }

        .channel-flash {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 50%;
          pointer-events: none;
          background: transparent;
          transition: background 0.1s;
        }

        .channel-flash.left {
          left: 0;
        }

        .channel-flash.right {
          right: 0;
        }

        .channel-flash.active {
          background: rgba(255, 255, 255, 0.1);
        }

        .channel-indicator {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          padding: 8px 16px;
          background: var(--color-accent);
          color: var(--color-background);
          font-weight: 700;
          font-size: 14px;
          border-radius: 4px;
          pointer-events: none;
          animation: fadeIn 0.15s ease-out;
        }

        .channel-indicator.left {
          left: 20px;
        }

        .channel-indicator.right {
          right: 20px;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-50%) scale(0.9);
          }
          to {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
        }

        .start-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 0, 0, 0.7);
          z-index: 50;
        }

        .start-button {
          padding: 16px 32px;
          font-size: 18px;
          font-weight: 700;
          background: var(--color-primary);
          color: white;
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: transform 0.2s, background 0.2s;
        }

        .start-button:hover:not(:disabled) {
          transform: scale(1.05);
          background: var(--color-accent);
        }

        .start-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .feedback-overlay {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          padding: 12px 20px;
          border-radius: 8px;
          pointer-events: none;
          animation: feedbackPop 0.5s ease-out forwards;
          z-index: 60;
        }

        .feedback-overlay.left {
          left: 20%;
        }

        .feedback-overlay.right {
          right: 20%;
        }

        .feedback-overlay.perfect {
          background: var(--color-success);
        }

        .feedback-overlay.good {
          background: #4CAF50;
        }

        .feedback-overlay.partial {
          background: var(--color-accent);
        }

        .feedback-overlay.miss {
          background: var(--color-error);
          animation: feedbackPopMiss 1.5s ease-out forwards;
        }

        .feedback-score {
          font-family: var(--font-mono);
          font-size: 24px;
          font-weight: 700;
          color: white;
          text-align: center;
        }

        .feedback-type {
          font-size: 12px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.8);
          text-align: center;
        }

        .feedback-correct {
          font-size: 14px;
          font-weight: 700;
          color: white;
          text-align: center;
          margin-top: 4px;
          padding-top: 4px;
          border-top: 1px solid rgba(255, 255, 255, 0.3);
        }

        @keyframes feedbackPop {
          0% {
            opacity: 0;
            transform: translateY(-50%) scale(0.8);
          }
          20% {
            opacity: 1;
            transform: translateY(-50%) scale(1.1);
          }
          40% {
            transform: translateY(-50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-80%) scale(1);
          }
        }

        @keyframes feedbackPopMiss {
          0% {
            opacity: 0;
            transform: translateY(-50%) scale(0.8);
          }
          5% {
            opacity: 1;
            transform: translateY(-50%) scale(1.1);
          }
          10% {
            transform: translateY(-50%) scale(1);
          }
          85% {
            opacity: 1;
            transform: translateY(-50%) scale(1);
          }
          100% {
            opacity: 0;
            transform: translateY(-70%) scale(1);
          }
        }

        .dual-input-panel {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          padding-bottom: calc(12px + var(--safe-area-bottom, 0px));
          background: linear-gradient(0deg, var(--color-surface) 0%, rgba(26, 26, 46, 0.9) 100%);
          gap: 20px;
        }

        .input-column {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .input-column.left {
          align-items: flex-start;
        }

        .input-column.right {
          align-items: flex-end;
        }

        .column-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 2px 8px;
          border-radius: 4px;
        }

        .input-column.left .column-label {
          color: #81C784;
          background: rgba(129, 199, 132, 0.15);
        }

        .input-column.right .column-label {
          color: #64B5F6;
          background: rgba(100, 181, 246, 0.15);
        }

        .species-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .input-column.left .species-buttons {
          justify-content: flex-start;
        }

        .input-column.right .species-buttons {
          justify-content: flex-end;
        }

        .species-btn {
          padding: 6px;
          border-radius: 12px;
          border: 2px solid var(--color-text-muted);
          background: var(--color-surface);
          color: var(--color-text);
          font-size: 10px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease-out;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .species-btn:hover:not(:disabled) {
          transform: scale(1.1);
        }

        .species-btn:active:not(:disabled) {
          transform: scale(0.95);
        }

        .species-btn.selected {
          color: var(--color-background);
          transform: scale(1.05);
        }

        .species-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

export default GameplayScreen;
