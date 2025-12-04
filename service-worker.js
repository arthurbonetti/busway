// Service Worker para Busway PWA
const CACHE_NAME = 'busway-v1';
const CACHE_URLS = [
    '/',
    '/index.html',
    '/routes.html',
    '/user-dashboard.html',
    '/admin-dashboard.html',
    '/financial.html',
    '/history.html',
    '/settings.html',
    '/styles.css',
    '/routes.css',
    '/user-dashboard.css',
    '/financial.css',
    '/firebase-config.js',
    '/firestore-service.js',
    '/script.js',
    '/routes.js',
    '/admin-dashboard.js',
    '/user-dashboard.js',
    '/real-routes.js',
    '/route-cache.js',
    '/osm-routing.js',
    '/notification-system.js',
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
    const url = new URL(event.request.url);

    // Ignorar requisições Firebase/Firestore
    if (url.hostname.includes('firebase') || url.hostname.includes('google')) {
        return;
    }

    // Ignorar requisições de API externa
    if (url.hostname.includes('openstreetmap') || url.hostname.includes('nominatim')) {
        return;
    }

    // Estratégia: Network First, fallback para Cache
    event.respondWith(
        fetch(event.request)
            .then((response) => {
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
