// ROUTES (antigo routes.js que ainda deve aparecer em algumas requisições)
// Lista todas as rotas disponíveis, usuário escolhe uma

let currentUserId = null;
let userBalance = 0;
let allRoutes = [];
let filteredRoutes = [];
let modalMap = null;
let modalRouteLine = null;
let selectedRoute = null;

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[routes-simple] Inicializando...');

    // Verificar sessão
    const session = loadUserSession();
    if (!session) {
        showToast('Você precisa estar logado', 'error');
        setTimeout(() => window.location.href = 'index.html', 1500);
        return;
    }

    currentUserId = session.uid || session.id;
    console.log('[routes-simple] Usuário logado:', currentUserId);

    // Carregar dados
    await loadUserData();
    await loadRoutes();

    // Setup search
    document.getElementById('searchInput').addEventListener('input', handleSearch);
});

// ========== CARREGAR DADOS ==========

function loadUserSession() {
    const sessionData = sessionStorage.getItem('buswaySession') ||
                       sessionStorage.getItem('user_session') ||
                       localStorage.getItem('user_session');
    if (!sessionData) return null;
    return JSON.parse(sessionData);
}

async function loadUserData() {
    try {
        userBalance = await getUserBalance(currentUserId);
        document.getElementById('userBalance').textContent = `R$ ${userBalance.toFixed(2).replace('.', ',')}`;
        console.log('[routes-simple] Saldo carregado:', userBalance);
    } catch (error) {
        console.error('[routes-simple] Erro ao carregar saldo:', error);
        userBalance = 0;
    }
}

