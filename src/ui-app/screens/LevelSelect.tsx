import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';
import { trackLevelSelect } from '../utils/analytics';

// Clip data for audio playback
interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  vocalization_type?: string;
  canonical?: boolean;
  rejected?: boolean;
  spectrogram_path?: string;
}

// Species info for gallery display
interface SpeciesInfo {
  code: string;
  displayName: string;  // Common name for NA, tile name (Maori) for NZ
  englishName: string;  // English common name (for NZ birds)
  scientificName: string;
  showCode: boolean;    // Show 4-letter code for NA, hide for NZ
  isNZ: boolean;        // Whether this is an NZ bird
  canonicalClipPath?: string;  // Path to canonical audio clip
}

// Pack display names
const PACK_NAMES: Record<string, string> = {
  starter_birds: 'Backyard Birds',
  grassland_birds: 'Grasslands',
  expanded_backyard: 'Eastern Birds',
  sparrows: 'Sparrows',
  woodpeckers: 'Woodpeckers',
  spring_warblers: 'Warbler Academy',
  western_birds: 'Western Birds',
  custom: 'Custom Pack',
  // NZ packs
  nz_all_birds: 'All NZ Birds',
  nz_common: 'Garden & Bush',
  nz_north_island: 'North Island',
  nz_south_island: 'South Island',
};

// NZ pack IDs for routing
const NZ_PACK_IDS = ['nz_all_birds', 'nz_common', 'nz_north_island', 'nz_south_island'];

// Key for tracking custom pack region
const CUSTOM_PACK_REGION_KEY = 'soundfield_custom_pack_region';

