/**
 * NZ Subspecies Merge Utility
 *
 * Handles the merging of NZ subspecies pairs into single gameplay species.
 * For example, nezrob2 (NI Robin) and nezrob3 (SI Robin) are treated as "Toutouwai".
 */

export interface MergeInfo {
  maori_name: string;
  english_name: string;
  scientific_name: string;
  display_code: string;
  subspecies: string[];
  region_labels: Record<string, string>;
  icon: string;
}

export interface MergeConfig {
  description: string;
  merges: Record<string, MergeInfo>;
}

// Cache for loaded config
let cachedConfig: MergeConfig | null = null;
let loadingPromise: Promise<MergeConfig> | null = null;

/**
 * Load the merge configuration from nz_subspecies_merge.json
 */
export async function loadMergeConfig(): Promise<MergeConfig> {
  if (cachedConfig) return cachedConfig;

  if (loadingPromise) return loadingPromise;

  loadingPromise = fetch(`${import.meta.env.BASE_URL}data/nz_subspecies_merge.json`)
    .then(res => res.json())
    .then((config: MergeConfig) => {
      cachedConfig = config;
      return config;
    })
    .catch(err => {
      console.error('Failed to load NZ subspecies merge config:', err);
      // Return empty config on error
      cachedConfig = { description: '', merges: {} };
      return cachedConfig;
    });

  return loadingPromise;
}

/**
 * Get the merged config synchronously (returns null if not loaded yet)
 */
export function getMergeConfigSync(): MergeConfig | null {
  return cachedConfig;
}

/**
 * Get the display species ID for a subspecies code.
 * Returns the merged species ID if this code is part of a merge, otherwise returns the code itself.
 *
 * @param code The eBird species code (e.g., "nezrob2")
 * @returns The merged species ID (e.g., "toutouwai") or the original code
 */
export function getDisplaySpecies(code: string): string {
  if (!cachedConfig) return code;

  for (const [mergeId, info] of Object.entries(cachedConfig.merges)) {
    if (info.subspecies.includes(code)) {
      return mergeId;
    }
  }

  return code;
}

/**
 * Get all subspecies codes for a merged species.
 *
 * @param displaySpecies The merged species ID (e.g., "toutouwai")
 * @returns Array of subspecies codes, or [displaySpecies] if not a merged species
 */
export function getSubspeciesCodes(displaySpecies: string): string[] {
  if (!cachedConfig) return [displaySpecies];

  const mergeInfo = cachedConfig.merges[displaySpecies];
  if (mergeInfo) {
    return mergeInfo.subspecies;
  }

  return [displaySpecies];
}

/**
 * Get the region label for a subspecies code.
 *
 * @param code The eBird species code (e.g., "nezrob2")
 * @returns Region label (e.g., "NI", "SI", "Ch") or empty string
 */
export function getRegionLabel(code: string): string {
  if (!cachedConfig) return '';

  for (const info of Object.values(cachedConfig.merges)) {
    if (info.subspecies.includes(code)) {
      return info.region_labels[code] || '';
    }
  }

  return '';
}

/**
 * Get full merge info for a merged species.
 *
 * @param displaySpecies The merged species ID (e.g., "toutouwai")
 * @returns MergeInfo or null if not a merged species
 */
export function getMergeInfo(displaySpecies: string): MergeInfo | null {
  if (!cachedConfig) return null;

  return cachedConfig.merges[displaySpecies] || null;
}

/**
 * Get full merge info by subspecies code.
 *
 * @param code The eBird species code (e.g., "nezrob2")
 * @returns MergeInfo or null if not a merged species
 */
export function getMergeInfoByCode(code: string): MergeInfo | null {
  if (!cachedConfig) return null;

  for (const info of Object.values(cachedConfig.merges)) {
    if (info.subspecies.includes(code)) {
      return info;
    }
  }

  return null;
}

/**
 * Get the icon code for a merged species.
 * Returns the designated icon subspecies code for use in icon paths.
 *
 * @param displaySpecies The merged species ID or subspecies code
 * @returns The icon code (e.g., "nezrob2" for Toutouwai)
 */
