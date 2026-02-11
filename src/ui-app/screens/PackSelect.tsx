import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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

const REGIONS = [
  {
    id: 'na',
    name: 'North America',
    route: '/na-packs',
    summary: '120 species · 8 packs',
    tagline: 'Warblers, sparrows, woodpeckers & more',
    bg: 'rgba(245, 166, 35, 0.18)',
    accentColor: '#f5c87a',
    titleColor: '#f5c87a',
    icon: 'NOCA',
    preview: ['BLJA', 'CARW', 'EATO', 'AMRO', 'RWBL'],
  },
  {
    id: 'eu',
    name: 'Europe',
    route: '/eu-packs',
    summary: '61 species · 4 packs',
    tagline: 'Skulkers, raptors & woodland birds',
    bg: 'rgba(160, 180, 80, 0.18)',
    accentColor: '#a0b450',
    titleColor: '#c8d8a2',
    icon: 'EURO',
    preview: ['eurwar1', 'combuz1', 'redkit1', 'firecr1', 'eugori2'],
  },
  {
    id: 'nz',
    name: 'New Zealand',
    route: '/nz-packs',
    summary: '37 species · 4 packs',
    tagline: 'Unique island birds & native species',
    bg: 'rgba(100, 200, 180, 0.18)',
    accentColor: '#4db6ac',
    titleColor: '#a8d8cc',
    icon: 'yeepen1',
    preview: ['tui1', 'nezbel1', 'nezfan1', 'morepo2', 'weka1'],
  },
];