// Generate standard levels for custom packs
function generateCustomLevels(speciesCount: number): LevelConfig[] {
  return [
    {
      level_id: 1,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Meet Your Birds',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 'canonical',
      channel_mode: 'single',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
    {
      level_id: 2,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Sound Variations',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 3,
      channel_mode: 'single',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
    {
      level_id: 3,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Full Repertoire',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 'all',
      channel_mode: 'single',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
    {
      level_id: 4,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Both Ears',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 'canonical',
      channel_mode: 'offset',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
    {
      level_id: 5,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Variations + Both Ears',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 3,
      channel_mode: 'offset',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
    {
      level_id: 6,
      pack_id: 'custom',
      mode: 'campaign',
      title: 'Master Birder',
      round_duration_sec: 30,
      species_count: speciesCount,
      species_pool: [],
      clip_selection: 'all',
      channel_mode: 'offset',
      event_density: 'low',
      overlap_probability: 0,
      scoring_window_ms: 2000,
      spectrogram_mode: 'full',
    },
  ];
}

// Level descriptions based on config
function getLevelDescription(level: LevelConfig): string {
  const parts: string[] = [];

  // Clip selection
  if (level.clip_selection === 'canonical') {
    parts.push('Signature sounds only');
  } else if (level.clip_selection === 'all') {
    parts.push('Full repertoire');
  } else if (typeof level.clip_selection === 'number') {
    parts.push(`${level.clip_selection} variations per bird`);
  }

  // Channel mode
  if (level.channel_mode === 'offset') {
    parts.push('both ears');
  } else {
    parts.push('one ear');
  }

  return parts.join(' • ');
}

// Level difficulty indicator
function getLevelDifficulty(level: LevelConfig): { label: string; color: string } {
  const levelId = level.level_id;
  if (levelId <= 2) return { label: 'Easy', color: '#4CAF50' };
  if (levelId <= 4) return { label: 'Medium', color: 'rgba(245, 166, 35, 0.8)' };
  return { label: 'Hard', color: '#FF5722' };
}

// Theme colors by region
const NZ_ACCENT_COLOR = '#4db6ac';  // Muted teal for NZ

function LevelSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('pack') || 'starter_birds';

  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showGallery, setShowGallery] = useState(false);  // Species overview (icons + names)
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);  // Clips per species
  const [gallerySpecies, setGallerySpecies] = useState<SpeciesInfo[]>([]);
  const [galleryClips, setGalleryClips] = useState<ClipData[]>([]);  // All clips for sound library
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Determine if this is an NZ pack for theming
  const isNZPack = NZ_PACK_IDS.includes(packId) ||
    (packId === 'custom' && localStorage.getItem(CUSTOM_PACK_REGION_KEY) === 'nz');
  const accentColor = isNZPack ? NZ_ACCENT_COLOR : 'var(--color-accent)';

  // Load levels for this pack
  useEffect(() => {
    // Handle custom pack specially - generate levels dynamically
    if (packId === 'custom') {
      try {
        const saved = localStorage.getItem('soundfield_custom_pack');
        if (saved) {
          const speciesCodes = JSON.parse(saved);
          if (Array.isArray(speciesCodes) && speciesCodes.length > 0) {
            setLevels(generateCustomLevels(speciesCodes.length));
            setLoading(false);
            return;
          }
        }
        // No custom pack saved - redirect to builder
        const customPackRegion = localStorage.getItem(CUSTOM_PACK_REGION_KEY);
        navigate(customPackRegion === 'nz' ? '/custom-pack?region=nz' : '/custom-pack', { replace: true });
      } catch (e) {
        console.error('Failed to load custom pack:', e);
        const customPackRegion = localStorage.getItem(CUSTOM_PACK_REGION_KEY);
        navigate(customPackRegion === 'nz' ? '/custom-pack?region=nz' : '/custom-pack', { replace: true });
      }
      return;
    }

    fetch(`${import.meta.env.BASE_URL}data/levels.json`)
      .then((res) => res.json())
      .then((allLevels: LevelConfig[]) => {
        const packLevels = allLevels.filter((l) => l.pack_id === packId);
        setLevels(packLevels.sort((a, b) => a.level_id - b.level_id));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load levels:', err);
        setLoading(false);
      });
  }, [packId, navigate]);

  // Load species for the gallery/sound library when either is opened
  useEffect(() => {
    if ((!showGallery && !showSoundLibrary) || packId === 'custom') return;

    const isNZ = NZ_PACK_IDS.includes(packId);
    const packJsonPath = `${import.meta.env.BASE_URL}data/packs/${packId}.json`;
    const speciesJsonPath = `${import.meta.env.BASE_URL}data/species.json`;
    const clipsJsonPath = `${import.meta.env.BASE_URL}data/clips.json`;
    const nzDisplayCodesPath = `${import.meta.env.BASE_URL}data/nz_display_codes.json`;

    const fetches: Promise<unknown>[] = [
      fetch(packJsonPath).then(r => r.json()),
      fetch(speciesJsonPath).then(r => r.json()),
      fetch(clipsJsonPath).then(r => r.json()),
    ];
    if (isNZ) {
      fetches.push(fetch(nzDisplayCodesPath).then(r => r.json()));
    }

    Promise.all(fetches)
      .then((results) => {
        const packData = results[0] as { species: string[] };
        const speciesData = results[1] as Array<{ species_code: string; common_name: string; scientific_name: string }>;
        const clipsData = results[2] as ClipData[];
        const nzDisplayCodes = isNZ ? (results[3] as { codes: Record<string, { code: string; tileName: string }> }).codes : null;

        const speciesCodes: string[] = packData.species || [];

        // Build a map of species code -> species info from species.json
        const speciesMap: Record<string, { name: string; scientificName: string }> = {};
        for (const sp of speciesData) {
          speciesMap[sp.species_code] = {
            name: sp.common_name,
            scientificName: sp.scientific_name,
          };
        }

        // Build a map of species code -> canonical clip path
        const canonicalClipMap: Record<string, string> = {};
        for (const clip of clipsData) {
          if (clip.canonical && !clip.rejected) {
            canonicalClipMap[clip.species_code] = `${import.meta.env.BASE_URL}${clip.file_path}`;
          }
        }

        // Build species info array
        let speciesInfo: SpeciesInfo[] = speciesCodes.map(code => {
          if (isNZ && nzDisplayCodes && nzDisplayCodes[code]) {
            // NZ birds: use tile name (Maori), include English name for 3-name display
            const nzData = nzDisplayCodes[code] as { tileName: string; englishName?: string };
            return {
              code,
              displayName: nzData.tileName,
              englishName: nzData.englishName || speciesMap[code]?.name || '',
              scientificName: speciesMap[code]?.scientificName || '',
              showCode: false,
              isNZ: true,
              canonicalClipPath: canonicalClipMap[code],
            };
          } else {
            // NA birds: use common name, show 4-letter code
            return {
              code,
              displayName: speciesMap[code]?.name || code,
              englishName: '',
              scientificName: speciesMap[code]?.scientificName || '',
              showCode: true,
              isNZ: false,
              canonicalClipPath: canonicalClipMap[code],
            };
          }
        });

        // Sort: NA birds by 4-letter code, NZ birds by English name (for consistent gallery viewing)
        if (isNZ) {
          speciesInfo.sort((a, b) => a.englishName.localeCompare(b.englishName));
        } else {
          speciesInfo.sort((a, b) => a.code.localeCompare(b.code));
        }

        setGallerySpecies(speciesInfo);

        // Store all clips for the pack's species (for sound library view)
        const packClips = clipsData.filter(
          c => speciesCodes.includes(c.species_code) && !c.rejected
        );
        setGalleryClips(packClips);
      })
      .catch(err => {
        console.error('Failed to load gallery species:', err);
      });
  }, [showGallery, showSoundLibrary, packId]);

  // Cleanup audio on unmount or when modals close
  useEffect(() => {
    if (!showSoundLibrary && !showGallery && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setPlayingClip(null);
    }
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [showSoundLibrary, showGallery]);

  // Play sound function for gallery (canonical clips only)
  const playGallerySound = (clipPath: string, code: string) => {
    // Stop current audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingClip === code) {
      // Toggle off
      setPlayingClip(null);
      return;
    }

    const audio = new Audio(clipPath);
    audioRef.current = audio;
    setPlayingClip(code);

    audio.play().catch((err) => console.error('Failed to play audio:', err));
    audio.onended = () => {
      setPlayingClip(null);
      audioRef.current = null;
    };
  };

  const handleLevelSelect = (level: LevelConfig) => {
    trackLevelSelect(packId, level.level_id, level.title || `Level ${level.level_id}`);
    navigate(`/preview?pack=${packId}&level=${level.level_id}`);
  };

  const packName = PACK_NAMES[packId] || packId;

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div className="flex-row items-center gap-md" style={{ marginBottom: '8px' }}>
        <button className="btn-icon" onClick={() => {
          if (packId === 'custom') {
            // Check if custom pack was NZ region
            const customPackRegion = localStorage.getItem(CUSTOM_PACK_REGION_KEY);
            navigate(customPackRegion === 'nz' ? '/custom-pack?region=nz' : '/custom-pack');
          } else if (NZ_PACK_IDS.includes(packId)) {
            navigate('/nz-packs');
          } else {
            navigate('/pack-select');
          }
        }} aria-label="Back" style={{ color: accentColor, opacity: 0.6 }}>
          <BackIcon />
        </button>
        <div style={{ flex: 1 }}>
          {packId !== 'custom' ? (
            <button
              onClick={() => setShowGallery(true)}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                margin: 0,
                cursor: 'pointer',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: accentColor,
                opacity: 0.85,
              }}
              aria-label={`View ${packName} bird gallery`}
            >
              <h2 style={{ margin: 0, fontSize: '20px', color: 'inherit' }}>{packName}</h2>
              <span
                style={{
                  fontSize: '16px',
                  display: 'inline-block',
                  animation: 'wiggle 2s ease-in-out infinite',
                }}>🖼️</span>
            </button>
          ) : (
            <h2 style={{ margin: 0, fontSize: '20px' }}>{packName}</h2>
          )}
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            <span>Select a level</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {packId !== 'custom' && (
            <button
              onClick={() => setShowSoundLibrary(true)}
              className="btn-icon"
              style={{ color: accentColor, opacity: 0.6, background: 'none', border: 'none', fontSize: '18px', display: 'flex', gap: '2px', cursor: 'pointer' }}
              aria-label="Sound Library"
            >
              <span>🎧</span><span>📚</span>
            </button>
          )}
          <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{ color: accentColor }}>
            <HomeIcon />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading levels...
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
          {levels.map((level) => {
            const difficulty = getLevelDifficulty(level);
            return (
              <button
                key={level.level_id}
                onClick={() => handleLevelSelect(level)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '16px',
                  background: 'var(--color-surface)',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'transform 0.15s, background 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateX(4px)';
                  e.currentTarget.style.background = 'rgba(45, 45, 68, 1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateX(0)';
                  e.currentTarget.style.background = 'var(--color-surface)';
                }}
              >
                {/* Level number circle */}
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${difficulty.color}33, ${difficulty.color}11)`,
                  border: `2px solid ${difficulty.color}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '20px',
                  color: difficulty.color,
                  flexShrink: 0,
                }}>
                  {level.level_id}
                </div>

                {/* Level info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    marginBottom: '4px',
                  }}>
                    {level.title}
                  </div>
                  <div style={{
                    fontSize: '13px',
                    color: 'var(--color-text-muted)',
                  }}>
                    {getLevelDescription(level)}
                  </div>
                </div>

                {/* Arrow */}
                <div style={{ color: 'var(--color-text-muted)', flexShrink: 0 }}>
                  <ArrowIcon />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Level progression hint */}
      <div style={{
        marginTop: '24px',
        padding: '12px 16px',
        background: isNZPack ? 'rgba(77, 182, 172, 0.1)' : 'rgba(245, 166, 35, 0.1)',
        borderRadius: '8px',
        borderLeft: isNZPack ? '3px solid rgba(77, 182, 172, 0.5)' : '3px solid rgba(245, 166, 35, 0.5)',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: accentColor, opacity: 0.7 }}>Tip:</strong> Tap the pack name 🖼️ to see all birds, or 🎧📚 to explore all sounds.
        </div>
      </div>

      {/* Sound Library Modal (all clips per species) */}
      {showSoundLibrary && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.pause();
            }
            setPlayingClip(null);
            setShowSoundLibrary(false);
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              paddingTop: 'calc(16px + var(--safe-area-top, 0px))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
                🎧 {packName}
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {gallerySpecies.length} birds • Tap any clip to play
              </div>
            </div>
            <button
              onClick={() => {
                if (audioRef.current) {
                  audioRef.current.pause();
                }
                setPlayingClip(null);
                setShowSoundLibrary(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '20px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 20px',
              paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {gallerySpecies.map((species) => {
              // Get all clips for this species
              const speciesClips = galleryClips.filter(
                (c) => c.species_code === species.code
              );
              // Sort: canonical first, then by vocalization type
              const sortedClips = [...speciesClips].sort((a, b) => {
                if (a.canonical && !b.canonical) return -1;
                if (!a.canonical && b.canonical) return 1;
                return (a.vocalization_type || '').localeCompare(b.vocalization_type || '');
              });

              return (
                <div
                  key={species.code}
                  style={{
                    marginBottom: '20px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                >
                  {/* Species header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <img
                      src={`${import.meta.env.BASE_URL}data/icons/${species.code}.png`}
                      alt={species.displayName}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${accentColor}`,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'white' }}>
                        {species.displayName}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {species.isNZ && species.englishName && species.englishName !== species.displayName
                          ? `${species.englishName} • `
                          : ''
                        }
                        {species.code} • {sortedClips.length} clip{sortedClips.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Clips grid */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    {sortedClips.map((clip) => {
                      const isPlaying = playingClip === clip.clip_id;
                      return (
                        <button
                          key={clip.clip_id}
                          onClick={() => {
                            if (isPlaying) {
                              // Stop playing
                              if (audioRef.current) {
                                audioRef.current.pause();
                              }
                              setPlayingClip(null);
                            } else {
                              // Start playing
                              if (audioRef.current) {
                                audioRef.current.pause();
                              }
                              const audio = new Audio(`${import.meta.env.BASE_URL}${clip.file_path}`);
                              audioRef.current = audio;
                              audio.onended = () => setPlayingClip(null);
                              audio.play().catch(console.error);
                              setPlayingClip(clip.clip_id);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: isPlaying
                              ? 'rgba(76, 175, 80, 0.3)'
                              : clip.canonical
                                ? 'rgba(255, 152, 0, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                            border: isPlaying
                              ? '2px solid #4CAF50'
                              : clip.canonical
                                ? '1px solid rgba(255, 152, 0, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'white',
                            fontSize: '12px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>
                            {isPlaying ? '⏹️' : '▶️'}
                          </span>
                          <span style={{ textTransform: 'capitalize' }}>
                            {clip.vocalization_type || 'clip'}
                          </span>
                          {clip.canonical && (
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>⭐</span>
                          )}
                        </button>
                      );
                    })}
                    {sortedClips.length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No clips available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Gallery Modal (Instagram-style single column with large tiles) */}
      {showGallery && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.2s ease-out',
          }}
          onClick={() => setShowGallery(false)}
        >
          {/* Header */}
          <div style={{
            padding: '16px 20px',
            paddingTop: 'calc(16px + var(--safe-area-top, 0px))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
          }}>
            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--color-text)' }}>
              {packName}
            </h3>
            <button
              onClick={() => setShowGallery(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '28px',
                cursor: 'pointer',
                padding: '4px',
                lineHeight: 1,
              }}
              aria-label="Close gallery"
            >
              ×
            </button>
          </div>

          {/* Gallery Grid */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px',
              paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              maxWidth: '400px',
              margin: '0 auto',
            }}>
              {gallerySpecies.map((species) => (
                <div
                  key={species.code}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'var(--color-surface)',
                    borderRadius: '16px',
                  }}
                >
                  {/* Image container with play button overlay */}
                  <div style={{ position: 'relative', width: '100%' }}>
                    <img
                      src={`${import.meta.env.BASE_URL}data/icons/${species.code}.png`}
                      alt={species.displayName}
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        borderRadius: '12px',
                        objectFit: 'cover',
                      }}
                    />
                    {/* Play button overlay */}
                    {species.canonicalClipPath && (
                      <button
                        onClick={() => playGallerySound(species.canonicalClipPath!, species.code)}
                        style={{
                          position: 'absolute',
                          bottom: '12px',
                          right: '12px',
                          width: '48px',
                          height: '48px',
                          borderRadius: '50%',
                          border: 'none',
                          background: playingClip === species.code
                            ? 'var(--color-accent)'
                            : 'rgba(0, 0, 0, 0.7)',
                          color: playingClip === species.code
                            ? '#000'
                            : 'var(--color-accent)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '20px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                          transition: 'all 0.15s',
                        }}
                        aria-label={playingClip === species.code ? `Stop ${species.displayName}` : `Play ${species.displayName}`}
                      >
                        {playingClip === species.code ? '⏸' : '▶'}
                      </button>
                    )}
                  </div>
                  <div style={{
                    textAlign: 'center',
                  }}>
                    {/* NZ birds show Maori name, English name, then Scientific */}
                    {species.isNZ ? (
                      <>
                        <div style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          marginBottom: '4px',
                        }}>
                          {species.displayName}
                        </div>
                        {species.englishName && species.englishName !== species.displayName && (
                          <div style={{
                            fontSize: '15px',
                            color: 'var(--color-text-muted)',
                            marginBottom: '4px',
                          }}>
                            {species.englishName}
                          </div>
                        )}
                        {species.scientificName && (
                          <div style={{
                            fontSize: '13px',
                            fontStyle: 'italic',
                            color: 'rgba(255,255,255,0.4)',
                          }}>
                            {species.scientificName}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        {/* NA birds show Common name, Scientific, then Code */}
                        <div style={{
                          fontSize: '20px',
                          fontWeight: 700,
                          color: 'var(--color-text)',
                          marginBottom: '4px',
                        }}>
                          {species.displayName}
                        </div>
                        {species.scientificName && (
                          <div style={{
                            fontSize: '15px',
                            fontStyle: 'italic',
                            color: 'var(--color-text-muted)',
                            marginBottom: species.showCode ? '6px' : '0',
                          }}>
                            {species.scientificName}
                          </div>
                        )}
                        {species.showCode && (
                          <div style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: accentColor,
                            opacity: 0.7,
                          }}>
                            {species.code}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
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

export default LevelSelect;
