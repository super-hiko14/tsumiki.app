// ツミキapp の Service Worker
// ･ページ(index.html)… ネットを先に見て、つながらないときだけ保存しておいたものを出す(更新はすぐ届く)
// ･画像･フォント･音 … 保存しておいたものをすぐ出し、裏で新しいものに入れ替える
// ･Google Fonts … 同じく保存して、ネットがなくても文字の形が変わらないようにする
// ･それ以外(アクセス解析･YouTube など)… 何もしない

const CACHE = 'tsumiki-v1';
const FONT_CACHE = 'tsumiki-fonts-v1';
const NETWORK_TIMEOUT_MS = 4000;

// 初めて開いたときに保存しておくもの(フォントは大きいので、使ったときに保存する)
const PRECACHE = [
    './',
    'manifest.webmanifest',
    'favicon-v2.ico?v=2',
    'favicon-v2.png',
    'favicon-v2-17x.png?v=2',
    'favicon-v2-32x.png?v=2',
    'favicon-v2-48x.png?v=2',
    'apple-touch-icon-v2.png?v=2',
    'app-icon-192.png',
    'app-icon-512.png',
    'tsumiki_logo.svg',
    'tsumiki_logo_akarui.svg',
    '1024,1024_icon.png',
    'guide.png',
    'arrow_down.webp',
    'delete.webp',
    'drag_handle.webp',
    'drag_handle_kuro.webp',
    'export.webp',
    'import.webp',
    'loop_off.webp',
    'loop_on.webp',
    'moon.webp',
    'sun.webp',
    'next.webp',
    'prev.webp',
    'play.webp',
    'pause.webp',
    'settings.webp',
    'no_settings.webp',
    'shuffle_off.webp',
    'shuffle_on.webp',
    'volume.webp',
    'volume_low.webp',
    'volume_mute.webp',
    'warning.webp',
    'del_icon.webp',
    'edit.webp',
    'fullscreen.webp',
    'jidouteisi_timer.webp',
    'music.webp',
    'reco.webp',
    'settigns_general.webp',
    'settigns_timer.webp',
    'settings_e.webp',
    'settings_other.webp',
    'settings_todo.webp',
    'timer.webp',
    'todo.webp',
    'toukei.webp',
    'tuuti.webp',
    'tuuti.wav'
];

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE);
        // 1つ失敗しても残りは保存する
        await Promise.all(PRECACHE.map(url =>
            cache.add(new Request(url, { cache: 'reload' })).catch(() => { })
        ));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        const keep = [CACHE, FONT_CACHE];
        const keys = await caches.keys();
        await Promise.all(keys.filter(k => !keep.includes(k)).map(k => caches.delete(k)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (req.mode === 'navigate' && url.origin === location.origin) {
        event.respondWith(networkFirst(req));
        return;
    }
    if (url.origin === location.origin) {
        // 音楽の Range リクエストなどは触らない
        if (req.headers.has('range')) return;
        event.respondWith(staleWhileRevalidate(req, CACHE));
        return;
    }
    if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
        event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    }
});

async function networkFirst(req) {
    const cache = await caches.open(CACHE);
    const fresh = fetch(req).then(res => {
        if (res && res.ok) cache.put('./', res.clone());
        return res;
    });
    try {
        return await withTimeout(fresh, NETWORK_TIMEOUT_MS);
    } catch (e) {
        // つながらない/遅すぎるときは保存しておいたページ。それもなければネットを待つ
        const cached = await cache.match('./');
        if (cached) return cached;
        return fresh;
    }
}

async function staleWhileRevalidate(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    const update = fetch(req).then(res => {
        // opaque(Google Fonts の一部)も保存できるようにする
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
    }).catch(() => null);
    if (cached) return cached;
    const res = await update;
    return res || Response.error();
}

function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
    });
}

// 通知を押したらアプリを前に出す
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil((async () => {
        const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of list) {
            if ('focus' in c) return c.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow('./');
    })());
});
