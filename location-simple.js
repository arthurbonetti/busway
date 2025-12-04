// LOCATION SIMPLE - MVP Rastreamento Básico
// Mostra o ônibus se movendo na rota

let map = null;
let busMarker = null;
let routeLine = null;
let originMarker = null;
let destMarker = null;
let activeTripData = null;
let busSimulator = null;
let currentUserId = null;
let tripUnsubscriber = null;

// Ícones personalizados
const busIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="6" width="16" height="14" rx="2" fill="#ef4444" stroke="white" stroke-width="2"/>
            <circle cx="8" cy="17" r="1.5" fill="white"/>
            <circle cx="16" cy="17" r="1.5" fill="white"/>
            <rect x="6" y="8" width="12" height="6" fill="white" opacity="0.8"/>
        </svg>
    `),
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

const stopIcon = L.icon({
    iconUrl: 'data:image/svg+xml;base64,' + btoa(`
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#10b981" stroke="white" stroke-width="2"/>
            <path d="M12 6v12M6 12h12" stroke="white" stroke-width="2"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16]
});

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[location-simple] Inicializando...');

    // Verificar sessão
    const session = loadUserSession();
    if (!session) {
        alert('Sessão expirada');
        window.location.href = 'index.html';
        return;
    }

    currentUserId = session.uid || session.id;

    // Carregar active trip
    await loadActiveTrip();

    if (!activeTripData) {
        alert('Nenhuma viagem ativa encontrada');
        window.location.href = 'routes-simple.html';
        return;
    }

    // Inicializar mapa
    initMap();

    // Configurar listener em tempo real
    setupRealtimeListener();

    // Configurar listener para evento de viagem concluída
    window.addEventListener('tripCompleted', handleTripCompleted);
});

function loadUserSession() {
    const sessionData = sessionStorage.getItem('buswaySession') ||
                       sessionStorage.getItem('user_session') ||
                       localStorage.getItem('user_session');
    return sessionData ? JSON.parse(sessionData) : null;
}

// ========== CARREGAR VIAGEM ATIVA ==========

async function loadActiveTrip() {
    console.log('[loadActiveTrip] Buscando viagem ativa...');

    // Tentar sessionStorage primeiro
    const storedTrip = sessionStorage.getItem('activeTrip');
    if (storedTrip) {
        activeTripData = JSON.parse(storedTrip);
        console.log('[loadActiveTrip] Viagem carregada do sessionStorage:', activeTripData);
        updateTripInfo();
        return;
    }

    // Buscar no Firestore
    try {
        const snapshot = await db.collection('active_trips')
            .where('userId', '==', currentUserId)
            .where('status', 'in', ['waiting_bus', 'in_transit'])
            .limit(1)
            .get();

        if (snapshot.empty) {
            console.error('[loadActiveTrip] Nenhuma viagem ativa encontrada');
            return;
        }

        const doc = snapshot.docs[0];
        activeTripData = { id: doc.id, ...doc.data() };
        console.log('[loadActiveTrip] Viagem encontrada no Firestore:', activeTripData);
        updateTripInfo();

    } catch (error) {
        console.error('[loadActiveTrip] Erro:', error);
    }
}

function updateTripInfo() {
    // Atualizar UI com dados da viagem
    document.getElementById('routeBadge').textContent = activeTripData.routeNumber || 'N/A';
    document.getElementById('routeName').textContent = activeTripData.routeName || 'Rota';
    document.getElementById('routeOrigin').textContent = activeTripData.origin || '---';
    document.getElementById('routeDestination').textContent = activeTripData.destination || '---';
    document.getElementById('tripPrice').textContent = `R$ ${(activeTripData.price || 0).toFixed(2).replace('.', ',')}`;
    document.getElementById('totalDuration').textContent = `${activeTripData.duration || 0} min`;
    document.getElementById('driverName').textContent = activeTripData.driver || 'N/A';

    // Atualizar status
    updateStatus(activeTripData.status || 'waiting_bus');
}

