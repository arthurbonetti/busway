let selectedTripId = null;
let selectedTripData = null;
let watchId = null;
let currentSession = null;
let lastSentPoint = null;
let lastSentAt = 0;

const MIN_SEND_INTERVAL_MS = 4000;
const MIN_MOVE_METERS = 12;

const tripsList = document.getElementById('tripsList');
const tripsEmpty = document.getElementById('tripsEmpty');
const refreshTripsBtn = document.getElementById('refreshTripsBtn');
const startSharingBtn = document.getElementById('startSharingBtn');
const stopSharingBtn = document.getElementById('stopSharingBtn');
const selectedTripLabel = document.getElementById('selectedTripLabel');
const sharingStatus = document.getElementById('sharingStatus');
const gpsInfo = document.getElementById('gpsInfo');
const notification = document.getElementById('notification');

function showNotification(message) {
    notification.textContent = message;
    notification.className = 'notification show';
    setTimeout(() => {
        notification.className = 'notification';
    }, 2800);
}

function loadSession() {
    const raw = sessionStorage.getItem('buswaySession');
    if (!raw) return null;
    return JSON.parse(raw);
}

function assertSession() {
    const session = loadSession();
    if (!session) {
        showNotification('Sessao expirada. Redirecionando...');
        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 1200);
        return null;
    }

    if (!session.isAdmin) {
        showNotification('Acesso permitido somente para administrador.');
        setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
        }, 1200);
        return null;
    }

    return session;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function shouldSend(point) {
    const now = Date.now();

    if (!lastSentPoint) {
        lastSentPoint = point;
        lastSentAt = now;
        return true;
    }

    const elapsed = now - lastSentAt;
    const movedMeters = haversineMeters(
        lastSentPoint.lat,
        lastSentPoint.lon,
        point.lat,
        point.lon
    );

    if (elapsed < MIN_SEND_INTERVAL_MS && movedMeters < MIN_MOVE_METERS) {
        return false;
    }

    lastSentPoint = point;
    lastSentAt = now;
    return true;
}

async function loadActiveTrips() {
    tripsList.innerHTML = '';
    tripsEmpty.style.display = 'none';

    const snapshot = await db.collection('active_trips')
        .where('status', 'in', ['approaching_origin', 'waiting_bus', 'in_transit'])
        .get();

    if (snapshot.empty) {
        tripsEmpty.style.display = 'block';
        return;
    }

    const docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
    });

    docs.forEach((trip) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `trip-card ${selectedTripId === trip.id ? 'selected' : ''}`;
        card.innerHTML = `
            <div class="trip-top">
                <span class="trip-route">Linha ${trip.routeNumber || 'N/A'} - ${trip.routeName || 'Rota'}</span>
                <span class="pill">${trip.status || 'active'}</span>
            </div>
            <div>${trip.origin || 'Origem'} -> ${trip.destination || 'Destino'}</div>
            <div class="trip-user">Trip ID: ${trip.id}</div>
        `;

        card.addEventListener('click', () => {
            selectTrip(trip.id, trip);
        });

        tripsList.appendChild(card);
    });
}

function selectTrip(tripId, tripData) {
    selectedTripId = tripId;
    selectedTripData = tripData;
    selectedTripLabel.textContent = `Selecionado: Linha ${tripData.routeNumber || 'N/A'} (${tripId})`;
    startSharingBtn.disabled = false;
    loadActiveTrips();
}

async function publishLocation(position) {
    if (!selectedTripId) return;

    const point = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        speed: position.coords.speed ?? null,
        heading: position.coords.heading ?? null,
        accuracy: position.coords.accuracy ?? null,
        collectedAt: Date.now()
    };

    if (!shouldSend(point)) {
        return;
    }

    await db.collection('active_trips').doc(selectedTripId).update({
        busLocation: {
            lat: point.lat,
            lon: point.lon,
            speed: point.speed,
            heading: point.heading,
            accuracy: point.accuracy,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        },
        liveTracking: {
            enabled: true,
            source: 'driver',
            driverId: currentSession.uid || currentSession.id || null,
            driverName: currentSession.name || currentSession.email || 'Motorista',
            lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    gpsInfo.textContent = `Ultimo envio: ${new Date().toLocaleTimeString('pt-BR')} | Precisao: ${Math.round(point.accuracy || 0)}m`;
}

function handleGeoError(error) {
    const msgMap = {
        1: 'Permissao de localizacao negada.',
        2: 'Localizacao indisponivel.',
        3: 'Tempo de localizacao excedido.'
    };
    showNotification(msgMap[error.code] || 'Falha ao capturar localizacao.');
}

function setSharingUi(active) {
    sharingStatus.textContent = active ? 'GPS ativo' : 'Inativo';
    sharingStatus.className = active ? 'pill live' : 'pill';
    startSharingBtn.disabled = active || !selectedTripId;
    stopSharingBtn.disabled = !active;
}

async function startSharing() {
    if (!selectedTripId || !selectedTripData) {
        showNotification('Selecione uma viagem antes de iniciar.');
        return;
    }

    if (!navigator.geolocation) {
        showNotification('Geolocalizacao nao suportada neste dispositivo.');
        return;
    }

    if (watchId !== null) {
        showNotification('GPS ja esta ativo.');
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        publishLocation,
        handleGeoError,
        {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 12000
        }
    );

    setSharingUi(true);
    showNotification('Transmissao em tempo real iniciada.');
}

async function stopSharing() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }

    if (selectedTripId) {
        await db.collection('active_trips').doc(selectedTripId).update({
            liveTracking: {
                enabled: false,
                source: 'simulator',
                driverId: currentSession.uid || currentSession.id || null,
                driverName: currentSession.name || currentSession.email || 'Motorista',
                lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    setSharingUi(false);
    showNotification('Transmissao de GPS encerrada.');
}

async function init() {
    currentSession = assertSession();
    if (!currentSession) return;

    setSharingUi(false);
    await loadActiveTrips();

    refreshTripsBtn.addEventListener('click', loadActiveTrips);
    startSharingBtn.addEventListener('click', startSharing);
    stopSharingBtn.addEventListener('click', stopSharing);

    window.addEventListener('beforeunload', () => {
        if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
        }
    });
}

init().catch((error) => {
    console.error('[driver-live-location] Erro de inicializacao:', error);
    showNotification('Erro ao abrir pagina de GPS.');
});
