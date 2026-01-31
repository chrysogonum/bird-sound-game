import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { LevelConfig } from '@engine/game/types';
import { trackTaxonomicSortToggle, trackNZSortModeChange } from '../utils/analytics';
import { useNZSortMode, getSortModeDisplayNames } from '../hooks/useNZSortMode';
import { useNADisplayMode } from '../hooks/useNADisplayMode';
import { loadMergeConfig, deduplicateSubspecies, getIconCode, getMergeInfoByCode } from '../utils/nzSubspeciesMerge';

interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  vocalization_type?: string;
  spectrogram_path?: string;
  canonical?: boolean;
  rejected?: boolean;
}

interface SelectedSpecies {
  code: string;
  displayCode: string;  // Short code for UI display (may differ from eBird code for NZ birds)
  tileName: string;     // Name to show on buttons (Māori name or short English)
  englishName: string;  // English common name (for 3-way sort)
  name: string;
  scientificName?: string;
  color: string;
  clipPath: string | null;
}

// Colors for species circles
const SPECIES_COLORS = [
  '#E57373', '#4FC3F7', '#81C784', '#FFD54F',
  '#BA68C8', '#FF8A65', '#4DB6AC', '#A1887F', '#90A4AE',
];

// Pack display names
const PACK_NAMES: Record<string, string> = {
  starter_birds: 'Backyard Birds',
  grassland_birds: 'Grasslands',
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
  nz_north_island: 'North Island',
  nz_south_island: 'South Island',
};

// NZ pack IDs and theme color
const NZ_PACK_IDS = ['nz_all_birds', 'nz_common', 'nz_north_island', 'nz_south_island'];
const NZ_ACCENT_COLOR = '#4db6ac';  // Muted teal for NZ

// Level titles for custom pack
const LEVEL_TITLES: Record<number, string> = {
  1: 'Meet the Birds',
  2: 'Sound Variations',
  3: 'Full Repertoire',
  4: 'Both Ears',
  5: 'Variations + Both Ears',
  6: 'Master Birder',
};

// Get clip selection mode for level
function getLevelClipSelection(levelId: number): 'canonical' | number | 'all' {
  if (levelId === 1 || levelId === 4) return 'canonical';
  if (levelId === 2 || levelId === 5) return 3;
  return 'all';
}

// Get channel mode for level
function getLevelChannelMode(levelId: number): 'single' | 'offset' {
  return levelId >= 4 ? 'offset' : 'single';
}

// Bird icon component - shows icon with code label below
function BirdIcon({ code, tileName, size = 56, color }: { code: string; tileName?: string; size?: number; color?: string }) {
  const [hasIcon, setHasIcon] = useState(true);
  const iconPath = `${import.meta.env.BASE_URL}data/icons/${code}.png`;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '4px',
      WebkitTapHighlightColor: 'transparent',
    }}>
      {hasIcon && tileName && (
        <span style={{
          fontSize: '11px',
          fontWeight: 700,
          color: '#FFFFFF',
          lineHeight: 1,
          textShadow: '0 1px 2px rgba(0,0,0,0.5)',
        }}>
          {tileName}
        </span>
      )}
      {hasIcon ? (
        <img
          src={iconPath}
          alt={tileName || code}
          width={size}
          height={size}
          style={{
            borderRadius: '50%',
            objectFit: 'cover',
            WebkitTapHighlightColor: 'transparent',
          }}
          onError={() => setHasIcon(false)}
        />
      ) : (
        <div style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: color || 'var(--color-surface)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.25,
          fontWeight: 700,
          color: '#1A1A2E',
        }}>
          {tileName || code}
        </div>
      )}
    </div>
  );
}

