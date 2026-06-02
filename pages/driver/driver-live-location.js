let selectedTripId = null;
let selectedTripData = null;
let watchId = null;
let currentSession = null;
let lastSentPoint = null;
let lastSentAt = 0;
let lastCapturedPoint = null;
let presenceIntervalId = null;
let selectedAssignedRoute = null;

function normalizeRouteValueList(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    if (typeof value === 'string') {
        return value
            .split(/[;,|]/)
            .map((item) => String(item || '').trim())
            .filter(Boolean);
    }

    return [];
}

function formatRouteLabel(routeNumber, routeName) {
    if (routeNumber) {
        return `Linha ${routeNumber}${routeName ? ` - ${routeName}` : ''}`;
    }
    return routeName || 'Rota designada';
}

function getAssignedRoutesFromSession() {
    const sessionRoutes = [];

    const routesFromList = Array.isArray(currentSession?.assignedRoutes) ? currentSession.assignedRoutes : [];
    routesFromList.forEach((route) => {
        const normalized = {
            id: String(route?.id || '').trim() || null,
            number: String(route?.number || '').trim() || null,
            name: String(route?.name || '').trim() || null
        };

        if (normalized.id || normalized.number || normalized.name) {
            sessionRoutes.push(normalized);
        }
    });

    const ids = normalizeRouteValueList(currentSession?.assignedRouteIds);
    const numbers = normalizeRouteValueList(currentSession?.assignedRouteNumbers);
    const names = normalizeRouteValueList(currentSession?.assignedRouteNames);

    const maxLength = Math.max(ids.length, numbers.length, names.length);
    for (let index = 0; index < maxLength; index += 1) {
        const normalized = {
            id: String(ids[index] || '').trim() || null,
            number: String(numbers[index] || '').trim() || null,
            name: String(names[index] || '').trim() || null
        };

        if (normalized.id || normalized.number || normalized.name) {
            sessionRoutes.push(normalized);
        }
    }

    const legacy = {
        id: String(currentSession?.assignedRouteId || '').trim() || null,
        number: String(currentSession?.assignedRouteNumber || '').trim() || null,
        name: String(currentSession?.assignedRouteName || '').trim() || null
    };

    if (legacy.id || legacy.number || legacy.name) {
        sessionRoutes.push(legacy);
    }

    const uniqueKeys = new Set();
    const deduped = [];

    sessionRoutes.forEach((route) => {
        const key = `${route.id || ''}|${(route.number || '').toLowerCase()}|${(route.name || '').toLowerCase()}`;
        if (uniqueKeys.has(key)) return;
        uniqueKeys.add(key);
        deduped.push(route);
    });

    return deduped;
}

function getAssignedRouteTarget() {
    const primaryRoute = selectedAssignedRoute || getAssignedRoutesFromSession()[0] || null;

    if (!primaryRoute || (!primaryRoute.id && !primaryRoute.number)) {
        return null;
    }

    return {
        mode: 'route',
        routeId: primaryRoute.id || null,
        routeNumber: primaryRoute.number || null,
        routeName: primaryRoute.name || null
    };
}

function getTrackingTarget() {
    if (selectedTripId && selectedTripData) {
        return {
            mode: 'trip',
            tripId: selectedTripId,
            routeId: String(selectedTripData.routeId || '').trim() || null,
            routeNumber: String(selectedTripData.routeNumber || '').trim() || null,
            routeName: String(selectedTripData.routeName || '').trim() || null
        };
    }

    return getAssignedRouteTarget();
}

function getRouteTargetFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const routeId = String(params.get('routeId') || '').trim();
    const routeNumber = String(params.get('routeNumber') || '').trim();
    const routeName = String(params.get('routeName') || '').trim();

    if (!routeId && !routeNumber && !routeName) {
        return null;
    }

    return {
        id: routeId || null,
        number: routeNumber || null,
        name: routeName || null
    };
}

