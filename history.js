document.addEventListener('DOMContentLoaded', function() {
    const filterBtn = document.getElementById('filterBtn');
    const filtersPanel = document.getElementById('filtersPanel');
    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    const periodFilter = document.getElementById('periodFilter');
    const routeFilter = document.getElementById('routeFilter');
    const locationFilter = document.getElementById('locationFilter');
    const tripsList = document.getElementById('tripsList');
    const emptyState = document.getElementById('emptyState');
    const notification = document.getElementById('notification');

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
        
        return JSON.parse(session);
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
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
        const date = new Date(dateString);
        return date.toLocaleDateString('pt-BR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function loadTrips(filters = {}) {
        try {
            const allTrips = JSON.parse(localStorage.getItem('recentTrips') || '[]');
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
                    const tripDate = new Date(trip.timestamp || trip.date);
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
                const dateA = new Date(a.timestamp || a.date || 0);
                const dateB = new Date(b.timestamp || b.date || 0);
                return dateB - dateA;
            });

            renderTrips(filteredTrips);
            updateStats(filteredTrips);
        } catch (e) {
            console.error('Erro ao carregar viagens:', e);
            showNotification('Erro ao carregar histórico de viagens', 'error');
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
            const date = new Date(trip.timestamp || trip.date);
            const price = trip.price || 4.50;
            
            return `
                <div class="trip-item">
                    <div class="trip-header">
                        <div class="trip-route">
                            <div class="route-badge">${trip.routeNumber || 'N/A'}</div>
                            <div class="trip-route-info">
                                <h3>${trip.routeName || 'Linha ' + (trip.routeNumber || 'N/A')}</h3>
                                <p>${trip.origin || 'Origem'} → ${trip.destination || 'Destino'}</p>
                            </div>
                        </div>
                        <div class="trip-price">R$ ${price.toFixed(2).replace('.', ',')}</div>
                    </div>
                    <div class="trip-details">
                        <div class="trip-detail">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2"/>
                                <circle cx="12" cy="9" r="2" fill="currentColor"/>
                            </svg>
                            <div class="trip-detail-text">
                                <div class="trip-detail-label">Origem</div>
                                <div class="trip-detail-value">${trip.origin || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="trip-detail">
                            <svg viewBox="0 0 24 24" fill="none">
                                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="currentColor" stroke-width="2"/>
                                <circle cx="12" cy="9" r="2" fill="currentColor"/>
                            </svg>
                            <div class="trip-detail-text">
                                <div class="trip-detail-label">Destino</div>
                                <div class="trip-detail-value">${trip.destination || 'N/A'}</div>
                            </div>
                        </div>
                        <div class="trip-detail">
                            <svg viewBox="0 0 24 24" fill="none">
                                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                                <path d="M12 6v6l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                            </svg>
                            <div class="trip-detail-text">
                                <div class="trip-detail-label">Data e Hora</div>
                                <div class="trip-detail-value">${formatDateTime(trip.timestamp || trip.date)}</div>
                            </div>
                        </div>
                    </div>
                    <div class="trip-footer">
                        <span class="trip-date">${formatDate(trip.timestamp || trip.date)}</span>
                        <div class="trip-actions">
                            <button class="btn-action" onclick="window.location.href='routes.html'">Fazer novamente</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    function updateStats(trips) {
        const totalTrips = trips.length;
        const totalSpent = trips.reduce((sum, trip) => sum + (trip.price || 4.50), 0);
        
        // Calcular dias ativos (dias únicos com viagens)
        const uniqueDays = new Set();
        trips.forEach(trip => {
            const date = new Date(trip.timestamp || trip.date);
            const dayStr = date.toISOString().split('T')[0];
            uniqueDays.add(dayStr);
        });
        const daysActive = uniqueDays.size;

        document.getElementById('totalTrips').textContent = totalTrips;
        document.getElementById('totalSpent').textContent = `R$ ${totalSpent.toFixed(2).replace('.', ',')}`;
        document.getElementById('daysActive').textContent = daysActive;
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
    filterBtn.addEventListener('click', () => {
        const isVisible = filtersPanel.style.display !== 'none';
        filtersPanel.style.display = isVisible ? 'none' : 'grid';
    });

    clearFiltersBtn.addEventListener('click', () => {
        periodFilter.value = 'all';
        routeFilter.value = '';
        locationFilter.value = '';
        loadTrips();
    });

    periodFilter.addEventListener('change', applyFilters);
    routeFilter.addEventListener('input', applyFilters);
    locationFilter.addEventListener('input', applyFilters);

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

    function initTheme() {
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        const theme = preferences.theme || 'light';
        applyTheme(theme);
        
        if (theme === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                applyTheme('auto');
            });
        }
    }

    // Inicialização
    checkSession();
    initTheme();
    loadTrips();

    // Atualizar quando houver mudanças no localStorage
    window.addEventListener('storage', function(e) {
        if (e.key === 'recentTrips') {
            loadTrips();
        }
    });
});

