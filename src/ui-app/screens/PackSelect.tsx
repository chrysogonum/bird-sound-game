import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface Pack {
  id: string;
  name: string;
  speciesCount: number;
  isUnlocked: boolean;
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
  { id: 'starter_birds', name: '5 Common Backyard Birds', speciesCount: 5, isUnlocked: true },
  { id: 'expanded_backyard', name: 'Expanded Backyard Birds', speciesCount: 27, isUnlocked: true },
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
      <div className="flex-row items-center gap-md" style={{ marginBottom: '24px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <BackIcon />
        </button>
        <h2 style={{ margin: 0 }}>Select Pack</h2>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {PACKS.map((pack) => (
          <button
            key={pack.id}
            className="card"
            onClick={() => handlePackSelect(pack)}
            style={{
              textAlign: 'left',
              opacity: pack.isUnlocked ? 1 : 0.5,
              cursor: pack.isUnlocked ? 'pointer' : 'not-allowed',
            }}
          >
            <div className="flex-row justify-between items-center">
              <span style={{ fontSize: '14px', fontWeight: 600 }}>{pack.name}</span>
              <span style={{ fontSize: '20px' }}>{pack.isUnlocked ? '🔓' : '🔒'}</span>
            </div>
            <div className="text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
              {pack.speciesCount} species
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

export default PackSelect;