function resolveSelectedAssignedRoute() {
    const queryRoute = getRouteTargetFromQuery();
    if (!queryRoute) {
        selectedAssignedRoute = null;
        return;
    }

    const assignedRoutes = getAssignedRoutesFromSession();

    const matchedById = queryRoute.id
        ? assignedRoutes.find((route) => String(route.id || '').trim() === queryRoute.id)
        : null;

    if (matchedById) {
        selectedAssignedRoute = matchedById;
        return;
    }

    const queryRouteNumber = String(queryRoute.number || '').trim().toLowerCase();
    const matchedByNumber = queryRouteNumber
        ? assignedRoutes.find((route) => String(route.number || '').trim().toLowerCase() === queryRouteNumber)
        : null;

    if (matchedByNumber) {
        selectedAssignedRoute = matchedByNumber;
        return;
    }

    selectedAssignedRoute = null;
}

function updateSelectionLabel() {
    const target = getTrackingTarget();

    if (!target) {
        selectedTripLabel.textContent = 'Selecione uma viagem para iniciar.';
        return;
    }

    if (target.mode === 'trip') {
        selectedTripLabel.textContent = `Selecionado: ${formatRouteLabel(target.routeNumber, target.routeName)} (${target.tripId})`;
        return;
    }

    selectedTripLabel.textContent = `Selecionado: ${formatRouteLabel(target.routeNumber, target.routeName)} (rota designada)`;
}

function getSessionUserId() {
    return currentSession?.uid || currentSession?.id || null;
}

async function refreshDriverProfile() {
    const userId = getSessionUserId();
    if (!userId) return;

    try {
        const doc = await db.collection('users').doc(userId).get();
        if (!doc.exists) return;

        const data = doc.data() || {};
        currentSession = {
            ...currentSession,
            ...data,
            uid: currentSession.uid || currentSession.id || userId,
            id: currentSession.id || currentSession.uid || userId
        };

        sessionStorage.setItem('buswaySession', JSON.stringify(currentSession));
    } catch (error) {
        console.warn('[driver-live-location] Falha ao atualizar perfil do motorista:', error);
    }
}

function isTripAllowedForAssignedRoute(trip) {
    const assignedRoutes = getAssignedRoutesFromSession();
    const assignedRouteIds = assignedRoutes
        .map((route) => String(route.id || '').trim())
        .filter(Boolean);
    const assignedRouteNumbers = assignedRoutes
        .map((route) => String(route.number || '').trim().toLowerCase())
        .filter(Boolean);

    if (!assignedRouteIds.length && !assignedRouteNumbers.length) {
        return true;
    }

    const tripRouteId = String(trip.routeId || '').trim();
    const tripRouteNumber = String(trip.routeNumber || '').trim().toLowerCase();

    if (tripRouteId && assignedRouteIds.includes(tripRouteId)) {
        return true;
    }

    if (tripRouteNumber && assignedRouteNumbers.includes(tripRouteNumber)) {
        return true;
    }

    return false;
}

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

