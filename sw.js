/* sw.js — 全ファイルをキャッシュしてオフラインで起動できるようにする。
   ファイルを足したら ASSETS に追記し、CACHE のバージョンを上げること。 */
var CACHE = 'kaikei-monster-v5';
var ASSETS = [
  './',
  './index.html',
  './css/base.css',
  './css/skin.css',
  './js/money.js',
  './js/layout.js',
  './js/calibrate.js',
  './js/audio.js',
  './js/keypad.js',
  './js/monster.js',
  './js/app.js',
  './assets/voice/waai.m4a',
  './assets/voice/arigatou.m4a',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

// キャッシュ優先。裏で取り直して次回に備える（オフラインでも必ず開くことを優先）
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(function (hit) {
      var net = fetch(e.request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      }).catch(function () { return hit; });
      return hit || net;
    })
  );
});
