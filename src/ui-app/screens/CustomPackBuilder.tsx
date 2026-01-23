import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackTaxonomicSortToggle, trackCustomPackCreate, trackCustomPackSave, trackCustomPackLoad, trackCustomPackDelete } from '../utils/analytics';

interface ClipData {
  clip_id: string;
  species_code: string;
  common_name: string;
  file_path: string;
  canonical?: boolean;
  rejected?: boolean;
}

interface SpeciesInfo {
  code: string;
  name: string;
  clipPath: string | null;
  scientificName?: string;
}

const MAX_SPECIES = 30;
const CUSTOM_PACK_KEY = 'soundfield_custom_pack';  // Legacy single pack

/**
 * Saved Packs System with Validation & Versioning
 *
 * PERSISTENCE: Packs persist across app updates via localStorage
 * VALIDATION: Species codes validated on load; invalid codes auto-removed
 * VERSIONING: Each pack has version field for future migrations
 * BACKWARD COMPATIBILITY: Legacy packs without version field auto-upgraded to v1
 */
const SAVED_PACKS_KEY = 'soundfield_saved_packs';
const MAX_SAVED_PACKS = 10;

interface SavedPack {
  id: string;
  name: string;
  species: string[];
  created: string;
  lastPlayed?: string;
  lastModified?: string;  // Track when pack was last edited
  version: number;  // For future migrations
}

// Colors for selected species (30 distinct colors)
const SPECIES_COLORS = [
  '#E57373', '#4FC3F7', '#81C784', '#FFD54F', '#BA68C8', '#FF8A65', '#4DB6AC', '#A1887F', '#90A4AE',
  '#F06292', '#64B5F6', '#AED581', '#FFB74D', '#9575CD', '#FF7043', '#4DD0E1', '#DCE775', '#C5A880',
  '#EF5350', '#42A5F5', '#66BB6A', '#FFA726', '#AB47BC', '#FF6F00', '#26C6DA', '#D4E157', '#8D6E63',
  '#EC407A', '#29B6F6', '#9CCC65',
];

