// ADMIN ROUTES - Gerenciamento de Rotas com OSRM
// Design minimalista MaaS

let map = null;
let originMarker = null;
let destMarker = null;
let routeLine = null;
let originCoords = null;
let destCoords = null;
let calculatedMetrics = null;
let allRoutes = [];
let editingRouteId = null;

// Ícones personalizados
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

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    console.log('[admin-routes] Inicializando...');

    // Verificar se é admin
    const session = sessionStorage.getItem('buswaySession');
    if (!session) {
        alert('Você precisa estar logado');
        window.location.href = 'index.html';
        return;
    }

    const sessionData = JSON.parse(session);
    if (!sessionData.isAdmin) {
        alert('Acesso negado. Apenas administradores.');
        window.location.href = 'user-dashboard.html';
        return;
    }

    // Inicializar mapa
    initMap();

    // Carregar rotas existentes
    loadRoutes();

    // Setup form submit
    document.getElementById('routeForm').addEventListener('submit', handleSubmit);
});

// ========== INICIALIZAR MAPA ==========

function initMap() {
    console.log('[initMap] Inicializando mapa');

    // Chapecó, SC
    map = L.map('map').setView([-27.0945, -52.6166], 13);

    // Adicionar camada OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Click handler
    map.on('click', handleMapClick);

    console.log('[initMap] Mapa pronto');
}

// ========== CLICK NO MAPA ==========

async function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    console.log('[handleMapClick]', lat, lng);

    // Se não tem origem, definir origem
    if (!originCoords) {
        originCoords = { lat, lng };

        // Criar marcador de origem
        if (originMarker) map.removeLayer(originMarker);
        originMarker = L.marker([lat, lng], { icon: originIcon })
            .addTo(map)
            .bindPopup('🟢 Origem');

        // Buscar nome da localização
        const locationName = await reverseGeocode(lat, lng);
        document.getElementById('routeOrigin').value = locationName;

        showToast('Origem definida. Agora clique no destino.', 'success');
        updateInstructions('Agora clique no mapa para definir o <strong>destino</strong>');

    }
    // Se tem origem mas não tem destino, definir destino
    else if (!destCoords) {
        destCoords = { lat, lng };

        // Criar marcador de destino
        if (destMarker) map.removeLayer(destMarker);
        destMarker = L.marker([lat, lng], { icon: destIcon })
            .addTo(map)
            .bindPopup('🔴 Destino');

        // Buscar nome da localização
        const locationName = await reverseGeocode(lat, lng);
        document.getElementById('routeDestination').value = locationName;

        showToast('Destino definido. Calculando rota...', 'info');
        updateInstructions('Calculando rota com OSRM...');

        // Calcular rota com OSRM
        await calculateRoute();
    }
    // Se já tem ambos, resetar
    else {
        resetRoute();
        handleMapClick(e); // Recomeçar
    }
}

function updateInstructions(html) {
    document.getElementById('mapInstructions').innerHTML = `🗺️ ${html}`;
}

// ========== REVERSE GEOCODING ==========

async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
            {
                headers: {
                    'User-Agent': 'Busway-Admin/1.0'
                }
            }
        );

        const data = await response.json();

        // Tentar extrair nome relevante
        if (data.address) {
            const addr = data.address;
            return addr.road || addr.neighbourhood || addr.suburb ||
                   addr.city || addr.town || addr.village ||
                   'Local Selecionado';
        }

        return 'Local Selecionado';

    } catch (error) {
        console.error('[reverseGeocode] Erro:', error);
        return 'Local Selecionado';
    }
}

// ========== CALCULAR ROTA COM OSRM ==========

async function calculateRoute() {
    if (!originCoords || !destCoords) return;

    console.log('[calculateRoute] Chamando OSRM...');

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            showToast('Erro ao calcular rota. Tente outros pontos.', 'error');
            return;
        }

        const route = data.routes[0];

        // Extrair métricas
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.ceil(route.duration / 60);

        calculatedMetrics = {
            distance: parseFloat(distanceKm),
            duration: durationMin,
            path: route.geometry.coordinates.map(coord => ({
                lat: coord[1],
                lon: coord[0]
            }))
        };

        console.log('[calculateRoute] Métricas:', calculatedMetrics);

        // Exibir preview
        document.getElementById('previewDistance').textContent = `${distanceKm} km`;
        document.getElementById('previewDuration').textContent = `${durationMin} min`;
        document.getElementById('metricsPreview').classList.add('show');

        // Desenhar rota no mapa
        drawRouteLine(calculatedMetrics.path);

        // Habilitar botão de salvar
        document.getElementById('btnSave').disabled = false;

        showToast('Rota calculada com sucesso!', 'success');
        updateInstructions('Rota calculada! Preencha os dados e clique em <strong>Salvar Rota</strong>');

    } catch (error) {
        console.error('[calculateRoute] Erro:', error);
        showToast('Erro ao calcular rota com OSRM', 'error');
    }
}

