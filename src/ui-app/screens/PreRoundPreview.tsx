import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';

interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  canonical?: boolean;
  rejected?: boolean;
}

interface SelectedSpecies {
  code: string;
  name: string;
  color: string;
  clipPath: string | null;
}

// Colors for species circles
const SPECIES_COLORS = [
  '#E57373', '#4FC3F7', '#81C784', '#FFD54F',
  '#BA68C8', '#FF8A65', '#4DB6AC', '#A1887F', '#90A4AE',
];

// Pack display names
const PACK_NAMES: Record<string, string> = {
  starter_birds: '5 Common Backyard Birds',
  expanded_backyard: 'Expanded Local Birds',
  sparrows: 'Sparrows',
  woodpeckers: 'Woodpeckers',
  custom: 'Custom Pack',
};

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

// Bird icon component - shows icon with code label below
function BirdIcon({ code, size = 56, color }: { code: string; size?: number; color?: string }) {
  const [hasIcon, setHasIcon] = useState(true);
  const iconPath = `${import.meta.env.BASE_URL}data/icons/${code}.png`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      WebkitTapHighlightColor: 'transparent',
    }}>
      {hasIcon && (
        <span style={{
          fontSize: '10px',
          fontWeight: 600,
          color: 'var(--color-text-muted)',
          lineHeight: 1,
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
            WebkitTapHighlightColor: 'transparent',
          }}
          onError={() => setHasIcon(false)}
        />
      ) : (
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color || 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.25,
          fontWeight: 700,
          color: '#1A1A2E',
        }}>
          {code}
        </div>
      )}
    </div>
  );
}

function PreRoundPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('pack') || 'starter_birds';
  const levelId = parseInt(searchParams.get('level') || '1', 10);

  const [level, setLevel] = useState<LevelConfig | null>(null);
  const [clips, setClips] = useState<ClipData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies[]>([]);
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Build species info from a list of codes (no shuffling)
  const buildSpeciesInfo = useCallback((codes: string[], clipsData: ClipData[]): SelectedSpecies[] => {
    return codes.sort().map((code, index) => {
      const canonicalClip = clipsData.find(
        c => c.species_code === code && c.canonical && !c.rejected
      );
      const anyClip = clipsData.find(c => c.species_code === code && !c.rejected);
      const clip = canonicalClip || anyClip;

      return {
        code,
        name: clip?.common_name || code,
        color: SPECIES_COLORS[index % SPECIES_COLORS.length],
        clipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
      };
    });
  }, []);

  // Load level and clips
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/levels.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/clips.json`).then(r => r.json()),
    ]).then(([levels, clipsData]: [LevelConfig[], ClipData[]]) => {
      setClips(clipsData);

      // Handle custom pack specially
      if (packId === 'custom') {
        const customSpeciesJson = localStorage.getItem('soundfield_custom_pack');
        if (customSpeciesJson) {
          try {
            const customSpecies = JSON.parse(customSpeciesJson) as string[];
            // Create synthetic level config for custom pack
            const customLevel: LevelConfig = {
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
              spectrogram_mode: 'full',
            };
            setLevel(customLevel);
            // For custom pack, use all selected species (no random subset)
            setSelectedSpecies(buildSpeciesInfo(customSpecies, clipsData));
          } catch (e) {
            console.error('Failed to parse custom pack:', e);
          }
        }
        setLoading(false);
        return;
      }

      const foundLevel = levels.find(l => l.pack_id === packId && l.level_id === levelId);
      if (foundLevel) {
        setLevel(foundLevel);
        // Select initial species
        selectRandomSpecies(foundLevel, clipsData);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  }, [packId, levelId, buildSpeciesInfo]);

  // Select random species from the pool
  const selectRandomSpecies = useCallback((levelConfig: LevelConfig, clipsData: ClipData[]) => {
    const pool = levelConfig.species_pool || [];
    const count = levelConfig.species_count || pool.length;

    // Shuffle and take count, then sort alphabetically for display
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count).sort();

    // Build species info with canonical clips
    const speciesInfo: SelectedSpecies[] = selected.map((code, index) => {
      const canonicalClip = clipsData.find(
        c => c.species_code === code && c.canonical && !c.rejected
      );
      const anyClip = clipsData.find(c => c.species_code === code && !c.rejected);
      const clip = canonicalClip || anyClip;

      return {
        code,
        name: clip?.common_name || code,
        color: SPECIES_COLORS[index % SPECIES_COLORS.length],
        clipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
      };
    });

    setSelectedSpecies(speciesInfo);
  }, []);

  // Shuffle species
  const handleShuffle = () => {
    if (level && clips.length > 0) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingCode(null);
      }
      selectRandomSpecies(level, clips);
    }
  };

  // Play preview sound
  const playPreview = (species: SelectedSpecies) => {
    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingCode === species.code) {
      // Toggle off
      setPlayingCode(null);
      return;
    }

    if (!species.clipPath) return;

    const audio = new Audio(species.clipPath);
    audioRef.current = audio;
    setPlayingCode(species.code);

    audio.play().catch(err => console.error('Failed to play:', err));
    audio.onended = () => {
      setPlayingCode(null);
      audioRef.current = null;
    };
  };

  // Start the round
  const handleReady = () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Store selected species in sessionStorage for gameplay to pick up
    const speciesCodes = selectedSpecies.map(s => s.code);
    sessionStorage.setItem('roundSpecies', JSON.stringify(speciesCodes));

    navigate(`/gameplay?mode=campaign&pack=${packId}&level=${levelId}&preview=true`);
  };

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
        <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="screen screen-center">
        <div style={{ color: 'var(--color-error)' }}>Level not found</div>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--color-surface)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const packName = PACK_NAMES[packId] || packId;

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ marginBottom: '12px' }}>
        <div className="flex-row items-center" style={{ marginBottom: '8px' }}>
          <button
            className="btn-icon"
            onClick={() => navigate(packId === 'custom' ? '/custom-pack' : `/level-select?pack=${packId}`)}
            aria-label="Back"
          >
            <BackIcon />
          </button>
          <div style={{ flex: 1, marginLeft: '8px' }}>
            <h2 style={{ margin: 0, fontSize: '16px' }}>{packName}</h2>
            <div style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
              Level {level.level_id}: {level.title}
            </div>
          </div>
        </div>

        {/* Ready button - prominent at top */}
        <button
          onClick={handleReady}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(45, 90, 39, 0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
        >
          Ready to Play <PlayArrowIcon />
        </button>
      </div>

      {/* Preview section */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px 0',
      }}>
        <div style={{
          fontSize: '14px',
          color: 'var(--color-text-muted)',
          marginBottom: '20px',
          textAlign: 'center',
          maxWidth: '280px',
        }}>
          {level.level_id === 1 ? (
            'Tap to preview each bird\'s signature sound'
          ) : (
            <>
              Tap to preview signature sounds.
              <br />
              <span style={{ fontSize: '12px', opacity: 0.8 }}>
                You'll hear variations during play!
              </span>
            </>
          )}
        </div>

        {/* Species grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          maxWidth: '320px',
          width: '100%',
        }}>
          {selectedSpecies.map((species) => (
            <button
              key={species.code}
              onClick={() => playPreview(species)}
              disabled={!species.clipPath}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                padding: '12px 8px',
                background: playingCode === species.code ? `${species.color}33` : 'var(--color-surface)',
                border: `2px solid ${species.color}`,
                borderRadius: '12px',
                cursor: species.clipPath ? 'pointer' : 'not-allowed',
                opacity: species.clipPath ? 1 : 0.5,
                transition: 'transform 0.15s, background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Bird icon/code */}
              <div style={{ position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                <BirdIcon code={species.code} size={56} color={species.color} />
              </div>
              {/* Name */}
              <div style={{
                fontSize: '11px',
                color: 'var(--color-text)',
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: '80px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}>
                {species.name}
              </div>
            </button>
          ))}
        </div>

        {/* Shuffle button */}
        {level.species_pool && level.species_pool.length > (level.species_count || 0) && (
          <button
            onClick={handleShuffle}
            style={{
              marginTop: '24px',
              padding: '10px 20px',
              background: 'transparent',
              border: '1px solid var(--color-text-muted)',
              borderRadius: '8px',
              color: 'var(--color-text-muted)',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <ShuffleIcon />
            Shuffle Birds
          </button>
        )}
      </div>


      {/* Pulse animation and tap highlight fix */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
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

function ShuffleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function PlayArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

export default PreRoundPreview;
