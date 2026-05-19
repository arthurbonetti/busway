const activeTripsCountEl = document.getElementById('activeTripsCount');
const liveTripsCountEl = document.getElementById('liveTripsCount');
const tripsListEl = document.getElementById('tripsList');
const emptyStateEl = document.getElementById('emptyState');
const refreshBtn = document.getElementById('refreshBtn');
const logoutBtn = document.getElementById('logoutBtn');
const notification = document.getElementById('notification');
const driverWelcome = document.getElementById('driverWelcome');

let currentSession = null;

function showNotification(message) {
    notification.textContent = message;
    notification.className = 'notification show';
    setTimeout(() => {
        notification.className = 'notification';
    }, 2600);
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
    const snapshot = await db.collection('active_trips')
        .where('status', 'in', ['approaching_origin', 'waiting_bus', 'in_transit'])
        .get();

    const trips = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    trips.sort((a, b) => {
        const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return bTime - aTime;
    });

    activeTripsCountEl.textContent = String(trips.length);
    liveTripsCountEl.textContent = String(trips.filter((trip) => trip.liveTracking?.enabled && trip.liveTracking?.source === 'driver').length);

    tripsListEl.innerHTML = '';

    if (!trips.length) {
        emptyStateEl.style.display = 'block';
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
            <button class="btn primary" data-trip-id="${trip.id}">Transmitir GPS</button>
        `;

        const btn = item.querySelector('button');
        btn.addEventListener('click', () => {
            window.location.href = `driver-live-location.html?tripId=${trip.id}`;
        });

        tripsListEl.appendChild(item);
    });
}

function logout() {
    sessionStorage.removeItem('buswaySession');
    window.location.href = '../../index.html';
}

async function init() {
    currentSession = assertDriverSession();
    if (!currentSession) return;

    driverWelcome.textContent = `Olá, ${currentSession.name || 'motorista'}.`;

    await loadTrips();

    refreshBtn.addEventListener('click', loadTrips);
    logoutBtn.addEventListener('click', logout);
}

init().catch((error) => {
    console.error('[driver-dashboard] erro:', error);
    showNotification('Erro ao carregar painel do motorista.');
});