function drawRouteLine(path) {
    // Remover linha anterior se existir
    if (routeLine) {
        map.removeLayer(routeLine);
    }

    // Desenhar nova linha VERMELHA
    const latLngs = path.map(p => [p.lat, p.lon]);

    routeLine = L.polyline(latLngs, {
        color: '#ef4444',
        weight: 5,
        opacity: 0.7
    }).addTo(map);

    // Ajustar zoom para mostrar rota completa
    map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

// ========== SALVAR ROTA ==========

async function handleSubmit(e) {
    e.preventDefault();

    console.log('[handleSubmit] Salvando rota...');

    // Validar campos
    const routeNumber = document.getElementById('routeNumber').value.trim();
    const routeName = document.getElementById('routeName').value.trim();
    const routePrice = parseFloat(document.getElementById('routePrice').value);
    const routeFrequency = document.getElementById('routeFrequency').value.trim();
    const routeDriver = document.getElementById('routeDriver').value.trim();

    if (!routeNumber || !routeName || !routeDriver) {
        showToast('Preencha número, nome e motorista da rota', 'error');
        return;
    }

    if (!originCoords || !destCoords || !calculatedMetrics) {
        showToast('Selecione origem e destino no mapa', 'error');
        return;
    }

    const routeData = {
        number: routeNumber,
        name: routeName,
        origin: document.getElementById('routeOrigin').value,
        destination: document.getElementById('routeDestination').value,
        originCoords: originCoords,
        destinationCoords: destCoords,
        price: routePrice,
        frequency: routeFrequency,
        driver: routeDriver,
        distance: calculatedMetrics.distance,
        duration: calculatedMetrics.duration,
        path: calculatedMetrics.path,
        active: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingRouteId) {
            // Editar rota existente
            await db.collection('routes').doc(editingRouteId).update(routeData);

            showToast('Rota atualizada com sucesso!', 'success');
            editingRouteId = null;

        } else {
            // Criar nova rota
            routeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('routes').add(routeData);
            showToast('Rota criada com sucesso!', 'success');
        }

        // Resetar formulário e recarregar lista
        resetForm();
        await loadRoutes();

    } catch (error) {
        console.error('[handleSubmit] Erro ao salvar:', error);
        showToast(`Erro ao salvar rota: ${error.message}`, 'error');
    }
}

// ========== CARREGAR ROTAS ==========

