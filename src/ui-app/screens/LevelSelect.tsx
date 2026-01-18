import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';
import { trackLevelSelect } from '../utils/analytics';

// Pack display names
const PACK_NAMES: Record<string, string> = {
  starter_birds: 'Common Eastern US Backyard Birds',
  expanded_backyard: 'Expanded Eastern US Birds',
  sparrows: 'Sparrows',
  woodpeckers: 'Woodpeckers',
  spring_warblers: 'Warbler Academy',
  western_birds: 'Western Backyard Birds',
  custom: 'Custom Pack',
};

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
  if (levelId <= 4) return { label: 'Medium', color: '#FFC107' };
  return { label: 'Hard', color: '#FF5722' };
}

function LevelSelect() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('pack') || 'starter_birds';

  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [loading, setLoading] = useState(true);

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
        navigate('/custom-pack', { replace: true });
      } catch (e) {
        console.error('Failed to load custom pack:', e);
        navigate('/custom-pack', { replace: true });
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

  const handleLevelSelect = (level: LevelConfig) => {
    trackLevelSelect(packId, level.level_id, level.title || `Level ${level.level_id}`);
    navigate(`/preview?pack=${packId}&level=${level.level_id}`);
  };

  const packName = PACK_NAMES[packId] || packId;

  return (
    <div className="screen" style={{ paddingBottom: '24px' }}>
      {/* Header */}
      <div className="flex-row items-center gap-md" style={{ marginBottom: '8px' }}>
        <button className="btn-icon" onClick={() => navigate(packId === 'custom' ? '/custom-pack' : '/pack-select')} aria-label="Back">
          <BackIcon />
        </button>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: '20px' }}>{packName}</h2>
          <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span>Select a level</span>
            {packId !== 'custom' && (
              <>
                <span style={{ color: 'var(--color-surface)' }}>•</span>
                <Link
                  to={`/pack-select?expand=${packId}#bird-reference`}
                  state={{ fromLevelSelect: true, packId }}
                  style={{ color: 'var(--color-accent)', textDecoration: 'none', fontSize: '12px' }}
                >
                  Bird Reference
                </Link>
              </>
            )}
          </div>
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
        background: 'rgba(245, 166, 35, 0.1)',
        borderRadius: '8px',
        borderLeft: '3px solid var(--color-accent)',
      }}>
        <div style={{ fontSize: '13px', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--color-accent)' }}>Tip:</strong> Start with Level 1 to learn
          each bird's signature sound, then progress to variations and both-ear challenges.
        </div>
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

function ArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export default LevelSelect;
