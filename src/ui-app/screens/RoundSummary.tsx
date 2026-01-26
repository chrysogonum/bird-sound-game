import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ShareCard, { ShareCardHandle } from '../components/ShareCard';

interface SpeciesResult {
  code: string;
  name: string;
  total: number;
  correct: number;
  accuracy: number;
}

interface ConfusionEntry {
  expectedSpecies: string;
  guessedSpecies: string | null;
  channel: 'left' | 'right';
}

interface RoundResults {
  score: number;
  eventsScored: number;
  totalEvents: number;
  speciesCorrect: number;
  channelCorrect: number;
  perfectCount: number;
  missCount: number;
  maxStreak: number;
  speciesResults: Record<string, { total: number; correct: number }>;
  species: Array<{ code: string; name: string }>;
  mode?: string;
  packId?: string;
  levelId?: number;
  levelTitle?: string;
  confusionData?: ConfusionEntry[];
  usedTrainingMode?: boolean;
}

// Total number of campaign levels per pack
const TOTAL_LEVELS = 6;

// Pack display names
const PACK_NAMES: Record<string, string> = {
  starter_birds: 'Backyard Birds',
  grassland_birds: 'Grassland & Open Country',
  expanded_backyard: 'Eastern Birds',
  sparrows: 'Sparrows',
  woodpeckers: 'Woodpeckers',
  spring_warblers: 'Warbler Academy',
  western_birds: 'Western Birds',
  custom: 'Custom Pack',
  drill: 'Confusion Drill',
  // NZ packs
  nz_all_birds: 'All NZ Birds',
  nz_common: 'Garden & Bush',
  nz_rare: 'Rare & Endemic',
};

// NZ pack IDs and theme color
const NZ_PACK_IDS = ['nz_all_birds', 'nz_common', 'nz_rare'];
const NZ_ACCENT_COLOR = '#4db6ac';  // Muted teal for NZ

// Level color based on difficulty (matches LevelSelect.tsx)
function getLevelColor(level: number): string {
  if (level <= 2) return '#4CAF50'; // Easy - green
  if (level <= 4) return 'rgba(245, 166, 35, 0.8)'; // Medium - muted orange
  return '#FF5722'; // Hard - red/orange
}

interface ConfusionSummaryItem {
  expectedSpecies: string;
  guessedSpecies: string | null;
  count: number;
}

