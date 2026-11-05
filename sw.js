const CACHE_NAME = 'momprenuer-v62';
const ASSETS = [
    './', './index.html', './manifest.json', './style.css', './script.js', './firebase.js',
    './privacy.html', './terms.html', './icon.png', './prestige-digital.jpg', './sw.js',
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/lucide@latest',
    'https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap',
    'https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js',
    'https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js',
    'https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js'
];

self.addEventListener('install', event => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_NAME);
        await Promise.allSettled(ASSETS.map(asset => cache.add(asset)));
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', event => {
    event.waitUntil((async () => {
        const keys = await caches.keys();
        await Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)));
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith((async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        try {
            const response = await fetch(event.request);
            if (response.ok || response.type === 'opaque') {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, response.clone());
            }
            return response;
        } catch (error) {
            if (event.request.mode === 'navigate') return caches.match('./index.html');
            throw error;
        }
    })());
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
        for (const client of windows) if ('focus' in client) return client.focus();
        if (clients.openWindow) return clients.openWindow('./index.html');
    }));
});