async function loadRoutes() {
    const routesList = document.getElementById('routesList');

    try {
        console.log('[routes-simple] Buscando rotas...');

        // Buscar todas as rotas ativas
        const snapshot = await db.collection('routes')
            .where('active', '==', true)
            .get();

        if (snapshot.empty) {
            routesList.innerHTML = `
                <div class="empty-state">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
                              fill="#9ca3af" opacity="0.5"/>
                    </svg>
                    <p>Nenhuma rota cadastrada ainda</p>
                    <p style="font-size:14px;margin-top:8px;color:#9ca3af;">
                        Aguarde enquanto o administrador cadastra as rotas
                    </p>
                </div>
            `;
            return;
        }

        // Montar array de rotas
        allRoutes = [];
        snapshot.forEach(doc => {
            allRoutes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        console.log('[routes-simple] Rotas carregadas:', allRoutes.length);

        // Ordenar por número
        allRoutes.sort((a, b) => {
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        filteredRoutes = [...allRoutes];
        displayRoutes(filteredRoutes);

    } catch (error) {
        console.error('[routes-simple] Erro ao carregar rotas:', error);
        routesList.innerHTML = `
            <div class="empty-state">
                <p style="color:#ef4444;">Erro ao carregar rotas</p>
                <p style="font-size:14px;margin-top:8px;color:#6b7280;">${error.message}</p>
            </div>
        `;
    }
}

// ========== EXIBIR ROTAS ==========

function displayRoutes(routes) {
    const routesList = document.getElementById('routesList');

    if (routes.length === 0) {
        routesList.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#b3b3b3">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <p>Nenhuma rota encontrada</p>
            </div>
        `;
        return;
    }

    routesList.innerHTML = routes.map(route => `
        <div class="route-card" onclick="selectRoute('${route.id}')">
            <div class="route-header">
                <div class="route-icon">
                    <div class="route-number">${route.number}</div>
                </div>
                <div class="route-main-info">
                    <div class="route-name">${route.name}</div>
                    <div class="route-path">
                        <span>${route.origin}</span>
                        <span class="route-arrow">→</span>
                        <span>${route.destination}</span>
                    </div>
                </div>
            </div>

            <div class="route-metrics">
                <div class="metric">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                    ${route.duration} min
                </div>
                <div class="metric">
                    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                    </svg>
                    ${route.distance} km
                </div>
                <div class="route-price">R$ ${route.price.toFixed(2)}</div>
            </div>
        </div>
    `).join('');
}

// ========== BUSCA ==========

function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query === '') {
        filteredRoutes = [...allRoutes];
    } else {
        filteredRoutes = allRoutes.filter(route => {
            return (
                route.number.toLowerCase().includes(query) ||
                route.name.toLowerCase().includes(query) ||
                route.origin.toLowerCase().includes(query) ||
                route.destination.toLowerCase().includes(query)
            );
        });
    }

    console.log('[routes-simple] Busca por:', query, '→', filteredRoutes.length, 'resultados');
    displayRoutes(filteredRoutes);
}

// ========== SELEÇÃO DE ROTA (ABRIR MODAL) ==========

function selectRoute(routeId) {
    console.log('[selectRoute] Abrindo modal para rota:', routeId);

    // Buscar dados da rota
    const route = allRoutes.find(r => r.id === routeId);
    if (!route) {
        showToast('Rota não encontrada', 'error');
        return;
    }

    // Validar saldo
    if (userBalance < route.price) {
        showToast('Saldo insuficiente. Adicione créditos para continuar.', 'error');
        return;
    }

    // Guardar rota selecionada
    selectedRoute = route;

    // Preencher dados do modal
    document.getElementById('modalRouteNumber').textContent = route.number;
    document.getElementById('modalRouteName').textContent = route.name;
    document.getElementById('modalOrigin').textContent = route.origin;
    document.getElementById('modalDestination').textContent = route.destination;
    document.getElementById('modalDuration').textContent = `${route.duration} min`;
    document.getElementById('modalDistance').textContent = `${route.distance} km`;
    document.getElementById('modalPrice').textContent = `R$ ${route.price.toFixed(2)}`;

    // Abrir modal
    document.getElementById('confirmModal').classList.add('show');

    // Inicializar mapa no modal
    setTimeout(() => {
        initModalMap(route);
    }, 100);
}

// ========== INICIALIZAR MAPA NO MODAL ==========

function initModalMap(route) {
    console.log('[initModalMap] Inicializando mapa com rota:', route.id);

    // Destruir mapa anterior se existir
    if (modalMap) {
        modalMap.remove();
        modalMap = null;
        modalRouteLine = null;
    }

    // Calcular centro do mapa (ponto médio entre origem e destino)
    const centerLat = (route.originCoords.lat + route.destinationCoords.lat) / 2;
    const centerLng = (route.originCoords.lng + route.destinationCoords.lng) / 2;

    // Criar mapa
    modalMap = L.map('modalMap').setView([centerLat, centerLng], 13);

    // Adicionar camada OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(modalMap);

    // Adicionar marcadores de origem e destino
    const originIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#10b981" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
        `),
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    const destIcon = L.icon({
        iconUrl: 'data:image/svg+xml;base64,' + btoa(`
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" fill="#ef4444" stroke="white" stroke-width="2"/>
                <circle cx="12" cy="12" r="4" fill="white"/>
            </svg>
        `),
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });

    L.marker([route.originCoords.lat, route.originCoords.lng], { icon: originIcon })
        .addTo(modalMap)
        .bindPopup(`🟢 ${route.origin}`);

    L.marker([route.destinationCoords.lat, route.destinationCoords.lng], { icon: destIcon })
        .addTo(modalMap)
        .bindPopup(`🔴 ${route.destination}`);

    // Desenhar rota VERMELHA
    if (route.path && route.path.length > 0) {
        const latLngs = route.path.map(p => [p.lat, p.lon]);

        modalRouteLine = L.polyline(latLngs, {
            color: '#ef4444',
            weight: 5,
            opacity: 0.7
        }).addTo(modalMap);

        // Ajustar zoom para mostrar rota completa
        modalMap.fitBounds(modalRouteLine.getBounds(), { padding: [30, 30] });
    }

    console.log('[initModalMap] Mapa inicializado');
}

// ========== FECHAR MODAL ==========

function closeConfirmModal() {
    console.log('[closeConfirmModal] Fechando modal');

    // Remover classe show
    document.getElementById('confirmModal').classList.remove('show');

    // Destruir mapa
    if (modalMap) {
        modalMap.remove();
        modalMap = null;
        modalRouteLine = null;
    }

    // Limpar rota selecionada
    selectedRoute = null;
}

// ========== BUSCAR PONTO DE PARTIDA ALEATÓRIO ==========

async function getRandomStartingPoint(excludeOriginCoords) {
    try {
        console.log('[getRandomStartingPoint] Buscando ponto de partida aleatório...');

        // Coletar todos os pontos disponíveis (origens e destinos de todas as rotas)
        const allPoints = [];

        for (const route of allRoutes) {
            // Adicionar origem
            if (route.originCoords) {
                allPoints.push({
                    name: route.origin,
                    coords: {
                        lat: route.originCoords.lat,
                        lng: route.originCoords.lng
                    }
                });
            }

            // Adicionar destino
            if (route.destinationCoords) {
                allPoints.push({
                    name: route.destination,
                    coords: {
                        lat: route.destinationCoords.lat,
                        lng: route.destinationCoords.lng
                    }
                });
            }
        }

        console.log('[getRandomStartingPoint] Total de pontos encontrados:', allPoints.length);

        // Filtrar pontos que não sejam a origem da rota selecionada
        // (distância mínima de 500m)
        const availablePoints = allPoints.filter(point => {
            const distance = haversineDistance(
                point.coords.lat, point.coords.lng,
                excludeOriginCoords.lat, excludeOriginCoords.lng
            );
            return distance > 0.5; // Mais de 500m (0.5 km)
        });

        console.log('[getRandomStartingPoint] Pontos disponíveis:', availablePoints.length);

        if (availablePoints.length === 0) {
            console.warn('[getRandomStartingPoint] Nenhum ponto disponível, usando origem');
            return null;
        }

        // Escolher aleatoriamente
        const randomIndex = Math.floor(Math.random() * availablePoints.length);
        const selectedPoint = availablePoints[randomIndex];

        console.log('[getRandomStartingPoint] Ponto selecionado:', selectedPoint.name, selectedPoint.coords);

        return selectedPoint;

    } catch (error) {
        console.error('[getRandomStartingPoint] Erro:', error);
        return null;
    }
}

// Função auxiliar de distância Haversine
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

// Calcular rota via OSRM entre dois pontos
async function calculateRouteOSRM(startCoords, endCoords) {
    try {
        console.log('[calculateRouteOSRM] Calculando rota...');
        console.log('  De:', startCoords);
        console.log('  Para:', endCoords);

        const url = `https://router.project-osrm.org/route/v1/driving/${startCoords.lng},${startCoords.lat};${endCoords.lng},${endCoords.lat}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            console.error('[calculateRouteOSRM] Erro na resposta OSRM:', data);
            return null;
        }

        const route = data.routes[0];
        const geometry = route.geometry.coordinates;

        // Converter para formato {lat, lon}
        const path = geometry.map(coord => ({
            lat: coord[1],
            lon: coord[0]
        }));

        const distanceKm = (route.distance / 1000).toFixed(2);
        const durationMin = Math.ceil(route.duration / 60);

        console.log('[calculateRouteOSRM] Rota calculada:');
        console.log('  Distância:', distanceKm, 'km');
        console.log('  Duração:', durationMin, 'min');
        console.log('  Pontos no caminho:', path.length);

        return {
            path: path,
            distance: parseFloat(distanceKm),
            duration: durationMin
        };

    } catch (error) {
        console.error('[calculateRouteOSRM] Erro ao calcular rota:', error);
        return null;
    }
}

// ========== CONFIRMAR VIAGEM ==========

async function confirmTrip() {
    if (!selectedRoute) {
        showToast('Erro: Nenhuma rota selecionada', 'error');
        return;
    }

    console.log('[confirmTrip] Confirmando viagem:', selectedRoute.id);

    try {
        // Cancelar viagens ativas antes de criar nova
        await cancelActiveTrips();

        showToast('Calculando trajeto do ônibus...', 'info');

        // 1. Buscar ponto de partida aleatório
        const startingPoint = await getRandomStartingPoint(selectedRoute.originCoords);

        let preRoutePath = [];
        let preRouteDuration = 0;
        let preRouteDistance = 0;
        let busStartLocation = null;

        if (startingPoint) {
            // 2. Calcular rota: Ponto Aleatório → Origem
            const preRoute = await calculateRouteOSRM(startingPoint.coords, selectedRoute.originCoords);

            if (preRoute) {
                preRoutePath = preRoute.path;
                preRouteDuration = preRoute.duration;
                preRouteDistance = preRoute.distance;
                busStartLocation = {
                    name: startingPoint.name,
                    coords: startingPoint.coords
                };

                console.log('[confirmTrip] Ônibus começará em:', busStartLocation.name);
                console.log('[confirmTrip] Trajeto até origem:', preRouteDistance, 'km,', preRouteDuration, 'min');
            }
        }

        // Se não conseguiu calcular pré-rota, ônibus começa na origem
        if (!busStartLocation) {
            console.log('[confirmTrip] Ônibus começará na origem (sem pré-rota)');
            busStartLocation = {
                name: selectedRoute.origin,
                coords: selectedRoute.originCoords
            };
        }

        // 3. Criar active_trip com informações do trajeto completo
        const activeTripData = {
            userId: currentUserId,
            routeId: selectedRoute.id,
            routeNumber: selectedRoute.number,
            routeName: selectedRoute.name,
            origin: selectedRoute.origin,
            destination: selectedRoute.destination,
            originCoords: selectedRoute.originCoords,
            destinationCoords: selectedRoute.destinationCoords,
            price: selectedRoute.price,
            duration: selectedRoute.duration,
            distance: selectedRoute.distance,
            path: selectedRoute.path || [],
            driver: selectedRoute.driver || 'N/A',

            // Informações do trajeto até a origem
            busStartLocation: busStartLocation,
            preRoutePath: preRoutePath,
            preRouteDuration: preRouteDuration,
            preRouteDistance: preRouteDistance,

            status: 'approaching_origin', // Novo status
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        console.log('[confirmTrip] Criando active_trip:', activeTripData);

        // Salvar no Firestore
        const activeTripRef = await db.collection('active_trips').add(activeTripData);

        console.log('[confirmTrip] Active trip criado:', activeTripRef.id);

        // Salvar no sessionStorage
        sessionStorage.setItem('activeTrip', JSON.stringify({
            id: activeTripRef.id,
            ...activeTripData
        }));

        showToast('Viagem iniciada! Redirecionando...', 'success');

        // Fechar modal
        closeConfirmModal();

        // Redirecionar para rastreamento
        setTimeout(() => {
            window.location.href = 'location-simple.html';
        }, 1000);

    } catch (error) {
        console.error('[confirmTrip] Erro ao criar viagem:', error);
        showToast(`Erro ao iniciar viagem: ${error.message}`, 'error');
    }
}

// ========== TOAST ==========

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// ========== CANCELAR VIAGENS ATIVAS ==========

async function cancelActiveTrips() {
    try {
        console.log('[cancelActiveTrips] Verificando viagens ativas para cancelar:', currentUserId);

        const activeTripsRef = db.collection('active_trips');
        const snapshot = await activeTripsRef
            .where('userId', '==', currentUserId)
            .where('status', 'in', ['approaching_origin', 'in_transit'])
            .get();

        if (snapshot.empty) {
            console.log('[cancelActiveTrips] Nenhuma viagem ativa encontrada');
            return;
        }

        // Cancelar todas as viagens ativas
        const batch = db.batch();
        const canceledTrips = [];

        snapshot.forEach(doc => {
            const tripData = doc.data();
            console.log('[cancelActiveTrips] Cancelando viagem:', doc.id);

            // Atualizar status para cancelado no active_trips
            batch.update(doc.ref, {
                status: 'cancelled',
                cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                cancelReason: 'Nova rota selecionada',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Adicionar ao array para mover para trips
            canceledTrips.push({
                id: doc.id,
                data: {
                    ...tripData,
                    status: 'cancelled',
                    cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
                    cancelReason: 'Nova rota selecionada'
                }
            });
        });

        // Executar batch update
        await batch.commit();

        // Mover para collection 'trips' (histórico)
        for (const trip of canceledTrips) {
            await db.collection('trips').doc(trip.id).set(trip.data);
            // Deletar do active_trips
            await db.collection('active_trips').doc(trip.id).delete();
        }

        console.log(`[cancelActiveTrips] ${canceledTrips.length} viagem(ns) cancelada(s) com sucesso`);

    } catch (error) {
        console.error('[cancelActiveTrips] Erro ao cancelar viagens:', error);
    }
}

// ========== EXPOR FUNÇÕES GLOBALMENTE ==========

window.selectRoute = selectRoute;
window.closeConfirmModal = closeConfirmModal;
window.confirmTrip = confirmTrip;

console.log('[routes-simple] Script carregado');
