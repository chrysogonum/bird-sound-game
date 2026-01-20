import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';
import { trackTaxonomicSortToggle } from '../utils/analytics';

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
  scientificName?: string;
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
  starter_birds: 'Eastern Backyard Birds',
  expanded_backyard: 'Expanded Eastern US Birds',
  sparrows: 'Sparrows',
  woodpeckers: 'Woodpeckers',
  spring_warblers: 'Warbler Academy',
  western_birds: 'Western Backyard Birds',
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
          fontSize: '11px',
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
  const keepBirds = searchParams.get('keepBirds') === 'true';

  const [level, setLevel] = useState<LevelConfig | null>(null);
  const [clips, setClips] = useState<ClipData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies[]>([]);
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preloadStatus, setPreloadStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const [trainingMode, setTrainingMode] = useState(() => {
    try {
      return localStorage.getItem('soundfield_training_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [taxonomicSort, setTaxonomicSort] = useState(() => {
    try {
      return localStorage.getItem('soundfield_taxonomic_sort') === 'true';
    } catch {
      return false;
    }
  });
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [fullCustomPack, setFullCustomPack] = useState<string[]>([]);  // All species in custom pack (up to 30)
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Toggle training mode
  const handleTrainingModeToggle = () => {
    const newValue = !trainingMode;
    setTrainingMode(newValue);
    try {
      localStorage.setItem('soundfield_training_mode', String(newValue));
    } catch (e) {
      console.error('Failed to save training mode:', e);
    }
  };

  // Toggle taxonomic sort
  const handleTaxonomicSortToggle = () => {
    const newValue = !taxonomicSort;
    setTaxonomicSort(newValue);
    try {
      localStorage.setItem('soundfield_taxonomic_sort', String(newValue));
      trackTaxonomicSortToggle(newValue, 'preview_screen');
    } catch (e) {
      console.error('Failed to save taxonomic sort:', e);
    }
  };

  // Re-sort selectedSpecies when taxonomicSort changes (without re-selecting)
  useEffect(() => {
    if (selectedSpecies.length === 0 || Object.keys(taxonomicOrder).length === 0) return;

    // Extract current species codes
    const currentCodes = selectedSpecies.map(s => s.code);

    // Re-sort based on new taxonomicSort preference
    const sortedCodes = taxonomicSort
      ? [...currentCodes].sort((a, b) => {
          const orderA = taxonomicOrder[a] || 9999;
          const orderB = taxonomicOrder[b] || 9999;
          return orderA - orderB;
        })
      : [...currentCodes].sort();

    // Rebuild species array with new sort order (but same species)
    const resorted = sortedCodes.map((code, index) => {
      const existing = selectedSpecies.find(s => s.code === code);
      return {
        ...existing!,
        color: SPECIES_COLORS[index % SPECIES_COLORS.length],
      };
    });

    // Only update if order actually changed
    const orderChanged = resorted.some((sp, i) => sp.code !== selectedSpecies[i].code);
    if (orderChanged) {
      setSelectedSpecies(resorted);
    }
  }, [taxonomicSort, taxonomicOrder]); // Depend on taxonomicSort and taxonomicOrder, but not selectedSpecies to avoid infinite loop

  // Load taxonomic order data and scientific names
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(r => r.json()),
    ]).then(([taxonomicData, speciesData]: [Record<string, number>, Array<{species_code: string; scientific_name: string}>]) => {
      setTaxonomicOrder(taxonomicData);
      // Build scientific names lookup
      const sciNames: Record<string, string> = {};
      speciesData.forEach((sp: {species_code: string; scientific_name: string}) => {
        sciNames[sp.species_code] = sp.scientific_name;
      });
      setScientificNames(sciNames);
    }).catch((err) => console.error('Failed to load taxonomy data:', err));
  }, []);

  // Build species info from a list of codes (no shuffling)
  // Always sorts alphabetically - the useEffect above handles taxonomic re-sorting
  const buildSpeciesInfo = useCallback((codes: string[], clipsData: ClipData[]): SelectedSpecies[] => {
    const sortedCodes = [...codes].sort();

    return sortedCodes.map((code, index) => {
      const canonicalClip = clipsData.find(
        c => c.species_code === code && c.canonical && !c.rejected
      );
      const anyClip = clipsData.find(c => c.species_code === code && !c.rejected);
      const clip = canonicalClip || anyClip;

      return {
        code,
        name: clip?.common_name || code,
        scientificName: scientificNames[code],
        color: SPECIES_COLORS[index % SPECIES_COLORS.length],
        clipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
      };
    });
  }, [scientificNames]);

  // Select random subset from custom pack (for packs with >9 birds)
  const selectRandomFromCustomPack = useCallback((allSpecies: string[], clipsData: ClipData[]) => {
    const targetCount = Math.min(9, allSpecies.length);

    // Shuffle and take 9
    const shuffled = [...allSpecies].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    setSelectedSpecies(buildSpeciesInfo(selected, clipsData));
  }, [buildSpeciesInfo]);

  // Select random species from the pool
  const selectRandomSpecies = useCallback((levelConfig: LevelConfig, clipsData: ClipData[]) => {
    const pool = levelConfig.species_pool || [];
    const count = levelConfig.species_count || pool.length;

    // Shuffle and take count
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Always sort alphabetically initially - the re-sort useEffect will handle taxonomic ordering
    const sortedSelected = selected.sort();

    // Build species info with canonical clips
    const speciesInfo: SelectedSpecies[] = sortedSelected.map((code, index) => {
      const canonicalClip = clipsData.find(
        c => c.species_code === code && c.canonical && !c.rejected
      );
      const anyClip = clipsData.find(c => c.species_code === code && !c.rejected);
      const clip = canonicalClip || anyClip;

      return {
        code,
        name: clip?.common_name || code,
        scientificName: scientificNames[code],
        color: SPECIES_COLORS[index % SPECIES_COLORS.length],
        clipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
      };
    });

    setSelectedSpecies(speciesInfo);
  }, [scientificNames]);

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
            setFullCustomPack(customSpecies);

            // If pack has >9 birds, randomly select 9 for gameplay
            const selectedForPlay = customSpecies.length > 9
              ? [...customSpecies].sort(() => Math.random() - 0.5).slice(0, 9)
              : customSpecies;

            // Create synthetic level config for custom pack
            const customLevel: LevelConfig = {
              level_id: levelId,
              pack_id: 'custom',
              mode: 'campaign',
              title: LEVEL_TITLES[levelId] || `Level ${levelId}`,
              round_duration_sec: 30,
              species_count: selectedForPlay.length,
              species_pool: selectedForPlay,
              clip_selection: getLevelClipSelection(levelId),
              channel_mode: getLevelChannelMode(levelId),
              event_density: 'low',
              overlap_probability: 0,
              scoring_window_ms: 2000,
              spectrogram_mode: 'full',
            };
            setLevel(customLevel);
            setSelectedSpecies(buildSpeciesInfo(selectedForPlay, clipsData));
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

        // Check if we should keep the same birds from previous round
        if (keepBirds) {
          const savedSpecies = sessionStorage.getItem('roundSpecies');
          if (savedSpecies) {
            try {
              const previousSpecies = JSON.parse(savedSpecies) as string[];
              // Verify these species are still in the pool
              const pool = foundLevel.species_pool || [];
              const validSpecies = previousSpecies.filter(s => pool.includes(s));
              if (validSpecies.length === previousSpecies.length) {
                // All previous species are valid, use them
                setSelectedSpecies(buildSpeciesInfo(validSpecies, clipsData));
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error('Failed to parse saved species:', e);
            }
          }
        }

        // Otherwise select new random species
        selectRandomSpecies(foundLevel, clipsData);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  }, [packId, levelId, keepBirds, buildSpeciesInfo, selectRandomSpecies]);

  // Preload all clips for selected species in the background
  useEffect(() => {
    if (selectedSpecies.length === 0 || clips.length === 0) {
      setPreloadStatus('idle');
      return;
    }

    // Get all clips for the selected species (not just canonical)
    const speciesCodes = selectedSpecies.map(s => s.code);
    const clipsToPreload = clips.filter(
      c => speciesCodes.includes(c.species_code) && !c.rejected
    );

    if (clipsToPreload.length === 0) {
      setPreloadStatus('ready');
      setPreloadProgress({ loaded: 0, total: 0 });
      return;
    }

    setPreloadStatus('loading');
    setPreloadProgress({ loaded: 0, total: clipsToPreload.length });
    console.log(`Preloading ${clipsToPreload.length} clips for ${speciesCodes.length} species...`);

    let loadedCount = 0;

    // Fetch all clips to warm browser cache
    const preloadPromises = clipsToPreload.map(async (clip) => {
      const url = `${import.meta.env.BASE_URL}${clip.file_path}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          // Just fetching is enough to cache - we don't need to decode here
          await response.arrayBuffer();
        }
      } catch (err) {
        console.warn('Failed to preload:', clip.file_path, err);
      } finally {
        loadedCount++;
        setPreloadProgress({ loaded: loadedCount, total: clipsToPreload.length });
      }
    });

    Promise.all(preloadPromises).then(() => {
      console.log('Preloading complete!');
      setPreloadStatus('ready');
    });
  }, [selectedSpecies, clips]);

  // Shuffle species
  const handleShuffle = () => {
    if (level && clips.length > 0) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingCode(null);
      }
      // Reset preload status - new birds need new clips
      setPreloadStatus('idle');
      selectRandomSpecies(level, clips);
    }
  };

  // Re-roll custom pack (select new random 9 from larger pack)
  const handleReroll = () => {
    if (fullCustomPack.length > 0 && clips.length > 0) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingCode(null);
      }
      // Reset preload status - new birds need new clips
      setPreloadStatus('idle');
      selectRandomFromCustomPack(fullCustomPack, clips);
    }
  };

  // Play preview sound
  const playPreview = (species: SelectedSpecies) => {
    console.log(`[Preview] Attempting to play: ${species.code}`);
    console.log(`[Preview] Clip path: ${species.clipPath}`);

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

    if (!species.clipPath) {
      console.error(`[Preview] No clip path for ${species.code}!`);
      return;
    }

    const audio = new Audio(species.clipPath);
    audioRef.current = audio;
    setPlayingCode(species.code);

    audio.play()
      .then(() => console.log(`[Preview] Playing ${species.code} successfully`))
      .catch(err => {
        console.error(`[Preview] Failed to play ${species.code}:`, err);
        console.error(`[Preview] Clip path was: ${species.clipPath}`);
      });
    audio.onended = () => {
      console.log(`[Preview] ${species.code} finished playing`);
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
    <div className="screen" style={{
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'calc(12px + var(--safe-area-top))',
      paddingBottom: 'calc(12px + var(--safe-area-bottom))',
      paddingLeft: '16px',
      paddingRight: '16px',
      gap: '10px'
    }}>
      {/* Compact Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate(`/level-select?pack=${packId}`)}
          aria-label="Back"
          style={{ flexShrink: 0 }}
        >
          <BackIcon />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '14px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {packName}
          </h2>
          <div style={{ fontSize: '12px', color: 'var(--color-accent)', lineHeight: 1.1 }}>
            Level {level.level_id}: {level.title}
          </div>
        </div>
        {/* Bird Reference link */}
        <button
          onClick={() => navigate(`/pack-select?scrollTo=${packId}&expandPack=${packId}#bird-reference`, {
            state: { fromPreview: true, pack: packId, level: levelId }
          })}
          style={{
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid rgba(100, 181, 246, 0.3)',
            borderRadius: '6px',
            color: '#64B5F6',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
        >
          📚
        </button>
        {/* Shuffle/Re-roll button - compact top right */}
        {((level.species_pool && level.species_pool.length > (level.species_count || 0)) || fullCustomPack.length > 9) && (
          <button
            onClick={fullCustomPack.length > 9 ? handleReroll : handleShuffle}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              border: '1px solid var(--color-accent)',
              borderRadius: '6px',
              color: 'var(--color-accent)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
            }}
            title={fullCustomPack.length > 9 ? `Re-roll (${fullCustomPack.length} total birds)` : 'Shuffle birds'}
          >
            <ShuffleIcon />
          </button>
        )}
      </div>

      {/* Compact Toggles Row */}
      <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
        <button
          onClick={handleTrainingModeToggle}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: trainingMode ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: trainingMode ? '2px solid var(--color-success)' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <EyeIcon filled={trainingMode} color={trainingMode ? 'var(--color-success)' : undefined} />
          <span style={{ fontSize: '11px' }}>Training</span>
        </button>
        <button
          onClick={handleTaxonomicSortToggle}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: taxonomicSort ? 'rgba(100, 181, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: taxonomicSort ? '2px solid #64B5F6' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <span style={{ fontSize: '14px' }}>{taxonomicSort ? '📊' : '🔤'}</span>
          <span style={{ fontSize: '11px' }}>{taxonomicSort ? 'Taxonomic 🐦🤓' : 'Sort'}</span>
        </button>
      </div>

      {/* Preload status indicator */}
      {preloadStatus === 'loading' && (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: '6px',
          padding: '6px 10px',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
          }}>
            Loading sounds {preloadProgress.loaded}/{preloadProgress.total}
          </div>
          <div style={{
            width: '100%',
            height: '3px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(preloadProgress.loaded / preloadProgress.total) * 100}%`,
              height: '100%',
              background: 'var(--color-accent)',
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      {/* Tip Box - Study the Grid */}
      <div style={{
        background: 'rgba(100, 181, 246, 0.1)',
        border: '1px solid rgba(100, 181, 246, 0.3)',
        borderRadius: '8px',
        padding: '10px 12px',
      }}>
        <div style={{
          fontSize: '12px',
          color: 'var(--color-text)',
          lineHeight: 1.4,
          textAlign: 'center',
        }}>
          <strong>💡 Study the grid:</strong> Each bird will appear in the same position during play. Take a moment to memorize where each species lives on screen—and any unfamiliar code names. Use 🔀 to mix it up. Engage 👁️ for speed-learning.
        </div>
      </div>

      {/* Species grid - MAIN FOCUS */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
      }}>
        {fullCustomPack.length > 9 && (
          <div style={{
            fontSize: '12px',
            color: 'var(--color-accent)',
            marginBottom: '6px',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Playing 9 of {fullCustomPack.length} birds
          </div>
        )}
        <div style={{
          fontSize: '11px',
          color: 'var(--color-text-muted)',
          marginBottom: '8px',
          textAlign: 'center',
        }}>
          Tap to preview signature song. Press and hold to get a closer look!
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
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
                gap: '6px',
                padding: '10px 6px',
                background: playingCode === species.code ? `${species.color}33` : 'var(--color-surface)',
                border: `2px solid ${species.color}`,
                borderRadius: '10px',
                cursor: species.clipPath ? 'pointer' : 'not-allowed',
                opacity: species.clipPath ? 1 : 0.5,
                transition: 'transform 0.15s, background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Bird icon/code */}
              <div style={{ position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                <BirdIcon code={species.code} size={52} color={species.color} />
              </div>
              {/* Name */}
              <div style={{
                fontSize: '10px',
                color: 'var(--color-text)',
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: '75px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                fontStyle: taxonomicSort && species.scientificName ? 'italic' : 'normal',
              }}>
                {taxonomicSort && species.scientificName ? species.scientificName : species.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Ready button - bottom */}
      <button
        onClick={handleReady}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '15px',
          fontWeight: 700,
          background: preloadStatus === 'ready'
            ? 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)'
            : 'linear-gradient(135deg, #555 0%, #444 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(45, 90, 39, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        {preloadStatus === 'ready' ? (
          <>Ready to Play <PlayArrowIcon /></>
        ) : preloadStatus === 'loading' ? (
          <>Loading...</>
        ) : (
          <>Ready to Play <PlayArrowIcon /></>
        )}
      </button>


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

function EyeIcon({ filled, color }: { filled: boolean; color?: string }) {
  const iconColor = color || (filled ? 'var(--color-accent)' : 'var(--color-text-muted)');
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" fill={filled ? iconColor : 'none'} />
    </svg>
  );
}

export default PreRoundPreview;