async function updateDriverPresence(isOnline) {
    const userId = getSessionUserId();
    if (!userId) return;

    try {
        await db.collection('users').doc(userId).set({
            isOnline,
            isLoggedIn: isOnline,
            lastActive: firebase.firestore.FieldValue.serverTimestamp(),
            lastActiveAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (error) {
        console.warn('[driver-live-location] Falha ao atualizar presença do motorista:', error);
    }
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

    if (!(session.isDriver || session.role === 'driver')) {
        showNotification('Acesso permitido somente para motorista.');
        setTimeout(() => {
            if (session.isAdmin) {
                window.location.href = '../admin/admin-dashboard.html';
            } else {
                window.location.href = '../user/user-dashboard.html';
            }
        }, 1200);
        return null;
    }

    return session;
}

function isSecureGpsContext() {
    return window.isSecureContext || window.location.protocol === 'http:' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
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

function updateGpsDisplay(showSendTime = false) {
    if (!lastCapturedPoint) {
        gpsInfo.textContent = 'Sem leitura ainda.';
        return;
    }

    const latText = `Lat: ${lastCapturedPoint.lat.toFixed(6)}`;
    const lngText = `Lng: ${lastCapturedPoint.lon.toFixed(6)}`;
    const accuracyText = `Precisao: ${Math.round(lastCapturedPoint.accuracy || 0)}m`;

    if (showSendTime) {
        const sendTime = `Ultimo envio: ${new Date().toLocaleTimeString('pt-BR')}`;
        gpsInfo.textContent = `${latText} | ${lngText} | ${accuracyText} | ${sendTime}`;
    } else {
        const captureTime = `Hora: ${new Date(lastCapturedPoint.collectedAt).toLocaleTimeString('pt-BR')}`;
        gpsInfo.textContent = `${latText} | ${lngText} | ${accuracyText} | ${captureTime}`;
    }
}

function getTripIdFromQuery() {
    const params = new URLSearchParams(window.location.search);
    return params.get('tripId');
}

function isTripAssignedToCurrentDriver(trip) {
    if (!currentSession) return false;

    const sessionName = String(currentSession.name || '').trim().toLowerCase();
    const sessionEmail = String(currentSession.email || '').trim().toLowerCase();
    const tripDriver = String(trip.driver || '').trim().toLowerCase();
    const tripDriverId = String(trip.driverId || '').trim();
    const trackingDriverId = String(trip.liveTracking?.driverId || '').trim();
    const sessionId = String(currentSession.uid || currentSession.id || '').trim();

    if (tripDriverId && sessionId && tripDriverId === sessionId) {
        return true;
    }

    if (trackingDriverId && sessionId && trackingDriverId === sessionId) {
        return true;
    }

    if (tripDriver && sessionName && tripDriver === sessionName) {
        return true;
    }

    if (tripDriver && sessionEmail && tripDriver === sessionEmail) {
        return true;
    }

    if (!tripDriver || tripDriver === 'n/a') {
        return true;
    }

    return false;
}

async function loadActiveTrips() {
    await refreshDriverProfile();
    await updateDriverPresence(true);

    tripsList.innerHTML = '';
    tripsEmpty.style.display = 'none';

    const snapshot = await db.collection('active_trips')
        .where('status', 'in', ['approaching_origin', 'waiting_bus', 'in_transit'])
        .get();

    if (snapshot.empty) {
        selectedTripId = null;
        selectedTripData = null;
        tripsEmpty.textContent = 'Nenhuma viagem ativa encontrada. Você pode transmitir pela rota designada.';
        tripsEmpty.style.display = 'block';
        updateSelectionLabel();
        setSharingUi(watchId !== null);
        return;
    }

    let docs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    docs = docs.filter((trip) => isTripAssignedToCurrentDriver(trip));
    docs = docs.filter((trip) => isTripAllowedForAssignedRoute(trip));

    if (!docs.length) {
        selectedTripId = null;
        selectedTripData = null;
        tripsEmpty.textContent = 'Nenhuma viagem ativa atribuída ao seu usuário de motorista.';
        tripsEmpty.style.display = 'block';
        updateSelectionLabel();
        setSharingUi(watchId !== null);
        return;
    }

    if (!docs.some((trip) => trip.id === selectedTripId)) {
        selectedTripId = null;
        selectedTripData = null;
    }

    docs.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
    });

    const queryTripId = getTripIdFromQuery();

    docs.forEach((trip) => {
        if (queryTripId && !selectedTripId && queryTripId === trip.id) {
            selectedTripId = trip.id;
            selectedTripData = trip;
        }

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

    updateSelectionLabel();
    setSharingUi(watchId !== null);
}

function selectTrip(tripId, tripData) {
    selectedTripId = tripId;
    selectedTripData = tripData;
    updateSelectionLabel();
    setSharingUi(watchId !== null);
    loadActiveTrips();
}

async function publishLocation(position) {
    const trackingTarget = getTrackingTarget();
    if (!trackingTarget) return;

    const point = {
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        speed: position.coords.speed ?? null,
        heading: position.coords.heading ?? null,
        accuracy: position.coords.accuracy ?? null,
        collectedAt: Date.now()
    };

    lastCapturedPoint = point;
    updateGpsDisplay();

    if (!shouldSend(point)) {
        return;
    }

    const updates = [];

    if (selectedTripId) {
        updates.push(db.collection('active_trips').doc(selectedTripId).update({
            busLocation: {
                lat: point.lat,
                lon: point.lon,
                speed: point.speed,
                heading: point.heading,
                accuracy: point.accuracy,
                deviceTimestamp: point.collectedAt,
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
        }));
    }

    if (trackingTarget.routeId) {
        updates.push(db.collection('routes').doc(trackingTarget.routeId).set({
            liveLocation: {
                lat: point.lat,
                lon: point.lon,
                speed: point.speed,
                heading: point.heading,
                accuracy: point.accuracy,
                deviceTimestamp: point.collectedAt,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            },
            liveTracking: {
                enabled: true,
                source: 'driver',
                driverId: currentSession.uid || currentSession.id || null,
                driverName: currentSession.name || currentSession.email || 'Motorista',
                routeId: trackingTarget.routeId,
                routeNumber: trackingTarget.routeNumber || null,
                routeName: trackingTarget.routeName || null,
                lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
    }

    if (updates.length) {
        await Promise.all(updates);
    }

    updateGpsDisplay(true);
}

async function disableNonSelectedAssignedRoutes(activeRouteId) {
    const routeId = String(activeRouteId || '').trim();
    if (!routeId) return;

    const assignedRoutes = getAssignedRoutesFromSession();
    const routesToDisable = assignedRoutes
        .map((route) => String(route.id || '').trim())
        .filter((id) => id && id !== routeId);

    if (!routesToDisable.length) {
        return;
    }

    await Promise.all(routesToDisable.map((otherRouteId) => (
        db.collection('routes').doc(otherRouteId).set({
            liveTracking: {
                enabled: false,
                source: 'simulator',
                driverId: currentSession.uid || currentSession.id || null,
                driverName: currentSession.name || currentSession.email || 'Motorista',
                routeId: otherRouteId,
                lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true })
    )));
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
    startSharingBtn.disabled = active || !getTrackingTarget();
    stopSharingBtn.disabled = !active;
}

async function startSharing() {
    const trackingTarget = getTrackingTarget();
    if (!trackingTarget) {
        showNotification('Selecione uma viagem ou tenha uma rota designada para iniciar.');
        return;
    }

    if (!isSecureGpsContext()) {
        showNotification('GPS real exige HTTPS ou localhost. Abra esta pagina via tunnel HTTPS.');
        gpsInfo.textContent = 'Contexto inseguro detectado: use HTTPS/localhost para ativar o GPS real.';
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

    if (trackingTarget.routeId) {
        await disableNonSelectedAssignedRoutes(trackingTarget.routeId);
    }

    gpsInfo.textContent = 'Aguardando primeira leitura do GPS do celular...';

    try {
        const freshPosition = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 20000
            });
        });

        await publishLocation(freshPosition);
    } catch (error) {
        console.warn('[driver-live-location] Falha ao obter leitura inicial:', error);
    }

    watchId = navigator.geolocation.watchPosition(
        publishLocation,
        handleGeoError,
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 20000
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

    const trackingTarget = getTrackingTarget();
    const updates = [];

    if (selectedTripId) {
        updates.push(db.collection('active_trips').doc(selectedTripId).update({
            liveTracking: {
                enabled: false,
                source: 'simulator',
                driverId: currentSession.uid || currentSession.id || null,
                driverName: currentSession.name || currentSession.email || 'Motorista',
                lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }));
    }

    if (trackingTarget?.routeId) {
        updates.push(db.collection('routes').doc(trackingTarget.routeId).set({
            liveTracking: {
                enabled: false,
                source: 'simulator',
                driverId: currentSession.uid || currentSession.id || null,
                driverName: currentSession.name || currentSession.email || 'Motorista',
                routeId: trackingTarget.routeId,
                routeNumber: trackingTarget.routeNumber || null,
                routeName: trackingTarget.routeName || null,
                lastGpsAt: firebase.firestore.FieldValue.serverTimestamp()
            },
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
    }

    if (updates.length) {
        await Promise.all(updates);
    }

    setSharingUi(false);
    showNotification('Transmissao de GPS encerrada.');
}

async function init() {
    currentSession = assertSession();
    if (!currentSession) return;

    await refreshDriverProfile();
    resolveSelectedAssignedRoute();
    await updateDriverPresence(true);

    if (presenceIntervalId) {
        clearInterval(presenceIntervalId);
    }
    presenceIntervalId = setInterval(() => {
        updateDriverPresence(true);
    }, 30000);

    if (!isSecureGpsContext()) {
        gpsInfo.textContent = 'GPS real indisponivel neste contexto. Abra via HTTPS ou localhost para testar no celular.';
        showNotification('Abra via HTTPS/localhost para usar GPS real.');
    }

    setSharingUi(false);
    await loadActiveTrips();
    updateSelectionLabel();
    setSharingUi(false);

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
