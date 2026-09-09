/* 西安行程 · 离线缓存
   策略：stale-while-revalidate
   - 有缓存 → 立刻返回（服务器挂了也能开），同时后台静默更新
   - 没缓存 → 走网络（首次访问必须联网一次）
*/
const CACHE = "xian-trip-v7";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(ASSETS).catch(function () {}); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  // 跨域资源（百度地图、CDN）不拦截，直接走网络
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then(function (cached) {
      const network = fetch(req)
        .then(function (res) {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then(function (c) { c.put(req, copy); });
          }
          return res;
        })
        .catch(function () {
          // 断网 / 服务器休眠 → 兜底返回缓存
          return cached || new Response("离线且无缓存", { status: 503 });
        });
      return cached || network;
    })
  );
});