export function getIconCode(displaySpecies: string): string {
  if (!cachedConfig) return displaySpecies;

  // Check if it's a merge ID
  const mergeInfo = cachedConfig.merges[displaySpecies];
  if (mergeInfo) {
    return mergeInfo.icon;
  }

  // Check if it's a subspecies code that belongs to a merge
  for (const info of Object.values(cachedConfig.merges)) {
    if (info.subspecies.includes(displaySpecies)) {
      return info.icon;
    }
  }

  return displaySpecies;
}

/**
 * Get the subspecies code for a specific region from a merged species.
 *
 * @param displaySpecies The merged species ID (e.g., "toutouwai")
 * @param region The region filter (e.g., "NI" or "SI")
 * @returns The subspecies code for that region, or null if not found
 */
export function getSubspeciesForRegion(displaySpecies: string, region: string): string | null {
  if (!cachedConfig) return null;

  const mergeInfo = cachedConfig.merges[displaySpecies];
  if (!mergeInfo) return null;

  // Find the subspecies that matches this region
  for (const [code, label] of Object.entries(mergeInfo.region_labels)) {
    if (label === region) {
      return code;
    }
  }

  return null;
}

/**
 * Check if a species code is part of a merged subspecies pair.
 *
 * @param code The eBird species code
 * @returns True if this code is a subspecies in a merge
 */
export function isSubspecies(code: string): boolean {
  if (!cachedConfig) return false;

  for (const info of Object.values(cachedConfig.merges)) {
    if (info.subspecies.includes(code)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if two species codes refer to the same merged species.
 * Used in scoring to accept either subspecies as correct.
 *
 * @param code1 First species code
 * @param code2 Second species code
 * @returns True if they are equivalent (same code or same merged species)
 */
export function areEquivalentSpecies(code1: string, code2: string): boolean {
  if (code1 === code2) return true;

  if (!cachedConfig) return false;

  // Find which merge group each code belongs to
  let merge1: string | null = null;
  let merge2: string | null = null;

  for (const [mergeId, info] of Object.entries(cachedConfig.merges)) {
    if (info.subspecies.includes(code1)) {
      merge1 = mergeId;
    }
    if (info.subspecies.includes(code2)) {
      merge2 = mergeId;
    }
  }

  // If both belong to the same merge group, they're equivalent
  return merge1 !== null && merge1 === merge2;
}

/**
 * Deduplicate a list of species codes, collapsing subspecies into their primary representative.
 * Keeps the first subspecies encountered for each merged species.
 *
 * @param codes Array of eBird species codes
 * @returns Deduplicated array with subspecies collapsed
 */
export function deduplicateSubspecies(codes: string[]): string[] {
  if (!cachedConfig) return codes;

  const seen = new Set<string>();
  const result: string[] = [];

  for (const code of codes) {
    // Check if this code belongs to a merged species
    let mergeId: string | null = null;
    for (const [id, info] of Object.entries(cachedConfig.merges)) {
      if (info.subspecies.includes(code)) {
        mergeId = id;
        break;
      }
    }

    const key = mergeId || code;

    if (!seen.has(key)) {
      seen.add(key);
      // Use the icon code (primary subspecies) for merged species
      if (mergeId) {
        result.push(cachedConfig.merges[mergeId].icon);
      } else {
        result.push(code);
      }
    }
  }

  return result;
}

/**
 * Get clips filtered by region for a species.
 * For merged subspecies, returns only clips from the specified region.
 * For non-merged species, returns all clips.
 *
 * @param speciesCode The species code to filter clips for
 * @param regionFilter The region filter ("NI", "SI", or undefined for all)
 * @returns Array of subspecies codes to include clips from
 */
export function getClipSubspecies(speciesCode: string, regionFilter?: string): string[] {
  if (!cachedConfig || !regionFilter) {
    return [speciesCode];
  }

  // Check if this is a subspecies that belongs to a merge
  for (const info of Object.values(cachedConfig.merges)) {
    if (info.subspecies.includes(speciesCode)) {
      // Find the subspecies for the requested region
      const regionCode = getSubspeciesForRegion(
        Object.keys(cachedConfig.merges).find(
          id => cachedConfig!.merges[id].subspecies.includes(speciesCode)
        )!,
        regionFilter
      );

      if (regionCode) {
        return [regionCode];
      }

      // If no subspecies for this region, fall back to main species
      return [speciesCode];
    }
  }

  return [speciesCode];
}
