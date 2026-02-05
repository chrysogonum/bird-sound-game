/**
 * Offline Manager for ChipNotes!
 * Handles pack downloads, verification, and cache management for offline play.
 */

import * as Sentry from '@sentry/react';

// Types
export interface Clip {
  clip_id: string;
  species_code: string;
  file_path: string;
  spectrogram_path?: string;
  rejected?: boolean;
}

export interface PackConfig {
  pack_id: string;
  display_name: string;
  description: string;
  species: string[];
}

export interface PackAsset {
  url: string;
  type: 'audio' | 'spectrogram' | 'icon';
}

export interface PackManifest {
  packId: string;
  displayName: string;
  clipCount: number;
  estimatedSizeMB: number;
  assets: PackAsset[];
}

export type PackStatus = 'not_downloaded' | 'downloading' | 'downloaded' | 'partial';

export interface PackDownloadStatus {
  packId: string;
  status: PackStatus;
  downloadedFiles: number;
  totalFiles: number;
  lastUpdated: number;
  downloadSessionId?: string;
}

export interface OfflinePacksState {
  schemaVersion: 1;
  packs: Record<string, PackDownloadStatus>;
}

export type ProgressCallback = (completed: number, total: number) => void;

// Constants
const CACHE_NAME = 'chipnotes-v2';
const STORAGE_KEY = 'chipnotes_offline_packs';
const CONCURRENCY = 4;
const THROTTLE_MS = 250;

// Average file sizes for estimation (in KB)
const AVG_AUDIO_SIZE_KB = 120;
const AVG_SPECTROGRAM_SIZE_KB = 25;

// Cached clips.json to avoid re-parsing
let cachedClips: Clip[] | null = null;

/**
 * Single source of truth for asset URLs - ensures consistent URL format for cache matching
 */
export function resolveAssetUrl(relativePath: string): string {
  const base = window.location.origin + import.meta.env.BASE_URL;
  return new URL(relativePath, base).href;
}

/**
 * Check if offline features are supported in this browser
 */
export function isOfflineSupported(): boolean {
  // Service workers require secure context (HTTPS or localhost)
  const isSecureContext = window.isSecureContext;
  const hasCaches = 'caches' in window;
  const hasServiceWorker = 'serviceWorker' in navigator;

  // Debug logging
  if (!isSecureContext || !hasCaches || !hasServiceWorker) {
    console.log('[OfflineManager] Support check:', {
      isSecureContext,
      hasCaches,
      hasServiceWorker,
      protocol: window.location.protocol,
      hostname: window.location.hostname,
    });
  }

  return isSecureContext && hasCaches && hasServiceWorker;
}

/**
 * Get clips.json with caching
 */
async function getCachedClips(): Promise<Clip[]> {
  if (cachedClips) return cachedClips;

  const response = await fetch(resolveAssetUrl('data/clips.json'));
  cachedClips = await response.json();
  return cachedClips!;
}

/**
 * Clear the clips cache (useful if clips.json changes)
 */
export function clearClipsCache(): void {
  cachedClips = null;
}

/**
 * Build a manifest of all assets needed for a pack
 */
export async function buildPackManifest(packId: string): Promise<PackManifest> {
  const clips = await getCachedClips();
  const packResponse = await fetch(resolveAssetUrl(`data/packs/${packId}.json`));
  const packConfig: PackConfig = await packResponse.json();

  const packSpecies = new Set(packConfig.species);
  const packClips = clips.filter(c => packSpecies.has(c.species_code) && !c.rejected);

  const assets: PackAsset[] = [];

  // Add icons for each species in the pack
  for (const speciesCode of packSpecies) {
    assets.push({ url: resolveAssetUrl(`data/icons/${speciesCode}.png`), type: 'icon' });
  }

  // Add audio and spectrograms for each clip
  for (const clip of packClips) {
    assets.push({ url: resolveAssetUrl(clip.file_path), type: 'audio' });
    if (clip.spectrogram_path) {
      assets.push({ url: resolveAssetUrl(clip.spectrogram_path), type: 'spectrogram' });
    }
  }

  // Estimate size based on asset counts
  const audioCount = assets.filter(a => a.type === 'audio').length;
  const spectrogramCount = assets.filter(a => a.type === 'spectrogram').length;
  const estimatedSizeMB = Math.round(
    (audioCount * AVG_AUDIO_SIZE_KB + spectrogramCount * AVG_SPECTROGRAM_SIZE_KB) / 1024
  );

  return {
    packId,
    displayName: packConfig.display_name,
    clipCount: packClips.length,
    estimatedSizeMB,
    assets,
  };
}

