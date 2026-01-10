import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

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
    speciesCount: 27,
    isUnlocked: true,
    description: 'Ready for more? 10 random birds per round from 27 eastern US species.',
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
];

// Species in each pack
const PACK_SPECIES: Record<string, string[]> = {
  starter_birds: ['NOCA', 'CARW', 'TUTI', 'BLJA', 'AMCR'],
  expanded_backyard: [
    'NOCA', 'CARW', 'BLJA', 'AMCR', 'TUTI',
    'BEKI', 'RSHA', 'AMGO', 'CACH', 'PIWA',
    'WTSP', 'HOFI', 'EABL', 'AMRO', 'HETH',
    'BHNU', 'BRCR', 'WBNU', 'YBSA', 'RBWO',
    'DOWO', 'HAWO', 'NOFL', 'PIWO', 'BRTH',
    'GRCA', 'MODO',
  ],
  sparrows: [
    'WTSP', 'SOSP', 'CHSP', 'SWSP', 'SASP', 'FISP', 'LISP',
  ],
  woodpeckers: [
    'DOWO', 'HAWO', 'RBWO', 'PIWO', 'YBSA', 'NOFL', 'RHWO',
  ],
};

function PackSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'campaign';

  const [clips, setClips] = useState<ClipData[]>([]);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load clips data
  useEffect(() => {
    fetch('/data/clips.json')
      .then((res) => res.json())
      .then((data: ClipData[]) => setClips(data))
      .catch((err) => console.error('Failed to load clips:', err));
  }, []);

  // Get bird info for a pack
  const getBirdsForPack = (packId: string): BirdInfo[] => {
    const speciesCodes = PACK_SPECIES[packId] || [];
    return speciesCodes.map((code) => {
      const canonicalClip = clips.find(
        (c) => c.species_code === code && c.canonical && !c.rejected
      );
      const anyClip = clips.find((c) => c.species_code === code && !c.rejected);
      const clip = canonicalClip || anyClip;
      return {
        code,
        name: clip?.common_name || code,
        canonicalClipPath: clip ? `/data/clips/${clip.file_path.split('/').pop()}` : null,
      };
    }).sort((a, b) => a.code.localeCompare(b.code));
  };

  const handlePackSelect = (pack: Pack) => {
    if (pack.isUnlocked) {
      navigate(`/gameplay?mode=${mode}&pack=${pack.id}`);
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
        <h2 style={{ margin: 0 }}>Select Pack</h2>
      </div>

      <p style={{
        fontSize: '14px',
        color: 'var(--color-text-muted)',
        marginBottom: '20px',
        lineHeight: 1.5,
      }}>
        Choose a bird pack to practice. Each pack has 6 levels that build your listening skills,
        from learning signature sounds to mastering full repertoires.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {PACKS.map((pack, index) => (
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
              background: index === 0
                ? 'linear-gradient(135deg, #2d5a3d 0%, #1a3d2a 100%)'
                : 'linear-gradient(135deg, #4a6741 0%, #2d4a32 100%)',
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
        ))}
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
                    gap: '12px',
                    padding: '8px 12px',
                    background: 'var(--color-surface)',
                    borderRadius: '8px',
                  }}
                >
                  <button
                    onClick={() => bird.canonicalClipPath && playSound(bird.canonicalClipPath, bird.code)}
                    disabled={!bird.canonicalClipPath}
                    style={{
                      width: '32px',
                      height: '32px',
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
                  <div style={{ minWidth: 0 }}>
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
                  </div>
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

function BirdSilhouette({ size = 80 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="currentColor">
      <path d="M85 35c-5-3-12-2-18 1-3-8-10-14-19-16 2-3 3-7 2-11-1-5-5-8-9-7s-7 5-6 10c0 2 1 4 2 5-10 3-18 11-21 21-8-1-16 2-21 8-2 2-1 5 1 6s5 0 7-2c3-4 8-5 13-4 0 12 7 23 18 28l-8 12c-2 2-1 5 1 7 2 1 5 1 6-2l10-14c3 1 6 1 9 1 4 0 7-1 10-2l10 14c2 2 5 3 7 1s2-5 0-7l-8-12c11-5 18-16 18-28 5-1 10 0 13 4 2 2 5 3 7 2s3-4 1-6c-5-6-13-9-21-8z" />
    </svg>
  );
}

export default PackSelect;
