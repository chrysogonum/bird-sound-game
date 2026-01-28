import { useState, useEffect } from 'react';
import { trackEvent } from '../utils/analytics';

/**
 * NA (North American) display mode for bird names during gameplay.
 * - 'code': Show 4-letter codes (NOCA, BLJA, etc.)
 * - 'name': Show common names (Northern Cardinal, Blue Jay, etc.)
 *
 * Note: This only affects display, not sort order. Sort is always by 4-letter code
 * (alphabetically) or taxonomic order.
 */
export type NADisplayMode = 'code' | 'name';

const STORAGE_KEY = 'soundfield_na_display_mode';

export function useNADisplayMode(): [NADisplayMode, (mode: NADisplayMode) => void] {
  const [displayMode, setDisplayMode] = useState<NADisplayMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'code' || saved === 'name') {
      return saved;
    }
    return 'code'; // Default to 4-letter codes (existing behavior)
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, displayMode);
  }, [displayMode]);

  const setMode = (mode: NADisplayMode) => {
    setDisplayMode(mode);
    trackEvent('na_display_mode_change', {
      mode,
      location: 'na_pack',
    });
  };

  return [displayMode, setMode];
}

/**
 * Get the display name for a species based on the current NA display mode.
 */
export function getNADisplayName(
  code: string,
  commonName: string,
  displayMode: NADisplayMode
): string {
  return displayMode === 'name' ? commonName : code;
}
