/**
 * useNZSortMode - React hook for managing NZ bird sort mode (3-way toggle)
 *
 * Sort modes:
 * - 'english': Sort by English name, display English name on top
 * - 'maori': Sort by Maori name, display Maori name on top (default)
 * - 'taxonomic': Sort by eBird taxonomic order, display Maori name + scientific name
 */

import { useState, useCallback } from 'react';
import { trackEvent } from '../utils/analytics';

export type NZSortMode = 'english' | 'maori' | 'taxonomic';

const STORAGE_KEY = 'soundfield_nz_sort_mode';
const DEFAULT_MODE: NZSortMode = 'maori';

/**
 * Hook to manage NZ bird sort mode with localStorage persistence
 *
 * @returns [currentMode, setMode] tuple
 */
export function useNZSortMode(): [NZSortMode, (mode: NZSortMode) => void] {
  const [mode, setModeState] = useState<NZSortMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'english' || stored === 'maori' || stored === 'taxonomic') {
        return stored;
      }
    } catch {
      // localStorage not available
    }
    return DEFAULT_MODE;
  });

  // Persist changes to localStorage
  const setMode = useCallback((newMode: NZSortMode) => {
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
      // Track analytics
      trackEvent('nz_sort_mode_change', {
        mode: newMode,
        location: 'nz_pack',
      });
    } catch (e) {
      console.error('Failed to save NZ sort mode:', e);
    }
  }, []);

  return [mode, setMode];
}

/**
 * Get sort mode synchronously (for non-hook contexts)
 */
export function getNZSortMode(): NZSortMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'english' || stored === 'maori' || stored === 'taxonomic') {
      return stored;
    }
  } catch {
    // localStorage not available
  }
  return DEFAULT_MODE;
}

/**
 * Cycle to the next sort mode (for simple toggle behavior)
 */
export function getNextSortMode(current: NZSortMode): NZSortMode {
  switch (current) {
    case 'maori':
      return 'english';
    case 'english':
      return 'taxonomic';
    case 'taxonomic':
      return 'maori';
    default:
      return 'maori';
  }
}

/**
 * Get display names for a species based on sort mode
 *
 * @param mode Current sort mode
 * @param maoriName Maori name (tileName)
 * @param englishName English common name
 * @param scientificName Scientific name
 * @returns { primary: string, secondary: string | null }
 */
export function getSortModeDisplayNames(
  mode: NZSortMode,
  maoriName: string,
  englishName: string,
  scientificName?: string
): { primary: string; secondary: string | null } {
  switch (mode) {
    case 'english':
      return {
        primary: englishName,
        secondary: maoriName !== englishName ? maoriName : null,
      };
    case 'maori':
      return {
        primary: maoriName,
        secondary: maoriName !== englishName ? englishName : null,
      };
    case 'taxonomic':
      return {
        primary: maoriName,
        secondary: scientificName || null,
      };
    default:
      return {
        primary: maoriName,
        secondary: englishName !== maoriName ? englishName : null,
      };
  }
}

/**
 * Get the sort key for a species based on sort mode
 */
export function getSortKey(
  mode: NZSortMode,
  maoriName: string,
  englishName: string,
  taxonomicOrder?: number
): string | number {
  switch (mode) {
    case 'english':
      return englishName.toLowerCase();
    case 'maori':
      return maoriName.toLowerCase();
    case 'taxonomic':
      return taxonomicOrder ?? 9999;
    default:
      return maoriName.toLowerCase();
  }
}

export default useNZSortMode;