function updateStatus(status) {
    const statusEl = document.getElementById('tripStatus');
    const statusIconEl = document.querySelector('#statusRow .info-icon');
    const priceNoteEl = document.getElementById('priceNote');

    const statusConfig = {
        'waiting_bus': {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a"><circle cx="12" cy="12" r="10" stroke-width="2"/><path d="M12 6v6l4 2" stroke-width="2" stroke-linecap="round"/></svg>',
            text: 'Aguardando ônibus...',
            note: 'Será debitado quando o ônibus chegar'
        },
        'in_transit': {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z" stroke-width="2"/><circle cx="7.5" cy="15.5" r="1.5" fill="#1a1a1a"/><circle cx="16.5" cy="15.5" r="1.5" fill="#1a1a1a"/><path d="M6 6h12v5H6z" stroke-width="2"/></svg>',
            text: 'Em viagem',
            note: 'Valor já debitado'
        },
        'completed': {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
            text: 'Viagem concluída!',
            note: 'Obrigado por usar o Busway'
        },
        'cancelled': {
            icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a1a1a"><circle cx="12" cy="12" r="10" stroke-width="2"/><line x1="15" y1="9" x2="9" y2="15" stroke-width="2" stroke-linecap="round"/><line x1="9" y1="9" x2="15" y2="15" stroke-width="2" stroke-linecap="round"/></svg>',
            text: 'Viagem cancelada',
            note: 'Nenhum valor foi debitado'
        }
    };

    const config = statusConfig[status] || statusConfig['waiting_bus'];

    // Update status icon
    if (statusIconEl) {
        statusIconEl.innerHTML = config.icon;
    }

    // Update status text
    statusEl.textContent = config.text;

    // Update price note
    priceNoteEl.textContent = config.note;
}

// ========== INICIALIZAR MAPA ==========

function initMap() {
    console.log('[initMap] Inicializando mapa');

    // Coordenadas padrão (centro da rota)
    const defaultLat = activeTripData.originCoords?.lat || -27.0945;
    const defaultLng = activeTripData.originCoords?.lng || -52.6166;

    // Criar mapa
    map = L.map('map').setView([defaultLat, defaultLng], 13);

    // Adicionar camada OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Desenhar rota se tiver path
    if (activeTripData.path && activeTripData.path.length > 0) {
        console.log('[initMap] Desenhando rota com', activeTripData.path.length, 'pontos');

        routeLine = L.polyline(
            activeTripData.path.map(p => [p.lat, p.lon]),
            { color: '#667eea', weight: 5, opacity: 0.7 }
        ).addTo(map);

        // Ajustar zoom para mostrar rota completa
        map.fitBounds(routeLine.getBounds());
    }

    // Adicionar marcadores de origem e destino
    if (activeTripData.originCoords) {
        originMarker = L.marker(
            [activeTripData.originCoords.lat, activeTripData.originCoords.lng],
            { icon: stopIcon }
        ).addTo(map).bindPopup(`🟢 Origem: ${activeTripData.origin}`);
    }

    if (activeTripData.destinationCoords) {
        destMarker = L.marker(
            [activeTripData.destinationCoords.lat, activeTripData.destinationCoords.lng],
            { icon: stopIcon }
        ).addTo(map).bindPopup(`🔴 Destino: ${activeTripData.destination}`);
    }

    // Iniciar simulador de ônibus
    startBusSimulator();
}

// ========== SIMULADOR DE ÔNIBUS ==========

function startBusSimulator() {
    console.log('[startBusSimulator] Iniciando simulador');

    if (!activeTripData || !activeTripData.id) {
        console.error('[startBusSimulator] Dados da viagem ausentes');
        return;
    }

    // Usar path da rota ou gerar path mock
    let routePath = activeTripData.path;

    if (!routePath || routePath.length === 0) {
        console.warn('[startBusSimulator] Sem path, gerando mock');

        const startLat = activeTripData.originCoords?.lat || -27.0945;
        const startLng = activeTripData.originCoords?.lng || -52.6166;
        const endLat = activeTripData.destinationCoords?.lat || -27.1045;
        const endLng = activeTripData.destinationCoords?.lng || -52.6266;

        routePath = BusSimulator.generateMockPath(startLat, startLng, endLat, endLng, 30);
    }

    console.log('[startBusSimulator] Path principal com', routePath.length, 'pontos');

    // Pegar pré-rota (trajeto até a origem) se existir
    const preRoutePath = activeTripData.preRoutePath || null;

    if (preRoutePath && preRoutePath.length > 0) {
        console.log('[startBusSimulator] Pré-rota com', preRoutePath.length, 'pontos');
        console.log('[startBusSimulator] Ônibus começará em:', activeTripData.busStartLocation?.name);
    } else {
        console.log('[startBusSimulator] Sem pré-rota, ônibus começa na origem');
    }

    // Criar e iniciar simulador (com pré-rota se disponível)
    busSimulator = new BusSimulator(activeTripData.id, routePath, 40, preRoutePath);
    busSimulator.start();
}

// ========== LISTENER EM TEMPO REAL ==========

