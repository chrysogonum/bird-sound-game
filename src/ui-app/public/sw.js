/**
 * Service Worker for ChipNotes!
 * Provides offline support and caching for the PWA
 */

// Derive base URL from service worker's location (e.g., /bird-sound-game/)
const BASE_URL = self.location.pathname.replace(/sw\.js$/, '');

const CACHE_NAME = 'chipnotes-v2';
const STATIC_ASSETS = [
  BASE_URL,
  `${BASE_URL}index.html`,
  `${BASE_URL}manifest.json`,
  // Core data files needed for offline play
  `${BASE_URL}data/clips.json`,
  `${BASE_URL}data/species.json`,
  `${BASE_URL}data/levels.json`,
  `${BASE_URL}data/taxonomic_order.json`,
  `${BASE_URL}data/nz_subspecies_merge.json`,
  `${BASE_URL}data/nz_display_codes.json`,
  // Pack definitions
  `${BASE_URL}data/packs/starter_birds.json`,
  `${BASE_URL}data/packs/grassland_birds.json`,
  `${BASE_URL}data/packs/sparrows.json`,
  `${BASE_URL}data/packs/woodpeckers.json`,
  `${BASE_URL}data/packs/spring_warblers.json`,
  `${BASE_URL}data/packs/western_birds.json`,
  `${BASE_URL}data/packs/expanded_backyard.json`,
  `${BASE_URL}data/packs/common_se_birds.json`,
  `${BASE_URL}data/packs/nz_common.json`,
  `${BASE_URL}data/packs/nz_north_island.json`,
  `${BASE_URL}data/packs/nz_south_island.json`,
  `${BASE_URL}data/packs/nz_all_birds.json`,
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - network first, fall back to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // For audio, spectrograms, and icons, use cache-first strategy
  if (url.pathname.startsWith(`${BASE_URL}data/clips/`) ||
      url.pathname.startsWith(`${BASE_URL}data/spectrograms/`) ||
      url.pathname.startsWith(`${BASE_URL}data/icons/`)) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          return fetch(request).then((response) => {
            // Cache audio/image files for offline use
            if (response.ok) {
              cache.put(request, response.clone());
            }
            return response;
          });
        });
      })
    );
    return;
  }

  // For other requests, use network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Only cache responses that are NOT hashed bundles (JS/CSS with content hashes)
        // Hashed bundles change filename on every build, so caching them causes stale code
        const isHashedBundle = /\/(assets|js|css)\/[^/]+-[a-zA-Z0-9]{8,}\.(js|css)$/.test(url.pathname);

        if (response.ok && !isHashedBundle) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache
        return caches.match(request).then((cached) => {
          if (cached) {
            return cached;
          }
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match(BASE_URL);
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});
