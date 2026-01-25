import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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
}

interface BirdInfo {
  code: string;
  displayCode: string;  // Short code for UI display
  tileName: string;     // Name to show (Māori name or short English)
  name: string;
  canonicalClipPath: string | null;
  clipCount: number;
  allClips: BirdClip[];
}

const NZ_PACKS: Pack[] = [
  {
    id: 'nz_all_birds',
    name: 'All NZ Birds in ChipNotes',
    speciesCount: 42,
    isUnlocked: true,
    description: 'Some of New Zealand\'s most\niconic native birds.',
  },
  {
    id: 'nz_common',
    name: 'Garden & Bush',
    speciesCount: 21,
    isUnlocked: true,
    description: 'Gardens, parks, and forests. Tūī, Kea, Fantail, and\nmore.',
  },
  {
    id: 'nz_rare',
    name: 'Rare & Endemic',
    speciesCount: 21,
    isUnlocked: true,
    description: 'Conservation stars: Kiwi, Kākāpō, Takahē, and Chatham\nIslands\nsubspecies.',
  },
];

function NZPackSelect() {
  const navigate = useNavigate();
  const [clips, setClips] = useState<ClipData[]>([]);
  const [packDisplaySpecies, setPackDisplaySpecies] = useState<Record<string, string[]>>({});
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const [nzDisplayCodes, setNzDisplayCodes] = useState<Record<string, { code: string; tileName: string }>>({});
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());
  const [expandedBird, setExpandedBird] = useState<string | null>(null);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

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

  // Load species names and NZ display codes
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(res => res.json()),
      fetch(`${import.meta.env.BASE_URL}data/nz_display_codes.json`).then(res => res.json()).catch(() => ({ codes: {} })),
    ]).then(([speciesData, nzCodesData]: [Array<{species_code: string; common_name: string}>, { codes: Record<string, { code: string; tileName: string }> }]) => {
      const names: Record<string, string> = {};
      speciesData.forEach((sp) => {
        names[sp.species_code] = sp.common_name;
      });
      setCommonNames(names);
      setNzDisplayCodes(nzCodesData.codes || {});
    }).catch((err) => console.error('Failed to load species:', err));
  }, []);

  // Load pack species
  useEffect(() => {
    const packIds = ['nz_all_birds', 'nz_common', 'nz_rare'];

    Promise.all(
      packIds.map((id) =>
        fetch(`${import.meta.env.BASE_URL}data/packs/${id}.json`)
          .then((res) => res.json())
          .catch(() => null)
      )
    ).then((packs) => {
      const speciesMap: Record<string, string[]> = {};
      packs.forEach((pack, i) => {
        if (pack && pack.species) {
          speciesMap[packIds[i]] = pack.species;
        }
      });
      setPackDisplaySpecies(speciesMap);
    });
  }, []);

  const handlePackSelect = (pack: Pack) => {
    trackPackSelect(pack.id, pack.name);
    navigate(`/level-select?pack=${pack.id}`);
  };

  const getBirdsForPack = (packId: string): BirdInfo[] => {
    const speciesCodes = packDisplaySpecies[packId] || [];
    return speciesCodes.map((code) => {
      const speciesClips = clips.filter((c) =>
        c.species_code === code && !c.rejected
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
        displayCode: nzDisplayCodes[code]?.code || code,
        tileName: nzDisplayCodes[code]?.tileName || code,
        name: commonNames[code] || code,
        canonicalClipPath: clip ? `${import.meta.env.BASE_URL}${clip.file_path}` : null,
        clipCount: speciesClips.length,
        allClips,
      };
    });
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
    nz_all_birds: 'linear-gradient(135deg, #5a8ab0 0%, #3a6a8a 100%)',
    nz_common: 'linear-gradient(135deg, #b8a832 0%, #8a7a28 100%)',
    nz_rare: 'linear-gradient(135deg, #2d7a7a 0%, #1a5a5a 100%)',
  };

  const nzPackIcons: Record<string, string> = {
    nz_all_birds: 'kakapo2',
    nz_common: 'tui1',
    nz_rare: 'nibkiw1',
  };

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="flex-row items-center gap-md" style={{ marginBottom: '16px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate('/pack-select')}
          aria-label="Back"
          style={{ color: '#2d7a7a', opacity: 0.7 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '28px' }}>🇳🇿</span>
          <h2 style={{ margin: 0 }}>New Zealand Birds</h2>
        </div>
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
        <p style={{ margin: '0 0 10px 0' }}>
          42 endemic species from Aotearoa New Zealand. Audio recordings courtesy of the{' '}
          <a
            href="https://www.doc.govt.nz/nature/native-animals/birds/bird-songs-and-calls/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#a8d5a2', textDecoration: 'underline' }}
          >NZ Department of Conservation</a> (Crown Copyright).
        </p>
        <p style={{ margin: 0, fontSize: '13px', fontStyle: 'italic' }}>
          Birds display their Māori names. Subspecies are distinguished with abbreviations: (NI) North Island, (SI) South Island, (Ch.) Chatham Islands.
        </p>
      </div>

      {/* Create Custom Pack Section */}
      <div
        style={{
          marginBottom: '20px',
          background: 'var(--color-surface)',
          border: '2px solid rgba(45, 122, 122, 0.4)',
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
            borderRadius: '10px',
            background: 'rgba(45, 122, 122, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '16px', fontWeight: 600, color: '#f5f0e6' }}>
              Build Custom NZ Pack
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
              Mix and match your own selection of NZ birds
            </div>
          </div>
          <span style={{ fontSize: '20px', color: '#a8d5a2' }}>→</span>
        </div>
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
              gridColumn: pack.id === 'nz_all_birds' ? '1 / -1' : 'auto',
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
                opacity: 0.5,
                filter: 'brightness(1.3)',
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

            <div style={{ position: 'relative', zIndex: 1, paddingTop: pack.id === 'nz_all_birds' ? 0 : '8px' }}>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#f5f0e6', marginBottom: '6px' }}>
                {pack.name}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(245, 240, 230, 0.6)', marginBottom: '10px', whiteSpace: 'pre-line' }}>
                {pack.description}
              </div>
              <span style={{ fontSize: '12px', color: 'rgba(245, 240, 230, 0.7)', fontWeight: 500 }}>
                {pack.speciesCount} species
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Sound Library */}
      <div>
        <h3 style={{ fontSize: '16px', margin: '0 0 16px 0', color: 'var(--color-text-muted)' }}>
          Sound Library 🎧📚
        </h3>

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
                  background: 'var(--color-surface)',
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
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '8px',
                    marginTop: '8px',
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
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#4db6ac' }}>
                              {bird.tileName}
                            </div>
                            <div style={{
                              fontSize: '12px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}>
                              {bird.name}
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
                                background: playingClip === bird.code ? '#4db6ac' : 'rgba(255,255,255,0.1)',
                                color: playingClip === bird.code ? '#000' : 'var(--color-text)',
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
                                      background: playingClip === clip.id ? '#4db6ac' : 'rgba(255,255,255,0.15)',
                                      color: 'white',
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
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default NZPackSelect;
