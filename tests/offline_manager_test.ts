/**
 * Offline Manager Tests
 *
 * Tests pure/testable functions from offlineManager.ts:
 * - formatBytes: byte formatting
 * - getPackStatuses: localStorage state management
 * - AVAILABLE_PACKS: pack list integrity
 * - isOfflineSupported: browser API detection
 * - resolveAssetUrl: URL construction
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock Sentry before importing offlineManager (it imports Sentry at top level)
vi.mock('@sentry/react', () => ({
  addBreadcrumb: vi.fn(),
}));

// Mock import.meta.env
vi.stubGlobal('importMetaEnv', { DEV: true, BASE_URL: '/' });

// We need to dynamically import after mocks are set up
let formatBytes: typeof import('../src/ui-app/utils/offlineManager').formatBytes;
let getPackStatuses: typeof import('../src/ui-app/utils/offlineManager').getPackStatuses;
let AVAILABLE_PACKS: typeof import('../src/ui-app/utils/offlineManager').AVAILABLE_PACKS;
let isOfflineSupported: typeof import('../src/ui-app/utils/offlineManager').isOfflineSupported;
let resolveAssetUrl: typeof import('../src/ui-app/utils/offlineManager').resolveAssetUrl;

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete store[key]; }),
    clear: vi.fn(() => { store = {}; }),
    get length() { return Object.keys(store).length; },
    key: vi.fn((i: number) => Object.keys(store)[i] ?? null),
  };
})();

// Mock window APIs needed by offlineManager
vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('window', {
  ...globalThis.window,
  localStorage: localStorageMock,
  location: {
    origin: 'https://chipnotes.app',
    protocol: 'https:',
    hostname: 'chipnotes.app',
  },
  isSecureContext: true,
  caches: {},
});
vi.stubGlobal('navigator', { serviceWorker: {} });
vi.stubGlobal('caches', {});

// Provide import.meta.env.BASE_URL for resolveAssetUrl
// The module reads import.meta.env at call time, so we need it available
Object.defineProperty(import.meta, 'env', {
  value: { DEV: true, BASE_URL: '/' },
  writable: true,
});

beforeEach(async () => {
  localStorageMock.clear();
  vi.clearAllMocks();

  // Fresh import each time to avoid stale module state
  const mod = await import('../src/ui-app/utils/offlineManager');
  formatBytes = mod.formatBytes;
  getPackStatuses = mod.getPackStatuses;
  AVAILABLE_PACKS = mod.AVAILABLE_PACKS;
  isOfflineSupported = mod.isOfflineSupported;
  resolveAssetUrl = mod.resolveAssetUrl;
});

// ── formatBytes ─────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats small byte values', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1536)).toBe('2 KB'); // rounds
    expect(formatBytes(512 * 1024)).toBe('512 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('6 MB'); // rounds
    expect(formatBytes(100 * 1024 * 1024)).toBe('100 MB');
  });

  it('formats gigabytes with one decimal', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
    expect(formatBytes(2.5 * 1024 * 1024 * 1024)).toBe('2.5 GB');
  });

  it('handles boundary values correctly', () => {
    // Just below KB threshold
    expect(formatBytes(1023)).toBe('1023 B');
    // Exactly at KB threshold
    expect(formatBytes(1024)).toBe('1 KB');
    // Just below MB threshold
    expect(formatBytes(1024 * 1024 - 1)).toBe('1024 KB');
    // Exactly at MB threshold
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });
});

// ── getPackStatuses ─────────────────────────────────────────

describe('getPackStatuses', () => {
  it('returns default state when localStorage is empty', () => {
    const state = getPackStatuses();
    expect(state).toEqual({ schemaVersion: 1, packs: {} });
  });

  it('returns saved state when valid', () => {
    const savedState = {
      schemaVersion: 1,
      packs: {
        starter_birds: {
          packId: 'starter_birds',
          status: 'downloaded',
          downloadedFiles: 42,
          totalFiles: 42,
          lastUpdated: 1700000000000,
        },
      },
    };
    localStorageMock.setItem('chipnotes_offline_packs', JSON.stringify(savedState));

    const state = getPackStatuses();
    expect(state).toEqual(savedState);
    expect(state.packs.starter_birds.status).toBe('downloaded');
  });

  it('returns default state when JSON is corrupted', () => {
    localStorageMock.setItem('chipnotes_offline_packs', '{not valid json!!!');

    const state = getPackStatuses();
    expect(state).toEqual({ schemaVersion: 1, packs: {} });
  });

  it('returns default state when schema version is wrong', () => {
    const oldState = {
      schemaVersion: 99,
      packs: { some_pack: { status: 'downloaded' } },
    };
    localStorageMock.setItem('chipnotes_offline_packs', JSON.stringify(oldState));

    const state = getPackStatuses();
    expect(state).toEqual({ schemaVersion: 1, packs: {} });
  });

  it('returns default state when saved data is null-ish', () => {
    localStorageMock.setItem('chipnotes_offline_packs', 'null');

    const state = getPackStatuses();
    expect(state).toEqual({ schemaVersion: 1, packs: {} });
  });
});

// ── AVAILABLE_PACKS ─────────────────────────────────────────

describe('AVAILABLE_PACKS', () => {
  it('contains expected packs', () => {
    expect(AVAILABLE_PACKS).toContain('starter_birds');
    expect(AVAILABLE_PACKS).toContain('nz_common');
    expect(AVAILABLE_PACKS).toContain('spring_warblers');
  });

  it('has no duplicates', () => {
    const unique = new Set(AVAILABLE_PACKS);
    expect(unique.size).toBe(AVAILABLE_PACKS.length);
  });

  it('contains only non-empty strings', () => {
    for (const pack of AVAILABLE_PACKS) {
      expect(typeof pack).toBe('string');
      expect(pack.length).toBeGreaterThan(0);
    }
  });

  it('has a reasonable number of packs', () => {
    expect(AVAILABLE_PACKS.length).toBeGreaterThanOrEqual(8);
    expect(AVAILABLE_PACKS.length).toBeLessThanOrEqual(50);
  });
});

// ── isOfflineSupported ──────────────────────────────────────

describe('isOfflineSupported', () => {
  it('returns true when all APIs are present', () => {
    // Our global mocks set all three: isSecureContext, caches, serviceWorker
    expect(isOfflineSupported()).toBe(true);
  });

  it('returns false when not in secure context', () => {
    const originalWindow = globalThis.window;
    vi.stubGlobal('window', {
      ...originalWindow,
      isSecureContext: false,
      location: { protocol: 'http:', hostname: 'example.com' },
    });

    expect(isOfflineSupported()).toBe(false);

    // Restore
    vi.stubGlobal('window', originalWindow);
  });

  it('returns false when caches API is missing', () => {
    const originalWindow = globalThis.window;
    const windowWithoutCaches = { ...originalWindow };
    delete (windowWithoutCaches as Record<string, unknown>)['caches'];
    vi.stubGlobal('window', windowWithoutCaches);

    expect(isOfflineSupported()).toBe(false);

    vi.stubGlobal('window', originalWindow);
  });
});

// ── resolveAssetUrl ─────────────────────────────────────────

describe('resolveAssetUrl', () => {
  it('builds absolute URL from relative path', () => {
    const url = resolveAssetUrl('data/clips/NOCA_123.wav');
    expect(url).toBe('https://chipnotes.app/data/clips/NOCA_123.wav');
  });

  it('handles paths with leading slash', () => {
    const url = resolveAssetUrl('/data/icons/NOCA.png');
    expect(url).toBe('https://chipnotes.app/data/icons/NOCA.png');
  });

  it('handles nested paths', () => {
    const url = resolveAssetUrl('data/spectrograms/NOCA_123_1.png');
    expect(url).toBe('https://chipnotes.app/data/spectrograms/NOCA_123_1.png');
  });
});
