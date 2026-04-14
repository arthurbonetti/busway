// Service Worker para Busway PWA
const CACHE_NAME = 'busway-v3';
const CACHE_URLS = [
    '/',
    '/landing.html',
    '/landing.css',
    '/index.html',
    '/user-dashboard.html',
    '/admin-dashboard.html',
    '/admin-feedbacks.html',
    '/routes-simple.html',
    '/location-simple.html',
    '/financial.html',
    '/history.html',
    '/settings.html',
    '/styles.css',
    '/user-dashboard.css',
    '/financial.css',
    '/dark-mode.css',
    '/location-simple.css',
    '/admin-feedbacks.css',
    '/firebase-config.js',
    '/firestore-service.js',
    '/script.js',
    '/routes-simple.js',
    '/admin-dashboard.js',
    '/admin-feedbacks.js',
    '/user-dashboard.js',
    '/dark-mode-global.js',
    '/bus-simulator.js',
    '/location-simple.js',
    '/financial-control.js',
    '/financial-ui.js',
    '/history.js',
    '/settings.js'
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
