// ponytail: minimal service worker — cache-first for app shell, network-first for avatars
var CACHE = 'nantang-v2';
var SHELL = [
  '.',
  'index.html',
  'nantang-mobile.html',
  'css/theme.css',
  'css/mobile-game.css',
  'js/app.js',
  'js/mobile-bundle.js',
  'js/nantang-mobile-ui.js',
  'js/mobile-ui.js',
  'js/core/utils.js',
  'js/core/nt.js',
  'js/core/auth.js',
  'js/core/self-check.js',
  'js/data/schema.js',
  'js/data/store.js',
  'js/data/backup.js',
  'js/seed-test-data.js',
  'bg-workshop-watercolor.png',
  'manifest.json',
  '92e279b22d04d4c831aec15aa09213df (1).png'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(c) { return c.addAll(SHELL); })
  );
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); }));
    })
  );
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);

  // Network-first for DiceBear avatars: always try fresh, fall back to cache
  if (url.hostname === 'api.dicebear.com') {
    e.respondWith(
      fetch(e.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE).then(function(c) { c.put(e.request, clone); });
        return response;
      }).catch(function() {
        return caches.match(e.request);
      })
    );
    return;
  }

  // Cache-first for everything else (app shell)
  e.respondWith(
    caches.match(e.request).then(function(r) { return r || fetch(e.request); })
  );
});
