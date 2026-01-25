import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';
import { trackLevelSelect } from '../utils/analytics';

// Species info for gallery display
interface SpeciesInfo {
  code: string;
  displayName: string;  // Common name for NA, tile name (Māori) for NZ
  scientificName: string;
  showCode: boolean;    // Show 4-letter code for NA, hide for NZ
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
  nz_rare: 'Rare & Endemic',
};

// NZ pack IDs for routing
const NZ_PACK_IDS = ['nz_all_birds', 'nz_common', 'nz_rare'];

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
  const [showGallery, setShowGallery] = useState(false);
  const [gallerySpecies, setGallerySpecies] = useState<SpeciesInfo[]>([]);

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

  // Load species for the gallery when opened
  useEffect(() => {
    if (!showGallery || packId === 'custom') return;

    const isNZ = NZ_PACK_IDS.includes(packId);
    const packJsonPath = `${import.meta.env.BASE_URL}data/packs/${packId}.json`;
    const speciesJsonPath = `${import.meta.env.BASE_URL}data/species.json`;
    const nzDisplayCodesPath = `${import.meta.env.BASE_URL}data/nz_display_codes.json`;

    const fetches: Promise<unknown>[] = [
      fetch(packJsonPath).then(r => r.json()),
      fetch(speciesJsonPath).then(r => r.json()),
    ];
    if (isNZ) {
      fetches.push(fetch(nzDisplayCodesPath).then(r => r.json()));
    }

    Promise.all(fetches)
      .then((results) => {
        const packData = results[0] as { species: string[] };
        const speciesData = results[1] as Array<{ species_code: string; common_name: string; scientific_name: string }>;
        const nzDisplayCodes = isNZ ? (results[2] as { codes: Record<string, { code: string; tileName: string }> }).codes : null;

        const speciesCodes: string[] = packData.species || [];

        // Build a map of species code -> species info from species.json
        const speciesMap: Record<string, { name: string; scientificName: string }> = {};
        for (const sp of speciesData) {
          speciesMap[sp.species_code] = {
            name: sp.common_name,
            scientificName: sp.scientific_name,
          };
        }

        // Build species info array
        let speciesInfo: SpeciesInfo[] = speciesCodes.map(code => {
          if (isNZ && nzDisplayCodes && nzDisplayCodes[code]) {
            // NZ birds: use tile name (Māori), hide code
            return {
              code,
              displayName: nzDisplayCodes[code].tileName,
              scientificName: speciesMap[code]?.scientificName || '',
              showCode: false,
            };
          } else {
            // NA birds: use common name, show 4-letter code
            return {
              code,
              displayName: speciesMap[code]?.name || code,
              scientificName: speciesMap[code]?.scientificName || '',
              showCode: true,
            };
          }
        });

        // Sort: NA birds by 4-letter code, NZ birds by tile name (Māori)
        if (isNZ) {
          speciesInfo.sort((a, b) => a.displayName.localeCompare(b.displayName));
        } else {
          speciesInfo.sort((a, b) => a.code.localeCompare(b.code));
        }

        setGallerySpecies(speciesInfo);
      })
      .catch(err => {
        console.error('Failed to load gallery species:', err);
      });
  }, [showGallery, packId]);

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
                opacity: 0.6,
              }}
              aria-label={`View ${packName} bird gallery`}
            >
              <h2 style={{ margin: 0, fontSize: '20px', color: 'inherit' }}>{packName}</h2>
              <span style={{ fontSize: '14px', opacity: 0.7 }}>🖼️</span>
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
            <Link
              to={isNZPack ? `/nz-packs?expand=${packId}#bird-reference` : `/pack-select?expand=${packId}#bird-reference`}
              state={{ fromLevelSelect: true, packId }}
              className="btn-icon"
              style={{ color: accentColor, opacity: 0.6, textDecoration: 'none', fontSize: '18px', display: 'flex', gap: '2px' }}
              aria-label="Sound Library"
            >
              <span>🎧</span><span>📚</span>
            </Link>
          )}
          <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{ color: accentColor, opacity: 0.6 }}>
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
          <strong style={{ color: accentColor, opacity: 0.7 }}>Tip:</strong> Tap the pack name to see all birds.
          Start with Level 1 to learn each bird's signature sound, then progress to variations and both-ear challenges.
        </div>
      </div>

      {/* Bird Gallery Modal */}
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
            padding: '16px',
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
                  <div style={{
                    textAlign: 'center',
                  }}>
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
      <path d="M15 18l-6-6 6-6" />
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
