import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import HUD from '../components/HUD';
import RadialWheel, { Species } from '../components/RadialWheel';
import PixiGame from './PixiGame';

// Mock species data for 8 placeholder species
const MOCK_SPECIES: Species[] = [
  { code: 'NOCA', name: 'Northern Cardinal', color: '#E57373' },
  { code: 'BLJA', name: 'Blue Jay', color: '#4FC3F7' },
  { code: 'CARW', name: 'Carolina Wren', color: '#81C784' },
  { code: 'AMCR', name: 'American Crow', color: '#424242' },
  { code: 'TUTI', name: 'Tufted Titmouse', color: '#FFD54F' },
  { code: 'EABL', name: 'Eastern Bluebird', color: '#4A90D9' },
  { code: 'MODO', name: 'Mourning Dove', color: '#A1887F' },
  { code: 'AMRO', name: 'American Robin', color: '#FF8A65' },
];

// Mock game state
interface GameState {
  score: number;
  streak: number;
  timeRemaining: number;
  selectedChannel: 'left' | 'right' | null;
  selectedSpecies: string | null;
}

function GameplayScreen() {
  const navigate = useNavigate();
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 400 });

  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    streak: 0,
    timeRemaining: 60,
    selectedChannel: null,
    selectedSpecies: null,
  });

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

  // Handle channel tap (left/right)
  const handleChannelTap = useCallback((channel: 'left' | 'right') => {
    setGameState(prev => ({
      ...prev,
      selectedChannel: channel,
    }));

    // Flash effect feedback
    const flashEl = document.getElementById(`flash-${channel}`);
    if (flashEl) {
      flashEl.classList.add('active');
      setTimeout(() => flashEl.classList.remove('active'), 150);
    }
  }, []);

  // Handle species selection
  const handleSpeciesSelect = useCallback((speciesCode: string) => {
    setGameState(prev => {
      // If both channel and species are selected, process the input
      if (prev.selectedChannel) {
        // Mock scoring - in real game this would check against the current event
        const pointsEarned = 100;
        return {
          ...prev,
          score: prev.score + pointsEarned,
          streak: prev.streak + 1,
          selectedChannel: null,
          selectedSpecies: null,
        };
      }

      return {
        ...prev,
        selectedSpecies: speciesCode,
      };
    });
  }, []);

  // Handle back button
  const handleBack = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // Mock end round
  const handleEndRound = useCallback(() => {
    navigate('/summary');
  }, [navigate]);

  return (
    <div className="gameplay-screen">
      {/* HUD */}
      <HUD
        score={gameState.score}
        streak={gameState.streak}
        maxStreak={5}
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
        {gameState.selectedChannel && (
          <div className={`channel-indicator ${gameState.selectedChannel}`}>
            {gameState.selectedChannel.toUpperCase()}
          </div>
        )}
      </div>

      {/* Radial species wheel */}
      <RadialWheel
        species={MOCK_SPECIES}
        selectedSpecies={gameState.selectedSpecies}
        onSelect={handleSpeciesSelect}
      />

      {/* Dev: End round button */}
      <button className="dev-end-button" onClick={handleEndRound}>
        End Round (dev)
      </button>

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