function CustomPackBuilder() {
  const navigate = useNavigate();
  const [allSpecies, setAllSpecies] = useState<SpeciesInfo[]>([]);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingCode, setPlayingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const hasValidatedPacks = useRef(false);  // Track if we've already validated packs
  const [taxonomicSort, setTaxonomicSort] = useState(() => {
    try {
      return localStorage.getItem('soundfield_taxonomic_sort') === 'true';
    } catch {
      return false;
    }
  });
  const [taxonomicOrder, setTaxonomicOrder] = useState<Record<string, number>>({});
  const [savedPacks, setSavedPacks] = useState<SavedPack[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [packNameInput, setPackNameInput] = useState('');
  const [savedPacksExpanded, setSavedPacksExpanded] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [packToDelete, setPackToDelete] = useState<string | null>(null);
  const [loadedPackId, setLoadedPackId] = useState<string | null>(null);  // Track currently loaded pack
  const [loadedPackName, setLoadedPackName] = useState<string>('');  // Track loaded pack name
  const [showSaveBeforePlayDialog, setShowSaveBeforePlayDialog] = useState(false);  // Prompt to save before playing
  const [shouldPlayAfterSave, setShouldPlayAfterSave] = useState(false);  // Navigate to play after saving
  const [availablePacks, setAvailablePacks] = useState<Array<{ id: string; name: string; species: string[] }>>([]);
  const [selectedPackFilter, setSelectedPackFilter] = useState<string | null>(null);  // null = "All Birds"

  // Load all species from clips.json, taxonomic order, scientific names, and packs
  useEffect(() => {
    // Load pack definitions
    const packFiles = [
      'starter_birds',
      'expanded_backyard',
      'sparrows',
      'woodpeckers',
      'spring_warblers',
      'western_birds',
    ];

    const packPromises = packFiles.map(packId =>
      fetch(`${import.meta.env.BASE_URL}data/packs/${packId}.json`)
        .then(r => r.json())
        .catch(err => {
          console.error(`Failed to load pack ${packId}:`, err);
          return null;
        })
    );

    Promise.all([
      fetch(`${import.meta.env.BASE_URL}data/clips.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/taxonomic_order.json`).then(r => r.json()),
      fetch(`${import.meta.env.BASE_URL}data/species.json`).then(r => r.json()),
      Promise.all(packPromises),
    ])
      .then(([clips, taxonomicData, speciesData, packsData]: [ClipData[], Record<string, number>, Array<{species_code: string; common_name: string; scientific_name: string}>, any[]]) => {
        // Build available packs list
        const packs = packsData
          .filter(p => p !== null)
          .map(p => ({
            id: p.pack_id,
            name: p.display_name,
            species: p.species,
          }));
        setAvailablePacks(packs);

        // Build species metadata lookup
        const sciNames: Record<string, string> = {};
        const comNames: Record<string, string> = {};
        for (const sp of speciesData) {
          sciNames[sp.species_code] = sp.scientific_name;
          comNames[sp.species_code] = sp.common_name;
        }

        // Extract unique species
        const speciesMap = new Map<string, SpeciesInfo>();
        for (const clip of clips) {
          if (clip.rejected) continue;
          if (!speciesMap.has(clip.species_code)) {
            const canonicalClip = clips.find(
              c => c.species_code === clip.species_code && c.canonical && !c.rejected
            );
            const clipToUse = canonicalClip || clips.find(
              c => c.species_code === clip.species_code && !c.rejected
            ) || clip;

            // Get common name from species.json (single source of truth)
            const commonName = comNames[clip.species_code];
            if (!commonName) {
              console.warn(`Skipping ${clip.species_code} - not found in species.json`);
              continue;
            }

            speciesMap.set(clip.species_code, {
              code: clip.species_code,
              name: commonName,
              clipPath: `${import.meta.env.BASE_URL}data/clips/${clipToUse.file_path.split('/').pop()}`,
              scientificName: sciNames[clip.species_code],
            });
          }
        }
        // Sort alphabetically by name initially
        const sorted = Array.from(speciesMap.values()).sort((a, b) =>
          (a.name || a.code).localeCompare(b.name || b.code)
        );
        setAllSpecies(sorted);
        setTaxonomicOrder(taxonomicData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load data:', err);
        setLoading(false);
      });

    // Check if the last pack was temporary (user clicked "Just Play" without saving)
    // If so, clear it to provide a clean slate
    try {
      const wasTemporary = sessionStorage.getItem('customPackWasTemporary');
      if (wasTemporary === 'true') {
        // Clear the temporary flag
        sessionStorage.removeItem('customPackWasTemporary');
        // Clear the temporary pack from localStorage
        localStorage.removeItem(CUSTOM_PACK_KEY);
        console.log('Cleared temporary custom pack after play session');
      } else {
        // Load saved custom pack (legacy single pack) - only if it wasn't temporary
        const saved = localStorage.getItem(CUSTOM_PACK_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSelectedCodes(parsed);
          }
        }
      }
    } catch (e) {
      console.error('Failed to load saved pack:', e);
    }

    // Load saved packs library
    try {
      const saved = localStorage.getItem(SAVED_PACKS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setSavedPacks(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to load saved packs:', e);
    }
  }, []);

  // Validate saved packs after species data loads (runs only once)
  useEffect(() => {
    if (allSpecies.length === 0 || savedPacks.length === 0 || hasValidatedPacks.current) return;

    hasValidatedPacks.current = true;  // Mark as validated

    const validCodes = new Set(allSpecies.map(s => s.code));
    let anyPacksModified = false;

    const validatedPacks = savedPacks.map(pack => {
      // Add version field to legacy packs (backward compatibility)
      if (!pack.version) {
        pack.version = 1;
        anyPacksModified = true;
      }

      // Validate species codes
      const validSpecies = pack.species.filter(code => validCodes.has(code));

      if (validSpecies.length !== pack.species.length) {
        anyPacksModified = true;
        return { ...pack, species: validSpecies };
      }

      return pack;
    });

    // Update localStorage if any packs were modified
    if (anyPacksModified) {
      setSavedPacks(validatedPacks);
      try {
        localStorage.setItem(SAVED_PACKS_KEY, JSON.stringify(validatedPacks));
        console.log('Auto-cleaned saved packs: removed invalid species codes');
      } catch (e) {
        console.error('Failed to auto-clean saved packs:', e);
      }
    }
  }, [allSpecies, savedPacks]);

  // Toggle species selection
  const toggleSpecies = useCallback((code: string, filteredCount: number) => {
    setSelectedCodes((prev) => {
      const isCurrentlySelected = prev.includes(code);
      const isAtMax = prev.length >= MAX_SPECIES;

      if (isCurrentlySelected) {
        // Removing a bird - just remove it
        return prev.filter((c) => c !== code);
      }

      if (isAtMax) {
        // Can't add - at max
        return prev;
      }

      // Adding a new bird
      // Only clear search if there was exactly one match (single-select scenario)
      // Keep search active if multiple matches (allows selecting multiple from filtered list)
      if (filteredCount === 1) {
        setSearchQuery('');
      }

      // Always refocus input for next entry
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 0);

      return [...prev, code];
    });
  }, []);

  // Play preview sound
  const playPreview = (species: SpeciesInfo, e: React.MouseEvent) => {
    e.stopPropagation();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (playingCode === species.code) {
      setPlayingCode(null);
      return;
    }

    if (!species.clipPath) return;

    const audio = new Audio(species.clipPath);
    audioRef.current = audio;
    setPlayingCode(species.code);

    audio.play().catch((err) => console.error('Failed to play:', err));
    audio.onended = () => {
      setPlayingCode(null);
      audioRef.current = null;
    };
  };

  // Save and go to level select
  const handleSaveAndPlay = () => {
    if (selectedCodes.length === 0) return;

    // Check if this pack is unsaved (not in saved packs list)
    const isUnsaved = !loadedPackId || !savedPacks.some(p => p.id === loadedPackId);

    if (isUnsaved) {
      // Show prompt to save before playing
      setShowSaveBeforePlayDialog(true);
    } else {
      // Pack is already saved, just play
      handleJustPlay();
    }
  };

  // Play without saving (marks pack as temporary)
  const handleJustPlay = () => {
    // Save to localStorage for this session
    localStorage.setItem(CUSTOM_PACK_KEY, JSON.stringify(selectedCodes));

    // Mark as temporary so it gets cleared on return
    sessionStorage.setItem('customPackWasTemporary', 'true');

    // Track custom pack creation
    trackCustomPackCreate(selectedCodes.length);

    // Navigate to level select for custom pack
    navigate('/level-select?pack=custom');
  };

  // Save pack and then play
  const handleSaveAndThenPlay = () => {
    setShowSaveBeforePlayDialog(false);
    setShouldPlayAfterSave(true);  // Flag to navigate after save completes
    setShowSaveDialog(true);  // Open save dialog
  };

  // Clear selection
  const handleClear = () => {
    setSelectedCodes([]);
    setLoadedPackId(null);  // Clear loaded pack state
    setLoadedPackName('');
    // Clear the persisted custom pack from localStorage
    try {
      localStorage.removeItem(CUSTOM_PACK_KEY);
    } catch (e) {
      console.error('Failed to clear custom pack from localStorage:', e);
    }
  };

  // Clear search and refocus
  const handleClearSearch = () => {
    setSearchQuery('');
    // Focus the input after clearing
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
  };

  // Toggle taxonomic sort
  const handleTaxonomicSortToggle = () => {
    const newValue = !taxonomicSort;
    setTaxonomicSort(newValue);
    try {
      localStorage.setItem('soundfield_taxonomic_sort', String(newValue));
      trackTaxonomicSortToggle(newValue, 'custom_pack_builder');
    } catch (e) {
      console.error('Failed to save taxonomic sort:', e);
    }
  };

  // Save current pack with a name
  const handleSavePack = () => {
    if (selectedCodes.length === 0) {
      alert('Please select at least one bird before saving.');
      return;
    }

    // Check if we're at max packs (only matters if saving as new)
    if (savedPacks.length >= MAX_SAVED_PACKS && !loadedPackId) {
      alert(`You can only save up to ${MAX_SAVED_PACKS} packs. Please delete one first.`);
      return;
    }

    // Pre-populate the name if editing an existing pack
    if (loadedPackId && loadedPackName) {
      setPackNameInput(loadedPackName);
    }

    setShowSaveDialog(true);
  };

  const confirmSavePack = (saveAsNew: boolean = false) => {
    const trimmedName = packNameInput.trim();
    if (!trimmedName) {
      alert('Please enter a name for your pack.');
      return;
    }

    // If we're updating an existing pack (and not explicitly saving as new)
    if (loadedPackId && !saveAsNew) {
      // Update the existing pack (with potentially new name and/or species)
      const updatedPacks = savedPacks.map(p => {
        if (p.id === loadedPackId) {
          return {
            ...p,
            name: trimmedName,  // Allow name to be updated
            species: [...selectedCodes],
            lastModified: new Date().toISOString(),
          };
        }
        return p;
      });

      setSavedPacks(updatedPacks);
      try {
        localStorage.setItem(SAVED_PACKS_KEY, JSON.stringify(updatedPacks));
        trackCustomPackSave(trimmedName, selectedCodes.length);
      } catch (e) {
        console.error('Failed to update pack:', e);
        alert('Failed to update pack. Storage may be full.');
      }

      // Update the loaded pack name
      setLoadedPackName(trimmedName);
    } else {
      // Save as new pack
      // Check if we're at max packs when saving as new
      if (savedPacks.length >= MAX_SAVED_PACKS) {
        alert(`You can only save up to ${MAX_SAVED_PACKS} packs. Please delete one first.`);
        return;
      }

      const newPack: SavedPack = {
        id: Date.now().toString(),
        name: trimmedName,
        species: [...selectedCodes],
        created: new Date().toISOString(),
        version: 1,
      };

      const updated = [...savedPacks, newPack];
      setSavedPacks(updated);
      try {
        localStorage.setItem(SAVED_PACKS_KEY, JSON.stringify(updated));
        trackCustomPackSave(trimmedName, selectedCodes.length);
      } catch (e) {
        console.error('Failed to save pack:', e);
        alert('Failed to save pack. Storage may be full.');
      }

      // Track this as the loaded pack for future edits
      setLoadedPackId(newPack.id);
      setLoadedPackName(newPack.name);
    }

    setShowSaveDialog(false);
    setPackNameInput('');

    // If user chose "Save & Play", navigate to level select
    if (shouldPlayAfterSave) {
      setShouldPlayAfterSave(false);
      // Save to localStorage for the game session
      localStorage.setItem(CUSTOM_PACK_KEY, JSON.stringify(selectedCodes));
      // DON'T mark as temporary - it's been saved
      // Track and navigate
      trackCustomPackCreate(selectedCodes.length);
      navigate('/level-select?pack=custom');
    }
  };

  // Load a saved pack with validation
  const handleLoadPack = (pack: SavedPack) => {
    // Validate species codes against available species
    const validCodes = new Set(allSpecies.map(s => s.code));
    const validSpecies = pack.species.filter(code => validCodes.has(code));
    const removedCount = pack.species.length - validSpecies.length;

    // If species were removed, show warning and update the pack
    if (removedCount > 0) {
      alert(
        `⚠️ ${removedCount} bird${removedCount > 1 ? 's' : ''} in "${pack.name}" ${removedCount > 1 ? 'are' : 'is'} no longer available and ${removedCount > 1 ? 'were' : 'was'} removed.\n\n` +
        `This can happen when bird names are updated to match the latest taxonomy.`
      );

      // Update the pack in localStorage
      const updatedPack = { ...pack, species: validSpecies };
      const updatedPacks = savedPacks.map(p => p.id === pack.id ? updatedPack : p);
      setSavedPacks(updatedPacks);
      try {
        localStorage.setItem(SAVED_PACKS_KEY, JSON.stringify(updatedPacks));
      } catch (e) {
        console.error('Failed to update pack:', e);
      }
    }

    setSelectedCodes(validSpecies);
    setSearchQuery('');
    setLoadedPackId(pack.id);  // Track which pack is loaded
    setLoadedPackName(pack.name);  // Track pack name
    trackCustomPackLoad(pack.name, validSpecies.length);
  };

  // Delete a saved pack - show confirmation dialog
  const handleDeletePack = (packId: string) => {
    setPackToDelete(packId);
    setShowDeleteDialog(true);
  };

  // Confirm deletion
  const confirmDeletePack = () => {
    if (!packToDelete) return;

    const packName = savedPacks.find(p => p.id === packToDelete)?.name || 'unknown';
    const updated = savedPacks.filter(p => p.id !== packToDelete);
    setSavedPacks(updated);
    try {
      localStorage.setItem(SAVED_PACKS_KEY, JSON.stringify(updated));
      trackCustomPackDelete(packName);
    } catch (e) {
      console.error('Failed to update saved packs:', e);
    }

    setShowDeleteDialog(false);
    setPackToDelete(null);
  };

  // Filter and sort species
  const filteredSpecies = (() => {
    let filtered = allSpecies;

    // First filter by pack (if selected)
    if (selectedPackFilter) {
      const pack = availablePacks.find(p => p.id === selectedPackFilter);
      if (pack) {
        const packSpeciesSet = new Set(pack.species);
        filtered = filtered.filter(s => packSpeciesSet.has(s.code));
      }
    }

    // Then filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.scientificName && s.scientificName.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Then sort based on taxonomic toggle
    if (taxonomicSort && Object.keys(taxonomicOrder).length > 0) {
      return [...filtered].sort((a, b) => {
        const orderA = taxonomicOrder[a.code] || 9999;
        const orderB = taxonomicOrder[b.code] || 9999;
        return orderA - orderB;
      });
    }

    return filtered;
  })();

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
        <div style={{ color: 'var(--color-text-muted)' }}>Loading species...</div>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ flexShrink: 0, marginBottom: '12px' }}>
        <div className="flex-row items-center gap-md">
          <button className="btn-icon" onClick={() => navigate('/pack-select')} aria-label="Back" style={{ color: 'var(--color-accent)' }}>
            <BackIcon />
          </button>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Custom Pack Builder</h2>
            <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {loadedPackId ? (
                <span>
                  Editing: <strong style={{ color: 'var(--color-accent)' }}>{loadedPackName}</strong>
                </span>
              ) : (
                `Select up to ${MAX_SPECIES} birds`
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Saved Packs Library - Collapsible */}
      {savedPacks.length > 0 && (
        <div style={{
          flexShrink: 0,
          marginBottom: '8px',
          padding: '8px 12px',
          background: 'var(--color-surface)',
          borderRadius: '8px',
        }}>
          <button
            onClick={() => setSavedPacksExpanded(!savedPacksExpanded)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'none',
              border: 'none',
              color: 'var(--color-text)',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600 }}>
              📁 My Saved Packs ({savedPacks.length}/{MAX_SAVED_PACKS})
            </span>
            <span style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
              {savedPacksExpanded ? '▲' : '▼'}
            </span>
          </button>
          {savedPacksExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
              {savedPacks.map((pack) => (
                <div
                  key={pack.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    background: 'rgba(100, 181, 246, 0.05)',
                    borderRadius: '6px',
                    border: '1px solid rgba(100, 181, 246, 0.2)',
                    position: 'relative',
                  }}
                >
                  <button
                    onClick={() => {
                      handleLoadPack(pack);
                      setSavedPacksExpanded(false);
                    }}
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-text)',
                      fontSize: '12px',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{pack.name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      {pack.species.length} bird{pack.species.length > 1 ? 's' : ''}
                    </div>
                  </button>
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      console.log('Delete button pressed!', pack.id);
                      // Use setTimeout to ensure UI updates before confirm dialog
                      setTimeout(() => {
                        handleDeletePack(pack.id);
                      }, 0);
                    }}
                    style={{
                      background: 'rgba(229, 115, 115, 0.1)',
                      border: '1px solid rgba(229, 115, 115, 0.3)',
                      borderRadius: '4px',
                      padding: '8px 12px',
                      fontSize: '11px',
                      color: 'var(--color-error)',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      position: 'relative',
                      zIndex: 100,
                      WebkitTapHighlightColor: 'rgba(229, 115, 115, 0.3)',
                      touchAction: 'manipulation',
                      WebkitUserSelect: 'none',
                      userSelect: 'none',
                      minWidth: '60px',
                      minHeight: '32px',
                    }}
                    aria-label={`Delete ${pack.name}`}
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pack Filter Chips */}
      {availablePacks.length > 0 && (
        <div style={{
          flexShrink: 0,
          marginBottom: '8px',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
        }}>
          <button
            onClick={() => setSelectedPackFilter(null)}
            style={{
              padding: '6px 12px',
              background: selectedPackFilter === null ? 'rgba(255, 152, 0, 0.2)' : 'var(--color-surface)',
              border: selectedPackFilter === null ? '2px solid var(--color-accent)' : '1px solid var(--color-text-muted)',
              borderRadius: '16px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: selectedPackFilter === null ? 600 : 400,
              color: selectedPackFilter === null ? 'var(--color-accent)' : 'var(--color-text)',
              whiteSpace: 'nowrap',
            }}
          >
            All
          </button>
          {availablePacks.map(pack => {
            // Simplify pack names for chips
            const shortName = pack.name
              .replace('Backyard Birds', 'Backyard')
              .replace('Grassland & Open Country', 'Grassland')
              .replace('Eastern Birds', 'Eastern')
              .replace('Western Birds', 'Western')
              .replace('Warbler Academy', 'Warblers');

            return (
              <button
                key={pack.id}
                onClick={() => setSelectedPackFilter(pack.id)}
                style={{
                  padding: '6px 12px',
                  background: selectedPackFilter === pack.id ? 'rgba(255, 152, 0, 0.2)' : 'var(--color-surface)',
                  border: selectedPackFilter === pack.id ? '2px solid var(--color-accent)' : '1px solid var(--color-text-muted)',
                  borderRadius: '16px',
                  cursor: 'pointer',
                  fontSize: '12px',
                  fontWeight: selectedPackFilter === pack.id ? 600 : 400,
                  color: selectedPackFilter === pack.id ? 'var(--color-accent)' : 'var(--color-text)',
                  whiteSpace: 'nowrap',
                }}
              >
                {shortName}
              </button>
            );
          })}
        </div>
      )}

      {/* Search and Sort Controls */}
      <div style={{ flexShrink: 0, marginBottom: '12px', display: 'flex', gap: '8px' }}>
        {/* Search box */}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search birds..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
              paddingRight: searchQuery ? '36px' : '12px',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-text-muted)',
              borderRadius: '8px',
              color: 'var(--color-text)',
              fontSize: '14px',
            }}
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--color-text-muted)',
                border: 'none',
                borderRadius: '50%',
                width: '20px',
                height: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
              }}
              aria-label="Clear search"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-background)" strokeWidth="3">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Taxonomic sort toggle */}
        <button
          onClick={handleTaxonomicSortToggle}
          style={{
            padding: '10px 14px',
            background: taxonomicSort ? 'rgba(100, 181, 246, 0.15)' : 'var(--color-surface)',
            border: taxonomicSort ? '1px solid #64B5F6' : '1px solid var(--color-text-muted)',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '13px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
          aria-label="Toggle taxonomic sort"
        >
          <span>{taxonomicSort ? '📊' : '🔤'}</span>
          <span>{taxonomicSort ? 'Taxonomic 🐦🤓' : 'Sort'}</span>
        </button>
      </div>

      {/* Instruction hint - More compact */}
      <div style={{
        flexShrink: 0,
        marginBottom: '8px',
        padding: '6px 10px',
        background: 'rgba(45, 90, 39, 0.1)',
        borderRadius: '8px',
        fontSize: '12px',
        color: 'var(--color-text-muted)',
        lineHeight: 1.3,
      }}>
        <span style={{ color: 'var(--color-accent)' }}>💡</span> Tap <strong style={{ color: 'var(--color-text)' }}>▶</strong> to preview, <strong style={{ color: 'var(--color-text)' }}>anywhere else on the card</strong> to add/remove.
        {taxonomicSort && (
          <> <span style={{ color: 'var(--color-accent)' }}>🐦🤓</span> Taxonomic mode groups related species together.</>
        )}
      </div>

      {/* Selected count */}
      <div style={{
        flexShrink: 0,
        marginBottom: '12px',
        padding: '8px 12px',
        background: selectedCodes.length > 0 ? 'rgba(45, 90, 39, 0.2)' : 'var(--color-surface)',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontSize: '14px' }}>
          <span style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{selectedCodes.length}</span>/{MAX_SPECIES} selected
        </span>
        {selectedCodes.length > 0 && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleSavePack}
              style={{
                background: 'rgba(45, 90, 39, 0.2)',
                border: '1px solid var(--color-primary)',
                borderRadius: '6px',
                padding: '4px 10px',
                color: 'white',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {loadedPackId ? '💾 Update / Save As New' : '💾 Save Pack'}
            </button>
            <button
              onClick={handleClear}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-text-muted)',
                fontSize: '12px',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      {/* Species grid */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: selectedCodes.length > 0 ? '80px' : '12px', // Space for sticky button
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
          gap: '6px',
        }}>
          {filteredSpecies.map((species) => {
            const isSelected = selectedCodes.includes(species.code);
            const selectionIndex = selectedCodes.indexOf(species.code);
            const color = isSelected ? SPECIES_COLORS[selectionIndex % SPECIES_COLORS.length] : undefined;

            return (
              <div
                key={species.code}
                onClick={() => toggleSpecies(species.code, filteredSpecies.length)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  padding: '6px',
                  background: isSelected ? `${color}22` : 'var(--color-surface)',
                  border: isSelected ? `2px solid ${color}` : '1px solid transparent',
                  borderRadius: '10px',
                  opacity: isSelected || selectedCodes.length < MAX_SPECIES ? 1 : 0.5,
                  transition: 'all 0.15s',
                  cursor: isSelected || selectedCodes.length < MAX_SPECIES ? 'pointer' : 'not-allowed',
                }}
              >
                {/* Top row: Play button (left) and Bird icon (right) */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                }}>
                  {/* Play button - left side */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(species, e);
                    }}
                    style={{
                      flex: '0 0 36px',
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: playingCode === species.code
                        ? 'rgba(255, 152, 0, 0.3)'
                        : 'rgba(255, 152, 0, 0.1)',
                      border: `2px solid ${playingCode === species.code ? 'var(--color-accent)' : 'rgba(255, 152, 0, 0.3)'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      padding: 0,
                    }}
                    aria-label={`Preview ${species.name}`}
                  >
                    {playingCode === species.code ? (
                      <StopIcon color="var(--color-accent)" />
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--color-accent)">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    )}
                  </button>

                  {/* Bird icon - right side */}
                  <div
                    style={{
                      flex: '1',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px',
                      position: 'relative',
                      pointerEvents: 'none', // Let clicks pass through to parent card
                    }}
                  >
                    <BirdIcon code={species.code} size={40} />

                    {/* Selection checkmark */}
                    {isSelected && (
                      <div style={{
                        position: 'absolute',
                        top: '0',
                        right: '0',
                        width: '20px',
                        height: '20px',
                        borderRadius: '50%',
                        background: color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <CheckIcon />
                      </div>
                    )}
                  </div>
                </div>

                {/* Species info */}
                <div style={{ width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
                  <div style={{
                    fontSize: '11px',
                    color: '#ffffff',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontWeight: 500,
                    fontStyle: taxonomicSort && species.scientificName ? 'italic' : 'normal',
                  }}>
                    {taxonomicSort && species.scientificName ? species.scientificName : species.name}
                  </div>
                  <div style={{
                    fontSize: '10px',
                    color: 'rgba(255, 255, 255, 0.7)',
                    marginTop: '2px',
                    fontWeight: 600,
                  }}>
                    {species.code}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Start Button */}
      {selectedCodes.length > 0 && (
        <button
          onClick={handleSaveAndPlay}
          style={{
            position: 'fixed',
            bottom: 'calc(24px + var(--safe-area-bottom, 0px))',
            left: '24px',
            right: '24px',
            padding: '14px 20px',
            fontSize: '16px',
            fontWeight: 700,
            background: 'linear-gradient(135deg, var(--color-primary) 0%, #3a7332 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(45, 90, 39, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            zIndex: 1000,
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          Start with {selectedCodes.length} bird{selectedCodes.length > 1 ? 's' : ''}
        </button>
      )}

      {/* Save Pack Dialog */}
      {showSaveDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
        }}
        onClick={() => setShowSaveDialog(false)}
        >
          <div
            style={{
              background: 'var(--color-background)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid var(--color-primary)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>
              {loadedPackId ? 'Update or Rename Pack' : 'Save Custom Pack'}
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              {loadedPackId
                ? 'Edit the name or species list. You can update this pack or save as a new one:'
                : 'Give your pack a name so you can load it later:'}
            </p>
            <input
              type="text"
              value={packNameInput}
              onChange={(e) => setPackNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmSavePack(false)}
              placeholder="e.g., My Backyard, Lake Erie Migrants..."
              autoFocus
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--color-surface)',
                border: '1px solid var(--color-text-muted)',
                borderRadius: '8px',
                color: 'var(--color-text)',
                fontSize: '14px',
                marginBottom: '16px',
              }}
            />
            {loadedPackId ? (
              // When editing existing pack, show both Update and Save As New options
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={() => confirmSavePack(false)}
                  style={{
                    padding: '12px 20px',
                    background: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💾 Update "{loadedPackName}"
                </button>
                <button
                  onClick={() => confirmSavePack(true)}
                  style={{
                    padding: '12px 20px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-text-muted)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Save As New Pack
                </button>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPackNameInput('');
                  }}
                  style={{
                    padding: '8px 20px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--color-text-muted)',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              // When creating new pack, show standard save/cancel
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  onClick={() => {
                    setShowSaveDialog(false);
                    setPackNameInput('');
                  }}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--color-surface)',
                    border: '1px solid var(--color-text-muted)',
                    borderRadius: '8px',
                    color: 'var(--color-text)',
                    fontSize: '14px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmSavePack(false)}
                  style={{
                    padding: '10px 20px',
                    background: 'var(--color-primary)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  💾 Save Pack
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Save Before Play Dialog */}
      {showSaveBeforePlayDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
        }}
        onClick={() => setShowSaveBeforePlayDialog(false)}
        >
          <div
            style={{
              background: 'var(--color-background)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid var(--color-accent)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px' }}>Save this pack?</h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '20px', lineHeight: 1.5 }}>
              Would you like to save this pack before playing? If you save it, you can easily reload and edit it later.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleSaveAndThenPlay}
                style={{
                  padding: '12px 20px',
                  background: 'var(--color-primary)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                💾 Save & Play
              </button>
              <button
                onClick={() => {
                  setShowSaveBeforePlayDialog(false);
                  handleJustPlay();
                }}
                style={{
                  padding: '12px 20px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-text-muted)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Just Play (Don't Save)
              </button>
              <button
                onClick={() => setShowSaveBeforePlayDialog(false)}
                style={{
                  padding: '12px 20px',
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-text-muted)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Pack Confirmation Dialog */}
      {showDeleteDialog && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px',
        }}
        onClick={() => {
          setShowDeleteDialog(false);
          setPackToDelete(null);
        }}
        >
          <div
            style={{
              background: 'var(--color-background)',
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '400px',
              width: '100%',
              border: '2px solid var(--color-error)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', color: 'var(--color-error)' }}>
              Delete Saved Pack?
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--color-text-muted)', marginBottom: '16px' }}>
              This will permanently delete "{savedPacks.find(p => p.id === packToDelete)?.name}". This action cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowDeleteDialog(false);
                  setPackToDelete(null);
                }}
                style={{
                  padding: '10px 20px',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-text-muted)',
                  borderRadius: '8px',
                  color: 'var(--color-text)',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeletePack}
                style={{
                  padding: '10px 20px',
                  background: 'var(--color-error)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Delete Pack
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function BirdIcon({ code, size = 48 }: { code: string; size?: number }) {
  const [hasIcon, setHasIcon] = useState(true);
  const iconPath = `${import.meta.env.BASE_URL}data/icons/${code}.png`;

  if (!hasIcon) {
    // Fallback to simple circle with code
    return (
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--color-text-muted)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '11px',
        fontWeight: 700,
        color: '#FFFFFF',
      }}>
        {code}
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
      }}
      onError={() => setHasIcon(false)}
    />
  );
}

function BackIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

function StopIcon({ color = 'currentColor' }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill={color}>
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="3">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

export default CustomPackBuilder;
