import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface ClipData {
  clip_id: string;
  species_code: string;
  file_path: string;
  canonical?: boolean;
  rejected?: boolean;
}

interface BirdInfo {
  code: string;
  name: string;
  scientificName?: string;
  canonicalClipPath: string | null;
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
  nz_all_birds: 'All NZ Birds',
  nz_common: 'Garden & Bush',
  nz_north_island: 'North Island',
  nz_south_island: 'South Island',
  eu_warblers: 'Warblers & Skulkers',
  eu_raptors: 'Raptors',
  eu_woodland: 'Woodland & Field',
  eu_all_birds: 'All European Birds',
  na_all_birds: 'All North America',
};

const NZ_PACK_IDS = ['nz_all_birds', 'nz_common', 'nz_north_island', 'nz_south_island'];
const EU_PACK_IDS = ['eu_warblers', 'eu_raptors', 'eu_woodland', 'eu_all_birds'];

function getAccentColor(packId: string): string {
  if (NZ_PACK_IDS.includes(packId)) return '#4db6ac';
  if (EU_PACK_IDS.includes(packId)) return '#a0b450';
  return '#f5c87a';
}

function getBackRoute(packId: string): string {
  if (NZ_PACK_IDS.includes(packId)) return '/nz-packs';
  if (EU_PACK_IDS.includes(packId)) return '/eu-packs';
  if (packId === 'custom') return '/custom-pack';
  return '/na-packs';
}

function PackDetail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('pack') || 'starter_birds';

  const [birds, setBirds] = useState<BirdInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingClip, setPlayingClip] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  type SortMode = 'alpha' | 'taxonomic' | 'code';
  const [sortMode, setSortMode] = useState<SortMode>('alpha');

  const accentColor = getAccentColor(packId);
  const packName = PACK_NAMES[packId] || packId;

  useEffect(() => {
    const appContainer = document.querySelector('.screen')?.parentElement;
    if (appContainer) appContainer.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/packs/${packId}.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/clips.json`).then(r => r.json()),
    ]).then(([packData, speciesData, clipsData]: [
      { species: (string | { code: string })[], display_species?: string[] },
      Array<{ species_code: string; common_name: string; scientific_name: string }>,
      ClipData[],
    ]) => {
      const speciesCodes: string[] = packData.display_species ||
        packData.species.map((sp) => typeof sp === 'string' ? sp : sp.code);

      const speciesMap: Record<string, { name: string; scientificName: string }> = {};
      for (const sp of speciesData) {
        speciesMap[sp.species_code] = { name: sp.common_name, scientificName: sp.scientific_name };
      }

      const canonicalMap: Record<string, string> = {};
      for (const clip of clipsData) {
        if (clip.canonical && !clip.rejected) {
          canonicalMap[clip.species_code] = `${import.meta.env.BASE_URL}${clip.file_path}`;
        }
      }

      const birdList: BirdInfo[] = speciesCodes.map(code => ({
        code,
        name: speciesMap[code]?.name || code,
        scientificName: speciesMap[code]?.scientificName,
        canonicalClipPath: canonicalMap[code] || null,
      }));

      setBirds(birdList);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load pack detail:', err);
      setLoading(false);
    });
  }, [packId]);

  useEffect(() => {
    return () => {
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

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
    audio.play().catch(err => console.error('Failed to play audio:', err));
    audio.onended = () => { setPlayingClip(null); audioRef.current = null; };
  };

  const sortedBirds = [...birds].sort((a, b) => {
    if (sortMode === 'taxonomic') {
      return (a.scientificName || '').localeCompare(b.scientificName || '');
    }
    if (sortMode === 'code') {
      return a.code.localeCompare(b.code);
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div className="flex-row items-center gap-md" style={{ marginBottom: '4px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate(getBackRoute(packId))}
          aria-label="Back"
          style={{ color: accentColor }}
        >
          <BackIcon />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '20px', color: accentColor, opacity: 0.85 }}>{packName}</h2>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
            {birds.length} species
          </div>
        </div>
        <button className="btn-icon" onClick={() => navigate('/')} aria-label="Home" style={{ color: accentColor }}>
          <HomeIcon />
        </button>
      </div>

      {/* Choose a Level button */}
      <div style={{ marginTop: '12px', marginBottom: '16px', padding: '0 16px' }}>
        <button
          onClick={() => navigate(`/level-select?pack=${packId}`)}
          style={{
            width: '100%',
            padding: '14px',
            fontSize: '16px',
            fontWeight: 600,
            background: 'transparent',
            color: accentColor,
            border: `2px solid ${accentColor}`,
            borderRadius: '14px',
            cursor: 'pointer',
            boxShadow: 'none',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = `0 4px 12px ${accentColor}33`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          Choose a Level
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Sort Toggle */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            marginTop: '8px',
            marginBottom: '4px',
          }}>
            <div style={{
              display: 'flex',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid rgba(255, 255, 255, 0.15)',
            }}>
              {([['alpha', '🔤 Name'], ['taxonomic', '🐦 Latin'], ['code', '# Code']] as [SortMode, string][]).map(([mode, label]) => (
                <button
                  key={mode}
                  onClick={() => setSortMode(mode)}
                  style={{
                    padding: '6px 10px',
                    background: sortMode === mode ? `${accentColor}4d` : 'rgba(255, 255, 255, 0.05)',
                    border: 'none',
                    borderRight: mode !== 'code' ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
                    cursor: 'pointer',
                    fontSize: '11px',
                    color: sortMode === mode ? accentColor : 'var(--color-text-muted)',
                    fontWeight: sortMode === mode ? 600 : 400,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Bird Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            marginTop: '8px',
          }}>
            {sortedBirds.map(bird => (
              <div
                key={bird.code}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '12px 4px',
                  background: 'var(--color-surface)',
                  borderRadius: '12px',
                }}
              >
                {/* Icon with play overlay */}
                <div style={{ position: 'relative' }}>
                  <img
                    src={`${import.meta.env.BASE_URL}data/icons/${bird.code}.png`}
                    alt={bird.name}
                    style={{
                      width: '64px',
                      height: '64px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.opacity = '0.3';
                    }}
                  />
                  {bird.canonicalClipPath && (
                    <button
                      onClick={() => playSound(bird.canonicalClipPath!, bird.code)}
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '26px',
                        height: '26px',
                        borderRadius: '50%',
                        border: 'none',
                        background: playingClip === bird.code ? accentColor : 'rgba(0,0,0,0.7)',
                        color: playingClip === bird.code ? '#000' : accentColor,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                      }}
                      aria-label={`Play ${bird.name}`}
                    >
                      {playingClip === bird.code ? '⏸' : '▶'}
                    </button>
                  )}
                </div>
                <div style={{
                  textAlign: 'center',
                  lineHeight: 1.3,
                }}>
                  <div style={{
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--color-text)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    fontStyle: sortMode === 'taxonomic' ? 'italic' : 'normal',
                  }}>
                    {sortMode === 'taxonomic' ? bird.scientificName || bird.name : bird.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    fontStyle: sortMode === 'taxonomic' ? 'normal' : 'italic',
                    color: 'var(--color-text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '100px',
                  }}>
                    {sortMode === 'taxonomic' ? bird.name : sortMode === 'code' ? bird.code : bird.scientificName || ''}
                  </div>
                </div>
              </div>
            ))}
          </div>

        </>
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

export default PackDetail;
