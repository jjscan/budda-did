/* 전시용 오프라인 캐싱 Service Worker
   - 앱 셸(HTML·매니페스트·아이콘): 설치 시 프리캐시
   - 페이지 이동(navigation): 네트워크 우선, 실패 시 캐시 (온라인이면 최신, 오프라인이면 저장본)
   - 그 외 GET(TF.js CDN, COCO-SSD 모델 파일 포함): 캐시 우선, 최초 1회만 네트워크
   → 전시 전 온라인에서 한 번 열고 카메라를 켜두면, 이후 완전 오프라인 재기동 가능 */

const CACHE = "budda-v1";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

// 외부 리소스 중 캐싱을 허용할 호스트 (TF.js 라이브러리·모델 가중치)
const RUNTIME_HOSTS = /jsdelivr\.net|storage\.googleapis\.com|tfhub\.dev|kaggle\.com/;

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;

  // 페이지 이동: 네트워크 우선 (업데이트 수신), 오프라인이면 캐시
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(resp => {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
          return resp;
        })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // 정적 리소스: 캐시 우선
  e.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(resp => {
        const url = new URL(req.url);
        const cacheable = url.origin === location.origin || RUNTIME_HOSTS.test(url.host);
        if (resp.ok && cacheable) {
          const copy = resp.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return resp;
      });
    })
  );
});
