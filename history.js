// HISTORY.JS - INTEGRADO COM FIRESTORE
document.addEventListener('DOMContentLoaded', async function() {
    const filterBtn = document.getElementById('filterBtn');
    const filtersPanel = document.getElementById('filtersPanel');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const periodFilter = document.getElementById('periodFilter');
    const routeFilter = document.getElementById('routeFilter');
    const locationFilter = document.getElementById('locationFilter');
    const tripsList = document.getElementById('tripsList');
    const emptyState = document.getElementById('emptyState');
    const notification = document.getElementById('notification');

    let currentUserId = null;
    let allTrips = [];
    let unsubscribers = [];

    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function checkSession() {
        const session = sessionStorage.getItem('buswaySession');

        if (!session) {
            showNotification('Sessão expirada. Redirecionando para login...', 'error');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 1500);
            return null;
        }

        const sessionData = JSON.parse(session);
        currentUserId = sessionData.uid || sessionData.id;
        return sessionData;
    }

    function formatDate(dateString) {
        const date = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) {
            if (diffHours === 1) return 'Há 1 hora';
            return `Há ${diffHours} horas`;
        }
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `Há ${diffDays} dias`;

        return date.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
        });
    }

    function formatDateTime(dateString) {
        const date = dateString?.toDate ? dateString.toDate() : new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Variáveis para armazenar dados temporariamente
    let completedTripsCache = [];
    let activeTripsCache = [];

    // Carregar viagens do Firestore
    async function loadTripsFromFirestore() {
        if (!currentUserId) return;

        try {
            // Adicionar listener para trips (histórico)
            const tripsUnsubscriber = db.collection('trips')
                .where('userId', '==', currentUserId)
                .orderBy('timestamp', 'desc')
                .limit(100)
                .onSnapshot(
                    (snapshot) => {
                        completedTripsCache = [];
                        snapshot.forEach(doc => {
                            completedTripsCache.push({ id: doc.id, ...doc.data() });
                        });

                        console.log('[History] Viagens completadas atualizadas:', completedTripsCache.length);
                        updateAllTrips();
                    },
                    (error) => {
                        console.error('[History] Erro no listener de trips:', error);
                        // Se falhar com orderBy, tentar sem ordenação
                        if (error.code === 'failed-precondition' || error.message.includes('index')) {
                            console.log('[History] Tentando sem orderBy devido a erro de índice...');
                            loadTripsWithoutIndex();
                        }
                    }
                );

            unsubscribers.push(tripsUnsubscriber);

            // Buscar viagens em andamento (active_trips) com listener
            const activeTripsUnsubscriber = db.collection('active_trips')
                .where('userId', '==', currentUserId)
                .where('status', 'in', ['approaching_origin', 'in_transit'])
                .onSnapshot((snapshot) => {
                    activeTripsCache = [];
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        activeTripsCache.push({
                            id: doc.id,
                            ...data,
                            status: data.status === 'in_transit' ? 'in_progress' : 'approaching',
                            timestamp: data.startTime || data.createdAt
                        });
                    });

                    console.log('[History] Viagens ativas atualizadas:', activeTripsCache.length);
                    updateAllTrips();
                });

            unsubscribers.push(activeTripsUnsubscriber);

        } catch (error) {
            console.error('[loadTripsFromFirestore] Erro:', error);
            showNotification('Erro ao carregar histórico', 'error');
            allTrips = [];
        }
    }

    function updateAllTrips() {
        // Combinar viagens completadas e em andamento
        allTrips = [...activeTripsCache, ...completedTripsCache];

        console.log('[updateAllTrips] Total de viagens:', allTrips.length);

        // Aplicar filtros padrão
        loadTrips();
    }

    // Fallback para quando não há índice no Firestore
    function loadTripsWithoutIndex() {
        console.log('[loadTripsWithoutIndex] Carregando sem orderBy...');

        const tripsUnsubscriber = db.collection('trips')
            .where('userId', '==', currentUserId)
            .limit(100)
            .onSnapshot((snapshot) => {
                completedTripsCache = [];
                snapshot.forEach(doc => {
                    completedTripsCache.push({ id: doc.id, ...doc.data() });
                });

                // Ordenar manualmente no cliente
                completedTripsCache.sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                    return dateB - dateA; // Mais recente primeiro
                });

                console.log('[History] Viagens completadas (sem índice):', completedTripsCache.length);
                updateAllTrips();
            });

        unsubscribers.push(tripsUnsubscriber);
    }

    function loadTrips(filters = {}) {
        try {
            let filteredTrips = [...allTrips];

            // Aplicar filtro de período
            if (filters.period && filters.period !== 'all') {
                const now = new Date();
                let startDate;

                switch(filters.period) {
                    case 'today':
                        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                        break;
                    case 'week':
                        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case 'month':
                        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                        break;
                    case 'year':
                        startDate = new Date(now.getFullYear(), 0, 1);
                        break;
                }

                filteredTrips = filteredTrips.filter(trip => {
                    const tripDate = trip.timestamp?.toDate ? trip.timestamp.toDate() : new Date(trip.timestamp);
                    return tripDate >= startDate;
                });
            }

            // Aplicar filtro de rota
            if (filters.route) {
                const routeLower = filters.route.toLowerCase();
                filteredTrips = filteredTrips.filter(trip =>
                    trip.routeNumber?.toLowerCase().includes(routeLower) ||
                    trip.routeName?.toLowerCase().includes(routeLower)
                );
            }

            // Aplicar filtro de localização
            if (filters.location) {
                const locationLower = filters.location.toLowerCase();
                filteredTrips = filteredTrips.filter(trip =>
                    trip.origin?.toLowerCase().includes(locationLower) ||
                    trip.destination?.toLowerCase().includes(locationLower)
                );
            }

            // Ordenar por data (mais recente primeiro)
            filteredTrips.sort((a, b) => {
                const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                return dateB - dateA;
            });

            renderTrips(filteredTrips);
            updateStats(filteredTrips);
        } catch (e) {
            showNotification('Erro ao filtrar histórico de viagens', 'error');
        }
    }

    function renderTrips(trips) {
        if (trips.length === 0) {
            tripsList.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        tripsList.style.display = 'flex';
        emptyState.style.display = 'none';

        tripsList.innerHTML = trips.map(trip => {
            const date = trip.timestamp?.toDate ? trip.timestamp.toDate() : new Date(trip.timestamp);
            const price = trip.price || 4.50;
            const status = trip.status || 'completed';

            let statusText = 'Concluída';
            let statusClass = 'completed';

            if (status === 'in_progress') {
                statusText = 'Em andamento';
                statusClass = 'in-progress';
            } else if (status === 'approaching') {
                statusText = 'Aguardando';
                statusClass = 'approaching';
            } else if (status === 'cancelled' || status === 'failed') {
                statusText = 'Cancelada';
                statusClass = 'cancelled';
            }

            return `
                <div class="trip-card">
                    <div class="trip-header">
                        <div class="trip-route">
                            <div class="trip-locations">
                                <span>${trip.origin || 'Origem'}</span>
                                <span class="trip-arrow">→</span>
                                <span>${trip.destination || 'Destino'}</span>
                            </div>
                            <div class="trip-line">Linha ${trip.routeNumber || 'N/A'}</div>
                        </div>
                        <div class="trip-price">R$ ${price.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div class="trip-footer">
                        <span class="trip-date">${formatDate(trip.timestamp)}</span>
                        <div class="trip-status ${statusClass}">
                            <span class="trip-status-icon"></span>
                            ${statusText}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateStats(trips) {
        const totalTrips = trips.length;
        const totalSpent = trips.reduce((sum, trip) => sum + (trip.price || 4.50), 0);

        const totalTripsEl = document.getElementById('totalTrips');
        const totalSpentEl = document.getElementById('totalSpent');

        if (totalTripsEl) totalTripsEl.textContent = totalTrips;
        if (totalSpentEl) totalSpentEl.textContent = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;
    }

    function applyFilters() {
        const filters = {
            period: periodFilter.value,
            route: routeFilter.value.trim(),
            location: locationFilter.value.trim()
        };
        loadTrips(filters);
    }

    // Event Listeners
    if (filterBtn) {
        filterBtn.addEventListener('click', () => {
            const isVisible = filtersPanel.style.display !== 'none';
            filtersPanel.style.display = isVisible ? 'none' : 'grid';
        });
    }

    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            periodFilter.value = 'all';
            routeFilter.value = '';
            locationFilter.value = '';
            loadTrips();
        });
    }

    if (periodFilter) periodFilter.addEventListener('change', applyFilters);
    if (routeFilter) routeFilter.addEventListener('input', applyFilters);
    if (locationFilter) locationFilter.addEventListener('input', applyFilters);

    // Aplicar tema
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            if (prefersDark) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }
        } else {
            document.body.classList.remove('dark-theme');
        }
    }

    async function initTheme() {
        if (currentUserId) {
            try {
                const preferences = await getUserPreferences(currentUserId);
                const theme = preferences?.theme || 'light';
                applyTheme(theme);

                if (theme === 'auto') {
                    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                        applyTheme('auto');
                    });
                }
            } catch (error) {
                applyTheme('light');
            }
        }
    }

    // Inicialização
    const session = checkSession();
    if (session) {
        await loadTripsFromFirestore();
        await initTheme();
    }

    // Cleanup ao sair da página
    window.addEventListener('beforeunload', () => {
        unsubscribers.forEach(unsubscribe => unsubscribe());
    });

});
