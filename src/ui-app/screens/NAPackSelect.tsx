import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { trackPackSelect } from '../utils/analytics';

interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  source_id?: string;
  canonical?: boolean;
  rejected?: boolean;
  vocalization_type?: string;
  source?: string;
  source_url?: string;
  spectrogram_path?: string;
  recordist?: string;
}

interface BirdClip {
  id: string;
  path: string;
  isCanonical: boolean;
  vocalizationType?: string;
  source?: string;
  sourceId?: string;
  sourceUrl?: string;
  recordist?: string;
}

interface BirdInfo {
  code: string;
  name: string;
  canonicalClipPath: string | null;
  clipCount: number;
  allClips: BirdClip[];
}

interface Pack {
  id: string;
  name: string;
  speciesCount: number;
  isUnlocked: boolean;
  description: string;
  region?: 'na' | 'nz' | 'eu';
}

const PACKS: Pack[] = [
  {
    id: 'starter_birds',
    name: 'Backyard Birds',
    speciesCount: 6,
    isUnlocked: true,
    description: 'Start here! Distinctive, bold, recognizable voices.',
    region: 'na',
  },
  {
    id: 'grassland_birds',
    name: 'Grasslands',
    speciesCount: 10,
    isUnlocked: true,
    description: 'From prairies to farmland: meadowlarks,\nbuntings, and field singers.',
    region: 'na',
  },
  {
    id: 'expanded_backyard',
    name: 'Eastern Birds',
    speciesCount: 60,
    isUnlocked: true,
    description: 'Ready for more feathered friends? 9 random\nper round.',
    region: 'na',
  },
  {
    id: 'western_birds',
    name: 'Western Birds',
    speciesCount: 26,
    isUnlocked: true,
    description: 'Frequent flyers from the Pacific coast to the Rockies.',
    region: 'na',
  },
  {
    id: 'woodpeckers',
    name: 'Woodpeckers',
    speciesCount: 9,
    isUnlocked: true,
    description: 'Drums, calls, and rattles.',
    region: 'na',
  },
  {
    id: 'sparrows',
    name: 'Sparrows',
    speciesCount: 9,
    isUnlocked: true,
    description: 'Master their subtle songs.',
    region: 'na',
  },
  {
    id: 'spring_warblers',
    name: 'Warbler Academy',
    speciesCount: 36,
    isUnlocked: true,
    description: '9 random per round. Custom Pack\nmode recommended!',
    region: 'na',
  },
  {
    id: 'na_all_birds',
    name: 'All North America',
    speciesCount: 122,
    isUnlocked: true,
    description: 'The complete 122-species collection.\n9 random per round.',
    region: 'na',
  },
];

function NAPackSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [packDisplaySpecies, setPackDisplaySpecies] = useState<Record<string, string[]>>({});
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBird, setExpandedBird] = useState<string | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [taxonomicSort, setTaxonomicSort] = useState(false);
  const [showPackGallery, setShowPackGallery] = useState(false);
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load clips data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/clips.json`)
      .then((res) => res.json())
      .then((data: ClipData[]) => {
        setClips(data);
      })
      .catch((err) => console.error('Failed to load clips:', err));
  }, []);

  // Load taxonomic order
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`)
      .then((res) => res.json())
      .then((data: Record<string, number>) => {
        setTaxonomicOrder(data);
      })
      .catch((err) => console.error('Failed to load taxonomic order:', err));
  }, []);

  // Load species metadata from species.json (single source of truth)
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/species.json`)
      .then((res) => res.json())
      .then((data: Array<{species_code: string; common_name: string; scientific_name: string}>) => {
        const sciNames: Record<string, string> = {};
        const comNames: Record<string, string> = {};
        data.forEach((sp) => {
          sciNames[sp.species_code] = sp.scientific_name;
          comNames[sp.species_code] = sp.common_name;
        });
        setScientificNames(sciNames);
        setCommonNames(comNames);
      })
      .catch((err) => console.error('Failed to load species metadata:', err));
  }, []);

  // Load pack species from JSON files (single source of truth)
  useEffect(() => {
    const packIds = [
      'starter_birds', 'grassland_birds', 'expanded_backyard', 'sparrows', 'woodpeckers', 'spring_warblers', 'western_birds', 'na_all_birds',
    ];

    Promise.all(
      packIds.map((id) =>
        fetch(`${import.meta.env.BASE_URL}data/packs/${id}.json`)
          .then((res) => res.json())
          .catch((err) => {
            console.error(`Failed to load pack ${id}:`, err);
            return null;
          })
      )
    ).then((packs) => {
      const displaySpeciesMap: Record<string, string[]> = {};
      packs.forEach((pack, i) => {
        if (pack && pack.species) {
          displaySpeciesMap[packIds[i]] = pack.display_species || pack.species;
        }
      });
      setPackDisplaySpecies((prev) => ({ ...prev, ...displaySpeciesMap }));
    });
  }, []);

  // Get bird info for a pack (use display_species for Bird Reference)
  const getBirdsForPack = (packId: string): BirdInfo[] => {
    const speciesCodes = packDisplaySpecies[packId] || [];
    const birds = speciesCodes.map((code) => {
      const speciesClips = clips.filter((c) =>
        c.species_code === code &&
        !c.rejected &&
        (!c.spectrogram_path || !c.spectrogram_path.includes('spectrograms-rejected'))
      );
      const canonicalClip = speciesClips.find((c) => c.canonical);
      const clip = canonicalClip || speciesClips[0];

      const allClips: BirdClip[] = speciesClips
        .sort((a, b) => {
          if (a.canonical && !b.canonical) return -1;
          if (!a.canonical && b.canonical) return 1;
          return a.clip_id.localeCompare(b.clip_id);
        })
        .map((c) => ({
          id: c.clip_id,
          path: `${import.meta.env.BASE_URL}${c.file_path}`,
          isCanonical: !!c.canonical,
          vocalizationType: c.vocalization_type,
          source: c.source,
          sourceId: c.source_id,
          sourceUrl: c.source_url,
          recordist: c.recordist,
        }));

      return {
        code,
        name: commonNames[code] || code,
        canonicalClipPath: clip ? `${import.meta.env.BASE_URL}${clip.file_path}` : null,
        clipCount: speciesClips.length,
        allClips,
      };
    });

    if (taxonomicSort && Object.keys(taxonomicOrder).length > 0) {
      return birds.sort((a, b) => {
        const orderA = taxonomicOrder[a.code] || 9999;
        const orderB = taxonomicOrder[b.code] || 9999;
        return orderA - orderB;
      });
    }

    return birds.sort((a, b) => a.code.localeCompare(b.code));
  };

  const handlePackSelect = (pack: Pack) => {
    if (pack.isUnlocked) {
      trackPackSelect(pack.id, pack.name);
      const savedLevel = localStorage.getItem(`soundfield_pack_level_${pack.id}`);
      const levelId = savedLevel ? parseInt(savedLevel, 10) : 1;
      navigate(`/preview?pack=${pack.id}&level=${levelId}`);
    }
  };

  const playSound = (clipPath: string, code: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingClip === code) {
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  // Auto-expand pack from query parameter and scroll to hash anchor
  useEffect(() => {
    const expandParam = searchParams.get('expand') || searchParams.get('expandPack');
    if (expandParam) {
      setExpandedPacks(new Set([expandParam]));
    }

    if (window.location.hash) {
      setTimeout(() => {
        const element = document.querySelector(window.location.hash);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, [searchParams]);

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="flex-row items-center gap-md" style={{ marginBottom: '16px' }}>
        <button className="btn-icon" onClick={() => navigate('/pack-select')} aria-label="Back" style={{
          color: 'var(--color-text-muted)',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '6px',
        }}>
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>North America</h2>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{
            color: 'var(--color-text-muted)',
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '6px',
          }}>
            <HomeIcon />
          </button>
        </div>
      </div>

      {/* Create Custom Pack Section */}
      <div
        style={{
          marginBottom: '20px',
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '16px',
          overflow: 'visible',
        }}
      >
        <div
          onClick={() => navigate('/custom-pack?region=na')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            minHeight: '80px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(245, 200, 122, 0.08)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            flexShrink: 0,
          }}>
            🥚
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              Hatch a Custom Pack
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreExamples(!showMoreExamples);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                padding: '0',
                textDecoration: 'underline',
                marginTop: '4px',
              }}
            >
              {showMoreExamples ? 'Hide examples' : 'See examples'}
            </button>
          </div>
        </div>

        {showMoreExamples && (
          <div
            onClick={() => navigate('/custom-pack?region=na')}
            style={{
              padding: '0 16px 16px 16px',
              cursor: 'pointer',
            }}
          >
            <div style={{
              fontSize: '13px',
              color: 'var(--color-text-muted)',
              lineHeight: 1.6,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: '12px',
            }}>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Got a nemesis bird? Add it and drill all its variations.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> A friend's eBird checklist has you jealous? Build their list and practice like you were there.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Constantly confuse Kinglets, Creepers and Waxwings? Put them head-to-head.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Warbler Wizard Wannabe? Training starts here!
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> You think you know your woodpeckers? Try the Pileated vs. Northern Flicker on Level 5.
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Mix species from any pack — your rules, your practice.
              </div>
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(245, 200, 122, 0.5)',
                borderRadius: '8px',
                color: '#f5f0e6',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                Click to Get Started →
              </div>
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {PACKS.map((pack) => {
          const packColors: Record<string, string> = {
            starter_birds: 'linear-gradient(135deg, #2a4a3a 0%, #1a3028 100%)',
            grassland_birds: 'linear-gradient(135deg, #3a4a2a 0%, #263618 100%)',
            expanded_backyard: 'linear-gradient(135deg, #2a3a4a 0%, #1a2838 100%)',
            sparrows: 'linear-gradient(135deg, #3a3a4a 0%, #282838 100%)',
            woodpeckers: 'linear-gradient(135deg, #4a2a2a 0%, #381a1a 100%)',
            western_birds: 'linear-gradient(135deg, #2a3a3a 0%, #1a2a2a 100%)',
            spring_warblers: 'linear-gradient(135deg, #4a4a1a 0%, #383810 100%)',
            na_all_birds: 'linear-gradient(135deg, #2a3040 0%, #1a2030 100%)',
          };

          const packIcons: Record<string, string> = {
            starter_birds: 'NOCA',
            grassland_birds: 'EAME',
            expanded_backyard: 'AGOL',
            sparrows: 'WTSP',
            woodpeckers: 'PIWO',
            western_birds: 'STJA',
            spring_warblers: 'BLBW',
            na_all_birds: 'AMRO',
          };

          return (
          <button
            key={pack.id}
            onClick={() => handlePackSelect(pack)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'left',
              padding: '12px 12px 14px 12px',
              borderRadius: '16px',
              border: 'none',
              background: packColors[pack.id] || packColors.starter_birds,
              boxShadow: pack.isUnlocked
                ? '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : 'none',
              opacity: pack.isUnlocked ? 1 : 0.5,
              cursor: pack.isUnlocked ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s, box-shadow 0.2s',
              gridColumn: (pack.id === 'spring_warblers' || pack.id === 'na_all_birds') ? '1 / -1' : 'auto',
            }}
            onMouseEnter={(e) => {
              if (pack.isUnlocked) {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}data/icons/${packIcons[pack.id]}.png`}
              alt=""
              style={{
                position: 'absolute',
                right: '-10px',
                bottom: '-10px',
                width: '80px',
                height: '80px',
                opacity: 0.75,
                filter: 'brightness(1.2)',
                transform: 'rotate(-15deg)',
                objectFit: 'cover',
              }}
            />

            {pack.isUnlocked && (
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  zIndex: 2,
                }}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    color: '#a8d5a2',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                  }}
                >
                  Play <ArrowIcon />
                </span>
              </div>
            )}

            <div style={{ position: 'relative', zIndex: 1, paddingTop: pack.id === 'spring_warblers' ? 0 : '8px' }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#f5f0e6',
                  lineHeight: 1.3,
                  marginBottom: '6px',
                  paddingRight: '50px',
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.5)',
                }}
              >
                {pack.name}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(245, 240, 230, 0.75)',
                  lineHeight: 1.4,
                  marginBottom: '10px',
                  whiteSpace: 'pre-line',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
                }}
              >
                {pack.description}
              </div>
              <div>
                <span
                  style={{
                    fontSize: '12px',
                    color: 'rgba(245, 240, 230, 0.7)',
                    fontWeight: 500,
                  }}
                >
                  {pack.speciesCount} species
                </span>
              </div>
            </div>
          </button>
        );})}

      </div>

      {/* Sound Library Section */}
      <div id="bird-reference" style={{ marginTop: '16px', scrollMarginTop: '20px' }}>
        {/* Back navigation button (PWA-friendly) */}
        {location.state?.fromHelp && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => navigate('/help')}
              style={{
                background: 'rgba(255, 255, 255, 0.7)',
                color: 'var(--color-background)',
                border: 'none',
                borderRadius: '8px',
                padding: '10px 16px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
              aria-label="Back to Help"
            >
              <span style={{ fontSize: '18px' }}>←</span>
              Back to Help
            </button>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', margin: 0, color: 'var(--color-text-muted)' }}>
              🎧📚 Sound Library
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => {
                setTaxonomicSort(!taxonomicSort);
                if (expandedPacks.size === 0) {
                  setExpandedPacks(new Set(['na_all_birds']));
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#fff',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '14px' }}>{taxonomicSort ? '📊' : '🔤'}</span>
              {taxonomicSort ? 'Taxonomy' : 'A-Z'}
            </button>
            <button
              onClick={() => setShowPackGallery(true)}
              style={{
                padding: '6px 8px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                fontSize: '14px',
              }}
              title="Bird Gallery"
            >
              🖼️
            </button>
          </div>
        </div>


        <p style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          marginBottom: '20px',
          paddingLeft: '12px',
          borderLeft: '3px solid rgba(245, 200, 122, 0.5)',
        }}>
          Preview signature sounds for each bird before you play. Click pack names to expand and see all birds, or click individual birds to explore their full library of recordings.
        </p>

        {/* All North America - uses na_all_birds pack */}
        {packDisplaySpecies['na_all_birds'] && (() => {
          const packId = 'na_all_birds';
          const isExpanded = expandedPacks.has(packId);
          return (
            <div key={packId} style={{ marginBottom: '16px' }}>
              <div
                onClick={() => {
                  const newExpanded = new Set(expandedPacks);
                  if (newExpanded.has(packId)) {
                    newExpanded.delete(packId);
                  } else {
                    newExpanded.add(packId);
                  }
                  setExpandedPacks(newExpanded);
                }}
                style={{
                  fontSize: '14px',
                  marginBottom: isExpanded ? '12px' : '0',
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'rgba(45, 45, 68, 0.7)',
                  borderRadius: '8px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 0.85)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 0.7)'}
              >
                <span style={{ fontSize: '14px', color: '#fff', opacity: 0.6 }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 600, color: '#fff', opacity: 0.85 }}>
                  All North America
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {packDisplaySpecies[packId]?.length || 0} species
                </span>
              </div>
              {isExpanded && (
              <div>
                <div style={{ marginBottom: '10px', position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by code, name, or Latin name..."
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 32px',
                      fontSize: '13px',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '8px',
                      color: '#fff',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px', opacity: 0.4 }}>🔍</span>
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: '14px', padding: '2px 4px',
                      }}
                    >✕</button>
                  )}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px',
                  }}
                >
                {getBirdsForPack(packId).filter((bird) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return bird.code.toLowerCase().includes(q)
                    || bird.name.toLowerCase().includes(q)
                    || (scientificNames[bird.code] || '').toLowerCase().includes(q);
                }).map((bird) => {
                  const isBirdExpanded = expandedBird === bird.code;
                  return (
                    <div
                      key={bird.code}
                      style={{
                        background: 'var(--color-surface)',
                        borderRadius: '8px',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          cursor: bird.clipCount > 1 ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (bird.clipCount > 1) {
                            setExpandedBird(isBirdExpanded ? null : bird.code);
                          }
                        }}
                      >
                        <BirdIcon code={bird.code} size={36} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                            {bird.code}
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {bird.name}
                          </div>
                          {taxonomicSort && scientificNames[bird.code] && (
                            <div style={{
                              fontSize: '11px',
                              fontStyle: 'italic',
                              color: 'var(--color-text-muted)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {scientificNames[bird.code]}
                            </div>
                          )}
                        </div>
                        {bird.canonicalClipPath && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              playSound(bird.canonicalClipPath!, bird.code);
                            }}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              border: 'none',
                              background: playingClip === bird.code ? '#f5c87a' : 'rgba(255, 255, 255, 0.15)',
                              color: playingClip === bird.code ? '#000' : '#f5c87a',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '14px',
                            }}
                          >
                            {playingClip === bird.code ? '⏸' : '▶'}
                          </button>
                        )}
                        {bird.clipCount > 1 && (
                          <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                            {isBirdExpanded ? '▼' : '▶'}
                          </span>
                        )}
                      </div>

                      {/* Expanded clip library */}
                      {isBirdExpanded && bird.allClips.length > 0 && (
                        <div style={{
                          padding: '0 12px 12px 12px',
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                        }}>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginTop: '8px', marginBottom: '8px', fontWeight: 600 }}>
                            All Recordings ({bird.allClips.length})
                          </div>
                          {bird.allClips.map((clip, idx) => (
                            <div
                              key={clip.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                marginBottom: '6px',
                                padding: '6px',
                                background: 'rgba(0,0,0,0.2)',
                                borderRadius: '6px',
                              }}
                            >
                              <button
                                onClick={() => playSound(clip.path, `${bird.code}_${idx}`)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: playingClip === `${bird.code}_${idx}` ? '#f5c87a' : 'rgba(255, 255, 255, 0.15)',
                                  color: playingClip === `${bird.code}_${idx}` ? '#000' : '#f5c87a',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '10px',
                                  flexShrink: 0,
                                }}
                              >
                                {playingClip === `${bird.code}_${idx}` ? '⏸' : '▶'}
                              </button>
                              <div style={{ flex: 1, fontSize: '11px' }}>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                  {clip.isCanonical && (
                                    <span style={{
                                      fontSize: '9px',
                                      background: 'rgba(255, 255, 255, 0.7)',
                                      color: '#000',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}>
                                      SIGNATURE
                                    </span>
                                  )}
                                  <span style={{
                                    fontSize: '9px',
                                    color: 'var(--color-text-muted)',
                                    background: clip.vocalizationType === 'song' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(245, 200, 122, 0.2)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    textTransform: 'uppercase',
                                  }}>
                                    {clip.vocalizationType}
                                  </span>
                                  {(clip.source || clip.recordist) && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: 'var(--color-text-muted)',
                                      background: 'rgba(255,255,255,0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}>
                                      {clip.sourceUrl ? (
                                        <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                                          {clip.sourceId}{clip.recordist ? ` • ${clip.recordist}` : ''}
                                        </a>
                                      ) : (
                                        <>
                                          {clip.source === 'macaulay' ? clip.sourceId || 'Cornell' : clip.source === 'user_recording' ? (clip.recordist || 'User') : clip.sourceId || clip.source}
                                          {clip.source !== 'user_recording' && clip.recordist && !clip.sourceId && ` • ${clip.recordist}`}
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
                </div>
              </div>
              )}
            </div>
          );
        })()}

        {PACKS.filter(p => p.isUnlocked && p.id !== 'na_all_birds').map((pack) => {
          const isExpanded = expandedPacks.has(pack.id);
          return (
          <div key={pack.id} style={{ marginBottom: '16px' }}>
            <div
              onClick={() => {
                const newExpanded = new Set(expandedPacks);
                if (newExpanded.has(pack.id)) {
                  newExpanded.delete(pack.id);
                } else {
                  newExpanded.add(pack.id);
                }
                setExpandedPacks(newExpanded);
              }}
              style={{
                fontSize: '14px',
                marginBottom: isExpanded ? '12px' : '0',
                color: 'var(--color-text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'rgba(45, 45, 68, 0.7)',
                borderRadius: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 0.85)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 0.7)'}
            >
              <span style={{ fontSize: '14px', color: '#fff', opacity: 0.6 }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <span style={{ fontWeight: 600, color: '#fff', opacity: 0.85 }}>
                {pack.name}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {packDisplaySpecies[pack.id]?.length || 0} species
              </span>
            </div>

            {/* Ready to Play button */}
            {isExpanded && location.state?.fromPreview && location.state?.pack === pack.id && (
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    const { pack, level } = location.state as { pack: string; level: number };
                    navigate(`/preview?pack=${pack}&level=${level}&keepBirds=true`);
                  }}
                  style={{
                    padding: '10px 16px',
                    fontSize: '14px',
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(45, 90, 39, 0.4)',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 16px rgba(45, 90, 39, 0.5)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(45, 90, 39, 0.4)';
                  }}
                >
                  Ready to Play?
                </button>
              </div>
            )}

            {isExpanded && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '8px',
              }}
            >
              {getBirdsForPack(pack.id).map((bird) => {
                const isExpanded = expandedBird === bird.code;
                return (
                  <div
                    key={bird.code}
                    style={{
                      background: 'var(--color-surface)',
                      borderRadius: '8px',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        padding: '8px 12px',
                        cursor: bird.clipCount > 1 ? 'pointer' : 'default',
                      }}
                      onClick={() => {
                        if (bird.clipCount > 1) {
                          setExpandedBird(isExpanded ? null : bird.code);
                        }
                      }}
                    >
                      <BirdIcon code={bird.code} size={36} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: '#fff' }}>
                          {bird.code}
                        </div>
                        <div
                          style={{
                            fontSize: '12px',
                            color: 'var(--color-text)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {bird.name}
                        </div>
                        {taxonomicSort && scientificNames[bird.code] && (
                          <div style={{
                            fontSize: '10px',
                            fontStyle: 'italic',
                            color: 'var(--color-text-muted)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {scientificNames[bird.code]}
                          </div>
                        )}
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                          {bird.clipCount} clip{bird.clipCount !== 1 ? 's' : ''}
                          {bird.clipCount > 1 && (
                            <span style={{ marginLeft: '4px', color: '#fff', opacity: 0.6 }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          bird.canonicalClipPath && playSound(bird.canonicalClipPath, bird.code);
                        }}
                        disabled={!bird.canonicalClipPath}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '50%',
                          border: 'none',
                          background: playingClip === bird.code ? '#f5c87a' : 'rgba(255, 255, 255, 0.15)',
                          color: playingClip === bird.code ? '#000' : '#f5c87a',
                          cursor: bird.canonicalClipPath ? 'pointer' : 'not-allowed',
                          opacity: bird.canonicalClipPath ? 1 : 0.3,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                        aria-label={`Play ${bird.name}`}
                      >
                        {playingClip === bird.code ? <StopIcon /> : <PlayIcon />}
                      </button>
                    </div>

                    {/* Expanded clips list */}
                    {isExpanded && bird.allClips.length > 0 && (
                      <div
                        style={{
                          borderTop: '1px solid rgba(255,255,255,0.1)',
                          padding: '8px 12px',
                          background: 'rgba(0,0,0,0.2)',
                        }}
                      >
                        <div style={{ fontSize: '10px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
                          All {bird.clipCount} clips:
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {bird.allClips.map((clip, index) => (
                            <div
                              key={clip.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <button
                                onClick={() => playSound(clip.path, clip.id)}
                                style={{
                                  width: '24px',
                                  height: '24px',
                                  borderRadius: '50%',
                                  border: 'none',
                                  background: playingClip === clip.id ? '#f5c87a' : 'rgba(255, 255, 255, 0.15)',
                                  color: playingClip === clip.id ? '#000' : '#f5c87a',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                                aria-label={`Play clip ${index + 1}`}
                              >
                                {playingClip === clip.id ? <StopIcon size={8} /> : <PlayIcon size={8} />}
                              </button>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--color-text)' }}>
                                    {clip.sourceId || `Clip ${index + 1}`}
                                  </span>
                                  {clip.isCanonical && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: '#000',
                                      background: 'rgba(255, 255, 255, 0.7)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}>
                                      ★ SIGNATURE
                                    </span>
                                  )}
                                  {clip.vocalizationType && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: 'var(--color-text-muted)',
                                      background: 'rgba(255,255,255,0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      textTransform: 'capitalize',
                                    }}>
                                      {clip.vocalizationType}
                                    </span>
                                  )}
                                  {(clip.source || clip.recordist) && (
                                    <span style={{
                                      fontSize: '9px',
                                      color: 'var(--color-text-muted)',
                                      background: 'rgba(255,255,255,0.1)',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                    }}>
                                      {clip.sourceUrl ? (
                                        <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>
                                          {clip.sourceId}{clip.recordist ? ` • ${clip.recordist}` : ''}
                                        </a>
                                      ) : (
                                        <>
                                          {clip.source === 'macaulay' ? clip.sourceId || 'Cornell' : clip.source === 'user_recording' ? (clip.recordist || 'User') : clip.sourceId || clip.source}
                                          {clip.source !== 'user_recording' && clip.recordist && !clip.sourceId && ` • ${clip.recordist}`}
                                        </>
                                      )}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
          );
        })}
      </div>

      {/* Bird Gallery Modal */}
      {showPackGallery && (
        <div
          onClick={() => setShowPackGallery(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            overflowY: 'auto',
            padding: '60px 16px 24px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '480px', width: '100%' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>All NA Birds</h2>
              <button
                onClick={() => setShowPackGallery(false)}
                style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer', padding: '8px 14px', borderRadius: '8px', minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                ✕
              </button>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
            }}>
              {getBirdsForPack('na_all_birds').map((bird) => (
                <div key={bird.code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <BirdIcon code={bird.code} size={120} />
                    {bird.canonicalClipPath && (
                      <button
                        onClick={() => playSound(bird.canonicalClipPath!, bird.code)}
                        style={{
                          position: 'absolute',
                          bottom: '-8px',
                          right: '-14px',
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: 'none',
                          background: playingClip === bird.code ? 'rgba(255,255,255,0.25)' : 'rgba(0, 0, 0, 0.7)',
                          color: playingClip === bird.code ? '#000' : 'rgba(255,255,255,0.8)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '16px',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                        }}
                        aria-label={playingClip === bird.code ? `Stop ${bird.name}` : `Play ${bird.name}`}
                      >
                        {playingClip === bird.code ? '⏸' : '▶'}
                      </button>
                    )}
                  </div>
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', textAlign: 'center', lineHeight: 1.2 }}>
                    {commonNames[bird.code] || bird.name}
                  </span>
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

function HomeIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function PlayIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function BirdSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      <path d="M85 35c-5-3-12-2-18 1-3-8-10-14-19-16 2-3 3-7 2-11-1-5-5-8-9-7s-7 5-6 10c0 2 1 4 2 5-10 3-18 11-21 21-8-1-16 2-21 8-2 2-1 5 1 6s5 0 7-2c3-4 8-5 13-4 0 12 7 23 18 28l-8 12c-2 2-1 5 1 7 2 1 5 1 6-2l10-14c3 1 6 1 9 1 4 0 7-1 10-2l10 14c2 2 5 3 7 1s2-5 0-7l-8-12c11-5 18-16 18-28 5-1 10 0 13 4 2 2 5 3 7 2s3-4 1-6c-5-6-13-9-21-8z" />
    </svg>
  );
}

function BirdIcon({ code, size = 36 }: { code: string; size?: number }) {
  const [hasIcon, setHasIcon] = useState(true);
  const iconPath = `${import.meta.env.BASE_URL}data/icons/${code}.png`;

  if (!hasIcon) {
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.4,
        flexShrink: 0,
      }}>
        <BirdSilhouette size={size * 0.7} />
      </div>
    );
  }

  return (
    <img
      src={iconPath}
      alt={code}
      width={size}
      height={size}
      style={{
        borderRadius: '50%',
        objectFit: 'cover',
        flexShrink: 0,
      }}
      onError={() => setHasIcon(false)}
    />
  );
}

export default NAPackSelect;
