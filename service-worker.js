const CACHE_NAME = "app-trade-cache-v1";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./favicon.png",
  "./manifest.json",
  "./buy.mp3",
  "./sell.mp3",
  "./weak.mp3"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.all(
        FILES_TO_CACHE.map(file =>
          fetch(file)
            .then(response => {
              if (!response.ok) throw new Error("File not found: " + file);
              return cache.put(file, response);
            })
            .catch(err => {
              console.warn("⚠️ File non trovato e ignorato:", file);
            })
        )
      );
    })
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
