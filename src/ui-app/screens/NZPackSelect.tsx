import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { trackPackSelect, trackNZSortModeChange } from '../utils/analytics';
import { loadMergeConfig, getRegionLabel, getMergeConfigSync } from '../utils/nzSubspeciesMerge';
import { useNZSortMode } from '../hooks/useNZSortMode';

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
  canonical?: boolean;
  rejected?: boolean;
  vocalization_type?: string;
  source?: string;
  source_id?: string;
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
  regionLabel?: string;  // NI/SI/Ch for merged subspecies clips
}

interface BirdInfo {
  code: string;
  displayCode: string;  // Short code for UI display
  tileName: string;     // Name to show (Māori name or short English)
  englishName: string;  // English common name for 3-way sort
  name: string;
  scientificName?: string;
  canonicalClipPath: string | null;
  clipCount: number;
  allClips: BirdClip[];
}

// NZ accent color for consistent theming
const NZ_ACCENT_COLOR = '#4db6ac';

const NZ_PACKS: Pack[] = [
  {
    id: 'nz_common',
    name: 'Garden & Bush',
    speciesCount: 9,
    isUnlocked: true,
    description: 'The 9 most common birds you\'ll hear\nacross New Zealand.',
  },
  {
    id: 'nz_north_island',
    name: 'North Island',
    speciesCount: 21,
    isUnlocked: true,
    description: 'Birds of\nTe Ika-a-Maui',
  },
  {
    id: 'nz_south_island',
    name: 'South Island',
    speciesCount: 22,
    isUnlocked: true,
    description: 'Birds of\nTe Waipounamu',
  },
  {
    id: 'nz_all_birds',
    name: 'All NZ Birds',
    speciesCount: 37,
    isUnlocked: true,
    description: 'The complete collection of 37\nNew Zealand native birds.',
  },
];

