// shared-pwa.js — registers sw.js so every page installs as a PWA (home
// screen icon, standalone window, offline app shell). Loaded via a plain
// <script src> tag, same convention as every other shared-*.js file here —
// no bundler, no build step. See sw.js's own comment for the caching
// strategy (network-first, so a fresh `git push` is never masked by a
// stale cached page).
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      // never block the page over this — a failed registration just means
      // no offline shell / no home-screen install prompt, not a broken app
      console.warn("service worker registration failed:", err);
    });
  });
}
