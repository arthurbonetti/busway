// Service Worker para Busway PWA
const CACHE_NAME = 'busway-v5';
const CACHE_URLS = [
    '/',
    '/index.html',
    '/pages/user/user-dashboard.html',
    '/pages/user/user-feedbacks.html',
    '/pages/driver/driver-dashboard.html',
    '/pages/driver/driver-live-location.html',
    '/pages/admin/admin-dashboard.html',
    '/pages/admin/admin-feedbacks.html',
    '/pages/public/routes-simple.html',
    '/pages/public/location-simple.html',
    '/pages/public/history.html',
    '/pages/public/settings.html',
    '/pages/public/mobile-gps-setup.html',
    '/pages/finance/financial.html',
    '/styles/global/styles.css',
    '/styles/global/dark-mode.css',
    '/styles/global/ux-improvements.css',
    '/pages/user/user-dashboard.css',
    '/pages/user/user-feedbacks.css',
    '/pages/driver/driver-dashboard.css',
    '/pages/driver/driver-live-location.css',
    '/pages/admin/admin-feedbacks.css',
    '/pages/public/location-simple.css',
    '/pages/public/history.css',
    '/pages/public/settings.css',
    '/pages/finance/financial.css',
    '/firebase-config.js',
    '/js/services/firestore-service.js',
    '/js/script.js',
    '/js/financial-control.js',
    '/js/financial-ui.js',
    '/js/utilities/dark-mode-global.js',
    '/js/utilities/bus-simulator.js',
    '/pages/user/user-dashboard.js',
    '/pages/user/user-feedbacks.js',
    '/pages/driver/driver-dashboard.js',
    '/pages/driver/driver-live-location.js',
    '/pages/admin/admin-dashboard.js',
    '/pages/admin/admin-feedbacks.js',
    '/pages/public/routes-simple.js',
    '/pages/public/location-simple.js',
    '/pages/public/history.js',
    '/pages/public/settings.js',
    '/pages/finance/financial-control.js',
    '/pages/finance/financial-ui.js'
];

// Instalação do Service Worker
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Instalando...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Fazendo cache dos arquivos');
                // Cache apenas arquivos essenciais, ignore erros
                return cache.addAll(CACHE_URLS.slice(0, 10)).catch(err => {
                    console.warn('[Service Worker] Alguns arquivos não puderam ser cacheados:', err);
                });
            })
    );

    // Forçar ativação imediata
    self.skipWaiting();
});

// Ativação do Service Worker
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Ativando...');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Deletar caches antigos
                    if (cacheName !== CACHE_NAME) {
                        console.log('[Service Worker] Removendo cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );

    // Tomar controle imediato
    return self.clients.claim();
});

// Interceptar requisições
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    const url = new URL(event.request.url);

    // Ignorar requisições Firebase/Firestore
    if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
        return;
    }

    // Ignorar requisições de API externa
    if (url.hostname.includes('openstreetmap') || url.hostname.includes('nominatim')) {
        return;
    }

    // Recursos críticos do dashboard e imagens de anúncio não devem ficar presos em cache antigo.
    const isAdAsset = url.pathname.includes('/assets/ads/');
    const isDashboardCritical =
        url.pathname.endsWith('/user-dashboard.html') ||
        url.pathname.endsWith('/user-dashboard.js');

    if (isAdAsset || isDashboardCritical) {
        event.respondWith(
            fetch(event.request, { cache: 'no-store' })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Estratégia: Network First, fallback para Cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (!response || response.status !== 200) {
                    return response;
                }

                // Clonar a resposta
                const responseToCache = response.clone();

                // Atualizar cache
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return response;
            })
            .catch(() => {
                // Se falhar, buscar do cache
                return caches.match(event.request);
            })
    );
});

// Mensagens do app
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
