import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';

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
}

interface BirdInfo {
  code: string;
  name: string;
  canonicalClipPath: string | null;
  clipCount: number;
}

const PACKS: Pack[] = [
  {
    id: 'starter_birds',
    name: '5 Common Backyard Birds',
    speciesCount: 5,
    isUnlocked: true,
    description: 'Start here! Five distinctive birds with bold, recognizable voices.',
  },
  {
    id: 'expanded_backyard',
    name: 'Expanded Local Birds',
    speciesCount: 38,
    isUnlocked: true,
    description: 'Ready for more? 9 random birds per round from 38 eastern US species.',
  },
  {
    id: 'sparrows',
    name: 'Sparrows',
    speciesCount: 7,
    isUnlocked: true,
    description: 'Master the subtle songs of seven sparrow species.',
  },
  {
    id: 'woodpeckers',
    name: 'Woodpeckers',
    speciesCount: 7,
    isUnlocked: true,
    description: 'Learn the drums, calls, and rattles of seven woodpecker species.',
  },
  {
    id: 'spring_warblers',
    name: 'Warbler Academy',
    speciesCount: 33,
    isUnlocked: true,
    description: '33 wood-warblers — 9 random per round. Use Custom Pack for focused warbler brain training!',
  },
];

// Species in each pack
const PACK_SPECIES: Record<string, string[]> = {
  starter_birds: ['NOCA', 'CAWR', 'TUTI', 'BLJA', 'AMCR'],
  expanded_backyard: [
    'NOCA', 'CAWR', 'BLJA', 'AMCR', 'TUTI',
    'BEKI', 'RSHA', 'AMGO', 'CACH', 'PIWA',
    'WTSP', 'HOFI', 'EABL', 'AMRO', 'HETH',
    'BHNU', 'BRCR', 'WBNU', 'YBSA', 'RBWO',
    'DOWO', 'HAWO', 'NOFL', 'PIWO', 'BRTH',
    'GRCA', 'MODO', 'NOMO', 'GCKI', 'RCKI',
    'COHA', 'SSHA', 'RTHA', 'RTHU', 'BADO',
    'COGR', 'FICR', 'CEWA',
  ],
  sparrows: [
    'WTSP', 'SOSP', 'CHSP', 'SWSP', 'SASP', 'FISP', 'LISP',
  ],
  woodpeckers: [
    'DOWO', 'HAWO', 'RBWO', 'PIWO', 'YBSA', 'NOFL', 'RHWO',
  ],
  spring_warblers: [
    'AMRE', 'BAWW', 'BBWA', 'BLBW', 'BLPW', 'BTBW', 'BTNW', 'BWWA',
    'CAWA', 'CMWA', 'CONW', 'COYE', 'CSWA', 'GWWA', 'KEWA', 'LOWA',
    'MAWA', 'MOWA', 'NAWA', 'NOPA', 'NOWA', 'OCWA', 'OVEN', 'PAWA',
    'PIWA', 'PRAW', 'PROW', 'SWWA', 'TEWA', 'WEWA', 'WIWA', 'YRWA', 'YTWA',
  ],
};

