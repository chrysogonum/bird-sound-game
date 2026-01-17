import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  canonical?: boolean;
  rejected?: boolean;
}

interface SpeciesInfo {
  code: string;
  name: string;
  clipPath: string | null;
}

const MAX_SPECIES = 9;
const CUSTOM_PACK_KEY = 'soundfield_custom_pack';

// Colors for selected species
const SPECIES_COLORS = [
  '#E57373', '#4FC3F7', '#81C784', '#FFD54F',
  '#BA68C8', '#FF8A65', '#4DB6AC', '#A1887F', '#90A4AE',
];

function CustomPackBuilder() {
  const navigate = useNavigate();
  const [allSpecies, setAllSpecies] = useState<SpeciesInfo[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Load all species from clips.json
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/clips.json`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        return res.json();
      })
      .then((clips: ClipData[]) => {
        // Extract unique species
        const speciesMap = new Map<string, SpeciesInfo>();
        for (const clip of clips) {
          if (clip.rejected) continue;
          if (!speciesMap.has(clip.species_code)) {
            const canonicalClip = clips.find(
              c => c.species_code === clip.species_code && c.canonical && !c.rejected && c.common_name
            );
            const clipToUse = canonicalClip || clips.find(
              c => c.species_code === clip.species_code && c.common_name && !c.rejected
            ) || clip;

            // Skip if no common_name found
            if (!clipToUse.common_name) {
              console.warn(`Skipping ${clip.species_code} - missing common_name`);
              continue;
            }

            speciesMap.set(clip.species_code, {
              code: clip.species_code,
              name: clipToUse.common_name,
              clipPath: `${import.meta.env.BASE_URL}data/clips/${clipToUse.file_path.split('/').pop()}`,
            });
          }
        }
        // Sort alphabetically by name
        const sorted = Array.from(speciesMap.values()).sort((a, b) =>
          (a.name || a.code).localeCompare(b.name || b.code)
        );
        setAllSpecies(sorted);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load clips:', err);
        setLoading(false);
      });

    // Load saved custom pack
    try {
      const saved = localStorage.getItem(CUSTOM_PACK_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSelectedCodes(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved pack:', e);
    }
  }, []);

  // Toggle species selection
  const toggleSpecies = useCallback((code: string) => {
    setSelectedCodes((prev) => {
      const isCurrentlySelected = prev.includes(code);
      const isAtMax = prev.length >= MAX_SPECIES;

      if (isCurrentlySelected) {
        // Removing a bird - just remove it
        return prev.filter((c) => c !== code);
      }

      if (isAtMax) {
        // Can't add - at max
        return prev;
      }

      // Adding a new bird - clear search and refocus input for next entry
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);

      return [...prev, code];
    });
  }, []);

  // Play preview sound
  const playPreview = (species: SpeciesInfo, e: React.MouseEvent) => {
    e.stopPropagation();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingCode === species.code) {
      setPlayingCode(null);
      return;
    }

    if (!species.clipPath) return;

    const audio = new Audio(species.clipPath);
    audioRef.current = audio;
    setPlayingCode(species.code);

    audio.play().catch((err) => console.error('Failed to play:', err));
    audio.onended = () => {
      setPlayingCode(null);
      audioRef.current = null;
    };
  };

  // Save and go to level select
  const handleSaveAndPlay = () => {
    if (selectedCodes.length === 0) return;

    // Save to localStorage
    localStorage.setItem(CUSTOM_PACK_KEY, JSON.stringify(selectedCodes));

    // Navigate to level select for custom pack
    navigate('/level-select?pack=custom');
  };

  // Clear selection
  const handleClear = () => {
    setSelectedCodes([]);
  };

  // Clear search and refocus
  const handleClearSearch = () => {
    setSearchQuery('');
    // Focus the input after clearing
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  // Filter species by search
  const filteredSpecies = searchQuery
    ? allSpecies.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : allSpecies;

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="screen screen-center">
        <div style={{ color: 'var(--color-text-muted)' }}>Loading species...</div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: '12px' }}>
        <div className="flex-row items-center gap-md">
          <button className="btn-icon" onClick={() => navigate('/pack-select')} aria-label="Back">
            <BackIcon />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Custom Pack Builder</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Select up to {MAX_SPECIES} birds
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div style={{ flexShrink: 0, marginBottom: '12px', position: 'relative' }}>
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search birds..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            paddingRight: searchQuery ? '36px' : '12px',
            background: 'var(--color-surface)',
            border: '1px solid var(--color-text-muted)',
            borderRadius: '8px',
            color: 'var(--color-text)',
            fontSize: '14px',
          }}
        />
        {searchQuery && (
          <button
            onClick={handleClearSearch}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'var(--color-text-muted)',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-background)" strokeWidth="3">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Instruction hint */}
      <div style={{
        flexShrink: 0,
        marginBottom: '12px',
        padding: '8px 12px',
        background: 'rgba(45, 90, 39, 0.1)',
        borderRadius: '8px',
        fontSize: '13px',
        color: 'var(--color-text-muted)',
        lineHeight: 1.4,
      }}>
        <span style={{ color: 'var(--color-accent)' }}>💡 Tip:</span> Click the <strong style={{ color: 'var(--color-text)' }}>▶ play button</strong> to preview a bird's signature sound. Click the <strong style={{ color: 'var(--color-text)' }}>bird card</strong> to add it to your pack.
      </div>

      {/* Start button - Sticky below search */}
      {selectedCodes.length > 0 && (
        <div style={{
          flexShrink: 0,
          marginBottom: '12px',
          position: 'sticky',
          top: '0',
          zIndex: 100,
          paddingTop: '4px',
          paddingBottom: '4px',
          background: 'var(--color-background)',
        }}>
          <button
            onClick={handleSaveAndPlay}
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: '16px',
              fontWeight: 700,
              background: 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(45, 90, 39, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              transition: 'all 0.2s',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Start with {selectedCodes.length} bird{selectedCodes.length > 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Selected count */}
      <div style={{
        flexShrink: 0,
        marginBottom: '12px',
        padding: '8px 12px',
        background: selectedCodes.length > 0 ? 'rgba(45, 90, 39, 0.2)' : 'var(--color-surface)',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '14px' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{selectedCodes.length}</span>/{MAX_SPECIES} selected
        </span>
        {selectedCodes.length > 0 && (
          <button
            onClick={handleClear}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Species grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        marginBottom: '12px',
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '8px',
        }}>
          {filteredSpecies.map((species) => {
            const isSelected = selectedCodes.includes(species.code);
            const selectionIndex = selectedCodes.indexOf(species.code);
            const color = isSelected ? SPECIES_COLORS[selectionIndex % SPECIES_COLORS.length] : undefined;

            return (
              <button
                key={species.code}
                onClick={() => toggleSpecies(species.code)}
                disabled={!isSelected && selectedCodes.length >= MAX_SPECIES}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px',
                  background: isSelected ? `${color}22` : 'var(--color-surface)',
                  border: isSelected ? `2px solid ${color}` : '1px solid transparent',
                  borderRadius: '8px',
                  cursor: isSelected || selectedCodes.length < MAX_SPECIES ? 'pointer' : 'not-allowed',
                  opacity: isSelected || selectedCodes.length < MAX_SPECIES ? 1 : 0.5,
                  textAlign: 'left',
                  transition: 'all 0.15s',
                }}
              >
                {/* Selection indicator / play button */}
                <div
                  onClick={(e) => playPreview(species, e)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: isSelected ? color : 'var(--color-background)',
                    border: isSelected ? 'none' : '1px solid var(--color-text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    cursor: 'pointer',
                  }}
                >
                  {playingCode === species.code ? (
                    <StopIcon color={isSelected ? '#1A1A2E' : 'var(--color-text)'} />
                  ) : isSelected ? (
                    <CheckIcon />
                  ) : (
                    <PlayIcon />
                  )}
                </div>

                {/* Species info */}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: isSelected ? color : 'var(--color-accent)',
                  }}>
                    {species.code}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {species.name}
                  </div>
                </div>
              </button>
            );
          })}
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

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="var(--color-text-muted)">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill={color}>
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default CustomPackBuilder;