function PackSelect() {
  const navigate = useNavigate();
  const [showExamples, setShowExamples] = useState(false);

  // Sound Library state
  const [clips, setClips] = useState<ClipData[]>([]);
  const [allBirdsSpecies, setAllBirdsSpecies] = useState<string[]>([]);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const [expandedBird, setExpandedBird] = useState<string | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [taxonomicSort, setTaxonomicSort] = useState(false);
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load clips data and build "All Birds" from all species
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/clips.json`)
      .then((res) => res.json())
      .then((data: ClipData[]) => {
        setClips(data);
        const allSpeciesCodes = Array.from(
          new Set(
            data
              .filter((c) => !c.rejected && (!c.spectrogram_path || !c.spectrogram_path.includes('spectrograms-rejected')))
              .map((c) => c.species_code)
          )
        ).sort();
        setAllBirdsSpecies(allSpeciesCodes);
      })
      .catch((err) => console.error('Failed to load clips:', err));
  }, []);

  // Load taxonomic order
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`)
      .then((res) => res.json())
      .then((data: Record<string, number>) => setTaxonomicOrder(data))
      .catch((err) => console.error('Failed to load taxonomic order:', err));
  }, []);

  // Load species metadata
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

  const getBirdsForAllBirds = (): BirdInfo[] => {
    const birds = allBirdsSpecies.map((code) => {
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

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div className="flex-row items-center gap-md" style={{ marginBottom: '20px' }}>
        <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{
          color: 'var(--color-text-muted)',
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '10px',
          padding: '6px',
        }}>
          <HomeIcon />
        </button>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'var(--color-text)', opacity: 0.9, flex: 1, textAlign: 'center' }}>Bird Packs</h2>
        {/* Invisible spacer to balance the home button */}
        <div style={{ width: '37px' }} />
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
        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', marginBottom: '8px' }}>Getting Started</div>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li style={{ fontWeight: 600 }}>Best on a phone/tablet, with 🎧</li>
          <li>No sound? Check if 📱 is on silent 🔇→🔊</li>
          <li>6 levels—start @ #1, young Grasshopper <img src={`${import.meta.env.BASE_URL}data/icons/SAVS.png`} alt="" style={{ width: '18px', height: '18px', verticalAlign: 'middle', marginLeft: '2px', borderRadius: '3px' }} /></li>
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
          <li style={{ fontWeight: 600 }}>Pick a region below and start birding! 👇</li>
        </ul>
      </div>

      {/* Region cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {REGIONS.map((region) => (
          <button
            key={region.id}
            onClick={() => navigate(region.route)}
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              padding: '12px 16px',
              background: region.bg,
              borderRadius: '14px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.2s',
              textAlign: 'left',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = `0 4px 16px rgba(0,0,0,0.2)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img
                src={`${import.meta.env.BASE_URL}data/icons/${region.icon}.png`}
                alt=""
                style={{
                  width: '76px',
                  height: '76px',
                  borderRadius: '50%',
                  objectFit: 'cover',
                  flexShrink: 0,
                  boxShadow: `0 2px 8px rgba(0,0,0,0.3)`,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '18px', color: region.titleColor, fontWeight: 600 }}>
                  {region.name}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                  {region.summary}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', opacity: 0.8, marginTop: '2px' }}>
                  {region.tagline}
                </div>
                <div style={{ display: 'flex', marginTop: '6px' }}>
                  {region.preview.map((code, i) => (
                    <img
                      key={code}
                      src={`${import.meta.env.BASE_URL}data/icons/${code}.png`}
                      alt=""
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '2px solid rgba(0,0,0,0.4)',
                        marginLeft: i === 0 ? 0 : '-4px',
                      }}
                    />
                  ))}
                </div>
              </div>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={region.accentColor} strokeWidth="3" style={{ opacity: 1, flexShrink: 0 }}>
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        ))}
      </div>

      {/* Custom Pack */}
      <div
        style={{
          width: '100%',
          marginTop: '16px',
          background: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '14px',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          overflow: 'visible',
        }}
      >
        <div
          onClick={() => navigate('/custom-pack')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            padding: '16px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
            textAlign: 'left',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <div style={{
            width: '52px',
            height: '52px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            flexShrink: 0,
          }}>
            🥚
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text)', opacity: 0.8 }}>
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
              {showExamples ? 'Hide ideas' : 'Mix birds from any region — see ideas'}
            </button>
          </div>
        </div>

        {showExamples && (
          <div
            onClick={() => navigate('/custom-pack')}
            style={{
              padding: '0 20px 16px 20px',
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
                <span style={{ opacity: 0.6 }}>→</span> <strong>Thrush showdown:</strong> American Robin vs Song Thrush vs Eurasian Blackbird — how well do you know your <em>Turdus</em>?
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ opacity: 0.6 }}>→</span> <strong>Global woodpeckers:</strong> Downy, Hairy, Great Spotted, Lesser Spotted, Green — tap & drum across continents.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ opacity: 0.6 }}>→</span> <strong>Warblers worldwide:</strong> NA wood-warblers vs EU leaf warblers — completely different families, equally confusing.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ opacity: 0.6 }}>→</span> <strong>Raptors everywhere:</strong> Red-tailed Hawk vs Peregrine Falcon vs Red Kite vs Eurasian Sparrowhawk — raptor calls across continents.
              </div>
              <div style={{ marginBottom: '8px' }}>
                <span style={{ opacity: 0.6 }}>→</span> <strong>Island vs mainland:</strong> NZ endemics mixed with their closest European or American cousins.
              </div>
              <div style={{ marginBottom: '12px' }}>
                <span style={{ opacity: 0.6 }}>→</span> <strong>Your rules:</strong> Any combination, any region — build whatever challenge you want.
              </div>
              <div style={{
                marginTop: '12px',
                padding: '10px 16px',
                background: 'rgba(255, 255, 255, 0.12)',
                borderRadius: '8px',
                color: '#f5f0e6',
                fontWeight: 600,
                textAlign: 'center',
              }}>
                Build Your Pack →
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sound Library Section */}
      {allBirdsSpecies.length > 0 && (
        <div id="bird-reference" style={{ marginTop: '32px', scrollMarginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '16px', margin: 0, color: 'var(--color-text-muted)' }}>
                🎧📚 Sound Library
              </h3>
            </div>
            <button
              onClick={() => {
                setTaxonomicSort(!taxonomicSort);
                if (expandedPacks.size === 0) {
                  setExpandedPacks(new Set(['all_birds']));
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
          </div>


          <p style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            lineHeight: 1.6,
            marginBottom: '20px',
            paddingLeft: '12px',
            borderLeft: '3px solid rgba(245, 200, 122, 0.5)',
          }}>
            Preview signature sounds for every bird across all regions. Click to expand and explore each species' full library of recordings.
          </p>

          {/* All Birds expandable */}
          {(() => {
            const packId = 'all_birds';
            const isExpanded = expandedPacks.has(packId);
            return (
              <div style={{ marginBottom: '16px' }}>
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
                    All Birds
                  </span>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                    {allBirdsSpecies.length} species
                  </span>
                </div>
                {isExpanded && (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                      gap: '8px',
                    }}
                  >
                    {getBirdsForAllBirds().map((bird) => {
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
                              <div style={{ fontSize: '12px', color: 'var(--color-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                                    {isBirdExpanded ? '▲' : '▼'}
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
          })()}
        </div>
      )}
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

export default PackSelect;
