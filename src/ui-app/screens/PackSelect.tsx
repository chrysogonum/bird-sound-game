import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { trackPackSelect } from '../utils/analytics';

interface Pack {
  id: string;
  name: string;
  speciesCount: number;
  isUnlocked: boolean;
  description: string;
}

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

const PACKS: Pack[] = [
  {
    id: 'starter_birds',
    name: 'Backyard Birds',
    speciesCount: 6,
    isUnlocked: true,
    description: 'Start here! Distinctive, bold, recognizable voices.',
  },
  {
    id: 'expanded_backyard',
    name: 'Eastern Birds',
    speciesCount: 46,
    isUnlocked: true,
    description: 'Ready for more feathered friends? 9 random per round.',
  },
  {
    id: 'sparrows',
    name: 'Sparrows',
    speciesCount: 9,
    isUnlocked: true,
    description: 'Master their subtle songs.',
  },
  {
    id: 'woodpeckers',
    name: 'Woodpeckers',
    speciesCount: 9,
    isUnlocked: true,
    description: 'Drums, calls, and rattles.',
  },
  {
    id: 'western_birds',
    name: 'Western Birds',
    speciesCount: 18,
    isUnlocked: true,
    description: 'Frequent flyers from the Pacific coast to the Rockies.',
  },
  {
    id: 'spring_warblers',
    name: 'Warbler Academy',
    speciesCount: 33,
    isUnlocked: true,
    description: '9 random per round. Custom Pack mode recommended!',
  },
];

function PackSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [packDisplaySpecies, setPackDisplaySpecies] = useState<Record<string, string[]>>({});
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [expandedBird, setExpandedBird] = useState<string | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [showAllPacks, setShowAllPacks] = useState(false);
  const [showMoreExamples, setShowMoreExamples] = useState(false);
  const [taxonomicSort, setTaxonomicSort] = useState(false);
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

        // Create "All Birds" pack with all unique species from clips
        const allSpeciesCodes = Array.from(
          new Set(
            data
              .filter((c) => !c.rejected && (!c.spectrogram_path || !c.spectrogram_path.includes('spectrograms-rejected')))
              .map((c) => c.species_code)
          )
        ).sort();

        setPackDisplaySpecies((prev) => ({
          ...prev,
          'all_birds': allSpeciesCodes,
        }));
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
    const packIds = ['starter_birds', 'expanded_backyard', 'sparrows', 'woodpeckers', 'spring_warblers', 'western_birds'];

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
          // Use display_species for Bird Reference, fallback to species if not available
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

      // Build all clips list, canonical first
      const allClips: BirdClip[] = speciesClips
        .sort((a, b) => {
          // Canonical first
          if (a.canonical && !b.canonical) return -1;
          if (!a.canonical && b.canonical) return 1;
          // Then by clip_id
          return a.clip_id.localeCompare(b.clip_id);
        })
        .map((c) => ({
          id: c.clip_id,
          path: `${import.meta.env.BASE_URL}data/clips/${c.file_path.split('/').pop()}`,
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
        canonicalClipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
        clipCount: speciesClips.length,
        allClips,
      };
    });

    // Sort based on mode: taxonomic or alphabetical
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
      navigate(`/level-select?pack=${pack.id}`);
    }
  };

  const playSound = (clipPath: string, code: string) => {
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
        <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{ color: 'var(--color-accent)' }}>
          <HomeIcon />
        </button>
        <h2 style={{ margin: 0 }}>Select a Bird Pack</h2>
      </div>

      <div style={{
        fontSize: '14px',
        color: 'var(--color-text-muted)',
        marginBottom: '20px',
        lineHeight: 1.6,
        background: 'rgba(70, 70, 90, 0.5)',
        padding: '16px',
        borderRadius: '12px',
      }}>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li style={{ fontWeight: 600 }}>Use 🎧 (or not), but do UNmute 🔊📱</li>
          <li>6 levels per pack—start @ #1, 🦗 sparrow</li>
          <li>Try training mode (👁){' '}
            <Link to="/help#training-mode" state={{ fromPackSelect: true }} style={{ color: 'var(--color-accent)' }}>
              Help →
            </Link>
          </li>
          <li>Timer anxiety? Use Continuous Play{' '}
            <Link to="/settings" state={{ fromPackSelect: true }} style={{ color: 'var(--color-accent)' }}>
              🧘 ⚙️
            </Link>
          </li>
          <li>👇 Check out the full sound library below</li>
        </ul>
      </div>

      {/* Create Custom Pack Section - Compact, Collapsible */}
      <div
        style={{
          marginBottom: '20px',
          background: 'var(--color-surface)',
          border: '2px solid var(--color-accent)',
          borderRadius: '16px',
          overflow: 'visible',
        }}
      >
        <div
          onClick={() => navigate('/custom-pack')}
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
            e.currentTarget.style.background = 'rgba(45, 90, 39, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
            flexShrink: 0,
          }}>
            <PlusIcon />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#f5f0e6' }}>
              Create Custom Pack
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMoreExamples(!showMoreExamples);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-accent)',
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
            onClick={() => navigate('/custom-pack')}
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
                <span style={{ color: 'var(--color-accent)' }}>→</span> Got a nemesis bird? Add it and drill all its variations.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-accent)' }}>→</span> A friend's eBird checklist has you jealous? Build their list and practice like you were there.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-accent)' }}>→</span> Constantly confuse Kinglets, Creepers and Waxwings? Put them head-to-head.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-accent)' }}>→</span> Warbler Wizard Wannabe? Training starts here!
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-accent)' }}>→</span> You think you know your woodpeckers? Try the Pileated vs. Northern Flicker on Level 5.
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: 'var(--color-accent)' }}>→</span> Mix species from any pack — your rules, your practice.
              </div>
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'var(--color-accent)',
                borderRadius: '8px',
                color: '#000',
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
          // Different colors for each pack
          const packColors: Record<string, string> = {
            starter_birds: 'linear-gradient(135deg, #2d5a3d 0%, #1a3d2a 100%)',      // Forest green
            expanded_backyard: 'linear-gradient(135deg, #3d5a6e 0%, #2a3d4a 100%)',  // Slate blue
            sparrows: 'linear-gradient(135deg, #6b5344 0%, #4a3a2e 100%)',           // Earthy brown
            woodpeckers: 'linear-gradient(135deg, #6e3d3d 0%, #4a2a2a 100%)',        // Deep red
            spring_warblers: 'linear-gradient(135deg, #7a6b2d 0%, #5a4a1a 100%)',    // Golden olive
            western_birds: 'linear-gradient(135deg, #5a4a7a 0%, #3a2a5a 100%)',      // Mountain purple
          };

          // Pack representative bird icons
          const packIcons: Record<string, string> = {
            starter_birds: 'NOCA',
            expanded_backyard: 'AMGO',
            sparrows: 'WTSP',
            woodpeckers: 'PIWO',
            spring_warblers: 'BLBW',
            western_birds: 'STJA',
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
            {/* Decorative bird icon */}
            <img
              src={`${import.meta.env.BASE_URL}data/icons/${packIcons[pack.id]}.png`}
              alt=""
              style={{
                position: 'absolute',
                right: '-10px',
                bottom: '-10px',
                width: '80px',
                height: '80px',
                opacity: 0.3,
                transform: 'rotate(-15deg)',
                objectFit: 'cover',
              }}
            />

            {/* Play button - top right */}
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

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#f5f0e6',
                  lineHeight: 1.3,
                  marginBottom: '6px',
                  paddingRight: '50px',
                }}
              >
                {pack.name}
              </div>
              <div
                style={{
                  fontSize: '12px',
                  color: 'rgba(245, 240, 230, 0.6)',
                  lineHeight: 1.4,
                  marginBottom: '10px',
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
        {location.state?.fromLevelSelect && location.state?.packId && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => navigate(`/level-select?pack=${location.state.packId}`)}
              style={{
                background: 'var(--color-accent)',
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
              aria-label="Back to Level Select"
            >
              <span style={{ fontSize: '18px' }}>←</span>
              Back to Level Select
            </button>
          </div>
        )}
        {location.state?.fromHelp && (
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => navigate('/help')}
              style={{
                background: 'var(--color-accent)',
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

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h3 style={{ fontSize: '16px', margin: 0, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Sound Library <span style={{ fontSize: '14px' }}>🎧📚</span>
          </h3>
          <button
            onClick={() => {
              if (showAllPacks) {
                setExpandedPacks(new Set());
                setShowAllPacks(false);
              } else {
                const allPackIds = PACKS.filter(p => p.isUnlocked).map(p => p.id);
                setExpandedPacks(new Set(allPackIds));
                setShowAllPacks(true);
              }
            }}
            style={{
              fontSize: '12px',
              padding: '6px 12px',
              background: showAllPacks ? 'var(--color-accent)' : 'var(--color-surface)',
              color: showAllPacks ? '#000' : 'var(--color-text)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            {showAllPacks ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <p style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          marginBottom: '20px',
          paddingLeft: '12px',
          borderLeft: '3px solid var(--color-accent)',
        }}>
          Preview signature sounds for each bird before you play. Click pack names to expand and see all birds, or click individual birds to explore their full library of recordings.
        </p>

        {/* All Birds pack - dynamically populated */}
        {packDisplaySpecies['all_birds'] && (() => {
          const packId = 'all_birds';
          const isExpanded = showAllPacks || expandedPacks.has(packId);
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
                  color: 'var(--color-accent)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  background: 'var(--color-surface)',
                  borderRadius: '8px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 1)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
              >
                <span style={{ fontSize: '14px' }}>
                  {isExpanded ? '▼' : '▶'}
                </span>
                <span style={{ fontWeight: 600 }}>
                  All Birds
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {packDisplaySpecies[packId]?.length || 0} species
                </span>
              </div>
              {isExpanded && (
              <>
                {/* Taxonomic Sort Toggle - Enhanced visibility */}
                <div style={{
                  marginBottom: '12px',
                  padding: '10px',
                  background: 'rgba(70, 70, 90, 0.3)',
                  borderRadius: '8px',
                  border: '1px solid rgba(255,255,255,0.1)',
                  position: 'relative',
                }}>
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                      Sort:
                    </span>
                    <button
                      onClick={() => {
                        const newValue = !taxonomicSort;
                        setTaxonomicSort(newValue);
                      }}
                      style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: 600,
                        background: taxonomicSort ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                        color: taxonomicSort ? '#000' : 'var(--color-text)',
                        border: taxonomicSort ? 'none' : '1.5px solid var(--color-accent)',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: taxonomicSort ? '0 2px 8px rgba(245, 166, 35, 0.3)' : 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!taxonomicSort) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                          e.currentTarget.style.transform = 'scale(1.05)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!taxonomicSort) {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                          e.currentTarget.style.transform = 'scale(1)';
                        }
                      }}
                    >
                      {taxonomicSort ? '📊 Taxonomic' : '🔤 Species Codes'}
                    </button>
                    <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {taxonomicSort ? 'Phylogenetic (eBird 2025)' : 'Alphabetical'}
                    </span>
                  </div>
                </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '8px',
                }}
              >
                {getBirdsForPack(packId).map((bird) => {
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
                      {/* Bird card content - same as other packs */}
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
                          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)' }}>
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
                              background: playingClip === bird.code ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                              color: playingClip === bird.code ? '#000' : 'var(--color-text)',
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
                                  background: playingClip === `${bird.code}_${idx}` ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                                  color: playingClip === `${bird.code}_${idx}` ? '#000' : 'var(--color-text)',
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
                                      background: 'var(--color-accent)',
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
                                    background: clip.vocalizationType === 'song' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(245, 166, 35, 0.2)',
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
                                      {/* Format: XC667361 • Nick Komar OR Cornell CD Track 26 OR Peter Repetti */}
                                      {clip.sourceUrl ? (
                                        <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
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
              </>
              )}
            </div>
          );
        })()}

        {PACKS.filter(p => p.isUnlocked).map((pack) => {
          const isExpanded = showAllPacks || expandedPacks.has(pack.id);
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
                color: 'var(--color-accent)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--color-surface)',
                borderRadius: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(45, 45, 68, 1)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface)'}
            >
              <span style={{ fontSize: '14px' }}>
                {isExpanded ? '▼' : '▶'}
              </span>
              <span style={{ fontWeight: 600 }}>
                {pack.name}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                {packDisplaySpecies[pack.id]?.length || 0} species
              </span>
            </div>

            {/* Ready to Play button - shown when navigating from preview and this pack is expanded */}
            {isExpanded && location.state?.fromPreview && location.state?.pack === pack.id && (
              <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    const { pack, level } = location.state as { pack: string; level: number };
                    navigate(`/preview?pack=${pack}&level=${level}`);
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

            {/* Taxonomic Sort Toggle for individual packs */}
            {isExpanded && (
              <div style={{
                marginBottom: '12px',
                padding: '10px',
                background: 'rgba(70, 70, 90, 0.3)',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.1)',
                position: 'relative',
              }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--color-text-muted)' }}>
                    Sort:
                  </span>
                  <button
                    onClick={() => {
                      const newValue = !taxonomicSort;
                      setTaxonomicSort(newValue);
                    }}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      background: taxonomicSort ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                      color: taxonomicSort ? '#000' : 'var(--color-text)',
                      border: taxonomicSort ? 'none' : '1.5px solid var(--color-accent)',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: taxonomicSort ? '0 2px 8px rgba(245, 166, 35, 0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!taxonomicSort) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.25)';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!taxonomicSort) {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    }}
                  >
                    {taxonomicSort ? '📊 Taxonomic' : '🔤 Species Codes'}
                  </button>
                  <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                    {taxonomicSort ? 'Phylogenetic (eBird 2025)' : 'Alphabetical'}
                  </span>
                </div>
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
                    {/* Main bird row */}
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
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--color-accent)' }}>
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
                            <span style={{ marginLeft: '4px', color: 'var(--color-accent)' }}>
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
                          background: playingClip === bird.code ? 'var(--color-accent)' : 'var(--color-primary)',
                          color: 'white',
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
                                  background: playingClip === clip.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.15)',
                                  color: 'white',
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
                                      background: 'var(--color-accent)',
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
                                      {/* Format: XC667361 • Nick Komar OR Cornell CD Track 26 OR Peter Repetti */}
                                      {clip.sourceUrl ? (
                                        <a href={clip.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)', textDecoration: 'underline' }}>
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
    </div>
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

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
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
    // Placeholder silhouette for birds without icons
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

export default PackSelect;