function setupRealtimeListener() {
    if (!activeTripData || !activeTripData.id) return;

    console.log('[setupRealtimeListener] Configurando listener para:', activeTripData.id);

    tripUnsubscriber = db.collection('active_trips')
        .doc(activeTripData.id)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                console.warn('[Listener] Viagem não existe mais');
                return;
            }

            const data = doc.data();
            console.log('[Listener] Atualização:', data.status, data.busLocation);

            // Atualizar dados locais
            activeTripData = { id: doc.id, ...data };

            // Atualizar status
            updateStatus(data.status);

            // Atualizar posição do ônibus
            if (data.busLocation) {
                updateBusMarker(data.busLocation.lat, data.busLocation.lon);

                // Calcular distância e ETA
                if (activeTripData.originCoords) {
                    updateDistanceAndETA(data.busLocation);
                }
            }
        }, (error) => {
            console.error('[Listener] Erro:', error);
        });
}

function updateBusMarker(lat, lon) {
    if (!busMarker) {
        // Criar marcador do ônibus
        busMarker = L.marker([lat, lon], { icon: busIcon })
            .addTo(map)
            .bindPopup('<b>Ônibus</b>');
    } else {
        // Atualizar posição
        busMarker.setLatLng([lat, lon]);
    }
}

function updateDistanceAndETA(busLocation) {
    if (!activeTripData.originCoords) return;

    // Calcular distância até origem
    const distance = haversineDistance(
        busLocation.lat, busLocation.lon,
        activeTripData.originCoords.lat, activeTripData.originCoords.lng
    );

    const distanceMeters = Math.round(distance * 1000);

    document.getElementById('busDistance').textContent =
        distanceMeters < 1000
            ? `${distanceMeters} m`
            : `${distance.toFixed(1)} km`;

    // Calcular ETA (assumindo 40 km/h)
    const etaMinutes = Math.ceil((distance / 40) * 60);

    document.getElementById('etaValue').textContent =
        etaMinutes < 60
            ? `${etaMinutes} min`
            : `${Math.floor(etaMinutes / 60)}h ${etaMinutes % 60}min`;
}

// ========== HANDLER PARA VIAGEM CONCLUÍDA ==========

function handleTripCompleted(event) {
    console.log('[handleTripCompleted] Viagem concluída!', event.detail);

    const { routeName, routeNumber, origin, destination } = event.detail;

    // Atualizar status visual para "concluída"
    updateStatus('completed');

    // Mostrar notificação
    showCompletionNotification(routeName, routeNumber, origin, destination);

    // Redirecionar para o histórico após 3 segundos
    setTimeout(() => {
        console.log('[handleTripCompleted] Redirecionando para histórico...');
        window.location.href = 'history.html';
    }, 3000);
}

function showCompletionNotification(routeName, routeNumber, origin, destination) {
    // Criar elemento de notificação se não existir
    let notification = document.getElementById('tripCompletedNotification');

    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'tripCompletedNotification';
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 32px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            text-align: center;
            min-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(notification);

        // Adicionar CSS de animação
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translate(-50%, -60%); opacity: 0; }
                to { transform: translate(-50%, -50%); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    notification.innerHTML = `
        <div style="margin-bottom: 16px; display: flex; justify-content: center;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#10b981" stroke="#10b981" stroke-width="2"/>
                <path d="M8 12l2 2 4-4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
        </div>
        <h2 style="font-size: 24px; font-weight: 600; color: #10b981; margin-bottom: 12px;">
            Viagem Concluída!
        </h2>
        <p style="font-size: 16px; color: #4a5568; margin-bottom: 8px;">
            <strong>Linha ${routeNumber}</strong> - ${routeName}
        </p>
        <p style="font-size: 14px; color: #718096;">
            ${origin} → ${destination}
        </p>
        <p style="font-size: 13px; color: #a0aec0; margin-top: 16px;">
            Redirecionando para o histórico...
        </p>
    `;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ========== CANCELAR VIAGEM ==========

async function cancelTrip() {
    if (!confirm('Deseja realmente cancelar esta viagem?')) {
        return;
    }

    console.log('[cancelTrip] Cancelando viagem');

    try {
        // Parar simulador
        if (busSimulator) {
            busSimulator.stop();
        }

        // Atualizar status no Firestore
        if (activeTripData && activeTripData.id) {
            await db.collection('active_trips').doc(activeTripData.id).update({
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        alert('Viagem cancelada');
        window.location.href = 'routes-simple.html';

    } catch (error) {
        console.error('[cancelTrip] Erro:', error);
        alert('Erro ao cancelar viagem');
    }
}

// ========== CLEANUP ==========

window.addEventListener('beforeunload', () => {
    if (busSimulator) {
        busSimulator.stop();
    }

    if (tripUnsubscriber) {
        tripUnsubscriber();
    }
});

// ========== EXPOR FUNÇÕES GLOBALMENTE ==========

window.cancelTrip = cancelTrip;

console.log('[location-simple] Script carregado');
