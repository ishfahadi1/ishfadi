/* ==========================================================================
   ISHFADI Production Service Worker
   Version: 2.0.0
   Strategy:
   - App Shell: Cache First
   - HTML Pages: Network First
   - Static Assets: Stale While Revalidate
   - APIs: Network Only
   - Automatic cache cleanup
   - Push Notifications
   - Background Sync Ready
   ========================================================================== */

const CACHE_VERSION = "v2.0.0";

const PRECACHE = `ishfadi-precache-${CACHE_VERSION}`;
const RUNTIME = `ishfadi-runtime-${CACHE_VERSION}`;

const OFFLINE_URL = "/offline.html";

/* ==========================
   Files to cache immediately
========================== */

const APP_SHELL = [

  "/",
  "/index.html",
  "/offline.html",
  "/manifest.json",

  "/icons/icon-16.png",
  "/icons/icon-20.png",
  "/icons/icon-24.png",
  "/icons/icon-29.png",
  "/icons/icon-32.png",
  "/icons/icon-36.png",
  "/icons/icon-40.png",
  "/icons/icon-48.png",
  "/icons/icon-57.png",
  "/icons/icon-58.png",
  "/icons/icon-60.png",
  "/icons/icon-64.png",
  "/icons/icon-72.png",
  "/icons/icon-76.png",
  "/icons/icon-80.png",
  "/icons/icon-87.png",
  "/icons/icon-96.png",
  "/icons/icon-114.png",
  "/icons/icon-120.png",
  "/icons/icon-128.png",
  "/icons/icon-144.png",
  "/icons/icon-152.png",
  "/icons/icon-167.png",
  "/icons/icon-180.png",
  "/icons/icon-192.png",
  "/icons/icon-256.png",
  "/icons/icon-384.png",
  "/icons/icon-512.png",
  "/icons/icon-1024.png"

];

/* ==========================
   Install
========================== */

self.addEventListener("install", event => {

    event.waitUntil(

        (async () => {

            const cache = await caches.open(PRECACHE);

            await Promise.all(

                APP_SHELL.map(file =>
                    cache.add(new Request(file, {
                        cache: "reload"
                    })).catch(() => null)
                )

            );

            self.skipWaiting();

        })()

    );

});

/* ==========================
   Activate
========================== */

self.addEventListener("activate", event => {

    event.waitUntil(

        (async () => {

            const keys = await caches.keys();

            await Promise.all(

                keys.map(key => {

                    if (
                        key.startsWith("ishfadi-") &&
                        key !== PRECACHE &&
                        key !== RUNTIME
                    ) {
                        return caches.delete(key);
                    }

                })

            );

            if (self.registration.navigationPreload) {
                try {
                    await self.registration.navigationPreload.enable();
                } catch (e) {}
            }

            await self.clients.claim();

        })()

    );

});

/* ==========================
   Skip Waiting
========================== */

self.addEventListener("message", event => {

    if (
        event.data === "SKIP_WAITING" ||
        (
            event.data &&
            event.data.type === "SKIP_WAITING"
        )
    ) {
        self.skipWaiting();
    }

});

/* ==========================
   Helpers
========================== */

const isHTML = request =>

    request.mode === "navigate" ||

    (
        request.method === "GET" &&
        request.headers
            .get("accept")
            ?.includes("text/html")
    );

const isStaticAsset = url =>

    /\.(css|js|mjs|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|otf)$/i
        .test(url.pathname);

const isAPI = url =>

    /\/api\//i.test(url.pathname) ||

    /tile\.openstreetmap\.org/i.test(url.hostname);

/* ==========================
   HTML Strategy
========================== */

async function networkFirst(event) {

    const cache = await caches.open(RUNTIME);

    try {

        const preload = await event.preloadResponse;

        const response = preload || await fetch(event.request);

        cache.put(event.request, response.clone());

        return response;

    } catch {

        return (
            await cache.match(event.request)
        ) ||

        (
            await caches.match("/index.html")
        ) ||

        (
            await caches.match(OFFLINE_URL)
        );

    }

}

/* ==========================
   Static Assets
========================== */

async function staleWhileRevalidate(request) {

    const cache = await caches.open(RUNTIME);

    const cached = await cache.match(request);

    const networkFetch = fetch(request)

        .then(response => {

            if (
                response &&
                (
                    response.ok ||
                    response.type === "opaque"
                )
            ) {

                cache.put(
                    request,
                    response.clone()
                );

            }

            return response;

        })

        .catch(() => null);

    return cached || networkFetch;

}

/* ==========================
   Fetch
========================== */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET")
        return;

    const url = new URL(event.request.url);

    if (isAPI(url))
        return;

    if (isHTML(event.request)) {

        event.respondWith(
            networkFirst(event)
        );

        return;

    }

    if (
        url.origin === self.location.origin &&
        isStaticAsset(url)
    ) {

        event.respondWith(

            staleWhileRevalidate(event.request)

        );

        return;

    }

    if (

        url.origin !== self.location.origin &&

        /fonts\.|cdn\.|unpkg\.com|jsdelivr\.net/i

            .test(url.hostname)

    ) {

        event.respondWith(

            staleWhileRevalidate(event.request)

        );

    }

});

/* ==========================
   Push Notifications
========================== */

self.addEventListener("push", event => {

    let data = {};

    try {

        data = event.data
            ? event.data.json()
            : {};

    } catch {}

    event.waitUntil(

        self.registration.showNotification(

            data.title || "ISHFADI",

            {

                body:
                    data.body ||
                    "You have a new notification.",

                icon:
                    "/icons/icon-192.png",

                badge:
                    "/icons/icon-72.png",

                image:
                    data.image || undefined,

                tag:
                    data.tag || "ishfadi",

                data:
                    data.url || "/",

                vibrate: [
                    200,
                    100,
                    200
                ]

            }

        )

    );

});

/* ==========================
   Notification Click
========================== */

self.addEventListener("notificationclick", event => {

    event.notification.close();

    const url =
        event.notification.data || "/";

    event.waitUntil(

        clients.matchAll({

            type: "window"

        })

        .then(list => {

            for (const client of list) {

                if ("focus" in client) {

                    client.navigate(url);

                    return client.focus();

                }

            }

            if (clients.openWindow)
                return clients.openWindow(url);

        })

    );

});

/* ==========================
   Background Sync
========================== */

self.addEventListener("sync", event => {

    if (
        event.tag ===
        "ishfadi-sync"
    ) {

        event.waitUntil(

            Promise.resolve()

        );

    }

});