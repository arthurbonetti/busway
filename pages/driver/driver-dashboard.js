const activeTripsCountEl = document.getElementById('activeTripsCount');
const liveTripsCountEl = document.getElementById('liveTripsCount');
const tripsListEl = document.getElementById('tripsList');
const emptyStateEl = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const notification = document.getElementById('notification');
const driverWelcome = document.getElementById('driverWelcome');

let currentSession = null;
let presenceIntervalId = null;

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

function getAssignedRoutesFromSession() {
    const sessionRoutes = [];

    const routesList = Array.isArray(currentSession?.assignedRoutes) ? currentSession.assignedRoutes : [];
    routesList.forEach((route) => {
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
        console.warn('[driver-dashboard] Falha ao atualizar perfil do motorista:', error);
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

function showNotification(message) {
    notification.textContent = message;
    notification.className = 'notification show';
    setTimeout(() => {
        notification.className = 'notification';
    }, 2600);
}

function buildRouteLiveLocationUrl(route = {}) {
    const params = new URLSearchParams();

    if (route?.id) {
        params.set('routeId', String(route.id));
    }

    if (route?.number) {
        params.set('routeNumber', String(route.number));
    }

    if (route?.name) {
        params.set('routeName', String(route.name));
    }

    const query = params.toString();
    return query
        ? `driver-live-location.html?${query}`
        : 'driver-live-location.html';
}

function getRouteLabel(route = {}) {
    return route?.number
        ? `Linha ${route.number}${route?.name ? ` - ${route.name}` : ''}`
        : (route?.name || 'Rota designada');
}

function isAssignedRouteCoveredByTrips(route, trips = []) {
    const routeId = String(route?.id || '').trim();
    const routeNumber = String(route?.number || '').trim().toLowerCase();

    return trips.some((trip) => {
        const tripRouteId = String(trip.routeId || '').trim();
        const tripRouteNumber = String(trip.routeNumber || '').trim().toLowerCase();

        if (routeId && tripRouteId && routeId === tripRouteId) {
            return true;
        }

        if (routeNumber && tripRouteNumber && routeNumber === tripRouteNumber) {
            return true;
        }

        return false;
    });
}

function renderAssignedRouteCards(routes = []) {
    if (!routes.length) {
        return;
    }

    const cardsHtml = routes
        .map((route, index) => {
            const routeLabel = getRouteLabel(route);
            const targetUrl = buildRouteLiveLocationUrl(route);

            return `
                <div class="trip-item assigned-route-item">
                    <div>
                        <div class="trip-title">${routeLabel}</div>
                        <div class="trip-meta">Rota designada pelo admin. Aguardando viagens de usuários nesta linha.</div>
                    </div>
                    <div class="assigned-route-actions">
                        <span class="assigned-route-badge">Designada</span>
                        <button class="btn primary assigned-route-gps-btn" data-route-index="${index}" data-target-url="${targetUrl}">Transmitir GPS</button>
                    </div>
                </div>
            `;
        })
        .join('');

    tripsListEl.insertAdjacentHTML('beforeend', cardsHtml);

    tripsListEl.querySelectorAll('.assigned-route-gps-btn').forEach((button) => {
        if (button.dataset.boundClick === 'true') return;

        button.addEventListener('click', () => {
            const targetUrl = button.getAttribute('data-target-url') || 'driver-live-location.html';
            window.location.href = targetUrl;
        });

        button.dataset.boundClick = 'true';
    });
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
        console.warn('[driver-dashboard] Falha ao atualizar presença do motorista:', error);
    }
}

function renderAssignedRoutePlaceholder() {
    const normalizedRoutes = getAssignedRoutesFromSession();

    if (!normalizedRoutes.length) {
        emptyStateEl.style.display = 'block';
        return;
    }

    emptyStateEl.style.display = 'none';
    tripsListEl.innerHTML = '';
    renderAssignedRouteCards(normalizedRoutes);
}

function loadSession() {
    const raw = sessionStorage.getItem('buswaySession');
    if (!raw) return null;
    return JSON.parse(raw);
}

function assertDriverSession() {
    const session = loadSession();

    if (!session) {
        showNotification('Sessao expirada. Redirecionando...');
        setTimeout(() => {
            window.location.href = '../../index.html';
        }, 1200);
        return null;
    }

    if (!(session.isDriver || session.role === 'driver')) {
        showNotification('Acesso permitido somente para motoristas.');
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

async function loadTrips() {
    await refreshDriverProfile();
    await updateDriverPresence(true);

    const assignedRoutes = getAssignedRoutesFromSession();

    const snapshot = await db.collection('active_trips')
        .where('status', 'in', ['approaching_origin', 'waiting_bus', 'in_transit'])
        .get();

    const trips = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((trip) => isTripAllowedForAssignedRoute(trip));

    trips.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
    });

    const assignedRoutesWithoutActiveTrip = assignedRoutes.filter(
        (route) => !isAssignedRouteCoveredByTrips(route, trips)
    );

    const availableTransmitCount = trips.length + assignedRoutesWithoutActiveTrip.length;

    activeTripsCountEl.textContent = String(availableTransmitCount);
    liveTripsCountEl.textContent = String(trips.filter((trip) => trip.liveTracking?.enabled && trip.liveTracking?.source === 'driver').length);

    tripsListEl.innerHTML = '';

    if (!trips.length && !assignedRoutesWithoutActiveTrip.length) {
        renderAssignedRoutePlaceholder();
        return;
    }

    emptyStateEl.style.display = 'none';

    trips.forEach((trip) => {
        const item = document.createElement('div');
        item.className = 'trip-item';

        const liveText = trip.liveTracking?.enabled && trip.liveTracking?.source === 'driver' ? 'GPS real ativo' : 'Sem GPS real';

        item.innerHTML = `
            <div>
                <div class="trip-title">Linha ${trip.routeNumber || 'N/A'} - ${trip.routeName || 'Rota'}</div>
                <div class="trip-meta">${trip.origin || 'Origem'} -> ${trip.destination || 'Destino'} | Status: ${trip.status || 'active'} | ${liveText}</div>
            </div>
            <div class="assigned-route-actions">
                <span class="assigned-route-badge">Designada</span>
                <button class="btn primary" data-trip-id="${trip.id}">Transmitir GPS</button>
            </div>
        `;

        const btn = item.querySelector('button');
        btn.addEventListener('click', () => {
            window.location.href = `driver-live-location.html?tripId=${trip.id}`;
        });

        tripsListEl.appendChild(item);
    });

    renderAssignedRouteCards(assignedRoutesWithoutActiveTrip);
}

async function logout() {
    await updateDriverPresence(false);
    sessionStorage.removeItem('buswaySession');
    window.location.href = '../../index.html';
}

async function init() {
    currentSession = assertDriverSession();
    if (!currentSession) return;

    await refreshDriverProfile();
    const assignedRoutes = getAssignedRoutesFromSession();
    const assignedRouteText = assignedRoutes.length
        ? ` Rotas designadas: ${assignedRoutes.map((route) => route.number ? `Linha ${route.number}${route.name ? ` - ${route.name}` : ''}` : (route.name || 'Rota designada')).join(' | ')}.`
        : '';
    driverWelcome.textContent = `Olá, ${currentSession.name || 'motorista'}.${assignedRouteText}`;

    await loadTrips();

    if (presenceIntervalId) {
        clearInterval(presenceIntervalId);
    }
    presenceIntervalId = setInterval(() => {
        updateDriverPresence(true);
    }, 30000);

    refreshBtn.addEventListener('click', loadTrips);
    logoutBtn.addEventListener('click', () => {
        logout();
    });
}

init().catch((error) => {
    console.error('[driver-dashboard] erro:', error);
    showNotification('Erro ao carregar painel do motorista.');
});
