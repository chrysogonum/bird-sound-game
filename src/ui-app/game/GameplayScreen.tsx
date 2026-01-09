import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import HUD from '../components/HUD';
import PixiGame from './PixiGame';
import { useGameEngine } from './useGameEngine';
import type { Channel } from '@engine/audio/types';
import type { LevelConfig, GameMode } from '@engine/game/types';

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

  // Read mode, pack, and level from URL params
  const mode = (searchParams.get('mode') || 'campaign') as GameMode;
  const packId = searchParams.get('pack') || 'common_se_birds';
  const levelId = parseInt(searchParams.get('level') || '1', 10);

  // Load campaign levels from levels.json
  useEffect(() => {
    fetch('/data/levels.json')
      .then((res) => res.json())
      .then((levels: LevelConfig[]) => {
        setCampaignLevels(levels);
      })
      .catch((err) => {
        console.error('Failed to load levels.json:', err);
      });
  }, []);

  // Build level config based on mode
  const levelConfig = useMemo((): LevelConfig => {
    if (mode === 'campaign' && campaignLevels.length > 0) {
      // Find the requested level from levels.json
      const level = campaignLevels.find((l) => l.level_id === levelId);
      if (level) {
        return level;
      }
      // Fallback to first level if not found
      return campaignLevels[0];
    }

    // For non-campaign modes, use hardcoded configs
    const modeConfig = MODE_CONFIGS[mode] || MODE_CONFIGS.campaign;
    return {
      level_id: 1,
      pack_id: packId,
      ...modeConfig,
    };
  }, [mode, packId, levelId, campaignLevels]);

  // Use the game engine hook with the level config
  const [gameState, gameActions] = useGameEngine(levelConfig);

  // Initialize engine on mount
  useEffect(() => {
    gameActions.initialize();
  }, [gameActions]);

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

  // Handle back button
  const handleBack = useCallback(() => {
    gameActions.reset();
    navigate('/');
  }, [navigate, gameActions]);

  // Handle start round
  const handleStart = useCallback(() => {
    if (gameState.isAudioReady && gameState.species.length > 0) {
      gameActions.startRound();
    }
  }, [gameState.isAudioReady, gameState.species.length, gameActions]);

  // Handle end round
  const handleEndRound = useCallback(() => {
    gameActions.endRound();
    navigate('/summary');
  }, [navigate, gameActions]);

  // Auto-navigate to summary when round ends
  useEffect(() => {
    if (gameState.roundState === 'ended') {
      navigate('/summary');
    }
  }, [gameState.roundState, navigate]);

  return (
    <div className="gameplay-screen">
      {/* HUD */}
      <HUD
        score={gameState.score}
        streak={gameState.streak}
        maxStreak={gameState.maxStreak}
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
                style={{ borderColor: sp.color, backgroundColor: selectedSpecies === sp.code ? sp.color : undefined }}
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
                {sp.code}
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
                style={{ borderColor: sp.color, backgroundColor: selectedSpecies === sp.code ? sp.color : undefined }}
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
                {sp.code}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dev: End round button */}
      {gameState.roundState === 'playing' && (
        <button className="dev-end-button" onClick={handleEndRound}>
          End Round (dev)
        </button>
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
          color: var(--color-text);
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

        .dev-end-button {
          position: absolute;
          bottom: calc(170px + var(--safe-area-bottom, 0px));
          right: 8px;
          padding: 4px 8px;
          font-size: 10px;
          background: var(--color-surface);
          border: 1px solid var(--color-text-muted);
          border-radius: 4px;
          color: var(--color-text-muted);
          cursor: pointer;
          opacity: 0.5;
          z-index: 100;
        }

        .dev-end-button:hover {
          opacity: 1;
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
          width: 48px;
          height: 48px;
          border-radius: 50%;
          border: 3px solid;
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
