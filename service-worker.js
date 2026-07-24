/* ==========================================================================
   ISHFADI — Production Service Worker
   Version: 3.0.0

   This is the single, permanent service worker for the ISHFADI platform.
   It merges the previous waiting-list-scoped worker and the index.html
   worker into one enterprise-grade implementation. Future sprints extend
   this file — it is never replaced wholesale.

   Strategy:
   - App Shell            : Precached on install
   - HTML Pages           : Network First (offline fallback)
   - CSS / JS / Modules / SVG / Images : Stale While Revalidate
   - Property / Gallery / Screenshot / Icon / Logo images : Cache First
   - Fonts (local, CDN, Google Fonts)  : Cache First (long-lived)
   - APIs / Auth / Payments / POST     : Network Only, never cached
   - Map tiles                          : Architecture reserved, not active
   - Push Notifications, Notification Click, Background Sync, Update flow
   ========================================================================== */

const CACHE_VERSION = "v3.0.3";

/* ==========================================================================
   Cache Names — one purpose per cache, never mixed
   ========================================================================== */

const CACHE_NAMES = {
  precache: `ishfadi-precache-${CACHE_VERSION}`,
  runtime: `ishfadi-runtime-${CACHE_VERSION}`,
  images: `ishfadi-images-${CACHE_VERSION}`,
  fonts: `ishfadi-fonts-${CACHE_VERSION}`,
  screenshots: `ishfadi-screenshots-${CACHE_VERSION}`,
  staticAssets: `ishfadi-static-${CACHE_VERSION}`,
  mapTiles: `ishfadi-map-tiles-${CACHE_VERSION}`, // reserved for future Sprint Map
  offline: `ishfadi-offline-${CACHE_VERSION}`
};

// All current-version caches. Anything else found on activate is stale
// and gets removed, regardless of which past version created it.
const CURRENT_CACHES = new Set(Object.values(CACHE_NAMES));

const OFFLINE_URL = "/offline.html";

/* ==========================================================================
   App Shell — cached immediately on install
   Missing files are ignored individually so one 404 never blocks install.
   ========================================================================== */

const APP_SHELL = [
  "/",
  "/agent.html",
  "/seller.html",
  "/index.html",
  "/offline.html",
  "/manifest.json",

  // Logo
 "/icons/logo.png",

// Standard / Android icons
"/icons/icon-192.png",
"/icons/icon-512.png",
"/icons/icon-1024.png",

// Maskable icons
"/icons/maskable-192.png",
"/icons/maskable-512.png",

// Apple
"/icons/icon-180.png",

// Favicons
"/favicon.ico",
];

/* ==========================================================================
   The admin page — deliberately NOT precached. It's auth-gated and has no
   meaningful offline use case as an internal review tool. It also no longer
   lives at a guessable filename (admin.html is retired and now 404s), so it
   isn't listed here by name on purpose.
   Future pages (buyer.html, host.html landing, property.html, booking.html,
   chat.html, profile.html) aren't precached yet since they don't exist;
   the HTML strategy below will apply to them automatically once they ship.
   ========================================================================== */

/* ==========================================================================
   Install
   ========================================================================== */

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAMES.precache);

      // Cache each file independently so a single missing asset
      // (e.g. a future-page icon not yet deployed) never fails install.
      await Promise.all(
        APP_SHELL.map((file) =>
          cache.add(new Request(file, { cache: "reload" })).catch(() => null)
        )
      );

      await self.skipWaiting();
    })()
  );
});

/* ==========================================================================
   Activate — clean up any cache from a previous version
   ========================================================================== */

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys.map((key) => {
          if (key.startsWith("ishfadi-") && !CURRENT_CACHES.has(key)) {
            return caches.delete(key);
          }
          return null;
        })
      );

      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.enable();
        } catch {
          // Navigation preload is an optimization, not a requirement.
        }
      }

      await self.clients.claim();

      // Let every open tab know a new service worker has taken control,
      // so the app can show a non-forced "New version available" prompt.
      const clientsList = await self.clients.matchAll({ type: "window" });
      for (const client of clientsList) {
        client.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION });
      }
    })()
  );
});

