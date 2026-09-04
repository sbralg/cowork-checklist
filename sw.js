// sw.js — app-shell cache so every page installs as a PWA (home-screen icon,
// standalone window, instant open) and stays usable with no signal.
//
// NETWORK-FIRST, cache only as a fallback — deliberately not cache-first.
// This repo's whole workflow is "push to main, reload on the phone, see the
// change" (CLAUDE.md's Conventions: "Push the work, let them look at the
// live page, iterate with another commit"). A cache-first service worker
// would silently keep serving yesterday's page after every push, which
// breaks that workflow outright. Network-first keeps a live push visible on
// the very next load while still giving *something* when there's truly no
// connection (a shelf in the pantry aisle with no signal).
const CACHE_NAME = "maga-shell-v1";

const SHELL_FILES = [
  "./",
  "index.html",
  "hoje.html",
  "tarefas.html",
  "compras.html",
  "estoque.html",
  "insumos.html",
  "ingredientes.html",
  "receitas.html",
  "produtos.html",
  "eventos.html",
  "clientes.html",
  "fornecedores.html",
  "financeiro.html",
  "shared-api.js",
  "shared-menu.js",
  "shared-ui.js",
  "shared-format.js",
  "shared-inputs.js",
  "shared-catalog.js",
  "shared-produto-panel.js",
  "shared-base.css",
  "shared-menu.css",
  "shared-modal.css",
  "shared-toast.css",
  "shared-inputs.css",
  "shared-catalog.css",
  "manifest.json",
  "assets/icon-192.png",
  "assets/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      // best-effort: one missing/renamed file must not break the whole
      // install, so cache what succeeds instead of failing atomically
      .then((cache) =>
        Promise.all(
          SHELL_FILES.map((file) => cache.add(file).catch(() => {}))
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  // never touch anything but a plain GET — every mutating call in this app
  // is a POST to maga-api, and none of that traffic should be cached
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  // never intercept the Supabase Edge Function or any other cross-origin
  // request — this cache is the app SHELL only, never API responses
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req).then((cached) => cached || Promise.reject("offline, not cached")))
  );
});
