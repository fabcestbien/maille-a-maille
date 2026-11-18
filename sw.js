/* Maille à maille — fonctionnement hors ligne et mises à jour.
   À chaque nouvelle version publiée, augmente VERSION ici
   ET la constante APP_VERSION dans index.html. */
var VERSION = '3';
var CACHE = 'maille-a-maille-v' + VERSION;
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      /* cache: 'reload' contourne le cache HTTP de GitHub Pages : on stocke bien les nouveaux fichiers. */
      return cache.addAll(ASSETS.map(function (u) { return new Request(u, { cache: 'reload' }); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function fromCache(req) {
  return caches.match(req, { ignoreSearch: true }).then(function (r) {
    return r || caches.match('./index.html') || caches.match('./');
  });
}

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  /* Page de l'app : réseau d'abord (version à jour), copie locale si pas de réseau. */
  if (req.mode === 'navigate') {
    event.respondWith(new Promise(function (resolve) {
      var settled = false;
      var timer = setTimeout(function () {
        fromCache(req).then(function (r) { if (r && !settled) { settled = true; resolve(r); } });
      }, 3500);
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        }
        if (!settled) { settled = true; clearTimeout(timer); resolve(res); }
      }).catch(function () {
        fromCache(req).then(function (r) {
          if (!settled) { settled = true; clearTimeout(timer); resolve(r || Response.error()); }
        });
      });
    }));
    return;
  }

  /* Icônes et manifeste : copie locale immédiate, rafraîchie en arrière-plan. */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (cached) {
      var network = fetch(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE).then(function (cache) { cache.put(req, copy); });
        }
        return res;
      }).catch(function () { return cached; });
      return cached || network;
    })
  );
});
