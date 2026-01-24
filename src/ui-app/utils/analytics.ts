/**
 * Google Analytics helper for tracking game events
 */

// Type declaration for gtag
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

/**
 * Track a custom event in Google Analytics
 */
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
}

/**
 * Track when a pack is selected
 */
export function trackPackSelect(packId: string, packName: string) {
  trackEvent('pack_select', {
    pack_id: packId,
    pack_name: packName,
  });
}

/**
 * Track when a game round starts
 */
export function trackGameStart(packId: string, levelId: number, speciesCount: number) {
  trackEvent('game_start', {
    pack_id: packId,
    level_id: levelId,
    species_count: speciesCount,
  });
}

/**
 * Track when a round completes
 */
export function trackRoundComplete(
  packId: string,
  levelId: number,
  score: number,
  accuracy: number,
  duration: number
) {
  trackEvent('round_complete', {
    pack_id: packId,
    level_id: levelId,
    score,
    accuracy,
    duration_sec: duration,
  });
}

/**
 * Track when Training Mode is toggled
 */
export function trackTrainingModeToggle(enabled: boolean) {
  trackEvent('training_mode_toggle', {
    enabled,
  });
}

/**
 * Track when spectrograms are toggled
 */
export function trackSpectrogramToggle(mode: string) {
  trackEvent('spectrogram_toggle', {
    mode,
  });
}

/**
 * Track when a level is selected
 */
export function trackLevelSelect(packId: string, levelId: number, levelTitle: string) {
  trackEvent('level_select', {
    pack_id: packId,
    level_id: levelId,
    level_title: levelTitle,
  });
}

/**
 * Track when taxonomic sorting is toggled
 */
export function trackTaxonomicSortToggle(enabled: boolean, location: 'custom_pack_builder' | 'preview_screen') {
  trackEvent('taxonomic_sort_toggle', {
    enabled,
    location,
  });
}

/**
 * Track when a custom pack is created (birds selected)
 */
export function trackCustomPackCreate(speciesCount: number) {
  trackEvent('custom_pack_create', {
    species_count: speciesCount,
  });
}

/**
 * Track when a custom pack is saved
 */
export function trackCustomPackSave(packName: string, speciesCount: number) {
  trackEvent('custom_pack_save', {
    pack_name: packName,
    species_count: speciesCount,
  });
}

/**
 * Track when a saved pack is loaded
 */
export function trackCustomPackLoad(packName: string, speciesCount: number) {
  trackEvent('custom_pack_load', {
    pack_name: packName,
    species_count: speciesCount,
  });
}

/**
 * Track when a saved pack is deleted
 */
export function trackCustomPackDelete(packName: string) {
  trackEvent('custom_pack_delete', {
    pack_name: packName,
  });
}

/**
 * Track when an external link is clicked
 */
export function trackExternalLinkClick(url: string, linkType: string, location: string) {
  trackEvent('external_link_click', {
    url,
    link_type: linkType,
    location,
  });
}
