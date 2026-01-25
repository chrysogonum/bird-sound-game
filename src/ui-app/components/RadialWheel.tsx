import { memo, useState, useCallback } from 'react';

export interface Species {
  code: string;
  displayCode: string;  // Short code shown in UI (may differ from eBird code for NZ birds)
  tileName: string;     // Name to show on buttons/tiles (Māori name or short English)
  name: string;
  color?: string;
}

export interface RadialWheelProps {
  species: Species[];
  selectedSpecies: string | null;
  onSelect: (speciesCode: string) => void;
  disabled?: boolean;
}

const DEFAULT_COLORS = [
  '#E57373', // Red
  '#4FC3F7', // Light Blue
  '#81C784', // Green
  '#FFD54F', // Yellow
  '#BA68C8', // Purple
  '#FF8A65', // Orange
  '#4DB6AC', // Teal
  '#A1887F', // Brown
];

function RadialWheel({ species, selectedSpecies, onSelect, disabled = false }: RadialWheelProps) {
  const [hoveredSpecies, setHoveredSpecies] = useState<string | null>(null);

  const handleSelect = useCallback((code: string) => {
    if (!disabled) {
      onSelect(code);
    }
  }, [disabled, onSelect]);

  // Calculate positions in a semicircle/arc at bottom
  const getPosition = (index: number, total: number) => {
    // Arc from -80° to 80° (160° sweep)
    const startAngle = -80 * (Math.PI / 180);
    const endAngle = 80 * (Math.PI / 180);
    const angleRange = endAngle - startAngle;
    const angle = startAngle + (index / (total - 1 || 1)) * angleRange;

    // Radius as percentage of container width
    const radius = 38;
    const x = 50 + radius * Math.sin(angle);
    const y = 85 - radius * Math.cos(angle); // 85% from top, inverted for bottom arc

    return { x, y, angle };
  };

  return (
    <div className="radial-wheel-container">
      <div className="radial-wheel">
        {species.map((sp, index) => {
          const { x, y } = getPosition(index, species.length);
          const isSelected = selectedSpecies === sp.code;
          const isHovered = hoveredSpecies === sp.code;
          const color = sp.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

          return (
            <button
              key={sp.code}
              className={`species-button ${isSelected ? 'selected' : ''} ${isHovered ? 'hovered' : ''}`}
              style={{
                left: `${x}%`,
                top: `${y}%`,
                backgroundColor: isSelected ? color : 'var(--color-surface)',
                borderColor: color,
              }}
              onClick={() => handleSelect(sp.code)}
              onMouseEnter={() => setHoveredSpecies(sp.code)}
              onMouseLeave={() => setHoveredSpecies(null)}
              onTouchStart={() => setHoveredSpecies(sp.code)}
              onTouchEnd={() => setHoveredSpecies(null)}
              disabled={disabled}
              aria-label={sp.name}
              aria-pressed={isSelected}
            >
              <span className="species-code">{sp.tileName}</span>
              {(isHovered || isSelected) && (
                <span className="species-tooltip">{sp.name}</span>
              )}
            </button>
          );
        })}
      </div>

      <style>{`
        .radial-wheel-container {
          width: 100%;
          height: 160px;
          padding-bottom: var(--safe-area-bottom, 0px);
          background: linear-gradient(0deg, var(--color-surface) 0%, transparent 100%);
        }

        .radial-wheel {
          position: relative;
          width: 100%;
          height: 100%;
          max-width: 400px;
          margin: 0 auto;
        }

        .species-button {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 56px;
          height: 56px;
          border-radius: 50%;
          border: 3px solid;
          background: var(--color-surface);
          cursor: pointer;
          transition: all 0.15s ease-out;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }

        .species-button:hover:not(:disabled),
        .species-button.hovered:not(:disabled) {
          transform: translate(-50%, -50%) scale(1.15);
          z-index: 10;
        }

        .species-button.selected {
          transform: translate(-50%, -50%) scale(1.1);
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.3);
          z-index: 5;
        }

        .species-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .species-button:active:not(:disabled) {
          transform: translate(-50%, -50%) scale(0.95);
        }

        .species-code {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.5px;
          color: var(--color-text);
        }

        .species-tooltip {
          position: absolute;
          bottom: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--color-background);
          color: var(--color-text);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          pointer-events: none;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .species-tooltip::after {
          content: '';
          position: absolute;
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border: 4px solid transparent;
          border-top-color: var(--color-background);
        }
      `}</style>
    </div>
  );
}

export default memo(RadialWheel);