// Throttled status updates
let pendingStatus: OfflinePacksState | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Get all pack statuses from localStorage
 */
export function getPackStatuses(): OfflinePacksState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.schemaVersion === 1) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to parse offline packs state:', e);
  }
  return { schemaVersion: 1, packs: {} };
}

/**
 * Update pack status (throttled writes to localStorage)
 */
function updatePackStatus(packId: string, updates: Partial<PackDownloadStatus>): void {
  const state = pendingStatus || getPackStatuses();
  const existing = state.packs[packId] || {
    packId,
    status: 'not_downloaded' as PackStatus,
    downloadedFiles: 0,
    totalFiles: 0,
    lastUpdated: Date.now(),
  };

  state.packs[packId] = {
    ...existing,
    ...updates,
    lastUpdated: Date.now(),
  };

  pendingStatus = state;

  if (!writeTimer) {
    writeTimer = setTimeout(() => {
      if (pendingStatus) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingStatus));
      }
      writeTimer = null;
      pendingStatus = null;
    }, THROTTLE_MS);
  }
}

/**
 * Force write pending status immediately
 */
function flushStatusUpdate(): void {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  if (pendingStatus) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingStatus));
    pendingStatus = null;
  }
}

/**
 * Run async tasks with limited concurrency
 */
async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>
): Promise<void> {
  const queue = [...items];
  const workers: Promise<void>[] = [];

  async function worker(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift();
      if (item) {
        await fn(item);
      }
    }
  }

  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }

  await Promise.all(workers);
}

/**
 * Download a pack for offline use
 */
export async function downloadPack(
  packId: string,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<void> {
  const manifest = await buildPackManifest(packId);
  const cache = await caches.open(CACHE_NAME);

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let completed = 0;

  updatePackStatus(packId, {
    status: 'downloading',
    downloadedFiles: 0,
    totalFiles: manifest.assets.length,
    downloadSessionId: sessionId,
  });

  async function downloadOne(asset: PackAsset): Promise<void> {
    if (abortSignal?.aborted) {
      throw new Error('Download aborted');
    }

    // Skip if already cached
    const cached = await cache.match(asset.url);
    if (cached) {
      completed++;
      onProgress(completed, manifest.assets.length);
      updatePackStatus(packId, { downloadedFiles: completed });
      return;
    }

    try {
      const response = await fetch(asset.url, { signal: abortSignal });
      if (response.ok) {
        await cache.put(asset.url, response.clone());
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw e;
      }
      // Log but continue on individual file failures
      console.warn(`Failed to download ${asset.url}:`, e);
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `Download failed: ${asset.url}`,
        level: 'warning',
      });
    }

    completed++;
    onProgress(completed, manifest.assets.length);
    updatePackStatus(packId, { downloadedFiles: completed });
  }

  try {
    await runWithConcurrency(manifest.assets, CONCURRENCY, downloadOne);

    updatePackStatus(packId, {
      status: 'downloaded',
      downloadedFiles: manifest.assets.length,
      downloadSessionId: undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError' || (e as Error).message === 'Download aborted') {
      updatePackStatus(packId, {
        status: 'partial',
        downloadSessionId: undefined,
      });
    } else {
      updatePackStatus(packId, {
        status: 'partial',
        downloadSessionId: undefined,
      });
      throw e;
    }
  } finally {
    flushStatusUpdate();
  }
}

/**
 * Resume a partial download
 */