async function loadRoutes() {
    console.log('[loadRoutes] Carregando rotas...');

    const routesList = document.getElementById('routesList');

    try {
        const snapshot = await db.collection('routes').get();

        allRoutes = [];
        snapshot.forEach(doc => {
            allRoutes.push({
                id: doc.id,
                ...doc.data()
            });
        });

        // Ordenar por número
        allRoutes.sort((a, b) => {
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        console.log('[loadRoutes] Total:', allRoutes.length);

        // Renderizar lista
        if (allRoutes.length === 0) {
            routesList.innerHTML = `
                <div class="empty-state">
                    Nenhuma rota cadastrada
                </div>
            `;
        } else {
            routesList.innerHTML = allRoutes.map(route => `
                <div class="route-card">
                    <div class="route-header">
                        <div class="route-number">${route.number}</div>
                        <div class="route-actions">
                            <button class="btn-icon" onclick="editRoute('${route.id}')">✏️ Editar</button>
                            <button class="btn-icon danger" onclick="deleteRoute('${route.id}', '${route.number}')">🗑️</button>
                        </div>
                    </div>
                    <div class="route-name">${route.name}</div>
                    <div class="route-path">
                        ${route.origin} → ${route.destination}
                    </div>
                    <div class="route-metrics">
                        <span>📏 ${route.distance} km</span>
                        <span>⏱️ ${route.duration} min</span>
                        <span>💰 R$ ${route.price.toFixed(2)}</span>
                    </div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('[loadRoutes] Erro:', error);
        routesList.innerHTML = `
            <div class="empty-state" style="color:#ef4444;">
                Erro ao carregar rotas
            </div>
        `;
    }
}

// ========== EDITAR ROTA ==========

async function editRoute(routeId) {
    console.log('[editRoute]', routeId);

    const route = allRoutes.find(r => r.id === routeId);
    if (!route) {
        showToast('Rota não encontrada', 'error');
        return;
    }

    // Preencher formulário
    document.getElementById('routeNumber').value = route.number;
    document.getElementById('routeName').value = route.name;
    document.getElementById('routeOrigin').value = route.origin;
    document.getElementById('routeDestination').value = route.destination;
    document.getElementById('routePrice').value = route.price;
    document.getElementById('routeFrequency').value = route.frequency || '';
    document.getElementById('routeDriver').value = route.driver || '';

    // Definir coordenadas
    originCoords = route.originCoords;
    destCoords = route.destinationCoords;
    calculatedMetrics = {
        distance: route.distance,
        duration: route.duration,
        path: route.path
    };

    // Adicionar marcadores
    if (originMarker) map.removeLayer(originMarker);
    if (destMarker) map.removeLayer(destMarker);

    originMarker = L.marker([originCoords.lat, originCoords.lng], { icon: originIcon })
        .addTo(map)
        .bindPopup('🟢 Origem');

    destMarker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
        .addTo(map)
        .bindPopup('🔴 Destino');

    // Desenhar rota
    drawRouteLine(calculatedMetrics.path);

    // Mostrar preview
    document.getElementById('previewDistance').textContent = `${route.distance} km`;
    document.getElementById('previewDuration').textContent = `${route.duration} min`;
    document.getElementById('metricsPreview').classList.add('show');

    // Habilitar botão salvar
    document.getElementById('btnSave').disabled = false;
    document.getElementById('btnSave').textContent = 'Atualizar Rota';

    // Guardar ID para edição
    editingRouteId = routeId;

    showToast('Editando rota. Altere os campos desejados.', 'info');
    updateInstructions('Editando rota. Clique em <strong>Atualizar Rota</strong> para salvar');

    // Scroll para o topo do formulário
    document.querySelector('.sidebar').scrollTop = 0;
}

// ========== DELETAR ROTA ==========

async function deleteRoute(routeId, routeNumber) {
    if (!confirm(`Deseja realmente deletar a rota ${routeNumber}?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    console.log('[deleteRoute]', routeId);

    try {
        await db.collection('routes').doc(routeId).delete();
        showToast('Rota deletada com sucesso', 'success');
        await loadRoutes();

    } catch (error) {
        console.error('[deleteRoute] Erro:', error);
        showToast(`Erro ao deletar rota: ${error.message}`, 'error');
    }
}

// ========== RESETAR FORMULÁRIO ==========

function resetForm() {
    console.log('[resetForm] Limpando formulário');

    // Limpar campos
    document.getElementById('routeForm').reset();
    document.getElementById('routePrice').value = '4.80';
    document.getElementById('routeFrequency').value = '10-15 min';
    document.getElementById('routeDriver').value = '';

    // Limpar coordenadas
    originCoords = null;
    destCoords = null;
    calculatedMetrics = null;
    editingRouteId = null;

    // Remover marcadores
    if (originMarker) {
        map.removeLayer(originMarker);
        originMarker = null;
    }
    if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
    }
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    // Esconder preview
    document.getElementById('metricsPreview').classList.remove('show');

    // Desabilitar botão salvar
    document.getElementById('btnSave').disabled = true;
    document.getElementById('btnSave').textContent = 'Salvar Rota';

    // Resetar instruções
    updateInstructions('Clique no mapa para marcar <strong>origem</strong>, depois clique novamente para marcar <strong>destino</strong>');

    // Resetar zoom
    map.setView([-27.0945, -52.6166], 13);
}

function resetRoute() {
    // Similar ao resetForm mas mantém campos de texto
    originCoords = null;
    destCoords = null;
    calculatedMetrics = null;

    document.getElementById('routeOrigin').value = '';
    document.getElementById('routeDestination').value = '';

    if (originMarker) {
        map.removeLayer(originMarker);
        originMarker = null;
    }
    if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
    }
    if (routeLine) {
        map.removeLayer(routeLine);
        routeLine = null;
    }

    document.getElementById('metricsPreview').classList.remove('show');
    document.getElementById('btnSave').disabled = true;

    updateInstructions('Clique no mapa para marcar <strong>origem</strong>, depois clique novamente para marcar <strong>destino</strong>');
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

//Expõe globalmente 

window.resetForm = resetForm;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;

console.log('[admin-routes] Script carregado');