/* ==========================================================================
   Update Workflow — "New version available / Refresh / Later"
   The app calls postMessage({ type: "SKIP_WAITING" }) once the user
   accepts the update. We never force a reload ourselves.
   ========================================================================== */

self.addEventListener("message", (event) => {
  const data = event.data;

  if (data === "SKIP_WAITING" || (data && data.type === "SKIP_WAITING")) {
    self.skipWaiting();
    return;
  }

  if (data && data.type === "CHECK_VERSION") {
    if (event.source) { event.source.postMessage({ type: "SW_VERSION", version: CACHE_VERSION }); }
  }
});

/* ==========================================================================
   Request Classification Helpers
   ========================================================================== */

function isHTMLRequest(request) {
  return (
    request.mode === "navigate" ||
    (request.method === "GET" &&
      (request.headers.get("accept") || "").includes("text/html"))
  );
}

function isNeverCache(url, request) {
  // Anything touching auth, sessions, tokens, or mutating the server
  // must always hit the network. This list is intentionally broad.
  if (request.method !== "GET") return true;

  const path = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();

  return (
    host.includes("supabase.co") ||
    host.includes("supabase.io") ||
    path.includes("/auth/") ||
    path.includes("/token") ||
    path.includes("/session") ||
    path.includes("/rest/v1/") ||
    path.includes("/realtime/") ||
    path.includes("/storage/v1/object/sign") ||
    host.includes("turnstile") ||
    host.includes("challenges.cloudflare.com") ||
    path.includes("/api/")
  );
}

function isFontRequest(url) {
  return (
    /\.(woff2?|ttf|otf|eot)$/i.test(url.pathname) ||
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  );
}

function isGalleryOrIconImage(url) {
  // Property images, screenshots, gallery/preview images, icons and logos —
  // large, rarely-changing, cache-first candidates.
  return (
    /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname) &&
    (url.pathname.includes("/icons/") ||
      url.pathname.includes("/logo") ||
      url.pathname.includes("/properties/") ||
      url.pathname.includes("/screenshots/") ||
      url.pathname.includes("/gallery/") ||
      url.pathname.includes("/previews/"))
  );
}

function isStaticAsset(url) {
  return /\.(css|js|mjs|svg|png|jpe?g|gif|webp|ico)$/i.test(url.pathname);
}

function isMapTileRequest(url) {
  // Architecture reserved for Sprint Map. Not activated yet — this
  // classifier exists so the fetch handler already knows how to route
  // these requests the moment tile caching is turned on.
  return (
    /tile\.openstreetmap\.org/i.test(url.hostname) ||
    /\.tiles\./i.test(url.hostname) ||
    url.pathname.includes("/map-tiles/")
  );
}

/* ==========================================================================
   HTML Strategy — Network First
   ========================================================================== */

async function networkFirstHTML(event) {
  const cache = await caches.open(CACHE_NAMES.runtime);
  const request = event.request;

  try {
    const preload = await event.preloadResponse;
    const response = preload || (await fetch(request));

    if (response && response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;

    // Only serve a cached copy of the EXACT page requested (e.g. user already
    // visited this page before going offline). Do NOT fall back to an unrelated
    // page like index.html here — that used to silently mask this whole offline
    // page behind the marketing homepage for any URL that wasn't in the runtime
    // cache, since index.html is always precached and matched first.
    const shellMatch = await caches.match(request.url);
    if (shellMatch) return shellMatch;

    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;

    return Response.error();
  }
}

/* ==========================================================================
   Static Assets Strategy — Stale While Revalidate
   ========================================================================== */

async function staleWhileRevalidate(request, cacheName = CACHE_NAMES.staticAssets) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || networkFetch || Response.error();
}

/* ==========================================================================
   Images / Screenshots / Icons Strategy — Cache First
   ========================================================================== */

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

