import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HUD from '../components/HUD';
import RadialWheel, { Species } from '../components/RadialWheel';
import PixiGame from './PixiGame';
import { useGameEngine } from './useGameEngine';
import type { Channel } from '@engine/audio/types';

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

function GameplayScreen() {
  const navigate = useNavigate();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null);

  // Use the game engine hook
  const [gameState, gameActions] = useGameEngine();

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

      {/* Radial species wheel */}
      <RadialWheel
        species={speciesForWheel}
        selectedSpecies={selectedSpecies}
        onSelect={handleSpeciesSelect}
        disabled={gameState.roundState !== 'playing'}
      />

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
      `}</style>
    </div>
  );
}

export default GameplayScreen;