function PreRoundPreview() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const packId = searchParams.get('pack') || 'starter_birds';
  const levelId = parseInt(searchParams.get('level') || '1', 10);
  const keepBirds = searchParams.get('keepBirds') === 'true';

  // Determine if this is an NZ pack for theming
  const isNZPack = NZ_PACK_IDS.includes(packId) ||
    (packId === 'custom' && localStorage.getItem('soundfield_custom_pack_region') === 'nz');
  const accentColor = isNZPack ? NZ_ACCENT_COLOR : 'var(--color-accent)';

  const [level, setLevel] = useState<LevelConfig | null>(null);
  const [clips, setClips] = useState<ClipData[]>([]);
  const [selectedSpecies, setSelectedSpecies] = useState<SelectedSpecies[]>([]);
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [preloadStatus, setPreloadStatus] = useState<'idle' | 'loading' | 'ready'>('idle');
  const [preloadProgress, setPreloadProgress] = useState({ loaded: 0, total: 0 });
  const [trainingMode, setTrainingMode] = useState(() => {
    try {
      return localStorage.getItem('soundfield_training_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [taxonomicSort, setTaxonomicSort] = useState(() => {
    try {
      return localStorage.getItem('soundfield_taxonomic_sort') === 'true';
    } catch {
      return false;
    }
  });
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [scientificNames, setScientificNames] = useState<Record<string, string>>({});
  const [commonNames, setCommonNames] = useState<Record<string, string>>({});
  const [nzDisplayCodes, setNzDisplayCodes] = useState<Record<string, { code: string; tileName: string; englishName?: string }>>({});

  // NZ-specific 3-way sort mode
  const [nzSortMode, setNzSortMode] = useNZSortMode();
  // NA display mode (4-letter code vs common name)
  const [naDisplayMode, setNaDisplayMode] = useNADisplayMode();
  const [fullCustomPack, setFullCustomPack] = useState<string[]>([]);  // All species in custom pack (up to 30)
  const [metadataLoaded, setMetadataLoaded] = useState(false);  // Track when NZ display codes etc are loaded
  const [mergeConfigLoaded, setMergeConfigLoaded] = useState(false);  // Track when subspecies merge config is loaded
  const [showSoundLibrary, setShowSoundLibrary] = useState(false);  // Mini sound library modal
  const [libraryPlayingClip, setLibraryPlayingClip] = useState<string | null>(null);  // Currently playing clip in library
  const selectedForRef = useRef<string | null>(null);  // Track which pack/level we've selected species for
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const libraryAudioRef = useRef<HTMLAudioElement | null>(null);

  // Toggle training mode
  const handleTrainingModeToggle = () => {
    const newValue = !trainingMode;
    setTrainingMode(newValue);
    try {
      localStorage.setItem('soundfield_training_mode', String(newValue));
    } catch (e) {
      console.error('Failed to save training mode:', e);
    }
  };

  // Toggle taxonomic sort
  const handleTaxonomicSortToggle = () => {
    const newValue = !taxonomicSort;
    setTaxonomicSort(newValue);
    try {
      localStorage.setItem('soundfield_taxonomic_sort', String(newValue));
      trackTaxonomicSortToggle(newValue, 'preview_screen');
    } catch (e) {
      console.error('Failed to save taxonomic sort:', e);
    }
  };

  // Re-sort selectedSpecies when sort mode changes (without re-selecting)
  useEffect(() => {
    if (selectedSpecies.length === 0) return;

    let resorted: SelectedSpecies[];

    if (isNZPack) {
      // NZ packs use 3-way sort mode
      switch (nzSortMode) {
        case 'english':
          resorted = [...selectedSpecies].sort((a, b) => a.englishName.localeCompare(b.englishName));
          break;
        case 'taxonomic':
          if (Object.keys(taxonomicOrder).length === 0) return;
          resorted = [...selectedSpecies].sort((a, b) => {
            const orderA = taxonomicOrder[a.code] || 9999;
            const orderB = taxonomicOrder[b.code] || 9999;
            return orderA - orderB;
          });
          break;
        case 'maori':
        default:
          resorted = [...selectedSpecies].sort((a, b) => a.tileName.localeCompare(b.tileName));
          break;
      }
    } else {
      // NA packs use 2-way toggle
      if (taxonomicSort && Object.keys(taxonomicOrder).length === 0) return;
      resorted = taxonomicSort
        ? [...selectedSpecies].sort((a, b) => {
            const orderA = taxonomicOrder[a.code] || 9999;
            const orderB = taxonomicOrder[b.code] || 9999;
            return orderA - orderB;
          })
        : [...selectedSpecies].sort((a, b) => a.tileName.localeCompare(b.tileName));
    }

    // Reassign colors based on new sort order
    const withColors = resorted.map((species, index) => ({
      ...species,
      color: SPECIES_COLORS[index % SPECIES_COLORS.length],
    }));

    // Only update if order actually changed
    const orderChanged = withColors.some((sp, i) => sp.code !== selectedSpecies[i].code);
    if (orderChanged) {
      setSelectedSpecies(withColors);
    }
  }, [taxonomicSort, taxonomicOrder, nzSortMode, isNZPack]); // Depend on sort modes but not selectedSpecies to avoid infinite loop

  // Load taxonomic order data, species metadata, NZ display codes, and subspecies merge config
  useEffect(() => {
    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/nz_display_codes.json`).then(r => r.json()).catch(() => ({ codes: {} })),
      loadMergeConfig(), // Load subspecies merge configuration
    ]).then(([taxonomicData, speciesData, nzCodesData]: [Record<string, number>, Array<{species_code: string; common_name: string; scientific_name: string}>, { codes: Record<string, { code: string; tileName: string; englishName?: string }> }, unknown]) => {
      setTaxonomicOrder(taxonomicData);
      setNzDisplayCodes(nzCodesData.codes || {});
      // Build species metadata lookup
      const sciNames: Record<string, string> = {};
      const comNames: Record<string, string> = {};
      speciesData.forEach((sp: {species_code: string; common_name: string; scientific_name: string}) => {
        sciNames[sp.species_code] = sp.scientific_name;
        comNames[sp.species_code] = sp.common_name;
      });
      setScientificNames(sciNames);
      setCommonNames(comNames);
      setMergeConfigLoaded(true);  // Merge config is now cached and ready
      setMetadataLoaded(true);
    }).catch((err) => console.error('Failed to load taxonomy data:', err));
  }, []);

  // Build species info from a list of codes (no shuffling)
  // Respects current sort preference (taxonomic for NA, 3-way for NZ)
  const buildSpeciesInfo = useCallback((codes: string[], clipsData: ClipData[]): SelectedSpecies[] => {
    // For NZ packs, deduplicate subspecies (e.g., nezrob2 and nezrob3 become just nezrob2)
    const dedupedCodes = isNZPack ? deduplicateSubspecies(codes) : codes;

    // First build the species info with tileNames
    const unsorted = dedupedCodes.map((code) => {
      // For merged subspecies, use the icon code for display/lookup
      const iconCode = isNZPack ? getIconCode(code) : code;

      // For clip lookup, we need to search for clips with ANY subspecies code that maps to this icon
      // e.g., for Toutouwai (iconCode nezrob2), search for both nezrob2 AND nezrob3 clips
      const mergeInfo = isNZPack ? getMergeInfoByCode(iconCode) : null;
      const clipSearchCodes = mergeInfo ? mergeInfo.subspecies : [iconCode];

      const canonicalClip = clipsData.find(
        c => clipSearchCodes.includes(c.species_code) && c.canonical && !c.rejected
      );
      const anyClip = clipsData.find(c => clipSearchCodes.includes(c.species_code) && !c.rejected);
      const clip = canonicalClip || anyClip;

      const nzData = nzDisplayCodes[iconCode];
      const englishName = nzData?.englishName || commonNames[iconCode] || iconCode;

      // For NZ packs, use Māori tileName; for NA packs, use code or common name based on display mode
      let tileName: string;
      if (isNZPack) {
        tileName = nzData?.tileName || iconCode;
      } else {
        // NA birds: show 4-letter code or common name based on user preference
        tileName = naDisplayMode === 'name'
          ? (commonNames[iconCode] || iconCode)
          : iconCode;
      }

      return {
        code: iconCode, // Use icon code as the primary code for merged species
        displayCode: nzData?.code || iconCode,
        tileName,
        englishName,
        name: commonNames[iconCode] || iconCode,
        scientificName: scientificNames[iconCode],
        color: '', // Will be assigned after sorting
        clipPath: clip ? `${import.meta.env.BASE_URL}${clip.file_path}` : null,
      };
    });

    // Sort based on current preference
    let sorted: SelectedSpecies[];
    if (isNZPack) {
      // NZ packs use 3-way sort mode
      switch (nzSortMode) {
        case 'english':
          sorted = unsorted.sort((a, b) => a.englishName.localeCompare(b.englishName));
          break;
        case 'taxonomic':
          sorted = unsorted.sort((a, b) => {
            const orderA = taxonomicOrder[a.code] || 9999;
            const orderB = taxonomicOrder[b.code] || 9999;
            return orderA - orderB;
          });
          break;
        case 'maori':
        default:
          sorted = unsorted.sort((a, b) => a.tileName.localeCompare(b.tileName));
          break;
      }
    } else {
      // NA packs use 2-way toggle (alphabetic/taxonomic)
      // Always sort by 4-letter code alphabetically (not tileName, which may be common name)
      sorted = taxonomicSort && Object.keys(taxonomicOrder).length > 0
        ? unsorted.sort((a, b) => {
            const orderA = taxonomicOrder[a.code] || 9999;
            const orderB = taxonomicOrder[b.code] || 9999;
            return orderA - orderB;
          })
        : unsorted.sort((a, b) => a.code.localeCompare(b.code));
    }

    // Assign colors based on sorted position
    return sorted.map((species, index) => ({
      ...species,
      color: SPECIES_COLORS[index % SPECIES_COLORS.length],
    }));
  }, [commonNames, scientificNames, nzDisplayCodes, taxonomicSort, taxonomicOrder, isNZPack, nzSortMode, naDisplayMode, mergeConfigLoaded]);

  // Select random subset from custom pack (for packs with >9 birds)
  const selectRandomFromCustomPack = useCallback((allSpecies: string[], clipsData: ClipData[]) => {
    const targetCount = Math.min(9, allSpecies.length);

    // Shuffle and take 9
    const shuffled = [...allSpecies].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, targetCount);

    setSelectedSpecies(buildSpeciesInfo(selected, clipsData));
  }, [buildSpeciesInfo]);

  // Select random species from the pool
  const selectRandomSpecies = useCallback((levelConfig: LevelConfig, clipsData: ClipData[]) => {
    const pool = levelConfig.species_pool || [];
    const count = levelConfig.species_count || pool.length;

    // For NZ packs, deduplicate BEFORE shuffling to avoid selecting both subspecies
    // (e.g., both nezrob2 and nezrob3) which would collapse to 1 bird after dedup
    const dedupedPool = isNZPack ? deduplicateSubspecies(pool) : pool;

    // Shuffle and take count
    const shuffled = [...dedupedPool].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, count);

    // Use buildSpeciesInfo for consistent handling
    setSelectedSpecies(buildSpeciesInfo(selected, clipsData));
  }, [buildSpeciesInfo, isNZPack]);

  // Load level and clips
  useEffect(() => {
    // Wait for metadata to be loaded before selecting species
    if (!metadataLoaded) return;

    // Only select species once per pack/level combination (prevents re-shuffle on sort toggle)
    const selectionKey = `${packId}-${levelId}`;
    if (selectedForRef.current === selectionKey) return;

    // Determine which clips file to load based on pack
    const isNZPack = packId.startsWith('nz_') ||
      (packId === 'custom' && localStorage.getItem('soundfield_custom_pack_region') === 'nz');
    const clipsFile = isNZPack ? 'clips-nz.json' : 'clips.json';

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/levels.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/${clipsFile}`).then(r => r.json()),
    ]).then(([levels, clipsData]: [LevelConfig[], ClipData[]]) => {
      setClips(clipsData);
      selectedForRef.current = selectionKey;  // Mark that we've selected species for this pack/level

      // Handle drill pack (from confusion summary)
      if (packId === 'drill') {
        const drillSpeciesJson = sessionStorage.getItem('drillSpecies');
        if (drillSpeciesJson) {
          try {
            const drillSpecies = JSON.parse(drillSpeciesJson) as string[];

            // Create synthetic level config for drill, matching difficulty of the level the user came from
            const drillLevelSettings: Record<number, { clip_selection: string | number; channel_mode: string; spectrogram_mode: string }> = {
              1: { clip_selection: 'canonical', channel_mode: 'single', spectrogram_mode: 'full' },
              2: { clip_selection: 3, channel_mode: 'single', spectrogram_mode: 'full' },
              3: { clip_selection: 'all', channel_mode: 'single', spectrogram_mode: 'full' },
              4: { clip_selection: 'canonical', channel_mode: 'offset', spectrogram_mode: 'full' },
              5: { clip_selection: 3, channel_mode: 'offset', spectrogram_mode: 'full' },
              6: { clip_selection: 'all', channel_mode: 'offset', spectrogram_mode: 'full' },
            };
            const settings = drillLevelSettings[levelId] || drillLevelSettings[1];
            const drillLevel: LevelConfig = {
              level_id: levelId,
              pack_id: 'drill',
              mode: 'campaign',
              title: 'Confusion Drill',
              round_duration_sec: 30,
              species_count: drillSpecies.length,
              species_pool: drillSpecies,
              clip_selection: settings.clip_selection as LevelConfig['clip_selection'],
              channel_mode: settings.channel_mode as LevelConfig['channel_mode'],
              event_density: 'low',
              overlap_probability: 0,
              scoring_window_ms: 2000,
              spectrogram_mode: settings.spectrogram_mode as LevelConfig['spectrogram_mode'],
            };
            setLevel(drillLevel);
            setSelectedSpecies(buildSpeciesInfo(drillSpecies, clipsData));
          } catch (e) {
            console.error('Failed to parse drill species:', e);
          }
        }
        setLoading(false);
        return;
      }

      // Handle custom pack specially
      if (packId === 'custom') {
        const customSpeciesJson = localStorage.getItem('soundfield_custom_pack');
        if (customSpeciesJson) {
          try {
            const customSpecies = JSON.parse(customSpeciesJson) as string[];
            setFullCustomPack(customSpecies);

            let selectedForPlay: string[];

            // Check if we should keep the same birds from previous round
            if (keepBirds) {
              const savedSpecies = sessionStorage.getItem('roundSpecies');
              if (savedSpecies) {
                try {
                  const previousSpecies = JSON.parse(savedSpecies) as string[];
                  // Verify these species are still in the custom pack
                  const validSpecies = previousSpecies.filter(s => customSpecies.includes(s));
                  if (validSpecies.length === previousSpecies.length) {
                    // All previous species are valid, use them
                    selectedForPlay = validSpecies;
                  } else {
                    // Some species were removed from pack, re-shuffle
                    selectedForPlay = customSpecies.length > 9
                      ? [...customSpecies].sort(() => Math.random() - 0.5).slice(0, 9)
                      : customSpecies;
                  }
                } catch (e) {
                  console.error('Failed to parse saved species:', e);
                  // Fall back to shuffling
                  selectedForPlay = customSpecies.length > 9
                    ? [...customSpecies].sort(() => Math.random() - 0.5).slice(0, 9)
                    : customSpecies;
                }
              } else {
                // No saved species, shuffle
                selectedForPlay = customSpecies.length > 9
                  ? [...customSpecies].sort(() => Math.random() - 0.5).slice(0, 9)
                  : customSpecies;
              }
            } else {
              // Not keeping birds, randomly select 9 for gameplay
              selectedForPlay = customSpecies.length > 9
                ? [...customSpecies].sort(() => Math.random() - 0.5).slice(0, 9)
                : customSpecies;
            }

            // Create synthetic level config for custom pack
            const customLevel: LevelConfig = {
              level_id: levelId,
              pack_id: 'custom',
              mode: 'campaign',
              title: LEVEL_TITLES[levelId] || `Level ${levelId}`,
              round_duration_sec: 30,
              species_count: selectedForPlay.length,
              species_pool: selectedForPlay,
              clip_selection: getLevelClipSelection(levelId),
              channel_mode: getLevelChannelMode(levelId),
              event_density: 'low',
              overlap_probability: 0,
              scoring_window_ms: 2000,
              spectrogram_mode: 'full',
            };
            setLevel(customLevel);
            setSelectedSpecies(buildSpeciesInfo(selectedForPlay, clipsData));
          } catch (e) {
            console.error('Failed to parse custom pack:', e);
          }
        }
        setLoading(false);
        return;
      }

      const foundLevel = levels.find(l => l.pack_id === packId && l.level_id === levelId);
      if (foundLevel) {
        setLevel(foundLevel);

        // Check if we should keep the same birds from previous round
        if (keepBirds) {
          const savedSpecies = sessionStorage.getItem('roundSpecies');
          if (savedSpecies) {
            try {
              const previousSpecies = JSON.parse(savedSpecies) as string[];
              // Verify these species are still in the pool
              const pool = foundLevel.species_pool || [];
              const validSpecies = previousSpecies.filter(s => pool.includes(s));
              if (validSpecies.length === previousSpecies.length) {
                // All previous species are valid, use them
                setSelectedSpecies(buildSpeciesInfo(validSpecies, clipsData));
                setLoading(false);
                return;
              }
            } catch (e) {
              console.error('Failed to parse saved species:', e);
            }
          }
        }

        // Otherwise select new random species
        selectRandomSpecies(foundLevel, clipsData);
      }
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load data:', err);
      setLoading(false);
    });
  // Note: intentionally excluding buildSpeciesInfo and selectRandomSpecies from deps
  // to prevent re-shuffling when taxonomicSort changes. The separate useEffect
  // above handles re-sorting without re-selecting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, levelId, keepBirds, metadataLoaded]);

  // Preload all clips for selected species in the background
  useEffect(() => {
    if (selectedSpecies.length === 0 || clips.length === 0) {
      setPreloadStatus('idle');
      return;
    }

    // Get all clips for the selected species (not just canonical)
    const speciesCodes = selectedSpecies.map(s => s.code);
    const clipsToPreload = clips.filter(
      c => speciesCodes.includes(c.species_code) && !c.rejected
    );

    if (clipsToPreload.length === 0) {
      setPreloadStatus('ready');
      setPreloadProgress({ loaded: 0, total: 0 });
      return;
    }

    setPreloadStatus('loading');
    setPreloadProgress({ loaded: 0, total: clipsToPreload.length });
    console.log(`Preloading ${clipsToPreload.length} clips for ${speciesCodes.length} species...`);

    let loadedCount = 0;

    // Fetch all clips to warm browser cache
    const preloadPromises = clipsToPreload.map(async (clip) => {
      const url = `${import.meta.env.BASE_URL}${clip.file_path}`;
      try {
        const response = await fetch(url);
        if (response.ok) {
          // Just fetching is enough to cache - we don't need to decode here
          await response.arrayBuffer();
        }
      } catch (err) {
        console.warn('Failed to preload:', clip.file_path, err);
      } finally {
        loadedCount++;
        setPreloadProgress({ loaded: loadedCount, total: clipsToPreload.length });
      }
    });

    Promise.all(preloadPromises).then(() => {
      console.log('Preloading complete!');
      setPreloadStatus('ready');
    });
  }, [selectedSpecies, clips]);

  // Shuffle species
  const handleShuffle = () => {
    if (level && clips.length > 0) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingCode(null);
      }
      // Reset preload status - new birds need new clips
      setPreloadStatus('idle');
      selectRandomSpecies(level, clips);
    }
  };

  // Re-roll custom pack (select new random 9 from larger pack)
  const handleReroll = () => {
    if (fullCustomPack.length > 0 && clips.length > 0) {
      // Stop any playing audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
        setPlayingCode(null);
      }
      // Reset preload status - new birds need new clips
      setPreloadStatus('idle');
      selectRandomFromCustomPack(fullCustomPack, clips);
    }
  };

  // Play preview sound
  const playPreview = (species: SelectedSpecies) => {
    console.log(`[Preview] Attempting to play: ${species.code}`);
    console.log(`[Preview] Clip path: ${species.clipPath}`);

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingCode === species.code) {
      // Toggle off
      setPlayingCode(null);
      return;
    }

    if (!species.clipPath) {
      console.error(`[Preview] No clip path for ${species.code}!`);
      return;
    }

    const audio = new Audio(species.clipPath);
    audioRef.current = audio;
    setPlayingCode(species.code);

    audio.play()
      .then(() => console.log(`[Preview] Playing ${species.code} successfully`))
      .catch(err => {
        console.error(`[Preview] Failed to play ${species.code}:`, err);
        console.error(`[Preview] Clip path was: ${species.clipPath}`);
      });
    audio.onended = () => {
      console.log(`[Preview] ${species.code} finished playing`);
      setPlayingCode(null);
      audioRef.current = null;
    };
  };

  // Start the round
  const handleReady = () => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }

    // Store selected species in sessionStorage for gameplay to pick up
    const speciesCodes = selectedSpecies.map(s => s.code);
    sessionStorage.setItem('roundSpecies', JSON.stringify(speciesCodes));

    // Store sort/display mode so gameplay can show names in the same format
    if (isNZPack) {
      sessionStorage.setItem('nzSortMode', nzSortMode);
    } else {
      sessionStorage.setItem('naDisplayMode', naDisplayMode);
    }

    navigate(`/gameplay?mode=campaign&pack=${packId}&level=${levelId}&preview=true`);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  if (loading) {
    return (
      <div className="screen screen-center">
        <div style={{ color: 'var(--color-text-muted)' }}>Loading...</div>
      </div>
    );
  }

  if (!level) {
    return (
      <div className="screen screen-center">
        <div style={{ color: 'var(--color-error)' }}>Level not found</div>
        <button
          onClick={() => navigate(-1)}
          style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--color-surface)', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer' }}
        >
          Go Back
        </button>
      </div>
    );
  }

  const packName = PACK_NAMES[packId] || packId;

  return (
    <div className="screen" style={{
      display: 'flex',
      flexDirection: 'column',
      paddingTop: 'calc(12px + var(--safe-area-top))',
      paddingBottom: 'calc(12px + var(--safe-area-bottom))',
      paddingLeft: '16px',
      paddingRight: '16px',
      gap: '10px'
    }}>
      {/* Compact Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          className="btn-icon"
          onClick={() => navigate(`/level-select?pack=${packId}`)}
          aria-label="Back"
          style={{ flexShrink: 0, color: accentColor, opacity: 0.6 }}
        >
          <BackIcon />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: '14px', lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {packName}
          </h2>
          <div style={{ fontSize: '12px', color: accentColor, opacity: 0.85, lineHeight: 1.1 }}>
            Level {level.level_id}: {level.title}
          </div>
        </div>
        {/* Sound Library button - opens modal with all clips for selected birds */}
        <button
          onClick={() => setShowSoundLibrary(true)}
          style={{
            padding: '6px 10px',
            background: 'transparent',
            border: '1px solid rgba(100, 181, 246, 0.3)',
            borderRadius: '6px',
            color: '#64B5F6',
            fontSize: '15px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flexShrink: 0,
            whiteSpace: 'nowrap',
          }}
          title="Sound Library - hear all clips for these birds"
        >
          🎧📚
        </button>
        {/* Shuffle/Re-roll button - compact top right */}
        {((level.species_pool && level.species_pool.length > (level.species_count || 0)) || fullCustomPack.length > 9) && (
          <button
            onClick={fullCustomPack.length > 9 ? handleReroll : handleShuffle}
            style={{
              padding: '6px 10px',
              background: 'transparent',
              border: `1px solid ${accentColor}`,
              borderRadius: '6px',
              color: accentColor,
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0,
              opacity: 0.6,
            }}
            title={fullCustomPack.length > 9 ? `Re-roll (${fullCustomPack.length} total birds)` : 'Shuffle birds'}
          >
            <ShuffleIcon />
          </button>
        )}
      </div>

      {/* Compact Toggles Row */}
      <div style={{ display: 'flex', gap: '6px', fontSize: '12px' }}>
        <button
          onClick={handleTrainingModeToggle}
          style={{
            flex: 1,
            padding: '6px 8px',
            background: trainingMode ? 'rgba(76, 175, 80, 0.25)' : 'rgba(255, 255, 255, 0.05)',
            border: trainingMode ? '2px solid var(--color-success)' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          <EyeIcon filled={trainingMode} color={trainingMode ? 'var(--color-success)' : undefined} />
          <span style={{ fontSize: '11px' }}>Training</span>
        </button>
        {isNZPack ? (
          /* NZ 3-way sort toggle */
          <div style={{
            flex: 1,
            display: 'flex',
            borderRadius: '6px',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.15)',
          }}>
            <button
              onClick={() => {
                setNzSortMode('maori');
                trackNZSortModeChange('maori', 'preview_screen');
              }}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: nzSortMode === 'maori' ? 'rgba(77, 182, 172, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                fontSize: '12px',
                color: nzSortMode === 'maori' ? NZ_ACCENT_COLOR : 'var(--color-text-muted)',
                fontWeight: nzSortMode === 'maori' ? 600 : 400,
              }}
              title="Sort by Maori name"
            >
              Te Reo
            </button>
            <button
              onClick={() => {
                setNzSortMode('english');
                trackNZSortModeChange('english', 'preview_screen');
              }}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: nzSortMode === 'english' ? 'rgba(77, 182, 172, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                borderRight: '1px solid rgba(255, 255, 255, 0.15)',
                cursor: 'pointer',
                fontSize: '12px',
                color: nzSortMode === 'english' ? NZ_ACCENT_COLOR : 'var(--color-text-muted)',
                fontWeight: nzSortMode === 'english' ? 600 : 400,
              }}
              title="Sort by English name"
            >
              English
            </button>
            <button
              onClick={() => {
                setNzSortMode('taxonomic');
                trackNZSortModeChange('taxonomic', 'preview_screen');
              }}
              style={{
                flex: 1,
                padding: '6px 4px',
                background: nzSortMode === 'taxonomic' ? 'rgba(77, 182, 172, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                color: nzSortMode === 'taxonomic' ? NZ_ACCENT_COLOR : 'var(--color-text-muted)',
                fontWeight: nzSortMode === 'taxonomic' ? 600 : 400,
              }}
              title="Sort by taxonomic order"
            >
              📊
            </button>
          </div>
        ) : (
          /* NA display mode + taxonomic sort toggles */
          <div style={{
            display: 'flex',
            gap: '6px',
            flex: 1,
          }}>
            {/* Display mode toggle: 4-letter code vs common name */}
            <button
              onClick={() => setNaDisplayMode(naDisplayMode === 'code' ? 'name' : 'code')}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: naDisplayMode === 'name' ? 'rgba(255, 152, 0, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: naDisplayMode === 'name' ? '2px solid var(--color-accent)' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              title={naDisplayMode === 'code' ? 'Show common names' : 'Show 4-letter codes'}
            >
              <span style={{ fontSize: '11px', fontWeight: naDisplayMode === 'name' ? 600 : 400 }}>
                {naDisplayMode === 'name' ? 'Names' : 'NOCA'}
              </span>
            </button>
            {/* Taxonomic sort toggle */}
            <button
              onClick={handleTaxonomicSortToggle}
              style={{
                flex: 1,
                padding: '6px 8px',
                background: taxonomicSort ? 'rgba(100, 181, 246, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                border: taxonomicSort ? '2px solid #64B5F6' : '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
              }}
              title={taxonomicSort ? 'Sort alphabetically' : 'Sort by taxonomy'}
            >
              <span style={{ fontSize: '14px' }}>{taxonomicSort ? '📊' : '🔤'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Preload status indicator */}
      {preloadStatus === 'loading' && (
        <div style={{
          background: 'var(--color-surface)',
          borderRadius: '6px',
          padding: '6px 10px',
        }}>
          <div style={{
            fontSize: '10px',
            color: 'var(--color-text-muted)',
            marginBottom: '4px',
          }}>
            Loading sounds {preloadProgress.loaded}/{preloadProgress.total}
          </div>
          <div style={{
            width: '100%',
            height: '3px',
            background: 'rgba(0,0,0,0.2)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${(preloadProgress.loaded / preloadProgress.total) * 100}%`,
              height: '100%',
              background: accentColor,
              transition: 'width 0.2s ease',
            }} />
          </div>
        </div>
      )}

      {/* Tip Box - Study the Grid */}
      {/* Tip box */}
      <div style={{
        background: 'rgba(100, 181, 246, 0.1)',
        border: '1px solid rgba(100, 181, 246, 0.3)',
        borderRadius: '8px',
        padding: '10px 12px',
      }}>
        <div style={{
          fontSize: '12px',
          color: 'var(--color-text)',
          lineHeight: 1.4,
          textAlign: 'center',
        }}>
          <strong>💡 Study the grid:</strong> Each bird keeps its position during play. Tap to hear, hold for a closer look. Use 🔀 to shuffle.
        </div>
      </div>

      {/* Species grid - MAIN FOCUS */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
      }}>
        {fullCustomPack.length > 9 && (
          <div style={{
            fontSize: '12px',
            color: accentColor,
            opacity: 0.85,
            marginBottom: '6px',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Playing 9 of {fullCustomPack.length} birds
          </div>
        )}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '10px',
          maxWidth: '320px',
          width: '100%',
        }}>
          {selectedSpecies.map((species) => (
            <button
              key={species.code}
              onClick={() => playPreview(species)}
              disabled={!species.clipPath}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 6px',
                background: playingCode === species.code ? `${species.color}33` : 'var(--color-surface)',
                border: `2px solid ${species.color}`,
                borderRadius: '10px',
                cursor: species.clipPath ? 'pointer' : 'not-allowed',
                opacity: species.clipPath ? 1 : 0.5,
                transition: 'transform 0.15s, background 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {/* Bird icon - no tileName above, we show names below */}
              <div style={{ position: 'relative', WebkitTapHighlightColor: 'transparent' }}>
                <BirdIcon code={species.code} size={52} color={species.color} />
              </div>
              {/* Name display based on region and mode */}
              <div style={{
                fontSize: '12px',
                color: 'var(--color-text)',
                textAlign: 'center',
                lineHeight: 1.2,
                maxWidth: '80px',
                overflow: 'hidden',
              }}>
                {(() => {
                  if (isNZPack) {
                    // NZ birds: use 3-way sort mode display
                    const { primary, secondary } = getSortModeDisplayNames(
                      nzSortMode,
                      species.tileName,
                      species.englishName,
                      species.scientificName
                    );
                    return (
                      <>
                        <div style={{ fontWeight: 600 }}>
                          {primary}
                        </div>
                        {secondary && (
                          <div style={{
                            fontSize: '10px',
                            color: 'var(--color-text-muted)',
                            fontStyle: nzSortMode === 'taxonomic' ? 'italic' : 'normal',
                            marginTop: '2px',
                          }}>
                            {secondary}
                          </div>
                        )}
                      </>
                    );
                  } else {
                    // NA birds: code or common name based on display mode
                    // (taxonomic sort only changes order, not display)
                    return (
                      <div style={{ fontWeight: 600 }}>
                        {naDisplayMode === 'name' ? species.name : species.code}
                      </div>
                    );
                  }
                })()}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Status line showing current settings */}
      <div style={{
        fontSize: '11px',
        color: 'var(--color-text-muted)',
        textAlign: 'center',
        marginBottom: '8px',
      }}>
        {isNZPack ? (
          <>
            👁️ Training {trainingMode ? 'on' : 'off'} • Display: {nzSortMode === 'maori' ? 'Te Reo' : nzSortMode === 'english' ? 'English' : 'Taxonomic'} • Sort: {nzSortMode === 'taxonomic' ? 'Taxonomic' : 'A-Z'}
          </>
        ) : (
          <>
            👁️ Training {trainingMode ? 'on' : 'off'} • Display: {naDisplayMode === 'name' ? 'Common names' : '4-letter codes'} • Sort: {taxonomicSort ? 'Taxonomic' : 'A-Z'}
          </>
        )}
      </div>

      {/* Ready button - bottom */}
      <button
        onClick={handleReady}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '15px',
          fontWeight: 700,
          background: preloadStatus === 'ready'
            ? 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)'
            : 'linear-gradient(135deg, #555 0%, #444 100%)',
          color: 'white',
          border: 'none',
          borderRadius: '10px',
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(45, 90, 39, 0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
        }}
      >
        {preloadStatus === 'ready' ? (
          <>Ready to Play <PlayArrowIcon /></>
        ) : preloadStatus === 'loading' ? (
          <>Loading...</>
        ) : (
          <>Ready to Play <PlayArrowIcon /></>
        )}
      </button>


      {/* Mini Sound Library Modal */}
      {showSoundLibrary && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
          onClick={() => {
            // Stop any playing audio when closing
            if (libraryAudioRef.current) {
              libraryAudioRef.current.pause();
            }
            setLibraryPlayingClip(null);
            setShowSoundLibrary(false);
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '16px 20px',
              paddingTop: 'calc(16px + var(--safe-area-top, 0px))',
              borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'white' }}>
                🎧 Sound Library
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>
                {selectedSpecies.length} birds • Tap any clip to play
              </div>
            </div>
            <button
              onClick={() => {
                if (libraryAudioRef.current) {
                  libraryAudioRef.current.pause();
                }
                setLibraryPlayingClip(null);
                setShowSoundLibrary(false);
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: 'none',
                borderRadius: '50%',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: 'white',
                fontSize: '20px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Scrollable content */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 20px',
              paddingBottom: 'calc(16px + var(--safe-area-bottom, 0px))',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedSpecies.map((species) => {
              // Get all clips for this species
              const speciesClips = clips.filter(
                (c) => c.species_code === species.code && !c.rejected
              );
              // Sort: canonical first, then by vocalization type
              const sortedClips = [...speciesClips].sort((a, b) => {
                if (a.canonical && !b.canonical) return -1;
                if (!a.canonical && b.canonical) return 1;
                return (a.vocalization_type || '').localeCompare(b.vocalization_type || '');
              });

              return (
                <div
                  key={species.code}
                  style={{
                    marginBottom: '20px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    padding: '12px',
                  }}
                >
                  {/* Species header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <img
                      src={`${import.meta.env.BASE_URL}data/icons/${species.code}.png`}
                      alt={species.name}
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: `2px solid ${species.color}`,
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '15px', color: 'white' }}>
                        {species.name}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                        {species.code} • {sortedClips.length} clip{sortedClips.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Clips grid */}
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}>
                    {sortedClips.map((clip) => {
                      const isPlaying = libraryPlayingClip === clip.clip_id;
                      return (
                        <button
                          key={clip.clip_id}
                          onClick={() => {
                            if (isPlaying) {
                              // Stop playing
                              if (libraryAudioRef.current) {
                                libraryAudioRef.current.pause();
                              }
                              setLibraryPlayingClip(null);
                            } else {
                              // Start playing
                              if (libraryAudioRef.current) {
                                libraryAudioRef.current.pause();
                              }
                              const audio = new Audio(`${import.meta.env.BASE_URL}${clip.file_path}`);
                              libraryAudioRef.current = audio;
                              audio.onended = () => setLibraryPlayingClip(null);
                              audio.play().catch(console.error);
                              setLibraryPlayingClip(clip.clip_id);
                            }
                          }}
                          style={{
                            padding: '6px 12px',
                            background: isPlaying
                              ? 'rgba(76, 175, 80, 0.3)'
                              : clip.canonical
                                ? 'rgba(255, 152, 0, 0.2)'
                                : 'rgba(255, 255, 255, 0.1)',
                            border: isPlaying
                              ? '2px solid #4CAF50'
                              : clip.canonical
                                ? '1px solid rgba(255, 152, 0, 0.4)'
                                : '1px solid rgba(255, 255, 255, 0.2)',
                            borderRadius: '20px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            color: 'white',
                            fontSize: '12px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span style={{ fontSize: '14px' }}>
                            {isPlaying ? '⏹️' : '▶️'}
                          </span>
                          <span style={{ textTransform: 'capitalize' }}>
                            {clip.vocalization_type || 'clip'}
                          </span>
                          {clip.canonical && (
                            <span style={{ fontSize: '10px', opacity: 0.7 }}>⭐</span>
                          )}
                        </button>
                      );
                    })}
                    {sortedClips.length === 0 && (
                      <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                        No clips available
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pulse animation and tap highlight fix */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.1); opacity: 0.7; }
        }
        * {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
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

function ShuffleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 3h5v5" />
      <path d="M4 20L21 3" />
      <path d="M21 16v5h-5" />
      <path d="M15 15l6 6" />
      <path d="M4 4l5 5" />
    </svg>
  );
}

function PlayArrowIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function EyeIcon({ filled, color }: { filled: boolean; color?: string }) {
  const iconColor = color || (filled ? 'var(--color-accent)' : 'var(--color-text-muted)');
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconColor} strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" fill={filled ? iconColor : 'none'} />
    </svg>
  );
}

export default PreRoundPreview;