export async function resumePack(
  packId: string,
  onProgress: ProgressCallback,
  abortSignal?: AbortSignal
): Promise<void> {
  const manifest = await buildPackManifest(packId);
  const cache = await caches.open(CACHE_NAME);

  // Find missing URLs only
  const missing: PackAsset[] = [];
  for (const asset of manifest.assets) {
    const cached = await cache.match(asset.url);
    if (!cached) {
      missing.push(asset);
    }
  }

  if (missing.length === 0) {
    updatePackStatus(packId, {
      status: 'downloaded',
      downloadedFiles: manifest.assets.length,
      totalFiles: manifest.assets.length,
    });
    flushStatusUpdate();
    onProgress(manifest.assets.length, manifest.assets.length);
    return;
  }

  const alreadyCached = manifest.assets.length - missing.length;
  let completed = alreadyCached;

  const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  updatePackStatus(packId, {
    status: 'downloading',
    downloadedFiles: alreadyCached,
    totalFiles: manifest.assets.length,
    downloadSessionId: sessionId,
  });

  onProgress(completed, manifest.assets.length);

  async function downloadOne(asset: PackAsset): Promise<void> {
    if (abortSignal?.aborted) {
      throw new Error('Download aborted');
    }

    try {
      const response = await fetch(asset.url, { signal: abortSignal });
      if (response.ok) {
        await cache.put(asset.url, response.clone());
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        throw e;
      }
      console.warn(`Failed to download ${asset.url}:`, e);
      Sentry.addBreadcrumb({
        category: 'offline',
        message: `Resume download failed: ${asset.url}`,
        level: 'warning',
      });
    }

    completed++;
    onProgress(completed, manifest.assets.length);
    updatePackStatus(packId, { downloadedFiles: completed });
  }

  try {
    await runWithConcurrency(missing, CONCURRENCY, downloadOne);

    updatePackStatus(packId, {
      status: 'downloaded',
      downloadedFiles: manifest.assets.length,
      downloadSessionId: undefined,
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError' || (e as Error).message === 'Download aborted') {
      updatePackStatus(packId, {
        status: 'partial',
        downloadSessionId: undefined,
      });
    } else {
      updatePackStatus(packId, {
        status: 'partial',
        downloadSessionId: undefined,
      });
      throw e;
    }
  } finally {
    flushStatusUpdate();
  }
}

/**
 * Verify if a pack's assets are all cached
 */
export async function verifyPackCache(packId: string): Promise<boolean> {
  try {
    const manifest = await buildPackManifest(packId);
    const cache = await caches.open(CACHE_NAME);

    for (const asset of manifest.assets) {
      const cached = await cache.match(asset.url);
      if (!cached) {
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error(`Failed to verify pack ${packId}:`, e);
    return false;
  }
}

/**
 * Verify all packs on app start - reconcile stored status with cache truth
 */
export async function verifyAllPacks(): Promise<void> {
  if (!isOfflineSupported()) return;

  const state = getPackStatuses();

  for (const [packId, status] of Object.entries(state.packs)) {
    if (status.status === 'downloaded' || status.status === 'partial') {
      const isComplete = await verifyPackCache(packId);
      if (isComplete && status.status !== 'downloaded') {
        updatePackStatus(packId, { status: 'downloaded' });
      } else if (!isComplete && status.status === 'downloaded') {
        // Browser evicted some files - mark as partial
        updatePackStatus(packId, { status: 'partial' });
      }
    }

    // Clear stale "downloading" states (session crashed)
    if (status.status === 'downloading') {
      updatePackStatus(packId, { status: 'partial', downloadSessionId: undefined });
    }
  }

  flushStatusUpdate();
}

/**
 * Clear a single pack from cache
 */
export async function clearPack(packId: string): Promise<void> {
  const manifest = await buildPackManifest(packId);
  const cache = await caches.open(CACHE_NAME);

  for (const asset of manifest.assets) {
    await cache.delete(asset.url);
  }

  updatePackStatus(packId, {
    status: 'not_downloaded',
    downloadedFiles: 0,
    totalFiles: 0,
    downloadSessionId: undefined,
  });
  flushStatusUpdate();
}

/**
 * Clear all offline pack data
 */
export async function clearAllPacks(): Promise<void> {
  // Delete the entire cache
  await caches.delete(CACHE_NAME);

  // Clear localStorage state
  localStorage.removeItem(STORAGE_KEY);

  // Re-create empty cache for SW to use
  await caches.open(CACHE_NAME);
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{ used: number; available: number } | null> {
  if (!navigator.storage?.estimate) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    return {
      used: estimate.usage || 0,
      available: estimate.quota || 0,
    };
  } catch (e) {
    console.error('Failed to get storage estimate:', e);
    return null;
  }
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * List of all available packs for offline download
 */
export const AVAILABLE_PACKS = [
  'starter_birds',
  'grassland_birds',
  'sparrows',
  'woodpeckers',
  'spring_warblers',
  'western_birds',
  'expanded_backyard',
  'common_se_birds',
  'nz_common',
  'nz_north_island',
  'nz_south_island',
  'nz_all_birds',
];