function NZPackSelect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [clips, setClips] = useState<ClipData[]>([]);
  const [packDisplaySpecies, setPackDisplaySpecies] = useState<Record<string, string[]>>({});
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [nzDisplayCodes, setNzDisplayCodes] = useState<Record<string, { code: string; tileName: string; englishName?: string }>>({});
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [expandedBird, setExpandedBird] = useState<string | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [showExamples, setShowExamples] = useState(false);

  // NZ 3-way sort mode
  const [nzSortMode, setNzSortMode] = useNZSortMode();
  const [showPackGallery, setShowPackGallery] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const soundLibraryRef = useRef<HTMLDivElement | null>(null);

  // Scroll to top on mount
  useEffect(() => {
    // The App wrapper has overflow: auto, so we need to scroll the parent container
    const appContainer = document.querySelector('.screen')?.parentElement;
    if (appContainer) {
      appContainer.scrollTo(0, 0);
    }
    window.scrollTo(0, 0);
  }, []);

  // Handle URL params for auto-expanding packs and scrolling to sound library
  useEffect(() => {
    const expandPack = searchParams.get('expand') || searchParams.get('expandPack');
    if (expandPack) {
      setExpandedPacks(new Set([expandPack]));
      // Scroll to sound library section after a brief delay
      setTimeout(() => {
        soundLibraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  // Load clips data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/clips.json`)
      .then((res) => res.json())
      .then((data: ClipData[]) => {
        // Filter to only NZ clips (source === 'doc')
        const nzClips = data.filter(c => c.source === 'doc');
        setClips(nzClips);
      })
      .catch((err) => console.error('Failed to load clips:', err));
  }, []);

  // Load species names, scientific names, NZ display codes, and taxonomic order
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/nz_display_codes.json`).then(res => res.json()).catch(() => ({ codes: {} })),
      fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`).then(res => res.json()).catch(() => ({})),
    ]).then(([speciesData, nzCodesData, taxOrder]: [Array<{species_code: string; common_name: string; scientific_name?: string}>, { codes: Record<string, { code: string; tileName: string }> }, Record<string, number>]) => {
      const names: Record<string, string> = {};
      const sciNames: Record<string, string> = {};
      speciesData.forEach((sp) => {
        names[sp.species_code] = sp.common_name;
        if (sp.scientific_name) {
          sciNames[sp.species_code] = sp.scientific_name;
        }
      });
      setCommonNames(names);
      setScientificNames(sciNames);
      setNzDisplayCodes(nzCodesData.codes || {});
      setTaxonomicOrder(taxOrder);
    }).catch((err) => console.error('Failed to load species:', err));
  }, []);

  // Load pack species and subspecies merge config
  useEffect(() => {
    const packIds = ['nz_all_birds', 'nz_common', 'nz_north_island', 'nz_south_island'];

    Promise.all([
      ...packIds.map((id) =>
        fetch(`${import.meta.env.BASE_URL}data/packs/${id}.json`)
          .then((res) => res.json())
          .catch(() => null)
      ),
      loadMergeConfig(), // Load subspecies merge config
    ]).then((results) => {
      const speciesMap: Record<string, string[]> = {};
      results.slice(0, packIds.length).forEach((pack, i) => {
        if (pack && pack.species) {
          // Use display_species for Sound Library if available (deduplicated list)
          speciesMap[packIds[i]] = pack.display_species || pack.species;
        }
      });
      setPackDisplaySpecies(speciesMap);
    });
  }, []);

  const handlePackSelect = (pack: Pack) => {
    trackPackSelect(pack.id, pack.name);
    const savedLevel = localStorage.getItem(`soundfield_pack_level_${pack.id}`);
    const levelId = savedLevel ? parseInt(savedLevel, 10) : 1;
    navigate(`/preview?pack=${pack.id}&level=${levelId}`);
  };

  const getBirdsForPack = (packId: string): BirdInfo[] => {
    const speciesCodes = packDisplaySpecies[packId] || [];
    const birds = speciesCodes.map((code) => {
      // For merged subspecies, we need to get clips from all subspecies
      const mergeConfig = getMergeConfigSync();
      let relatedCodes = [code];

      // Check if this code is part of a merged species
      if (mergeConfig) {
        for (const info of Object.values(mergeConfig.merges)) {
          if (info.subspecies.includes(code) || info.icon === code) {
            relatedCodes = info.subspecies;
            break;
          }
        }
      }

      const speciesClips = clips.filter((c) =>
        relatedCodes.includes(c.species_code) && !c.rejected
      );
      const canonicalClip = speciesClips.find((c) => c.canonical);
      const clip = canonicalClip || speciesClips[0];

      // Build all clips list, canonical first, with region labels
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
          path: `${import.meta.env.BASE_URL}${c.file_path}`,
          isCanonical: !!c.canonical,
          vocalizationType: c.vocalization_type,
          source: c.source,
          sourceId: c.source_id,
          sourceUrl: c.source_url,
          recordist: c.recordist,
          regionLabel: getRegionLabel(c.species_code), // Add region label for merged subspecies
        }));

      const nzData = nzDisplayCodes[code];
      return {
        code,
        displayCode: nzData?.code || code,
        tileName: nzData?.tileName || code,
        englishName: nzData?.englishName || commonNames[code] || code,
        name: commonNames[code] || code,
        scientificName: scientificNames[code],
        canonicalClipPath: clip ? `${import.meta.env.BASE_URL}${clip.file_path}` : null,
        clipCount: speciesClips.length,
        allClips,
      };
    });

    // Sort based on 3-way sort mode
    switch (nzSortMode) {
      case 'english':
        return birds.sort((a, b) => a.englishName.localeCompare(b.englishName));
      case 'taxonomic':
        if (Object.keys(taxonomicOrder).length > 0) {
          return birds.sort((a, b) => {
            const orderA = taxonomicOrder[a.code] || 9999;
            const orderB = taxonomicOrder[b.code] || 9999;
            return orderA - orderB;
          });
        }
        return birds.sort((a, b) => a.tileName.localeCompare(b.tileName));
      case 'maori':
      default:
        return birds.sort((a, b) => a.tileName.localeCompare(b.tileName));
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

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const nzPackColors: Record<string, string> = {
    nz_all_birds: 'linear-gradient(135deg, #4a7a6a 0%, #2a5a4a 100%)',
    nz_common: 'linear-gradient(135deg, #b8a832 0%, #8a7a28 100%)',
    nz_north_island: 'linear-gradient(135deg, #7a5a3d 0%, #5a4028 100%)',
    nz_south_island: 'linear-gradient(135deg, #5a6a8a 0%, #3a4a6a 100%)',
  };

  const nzPackIcons: Record<string, string> = {
    nz_all_birds: 'kakapo2',
    nz_common: 'tui1',
    nz_north_island: 'kokako3',
    nz_south_island: 'kea1',
  };

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="flex-row items-center gap-md" style={{ marginBottom: '16px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/pack-select')}
          aria-label="Back"
          style={{
            color: NZ_ACCENT_COLOR,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '6px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 style={{ margin: 0, flex: 1, fontSize: '22px' }}>New Zealand Birds</h2>
        <button
          className="btn-icon"
          onClick={() => navigate('/')}
          aria-label="Home"
          style={{
            color: NZ_ACCENT_COLOR,
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '10px',
            padding: '6px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      </div>

      {/* Create Custom Pack Section */}
      <div
        style={{
          marginBottom: '20px',
          background: 'rgba(77, 182, 172, 0.12)',
          border: 'none',
          borderRadius: '16px',
          overflow: 'visible',
        }}
      >
        <div
          onClick={() => navigate('/custom-pack?region=nz')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(45, 122, 122, 0.15)';
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
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#a8d8cc' }}>
              Hatch a Custom Pack
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowExamples(!showExamples);
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
              {showExamples ? 'Hide examples' : 'See examples'}
            </button>
          </div>
        </div>

        {showExamples && (
          <div
            onClick={() => navigate('/custom-pack?region=nz')}
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
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Dawn chorus prep — pick the birds from your local bush walk and learn them all.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Confuse T&#363;&#299; and Korimako? Put them head-to-head until you nail it.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Night birds only — R&#363;r&#363;, Kiwi, and Weka after dark.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Heading to a sanctuary? Build a pack from the species you'll hear there.
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ color: 'var(--color-text-muted)', opacity: 0.6 }}>→</span> Native vs introduced — mix them up and learn to tell them apart.
              </div>
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(77, 182, 172, 0.4)',
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

      {/* Pack Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {NZ_PACKS.map((pack) => (
          <button
            key={pack.id}
            onClick={() => handlePackSelect(pack)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'left',
              padding: '16px',
              borderRadius: '16px',
              border: 'none',
              background: nzPackColors[pack.id],
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
              cursor: 'pointer',
              transition: 'transform 0.2s, box-shadow 0.2s',
              gridColumn: (pack.id === 'nz_common' || pack.id === 'nz_all_birds') ? '1 / -1' : 'auto',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 0, 0, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}data/icons/${nzPackIcons[pack.id]}.png`}
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
                }}
              >
                Play →
              </span>
            </div>

            <div style={{ position: 'relative', zIndex: 1, paddingTop: (pack.id === 'nz_common' || pack.id === 'nz_all_birds') ? 0 : '8px', maxWidth: '55%' }}>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#f5f0e6', marginBottom: '6px' }}>
                {pack.name}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(245, 240, 230, 0.9)', marginBottom: '10px' }}>
                {pack.description}
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(245, 240, 230, 0.9)', fontWeight: 600 }}>
                {pack.speciesCount} species
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Sound Library */}
      <div ref={soundLibraryRef}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div>
            <h3 style={{ fontSize: '16px', margin: 0, color: 'var(--color-text-muted)' }}>
              🎧📚 Sound Library
            </h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Cycling sort button */}
            <button
              onClick={() => {
                const next = nzSortMode === 'maori' ? 'english' : nzSortMode === 'english' ? 'taxonomic' : 'maori';
                setNzSortMode(next);
                trackNZSortModeChange(next, 'sound_library');
                if (expandedPacks.size === 0) {
                  setExpandedPacks(new Set([NZ_PACKS[0].id]));
                }
              }}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                background: 'rgba(255, 255, 255, 0.05)',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#4db6ac',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '14px' }}>{nzSortMode === 'taxonomic' ? '📊' : '🔤'}</span>
              {nzSortMode === 'maori' ? 'Te Reo' : nzSortMode === 'english' ? 'English' : 'Taxonomy'}
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


        {/* Subspecies merge note */}
        <p style={{
          margin: '0 0 16px 0',
          fontSize: '12px',
          color: 'var(--color-text-muted)',
          fontStyle: 'italic',
        }}>
          Regional subspecies are merged for gameplay. Clips show region badges:{' '}
          <span style={{ background: '#4db6ac', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>NI</span>{' '}
          <span style={{ background: '#4db6ac', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>SI</span>{' '}
          <span style={{ background: '#4db6ac', color: '#fff', padding: '1px 4px', borderRadius: '3px', fontSize: '10px' }}>Ch</span>
        </p>

        {NZ_PACKS.map((pack) => {
          const isExpanded = expandedPacks.has(pack.id);
          const birds = getBirdsForPack(pack.id);

          return (
            <div key={pack.id} style={{ marginBottom: '12px' }}>
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
                  color: 'var(--color-text)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: 'rgba(45, 45, 68, 0.7)',
                  borderRadius: '8px',
                  transition: 'background 0.15s',
                }}
              >
                <span style={{ color: '#2d7a7a', opacity: 0.7 }}>{isExpanded ? '▼' : '▶'}</span>
                <span style={{ fontWeight: 600, color: '#4db6ac', opacity: 0.85 }}>{pack.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                  {birds.length} species
                </span>
              </div>

              {isExpanded && (
                <div style={{ marginTop: '8px' }}>
                  {/* Ready to Play button - shown when navigating from preview */}
                  {location.state?.fromPreview && location.state?.pack === pack.id && (
                    <div style={{ marginBottom: '12px', display: 'flex', justifyContent: 'flex-end', paddingRight: '8px' }}>
                      <button
                        onClick={() => {
                          const { pack: packId, level } = location.state as { pack: string; level: number };
                          navigate(`/preview?pack=${packId}&level=${level}&keepBirds=true`);
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        Ready to Play?
                      </button>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '8px',
                      padding: '8px',
                      background: 'rgba(0,0,0,0.2)',
                      borderRadius: '8px',
                    }}
                  >
                  {birds.map((bird) => {
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
                              setExpandedBird(isBirdExpanded ? null : bird.code);
                            }
                          }}
                        >
                          <img
                            src={`${import.meta.env.BASE_URL}data/icons/${bird.code}.png`}
                            alt={bird.name}
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                              flexShrink: 0,
                            }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#4db6ac' }}>
                              {nzSortMode === 'english' ? bird.englishName : bird.tileName}
                            </div>
                            <div style={{
                              fontSize: '11px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              color: 'var(--color-text-muted)',
                              fontStyle: nzSortMode === 'taxonomic' ? 'italic' : 'normal',
                            }}>
                              {nzSortMode === 'taxonomic'
                                ? bird.scientificName
                                : nzSortMode === 'english'
                                  ? (bird.tileName !== bird.englishName ? bird.tileName : '')
                                  : (bird.englishName !== bird.tileName ? bird.englishName : '')}
                            </div>
                            <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                              {bird.clipCount} clip{bird.clipCount !== 1 ? 's' : ''}
                              {bird.clipCount > 1 && (
                                <span style={{ marginLeft: '4px', color: '#2d7a7a', opacity: 0.7 }}>
                                  {isBirdExpanded ? '▲' : '▼'}
                                </span>
                              )}
                            </div>
                          </div>
                          {bird.canonicalClipPath && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                playSound(bird.canonicalClipPath!, bird.code);
                              }}
                              style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                border: 'none',
                                background: playingClip === bird.code ? '#4db6ac' : 'rgba(77, 182, 172, 0.3)',
                                color: playingClip === bird.code ? '#000' : '#4db6ac',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                flexShrink: 0,
                              }}
                            >
                              {playingClip === bird.code ? '⏸' : '▶'}
                            </button>
                          )}
                        </div>

                        {/* Expanded clips list */}
                        {isBirdExpanded && bird.allClips.length > 0 && (
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
                                      background: playingClip === clip.id ? '#4db6ac' : 'rgba(77, 182, 172, 0.3)',
                                      color: playingClip === clip.id ? '#000' : '#4db6ac',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      fontSize: '10px',
                                    }}
                                    aria-label={`Play clip ${index + 1}`}
                                  >
                                    {playingClip === clip.id ? '⏸' : '▶'}
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
                                          background: '#4db6ac',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 600,
                                        }}>
                                          SIGNATURE
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
                                      {clip.regionLabel && (
                                        <span style={{
                                          fontSize: '9px',
                                          color: '#fff',
                                          background: '#4db6ac',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                          fontWeight: 600,
                                        }}>
                                          {clip.regionLabel}
                                        </span>
                                      )}
                                      {clip.source === 'doc' && (
                                        <span style={{
                                          fontSize: '9px',
                                          color: 'var(--color-text-muted)',
                                          background: 'rgba(255,255,255,0.1)',
                                          padding: '2px 6px',
                                          borderRadius: '4px',
                                        }}>
                                          DOC NZ
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
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Attribution footnote */}
      <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.6, marginTop: '16px', textAlign: 'center', lineHeight: 1.5 }}>
        Audio courtesy of the{' '}
        <a href="https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/" target="_blank" rel="noopener noreferrer" style={{ color: NZ_ACCENT_COLOR, textDecoration: 'underline' }}>NZ Department of Conservation</a>{' '}
        (Crown Copyright)
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
              <h2 style={{ margin: 0, fontSize: '18px', color: '#fff' }}>All NZ Birds</h2>
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
              {getBirdsForPack('nz_all_birds').map((bird) => (
                <div key={bird.code} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={`${import.meta.env.BASE_URL}data/icons/${bird.code}.png`}
                      alt={bird.name}
                      style={{ width: 120, height: 120, borderRadius: '50%', objectFit: 'cover', background: 'rgba(255,255,255,0.1)' }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
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

export default NZPackSelect;