function PackSelect() {
  const navigate = useNavigate();

  const [clips, setClips] = useState<ClipData[]>([]);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load clips data
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/clips.json`)
      .then((res) => res.json())
      .then((data: ClipData[]) => setClips(data))
      .catch((err) => console.error('Failed to load clips:', err));
  }, []);

  // Get bird info for a pack
  const getBirdsForPack = (packId: string): BirdInfo[] => {
    const speciesCodes = PACK_SPECIES[packId] || [];
    return speciesCodes.map((code) => {
      const speciesClips = clips.filter((c) => c.species_code === code && !c.rejected);
      const canonicalClip = speciesClips.find((c) => c.canonical);
      const clip = canonicalClip || speciesClips[0];
      return {
        code,
        name: clip?.common_name || code,
        canonicalClipPath: clip ? `${import.meta.env.BASE_URL}data/clips/${clip.file_path.split('/').pop()}` : null,
        clipCount: speciesClips.length,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  };

  const handlePackSelect = (pack: Pack) => {
    if (pack.isUnlocked) {
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

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      <div className="flex-row items-center gap-md" style={{ marginBottom: '16px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>Select a Bird Pack</h2>
      </div>

      <div style={{
        fontSize: '14px',
        color: 'var(--color-text-muted)',
        marginBottom: '20px',
        lineHeight: 1.6,
      }}>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li>Each pack has 6 levels - from signature sounds to full repertoires</li>
          <li>New to 4-letter codes? See the Bird Reference section below</li>
          <li>Pro tip: Once expert, try playing muted using only spectrograms!</li>
        </ul>
        <div style={{ marginTop: '8px' }}>
          <Link to="/help" style={{ color: 'var(--color-accent)' }}>How to Play</Link> for full instructions
        </div>
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
          };
          const isWarblers = pack.id === 'spring_warblers';

          return (
          <button
            key={pack.id}
            onClick={() => handlePackSelect(pack)}
            style={{
              position: 'relative',
              overflow: 'hidden',
              textAlign: 'left',
              padding: '20px 16px',
              borderRadius: '16px',
              border: 'none',
              background: packColors[pack.id] || packColors.starter_birds,
              boxShadow: pack.isUnlocked
                ? '0 4px 12px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
                : 'none',
              opacity: pack.isUnlocked ? 1 : 0.5,
              cursor: pack.isUnlocked ? 'pointer' : 'not-allowed',
              transition: 'transform 0.2s, box-shadow 0.2s',
              ...(isWarblers && { gridColumn: '1 / -1' }),
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
            {/* Decorative bird silhouette */}
            <div
              style={{
                position: 'absolute',
                right: '-10px',
                bottom: '-10px',
                opacity: 0.15,
                transform: 'rotate(-15deg)',
              }}
            >
              <BirdSilhouette size={80} />
            </div>

            {/* Content */}
            <div style={{ position: 'relative', zIndex: 1 }}>
              <div
                style={{
                  fontSize: '15px',
                  fontWeight: 600,
                  color: '#f5f0e6',
                  lineHeight: 1.3,
                  marginBottom: '6px',
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
                {isWarblers && (
                  <span
                    style={{
                      marginLeft: '8px',
                      padding: '2px 6px',
                      background: 'rgba(255, 200, 50, 0.3)',
                      color: '#ffd54f',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    🎓 Experts Only
                  </span>
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span
                  style={{
                    fontSize: '12px',
                    color: 'rgba(245, 240, 230, 0.7)',
                    fontWeight: 500,
                  }}
                >
                  {pack.speciesCount} species
                </span>
                {pack.isUnlocked && (
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
                )}
              </div>
            </div>
          </button>
        );})}

      </div>

      {/* Create Custom Pack Section */}
      <div
        style={{
          marginBottom: '32px',
          background: 'var(--color-surface)',
          border: '2px solid var(--color-accent)',
          borderRadius: '16px',
          padding: '20px',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'var(--color-accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#000',
          }}>
            <PlusIcon />
          </div>
          <div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text)' }}>
              Create Custom Pack
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              Build your own training session
            </div>
          </div>
        </div>

        <div style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          lineHeight: 1.6,
          marginBottom: '16px',
        }}>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--color-accent)' }}>→</span> Got a nemesis bird? Queue it up and drill all its variations.
          </div>
          <div style={{ marginBottom: '8px' }}>
            <span style={{ color: 'var(--color-accent)' }}>→</span> Constantly confuse Kinglets and Creepers? Put them head-to-head!
          </div>
          <div>
            <span style={{ color: 'var(--color-accent)' }}>→</span> Mix species from any pack — your rules, your practice.
          </div>
        </div>

        <button
          onClick={() => navigate('/custom-pack')}
          style={{
            width: '100%',
            padding: '12px',
            background: 'var(--color-accent)',
            border: 'none',
            borderRadius: '8px',
            color: '#000',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Build Your Pack
        </button>
      </div>

      {/* Bird Reference Section */}
      <div style={{ marginTop: '16px' }}>
        <h3 style={{ fontSize: '16px', marginBottom: '16px', color: 'var(--color-text-muted)' }}>
          Bird Reference
        </h3>

        {PACKS.filter(p => p.isUnlocked).map((pack) => (
          <div key={pack.id} style={{ marginBottom: '24px' }}>
            <h4 style={{ fontSize: '14px', marginBottom: '12px', color: 'var(--color-accent)' }}>
              {pack.name}
            </h4>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: '8px',
              }}
            >
              {getBirdsForPack(pack.id).map((bird) => (
                <div
                  key={bird.code}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    borderRadius: '8px',
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
                    <div style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                      {bird.clipCount} clip{bird.clipCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <button
                    onClick={() => bird.canonicalClipPath && playSound(bird.canonicalClipPath, bird.code)}
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
              ))}
            </div>
          </div>
        ))}
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
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
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
