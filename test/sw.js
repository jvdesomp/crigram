// CRIGram service worker: lets the game open offline once it has been visited.
// Always tries the network first, so new puzzles and game updates show up right away,
// and falls back to the last saved copy when there is no connection or the network takes over 3 s.
// the cache name includes the folder, so a test copy in a subfolder keeps its own offline files
const CACHE = self.registration.scope + "|crigram-v2";   // keep the name: the saved files stay valid
const FILES = [
  "./",
  "./index.html",
  "./crigram.html",
  "./crigram.json",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith(self.registration.scope + "|") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // "no-cache" makes the browser check with GitHub for a newer version instead of reusing
  // a copy that GitHub allows to be kept for up to 10 minutes
  const network = fetch(req, { cache: "no-cache" })
    .then(res => {
      if (res.ok) {
        const copy = res.clone();
        return caches.open(CACHE).then(cache => cache.put(req, copy)).then(() => res, () => res);
      }
      return res;
    });
  const saved = () => caches.match(req, { ignoreSearch: true });
  // on a slow connection the saved copy is used after 3 s; the network answer still refreshes it for next time
  const slow = new Promise(resolve => setTimeout(resolve, 3000)).then(saved).then(copy => copy || network.catch(saved));
  event.respondWith(Promise.race([network.catch(saved), slow]));
  event.waitUntil(network.catch(() => {}));
});