function RoundSummary() {
  const navigate = useNavigate();
  const shareCardRef = useRef<ShareCardHandle>(null);
  const [results, setResults] = useState<RoundResults | null>(null);
  const [speciesBreakdown, setSpeciesBreakdown] = useState<SpeciesResult[]>([]);
  const [confusionSummary, setConfusionSummary] = useState<ConfusionSummaryItem[]>([]);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareReady, setShareReady] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [drillOrigin, setDrillOrigin] = useState<{ packId: string; level: number } | null>(null);

  useEffect(() => {
    // Load results from localStorage
    const saved = localStorage.getItem('soundfield_round_results');
    if (saved) {
      try {
        const parsed: RoundResults = JSON.parse(saved);
        setResults(parsed);

        // Save progress for campaign mode
        if (parsed.mode === 'campaign' && parsed.levelId) {
          const progressKey = 'soundfield_progress';
          const existingProgress = JSON.parse(localStorage.getItem(progressKey) || '{}');
          const levelKey = `level_${parsed.levelId}`;
          const existingBest = existingProgress[levelKey]?.bestScore || 0;

          existingProgress[levelKey] = {
            completed: true,
            bestScore: Math.max(existingBest, parsed.score),
            accuracy: parsed.totalEvents > 0
              ? Math.round((parsed.eventsScored / parsed.totalEvents) * 100)
              : 0,
          };
          localStorage.setItem(progressKey, JSON.stringify(existingProgress));
        }

        // Build species breakdown - only include species that were in this round
        const breakdown: SpeciesResult[] = [];
        for (const speciesInfo of parsed.species) {
          const data = parsed.speciesResults[speciesInfo.code] || { total: 0, correct: 0 };
          if (data.total > 0) {
            breakdown.push({
              code: speciesInfo.code,
              name: speciesInfo.name,
              total: data.total,
              correct: data.correct,
              accuracy: Math.round((data.correct / data.total) * 100),
            });
          }
        }
        breakdown.sort((a, b) => a.accuracy - b.accuracy);
        setSpeciesBreakdown(breakdown);

        // Build confusion summary
        if (parsed.confusionData && parsed.confusionData.length > 0) {
          const confusionMap = new Map<string, number>();

          for (const entry of parsed.confusionData) {
            if (entry.guessedSpecies === entry.expectedSpecies) continue;
            const key = `${entry.expectedSpecies}|${entry.guessedSpecies ?? 'MISS'}`;
            confusionMap.set(key, (confusionMap.get(key) || 0) + 1);
          }

          const summary: ConfusionSummaryItem[] = [];
          for (const [key, count] of confusionMap.entries()) {
            const [expected, guessed] = key.split('|');
            summary.push({
              expectedSpecies: expected,
              guessedSpecies: guessed === 'MISS' ? null : guessed,
              count,
            });
          }
          summary.sort((a, b) => b.count - a.count);
          setConfusionSummary(summary);
        }
      } catch (e) {
        console.error('Failed to parse round results:', e);
      }
    }
  }, []);

  const overallAccuracy = results && results.totalEvents > 0
    ? Math.round((results.eventsScored / results.totalEvents) * 100)
    : 0;

  const isCampaign = results?.mode === 'campaign';
  const currentLevel = results?.levelId || 1;
  const packId = results?.packId || 'starter_birds';
  const hasPrevLevel = currentLevel > 1;
  const hasNextLevel = currentLevel < TOTAL_LEVELS;
  const isDrill = packId === 'drill';

  // Determine if this is an NZ pack for theming
  // For drills, check the origin pack (from state or sessionStorage); otherwise check the current pack
  const isNZPack = (() => {
    if (NZ_PACK_IDS.includes(packId)) return true;
    if (packId === 'custom' && localStorage.getItem('soundfield_custom_pack_region') === 'nz') return true;
    if (isDrill) {
      // Check state first, then sessionStorage for initial render
      if (drillOrigin && NZ_PACK_IDS.includes(drillOrigin.packId)) return true;
      try {
        const origin = sessionStorage.getItem('drillOrigin');
        if (origin) {
          const parsed = JSON.parse(origin);
          if (NZ_PACK_IDS.includes(parsed.packId)) return true;
        }
      } catch { /* ignore */ }
    }
    return false;
  })();
  const accentColor = isNZPack ? NZ_ACCENT_COLOR : 'var(--color-accent)';

  // Check for drill origin on mount
  useEffect(() => {
    if (isDrill) {
      const origin = sessionStorage.getItem('drillOrigin');
      if (origin) {
        try {
          setDrillOrigin(JSON.parse(origin));
        } catch (e) {
          console.error('Failed to parse drill origin:', e);
        }
      }
    }
  }, [isDrill]);

  // Navigation helpers - all go through preview
  const goToLevel = (level: number) => {
    // Always save current species to sessionStorage so they persist to next round
    if (results?.species) {
      const speciesCodes = results.species.map(s => s.code);
      sessionStorage.setItem('roundSpecies', JSON.stringify(speciesCodes));
    }
    navigate(`/preview?pack=${packId}&level=${level}&keepBirds=true`);
  };

  const goToLevelSelect = () => {
    navigate(`/level-select?pack=${packId}`);
  };

  const goToMenu = () => {
    navigate('/');
  };

  const returnToOriginPack = () => {
    if (drillOrigin) {
      // Clear drill origin so it doesn't persist
      sessionStorage.removeItem('drillOrigin');
      sessionStorage.removeItem('drillSpecies');
      navigate(`/preview?pack=${drillOrigin.packId}&level=${drillOrigin.level}`);
    }
  };

  // Get unique species from confusion data for drill mode
  const getConfusedSpecies = (): string[] => {
    if (!confusionSummary.length) return [];
    const speciesSet = new Set<string>();
    for (const item of confusionSummary) {
      speciesSet.add(item.expectedSpecies);
      if (item.guessedSpecies) {
        speciesSet.add(item.guessedSpecies);
      }
    }
    return Array.from(speciesSet);
  };

  const confusedSpecies = getConfusedSpecies();
  const showDrillButton = confusedSpecies.length >= 4;
  const [showDrillLevelPicker, setShowDrillLevelPicker] = useState(false);

  const startDrill = (level: number = currentLevel) => {
    // Store confused species for drill mode
    sessionStorage.setItem('drillSpecies', JSON.stringify(confusedSpecies));
    // Save origin pack/level so user can return after drilling
    sessionStorage.setItem('drillOrigin', JSON.stringify({ packId, level: currentLevel }));
    navigate(`/preview?pack=drill&level=${level}`);
  };

  // Check when share card is ready
  useEffect(() => {
    const checkReady = setInterval(() => {
      if (shareCardRef.current?.isReady()) {
        setShareReady(true);
        clearInterval(checkReady);
      }
    }, 100);

    return () => clearInterval(checkReady);
  }, [results]);

  const handleShare = async () => {
    if (!shareCardRef.current) return;

    setIsSharing(true);
    setShareMessage(null);

    try {
      const result = await shareCardRef.current.share();

      // Check if this is iOS (the share function will return 'ios-instructions' if showing save instructions)
      if (result === 'ios-instructions') {
        setShareMessage('Follow instructions in new tab to save & share! 📸');
        // Clear message after 5 seconds
        setTimeout(() => setShareMessage(null), 5000);
      }
    } catch (err) {
      console.error('Share failed:', err);
      setShareMessage('Share failed. Please try again.');
      setTimeout(() => setShareMessage(null), 3000);
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="screen" style={{ paddingTop: 'calc(12px + var(--safe-area-top, 0px))', paddingBottom: 'calc(24px + var(--safe-area-bottom, 0px))' }}>
      {/* Header with navigation */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
        <button
          className="btn-icon"
          onClick={goToLevelSelect}
          aria-label="Back to levels"
          style={{ color: accentColor, opacity: 0.6 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <h1 style={{ fontSize: '20px', margin: 0 }}>Round Complete</h1>
          {isCampaign && (
            <p className="text-muted" style={{ margin: '4px 0 0', fontSize: '13px' }}>
              Level {currentLevel}: {results?.levelTitle || 'Campaign'}
            </p>
          )}
        </div>
        <button
          className="btn-icon"
          onClick={goToMenu}
          aria-label="Home"
          style={{ color: accentColor, opacity: 0.6 }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
        </button>
      </div>

      {/* Hidden ShareCard - always rendered for canvas generation */}
      {results && (
        <ShareCard
          ref={shareCardRef}
          score={results.score}
          accuracy={overallAccuracy}
          eventsScored={results.eventsScored}
          totalEvents={results.totalEvents}
          maxStreak={results.maxStreak}
          species={results.species}
          packId={results.packId}
          levelId={results.levelId}
          levelTitle={results.levelTitle}
          usedTrainingMode={results.usedTrainingMode}
          topConfusion={
            confusionSummary.length > 0 && confusionSummary[0].guessedSpecies
              ? {
                  from: confusionSummary[0].expectedSpecies,
                  to: confusionSummary[0].guessedSpecies,
                }
              : null
          }
        />
      )}

      {/* Stats Card */}
      <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Score</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '24px', color: accentColor, opacity: 0.85 }}>
            {results?.score || 0}
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Birds Identified</span>
          <span>{results?.eventsScored || 0} / {results?.totalEvents || 0}</span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Overall Accuracy</span>
          <span className={overallAccuracy >= 70 ? 'text-success' : overallAccuracy >= 50 ? 'text-accent' : 'text-error'}>
            {overallAccuracy}%
          </span>
        </div>
        <div className="flex-row justify-between" style={{ marginBottom: '12px' }}>
          <span>Perfect Hits</span>
          <span className="text-success">{results?.perfectCount || 0}</span>
        </div>
        <div className="flex-row justify-between">
          <span>Best Streak</span>
          <span>{results?.maxStreak || 0}</span>
        </div>
        {results?.usedTrainingMode && (
          <div style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--color-surface)',
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Training Mode was used
          </div>
        )}
      </div>

      {/* Play Again Button - below score summary, above species breakdown */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
        <button
          className="btn-primary"
          onClick={() => goToLevel(currentLevel)}
          style={{ width: '100%' }}
        >
          {isDrill ? 'Drill Again' : 'Play Again'}
        </button>
      </div>

      {/* Species Breakdown */}
      {speciesBreakdown.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Species Breakdown</h3>
          {speciesBreakdown.map((result) => (
            <div key={result.code} style={{ marginBottom: '12px' }}>
              <div className="flex-row justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ fontSize: '14px' }}>
                  {result.code} <span className="text-muted">({result.name})</span>
                </span>
                <span style={{ fontSize: '14px' }}>
                  {result.correct}/{result.total} ({result.accuracy}%)
                </span>
              </div>
              <div style={{ height: '8px', backgroundColor: 'var(--color-background)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${result.accuracy}%`,
                  height: '100%',
                  backgroundColor: result.accuracy >= 80 ? 'var(--color-success)' : result.accuracy >= 50 ? 'var(--color-accent)' : 'var(--color-error)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confusion Summary */}
      {confusionSummary.length > 0 && (
        <div className="card" style={{ width: '100%', maxWidth: '320px', margin: '0 auto 20px' }}>
          <h3 style={{ marginBottom: '12px' }}>Confusion Summary</h3>
          {confusionSummary.map((item, index) => (
            <div key={index} style={{ marginBottom: '8px', fontSize: '14px' }}>
              {item.guessedSpecies === null ? (
                <span>
                  Missed <span className="text-accent">{item.expectedSpecies}</span>: {item.count}x
                </span>
              ) : (
                <span>
                  <span className="text-accent">{item.expectedSpecies}</span> → <span className="text-error">{item.guessedSpecies}</span>: {item.count}x
                </span>
              )}
            </div>
          ))}
          {showDrillButton && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', justifyContent: 'center' }}>
                <button
                  onClick={() => startDrill(currentLevel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    borderRadius: '8px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #E57373 0%, #C62828 100%)',
                    color: 'white',
                    cursor: 'pointer',
                  }}
                >
                  <DrillIcon />
                  Drill These {confusedSpecies.length} Birds
                </button>
                <button
                  onClick={() => setShowDrillLevelPicker(!showDrillLevelPicker)}
                  title="Change drill level"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: 'transparent',
                    border: 'none',
                    color: getLevelColor(currentLevel),
                    fontSize: '12px',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  <span style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: showDrillLevelPicker
                      ? getLevelColor(currentLevel)
                      : `linear-gradient(135deg, ${getLevelColor(currentLevel)}33, ${getLevelColor(currentLevel)}11)`,
                    border: `2px solid ${getLevelColor(currentLevel)}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                    color: showDrillLevelPicker ? 'var(--color-background)' : getLevelColor(currentLevel),
                  }}>
                    {currentLevel}
                  </span>
                  <span style={{ textDecoration: 'underline' }}>Level</span>
                </button>
              </div>
              {showDrillLevelPicker && (
                <div style={{
                  marginTop: '10px',
                  padding: '12px',
                  background: 'var(--color-surface)',
                  borderRadius: '8px',
                }}>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '10px', textAlign: 'center' }}>
                    Drill at level:
                  </div>
                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                    {[1, 2, 3, 4, 5, 6].map((level) => (
                      <button
                        key={level}
                        onClick={() => startDrill(level)}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          border: level === currentLevel ? `2px solid ${accentColor}` : '1px solid var(--color-text-muted)',
                          background: level === currentLevel
                            ? accentColor
                            : 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
                          color: level === currentLevel ? 'var(--color-background)' : 'var(--color-text)',
                          fontWeight: 600,
                          fontSize: '16px',
                          cursor: 'pointer',
                        }}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Navigation Buttons */}
      <div style={{ width: '100%', maxWidth: '320px', margin: '0 auto' }}>
        {/* Level Navigation Row */}
        {isCampaign && (
          <div className="flex-row gap-md" style={{ marginBottom: '12px' }}>
            <button
              className="btn-secondary"
              onClick={() => goToLevel(currentLevel - 1)}
              disabled={!hasPrevLevel}
              style={{ flex: 1, opacity: hasPrevLevel ? 1 : 0.4 }}
            >
              <ChevronLeftIcon /> Prev
            </button>
            <button
              className="btn-secondary"
              onClick={() => setShowLevelPicker(!showLevelPicker)}
              style={{ flex: 1 }}
            >
              Level {currentLevel}/{TOTAL_LEVELS}
            </button>
            <button
              className="btn-secondary"
              onClick={() => goToLevel(currentLevel + 1)}
              disabled={!hasNextLevel}
              style={{ flex: 1, opacity: hasNextLevel ? 1 : 0.4 }}
            >
              Next <ChevronRightIcon />
            </button>
          </div>
        )}

        {/* Level Picker Dropdown */}
        {showLevelPicker && (
          <div className="card" style={{ marginBottom: '12px', padding: '12px' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginBottom: '8px' }}>
              Jump to level:
            </div>
            <div className="flex-row" style={{ flexWrap: 'wrap', gap: '8px' }}>
              {[1, 2, 3, 4, 5, 6].map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setShowLevelPicker(false);
                    goToLevel(level);
                  }}
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '8px',
                    border: level === currentLevel ? `2px solid ${accentColor}` : '1px solid var(--color-text-muted)',
                    background: level === currentLevel ? accentColor : 'var(--color-surface)',
                    color: level === currentLevel ? 'var(--color-background)' : 'var(--color-text)',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Actions */}
        <div className="flex-col gap-md">
          {/* Return to origin pack after drill */}
          {isDrill && drillOrigin && (
            <button
              className="btn-primary"
              onClick={returnToOriginPack}
              style={{ width: '100%', background: 'linear-gradient(135deg, #4A90D9 0%, #357ABD 100%)' }}
            >
              ← Back to {PACK_NAMES[drillOrigin.packId] || drillOrigin.packId}
            </button>
          )}

          {/* Share Score Button - bottom position */}
          <button
            className="btn-primary"
            onClick={handleShare}
            disabled={isSharing || !results || !shareReady}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <ShareIcon />
            {isSharing ? 'Generating...' : !shareReady ? 'Preparing...' : 'Share Your Score'}
          </button>
          <p style={{
            fontSize: '13px',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            marginTop: '-8px',
            marginBottom: '0',
            fontStyle: 'italic',
          }}>
            Let them Wordle, you already know how to spell.
          </p>
          {shareMessage && (
            <p style={{
              fontSize: '14px',
              color: accentColor,
              textAlign: 'center',
              marginTop: '0',
              marginBottom: '0',
              fontWeight: 600,
              animation: 'fadeIn 0.3s ease',
            }}>
              {shareMessage}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '4px' }}>
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: '4px' }}>
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

function DrillIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

export default RoundSummary;