/* ==========================================================================
   Fonts Strategy — Cache First, long-lived
   ========================================================================== */

async function cacheFirstFonts(request) {
  return cacheFirst(request, CACHE_NAMES.fonts);
}

/* ==========================================================================
   Fetch
   ========================================================================== */

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never intercept anything that must always be live.
  if (isNeverCache(url, request)) {
    return;
  }

  // HTML navigations — current and future pages alike.
  if (isHTMLRequest(request)) {
    event.respondWith(networkFirstHTML(event));
    return;
  }

  if (request.method !== "GET") {
    return;
  }

  // Map tiles — architecture only, not active. Left as a network pass-through
  // until Sprint Map explicitly enables ISHFADI Map Tiles caching.
  if (isMapTileRequest(url)) {
    return;
  }

  // Fonts — Google Fonts, CDN fonts, and local fonts.
  if (isFontRequest(url)) {
    event.respondWith(cacheFirstFonts(request));
    return;
  }

  // Property images, screenshots, gallery/preview images, icons, logos.
  if (isGalleryOrIconImage(url)) {
    const cacheName = url.pathname.includes("/screenshots/")
      ? CACHE_NAMES.screenshots
      : CACHE_NAMES.images;
    event.respondWith(cacheFirst(request, cacheName));
    return;
  }

  // Same-origin static assets (CSS, JS, modules, SVG, other images).
  if (url.origin === self.location.origin && isStaticAsset(url)) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.staticAssets));
    return;
  }

  // Cross-origin CDN assets (scripts/styles served from a CDN).
  if (
    url.origin !== self.location.origin &&
    /cdn\.|unpkg\.com|jsdelivr\.net|cdnjs\.cloudflare\.com/i.test(url.hostname)
  ) {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.runtime));
  }
});

/* ==========================================================================
   Push Notifications
   ========================================================================== */

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "ISHFADI";

  const options = {
    body: payload.body || "You have a new notification.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: payload.badge || "/icons/icon-72.png",
    image: payload.image || undefined,
    tag: payload.tag || "ishfadi-notification",
    vibrate: payload.vibration || [200, 100, 200],
    data: {
      url: payload.url || "/",
      deepLink: payload.deepLink || undefined
    },
    actions: Array.isArray(payload.actions) ? payload.actions : []
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ==========================================================================
   Notification Click — focus existing window or open a new one
   ========================================================================== */

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const windowClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true
      });

      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            try {
              await client.navigate(targetUrl);
            } catch {
              // Navigation can fail cross-origin; focusing is still useful.
            }
          }
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })()
  );
});

/* ==========================================================================
   Background Sync — architecture only, no fake implementations.
   Each tag below is reserved for a specific future retry queue. When the
   corresponding feature ships, its handler is implemented here without
   touching the rest of the file.
   ========================================================================== */

const SYNC_TAGS = {
  waitlistSignup: "ishfadi-sync-waitlist-signup",
  propertyUpload: "ishfadi-sync-property-upload",
  favorites: "ishfadi-sync-favorites",
  reviews: "ishfadi-sync-reviews",
  messages: "ishfadi-sync-messages",
  analytics: "ishfadi-sync-analytics"
};

self.addEventListener("sync", (event) => {
  switch (event.tag) {
    case SYNC_TAGS.waitlistSignup:
      // Reserved: retry queued waiting-list signups submitted while offline.
      break;

    case SYNC_TAGS.propertyUpload:
      // Reserved: retry queued property listing uploads.
      break;

    case SYNC_TAGS.favorites:
      // Reserved: retry queued favorite/save actions.
      break;

    case SYNC_TAGS.reviews:
      // Reserved: retry queued review submissions.
      break;

    case SYNC_TAGS.messages:
      // Reserved: retry queued chat messages.
      break;

    case SYNC_TAGS.analytics:
      // Reserved: retry queued analytics/telemetry events.
      break;

    default:
      break;
  }
});