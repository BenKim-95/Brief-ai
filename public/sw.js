// 브리프 서비스 워커. 오프라인 안내 화면과 정적 파일만 캐시한다.
// 뉴스·청약 목록(HTML)과 /api 응답은 캐시하지 않는다 → 오래된 정보가 보이지 않는다.
const VERSION = "v1";
const STATIC_CACHE = `brief-static-${VERSION}`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k.startsWith("brief-") && k !== STATIC_CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // 화면 이동: 네트워크 우선, 실패하면 오프라인 안내 화면
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error())));
    return;
  }

  // 빌드 산출물(파일명에 해시가 붙음): 캐시 우선
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
  }
});

// --- 웹 푸시 ---
// 서버(src/lib/push/payload.ts)가 보내는 { title, body, url } 을 알림으로 보여준다.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "브리프";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/pwa-icon/192",
      badge: "/pwa-icon/192",
      data: { url: typeof data.url === "string" ? data.url : "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  // 사이트 안 경로만 연다(바깥 주소가 들어와도 무시).
  let target = new URL("/", self.location.origin);
  try {
    const u = new URL(event.notification.data?.url ?? "/", self.location.origin);
    if (u.origin === self.location.origin) target = u;
  } catch {}
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (new URL(c.url).origin === target.origin && "focus" in c) {
          return c.navigate(target.href).then((w) => (w ?? c).focus());
        }
      }
      return self.clients.openWindow(target.href);
    }),
  );
});
