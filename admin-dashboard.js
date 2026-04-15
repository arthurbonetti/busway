// ADMIN DASHBOARD - Painel Unificado (Rotas + Usuários)

// ========== VARIÁVEIS GLOBAIS ==========

// Rotas
let routesMap = null;
let originMarker = null;
let destMarker = null;
let routeLine = null;
let originCoords = null;
let destCoords = null;
let calculatedMetrics = null;
let allRoutes = [];
let editingRouteId = null;

// Usuários
let allUsers = [];
let currentUserId = null;
let editingUserId = null;
let usersAutoRefreshInterval = null;
let allFeedbacks = [];
let currentFeedbackFilter = 'unread';
let selectedFeedbackId = null;

const adminSettings = {
    confirmDelete: true,
    autoRefreshUsers: false
};

// Tab ativa
let currentTab = 'routes';

// ========== INICIALIZAÇÃO ==========

document.addEventListener('DOMContentLoaded', () => {
    console.log('[admin-dashboard] Inicializando...');

    // Verificar se é admin
    const session = sessionStorage.getItem('buswaySession');
    if (!session) {
        alert('Você precisa estar logado');
        window.location.href = 'index.html';
        return;
    }

    const sessionData = JSON.parse(session);
    currentUserId = sessionData.uid || sessionData.id;

    if (!sessionData.isAdmin) {
        alert('Acesso negado. Apenas administradores.');
        window.location.href = 'user-dashboard.html';
        return;
    }

    // Inicializar tab Rotas (ativo por padrão)
    initRoutesTab();
    initSettingsTab();
    initFeedbacksTab();

    // Setup form submit
    document.getElementById('routeForm').addEventListener('submit', handleRouteSubmit);
    document.getElementById('editUserForm').addEventListener('submit', handleEditUserSubmit);
});

// ========== NAVEGAÇÃO ENTRE TABS ==========

function switchTab(tabName) {
    console.log('[switchTab]', tabName);

    if (tabName !== 'users') {
        stopUsersAutoRefresh();
    }

    // Atualizar botões de navegação
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');

    // Esconder todos os tabs
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // Mostrar tab selecionado
    if (tabName === 'routes') {
        document.getElementById('routesTab').classList.add('active');
        currentTab = 'routes';

        // Inicializar mapa se ainda não foi
        if (!routesMap) {
            setTimeout(() => initRoutesTab(), 100);
        } else {
            // Forçar redimensionamento do mapa
            routesMap.invalidateSize();
        }

    } else if (tabName === 'users') {
        document.getElementById('usersTab').classList.add('active');
        currentTab = 'users';

        // Carregar usuários
        loadUsersForAdmin();
        syncUsersAutoRefresh();
    } else if (tabName === 'feedbacks') {
        document.getElementById('feedbacksTab').classList.add('active');
        currentTab = 'feedbacks';
        loadFeedbacks();
    } else if (tabName === 'settings') {
        document.getElementById('settingsTab').classList.add('active');
        currentTab = 'settings';
    }
}

// ========================================
// TAB: FEEDBACKS
// ========================================

function initFeedbacksTab() {
    const filterElement = document.getElementById('feedbackFilterStatus');
    const saveReplyButton = document.getElementById('saveFeedbackReplyBtn');
    const clearReplyButton = document.getElementById('clearFeedbackReplyBtn');
    const replyTextarea = document.getElementById('feedbackReplyText');

    if (!filterElement) {
        return;
    }

    filterElement.value = currentFeedbackFilter;
    filterElement.addEventListener('change', (event) => {
        currentFeedbackFilter = event.target.value;
        renderFeedbacks();
    });

    if (saveReplyButton) {
        saveReplyButton.addEventListener('click', saveSelectedFeedbackReply);
    }

    if (clearReplyButton) {
        clearReplyButton.addEventListener('click', clearSelectedFeedbackReply);
    }

    if (replyTextarea) {
        replyTextarea.addEventListener('input', () => {
            if (selectedFeedbackId) {
                const selectedFeedback = allFeedbacks.find((item) => item.id === selectedFeedbackId);
                if (selectedFeedback) {
                    selectedFeedback.adminResponseDraft = replyTextarea.value;
                }
            }
        });
    }
}

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function updateFeedbackStats() {
    const total = allFeedbacks.length;
    const unread = allFeedbacks.filter((feedback) => feedback.status === 'unread').length;
    const read = allFeedbacks.filter((feedback) => feedback.status === 'read').length;

    document.getElementById('totalFeedbacks').textContent = total;
    document.getElementById('unreadFeedbacks').textContent = unread;
    document.getElementById('readFeedbacks').textContent = read;
}

function renderFeedbacks() {
    const feedbacksContainer = document.getElementById('feedbacksContainer');
    const emptyState = document.getElementById('feedbackEmptyState');

    if (!feedbacksContainer || !emptyState) {
        return;
    }

    const filteredFeedbacks = allFeedbacks.filter((feedback) => {
        if (currentFeedbackFilter === 'all') return true;

        if (currentFeedbackFilter === 'responded') {
            return typeof feedback.adminResponse === 'string' && feedback.adminResponse.trim().length > 0;
        }

        if (currentFeedbackFilter === 'read') {
            return feedback.status === 'read';
        }

        return feedback.status === currentFeedbackFilter;
    });

    if (filteredFeedbacks.length === 0) {
        feedbacksContainer.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    feedbacksContainer.innerHTML = filteredFeedbacks.map((feedback) => {
        const date = feedback.timestamp?.toDate ? feedback.timestamp.toDate() : new Date(feedback.timestamp);
        const dateStr = date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        const hasResponse = typeof feedback.adminResponse === 'string' && feedback.adminResponse.trim().length > 0;
        const respondedAt = feedback.respondedAt?.toDate ? feedback.respondedAt.toDate() : null;
        const respondedAtStr = respondedAt
            ? respondedAt.toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : '';
        const isUnread = feedback.status === 'unread';
        const safeUserEmail = escapeHtml(feedback.userEmail || 'Usuário');
        const safeFeedbackText = escapeHtml(feedback.feedbackText || '');
        const safeAdminResponse = hasResponse ? escapeHtml(feedback.adminResponse) : '';
        const isSelected = feedback.id === selectedFeedbackId;

        return `
            <div class="feedback-card ${isUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}" data-feedback-id="${feedback.id}">
                <div class="feedback-card-header">
                    <div>
                        <div class="feedback-user-email">${safeUserEmail}</div>
                        <div class="feedback-date">${dateStr}</div>
                    </div>
                    <div class="feedback-actions-group">
                        ${isUnread
                            ? `<button class="feedback-action-btn read" onclick="markAsRead('${feedback.id}')">Marcar como Lido</button>`
                            : hasResponse
                                ? ''
                                : `<button class="feedback-action-btn unread" onclick="markAsUnread('${feedback.id}')">Marcar como Não Lido</button>`
                        }
                        <button class="feedback-action-btn respond" onclick="selectFeedbackForReply('${feedback.id}')">
                            ${hasResponse ? 'Editar Resposta' : 'Responder'}
                        </button>
                    </div>
                </div>
                <p class="feedback-text">${safeFeedbackText}</p>
                ${hasResponse
                    ? `<div class="feedback-response-box">
                        <div class="feedback-response-title">Resposta do Admin ${respondedAtStr ? `• ${respondedAtStr}` : ''}</div>
                        <p class="feedback-response-text">${safeAdminResponse}</p>
                    </div>`
                    : ''
                }
            </div>
        `;
    }).join('');

    if (selectedFeedbackId) {
        highlightSelectedFeedback(selectedFeedbackId);
    }
}

function highlightSelectedFeedback(feedbackId) {
    document.querySelectorAll('.feedback-card').forEach((card) => {
        card.classList.remove('selected');
    });

    const selectedCard = document.querySelector(`.feedback-card[data-feedback-id="${feedbackId}"]`);

    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
}

function selectFeedbackForReply(feedbackId) {
    const feedback = allFeedbacks.find((item) => item.id === feedbackId);

    if (!feedback) {
        showToast('Feedback não encontrado', 'error');
        return;
    }

    selectedFeedbackId = feedbackId;

    const replyPanel = document.getElementById('feedbackReplyPanel');
    const replyMeta = document.getElementById('feedbackReplyMeta');
    const replyPreview = document.getElementById('feedbackReplyPreview');
    const replyTextarea = document.getElementById('feedbackReplyText');

    if (replyPanel) replyPanel.classList.remove('hidden');

    const date = feedback.timestamp?.toDate ? feedback.timestamp.toDate() : new Date(feedback.timestamp);
    const dateStr = Number.isNaN(date.getTime()) ? '' : date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    if (replyMeta) {
        replyMeta.textContent = `${feedback.userEmail || 'Usuário'}${dateStr ? ` • ${dateStr}` : ''}`;
    }

    if (replyPreview) {
        replyPreview.textContent = feedback.feedbackText || '';
    }

    if (replyTextarea) {
        replyTextarea.value = feedback.adminResponse || '';
        replyTextarea.focus();
    }

    highlightSelectedFeedback(feedbackId);
}

function clearSelectedFeedbackReply() {
    selectedFeedbackId = null;

    const replyPanel = document.getElementById('feedbackReplyPanel');
    const replyMeta = document.getElementById('feedbackReplyMeta');
    const replyPreview = document.getElementById('feedbackReplyPreview');
    const replyTextarea = document.getElementById('feedbackReplyText');

    if (replyPanel) replyPanel.classList.add('hidden');
    if (replyMeta) replyMeta.textContent = 'Nenhum feedback selecionado.';
    if (replyPreview) replyPreview.textContent = '';
    if (replyTextarea) replyTextarea.value = '';

    document.querySelectorAll('.feedback-card').forEach((card) => {
        card.classList.remove('selected');
    });
}

async function saveSelectedFeedbackReply() {
    if (!selectedFeedbackId) {
        showToast('Selecione um feedback para responder', 'error');
        return;
    }

    const replyTextarea = document.getElementById('feedbackReplyText');
    const responseText = (replyTextarea?.value || '').trim();

    if (responseText.length < 3) {
        showToast('A resposta deve ter pelo menos 3 caracteres', 'error');
        return;
    }

    try {
        await db.collection('feedback').doc(selectedFeedbackId).update({
            adminResponse: responseText,
            respondedAt: firebase.firestore.FieldValue.serverTimestamp(),
            respondedBy: currentUserId,
            status: 'read'
        });

        showToast('Resposta enviada ao usuário', 'success');
        clearSelectedFeedbackReply();
        await loadFeedbacks();
    } catch (error) {
        console.error('[saveSelectedFeedbackReply] Erro:', error);
        showToast('Erro ao salvar resposta', 'error');
    }
}

async function loadFeedbacks() {
    try {
        const snapshot = await db.collection('feedback')
            .orderBy('timestamp', 'desc')
            .get();

        allFeedbacks = [];
        snapshot.forEach((doc) => {
            allFeedbacks.push({
                id: doc.id,
                ...doc.data()
            });
        });

        updateFeedbackStats();
        renderFeedbacks();
    } catch (error) {
        console.error('[loadFeedbacks] Erro:', error);
        showToast('Erro ao carregar feedbacks', 'error');
    }
}

async function markAsRead(feedbackId) {
    try {
        await db.collection('feedback').doc(feedbackId).update({
            status: 'read',
            readAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Feedback marcado como lido', 'success');
        await loadFeedbacks();
    } catch (error) {
        console.error('[markAsRead] Erro:', error);
        showToast('Erro ao atualizar feedback', 'error');
    }
}

async function markAsUnread(feedbackId) {
    try {
        await db.collection('feedback').doc(feedbackId).update({
            status: 'unread',
            readAt: null
        });

        showToast('Feedback marcado como não lido', 'success');
        await loadFeedbacks();
    } catch (error) {
        console.error('[markAsUnread] Erro:', error);
        showToast('Erro ao atualizar feedback', 'error');
    }
}

// ========================================
// TAB: CONFIGURAÇÕES
// ========================================

function getAdminSettingsStorageKey() {
    return `buswayAdminSettings_${currentUserId || 'default'}`;
}

function loadAdminSettings() {
    try {
        const savedSettings = localStorage.getItem(getAdminSettingsStorageKey());
        if (!savedSettings) return;

        const parsed = JSON.parse(savedSettings);
        adminSettings.confirmDelete = parsed.confirmDelete !== false;
        adminSettings.autoRefreshUsers = parsed.autoRefreshUsers === true;
    } catch (error) {
        console.warn('[loadAdminSettings] Falha ao carregar settings:', error);
    }
}

function saveAdminSettings() {
    localStorage.setItem(getAdminSettingsStorageKey(), JSON.stringify(adminSettings));
}

function stopUsersAutoRefresh() {
    if (usersAutoRefreshInterval) {
        clearInterval(usersAutoRefreshInterval);
        usersAutoRefreshInterval = null;
    }
}

function syncUsersAutoRefresh() {
    stopUsersAutoRefresh();

    if (!adminSettings.autoRefreshUsers || currentTab !== 'users') {
        return;
    }

    usersAutoRefreshInterval = setInterval(() => {
        if (currentTab === 'users') {
            loadUsersForAdmin();
        }
    }, 30000);
}

async function updateDarkModePreference(enabled) {
    document.body.classList.toggle('dark-theme', enabled);

    if (!currentUserId) {
        showToast('Usuário não identificado para salvar preferência', 'error');
        return;
    }

    try {
        await db.collection('users').doc(currentUserId).update({
            'preferences.darkMode': enabled
        });

        showToast(enabled ? 'Modo noturno ativado' : 'Modo noturno desativado', 'success');
    } catch (error) {
        console.error('[updateDarkModePreference] Erro:', error);
        showToast('Erro ao salvar modo noturno', 'error');
    }
}

async function syncDarkModeToggleState() {
    const darkModeToggle = document.getElementById('adminDarkModeToggle');
    if (!darkModeToggle || !currentUserId) return;

    try {
        const userDoc = await db.collection('users').doc(currentUserId).get();
        if (!userDoc.exists) return;

        const darkModeEnabled = userDoc.data()?.preferences?.darkMode === true;
        darkModeToggle.checked = darkModeEnabled;
        document.body.classList.toggle('dark-theme', darkModeEnabled);
    } catch (error) {
        console.error('[syncDarkModeToggleState] Erro:', error);
    }
}

function initSettingsTab() {
    loadAdminSettings();

    const confirmDeleteToggle = document.getElementById('adminConfirmDeleteToggle');
    const autoRefreshUsersToggle = document.getElementById('adminAutoRefreshUsersToggle');
    const darkModeToggle = document.getElementById('adminDarkModeToggle');

    if (confirmDeleteToggle) {
        confirmDeleteToggle.checked = adminSettings.confirmDelete;
        confirmDeleteToggle.addEventListener('change', (e) => {
            adminSettings.confirmDelete = e.target.checked;
            saveAdminSettings();
            showToast(
                adminSettings.confirmDelete
                    ? 'Confirmação de exclusão ativada'
                    : 'Confirmação de exclusão desativada',
                'success'
            );
        });
    }

    if (autoRefreshUsersToggle) {
        autoRefreshUsersToggle.checked = adminSettings.autoRefreshUsers;
        autoRefreshUsersToggle.addEventListener('change', (e) => {
            adminSettings.autoRefreshUsers = e.target.checked;
            saveAdminSettings();
            syncUsersAutoRefresh();
            showToast(
                adminSettings.autoRefreshUsers
                    ? 'Autoatualização da aba Usuários ativada'
                    : 'Autoatualização da aba Usuários desativada',
                'success'
            );
        });
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', (e) => {
            updateDarkModePreference(e.target.checked);
        });
    }

    syncDarkModeToggleState();
}

// ========== LOGOUT ==========

function logout() {
    sessionStorage.removeItem('buswaySession');
    window.location.href = 'landing.html';
}

// ========================================
// TAB: ROTAS
// ========================================

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

function initRoutesTab() {
    console.log('[initRoutesTab] Inicializando mapa');

    // Chapecó, SC
    routesMap = L.map('routesMap').setView([-27.0945, -52.6166], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(routesMap);

    routesMap.on('click', handleMapClick);

    // Carregar rotas existentes
    loadRoutes();

    console.log('[initRoutesTab] Mapa pronto');
}

async function handleMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    if (!originCoords) {
        originCoords = { lat, lng };

        if (originMarker) routesMap.removeLayer(originMarker);
        originMarker = L.marker([lat, lng], { icon: originIcon })
            .addTo(routesMap)
            .bindPopup('🟢 Origem');

        const locationName = await reverseGeocode(lat, lng);
        document.getElementById('routeOrigin').value = locationName;

        showToast('Origem definida. Agora clique no destino.', 'success');
        updateInstructions('Agora clique no mapa para definir o <strong>destino</strong>');

    } else if (!destCoords) {
        destCoords = { lat, lng };

        if (destMarker) routesMap.removeLayer(destMarker);
        destMarker = L.marker([lat, lng], { icon: destIcon })
            .addTo(routesMap)
            .bindPopup('🔴 Destino');

        const locationName = await reverseGeocode(lat, lng);
        document.getElementById('routeDestination').value = locationName;

        showToast('Destino definido. Calculando rota...', 'info');
        updateInstructions('Calculando rota com OSRM...');

        await calculateRoute();
    } else {
        resetRoute();
        handleMapClick(e);
    }
}

function updateInstructions(html) {
    document.getElementById('mapInstructions').innerHTML = `🗺️ ${html}`;
}

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

async function calculateRoute() {
    if (!originCoords || !destCoords) return;

    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${originCoords.lng},${originCoords.lat};${destCoords.lng},${destCoords.lat}?overview=full&geometries=geojson`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
            showToast('Erro ao calcular rota. Tente outros pontos.', 'error');
            return;
        }

        const route = data.routes[0];

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

        document.getElementById('previewDistance').textContent = `${distanceKm} km`;
        document.getElementById('previewDuration').textContent = `${durationMin} min`;
        document.getElementById('metricsPreview').classList.add('show');

        drawRouteLine(calculatedMetrics.path);

        document.getElementById('btnSave').disabled = false;

        showToast('Rota calculada com sucesso!', 'success');
        updateInstructions('Rota calculada! Preencha os dados e clique em <strong>Salvar Rota</strong>');

    } catch (error) {
        console.error('[calculateRoute] Erro:', error);
        showToast('Erro ao calcular rota com OSRM', 'error');
    }
}

function drawRouteLine(path) {
    if (routeLine) {
        routesMap.removeLayer(routeLine);
    }

    const latLngs = path.map(p => [p.lat, p.lon]);

    routeLine = L.polyline(latLngs, {
        color: '#ef4444',
        weight: 5,
        opacity: 0.7
    }).addTo(routesMap);

    routesMap.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
}

async function handleRouteSubmit(e) {
    e.preventDefault();

    const routeNumber = document.getElementById('routeNumber').value.trim();
    const routeName = document.getElementById('routeName').value.trim();
    const routePrice = parseFloat(document.getElementById('routePrice').value);
    const routeFrequency = document.getElementById('routeFrequency').value.trim();

    if (!routeNumber || !routeName) {
        showToast('Preencha número e nome da rota', 'error');
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
        distance: calculatedMetrics.distance,
        duration: calculatedMetrics.duration,
        path: calculatedMetrics.path,
        active: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    try {
        if (editingRouteId) {
            await db.collection('routes').doc(editingRouteId).update(routeData);
            showToast('Rota atualizada com sucesso!', 'success');
            editingRouteId = null;
        } else {
            routeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
            await db.collection('routes').add(routeData);
            showToast('Rota criada com sucesso!', 'success');
        }

        resetRouteForm();
        await loadRoutes();

    } catch (error) {
        console.error('[handleRouteSubmit] Erro:', error);
        showToast(`Erro ao salvar rota: ${error.message}`, 'error');
    }
}

async function loadRoutes() {
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

        allRoutes.sort((a, b) => {
            const numA = parseInt(a.number) || 0;
            const numB = parseInt(b.number) || 0;
            return numA - numB;
        });

        if (allRoutes.length === 0) {
            routesList.innerHTML = `<div class="empty-state">Nenhuma rota cadastrada</div>`;
        } else {
            routesList.innerHTML = allRoutes.map(route => `
                <div class="route-card">
                    <div class="route-header">
                        <div class="route-number">${route.number}</div>
                        <div class="route-actions">
                            <button class="btn-icon" onclick="editRoute('${route.id}')">
                                <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                </svg>
                                Editar
                            </button>
                            <button class="btn-icon danger" onclick="deleteRoute('${route.id}', '${route.number}')">
                                <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div class="route-name">${route.name}</div>
                    <div class="route-path">
                        ${route.origin} → ${route.destination}
                    </div>
                    <div class="route-metrics">
                        <span>
                            <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"/>
                            </svg>
                            ${route.distance} km
                        </span>
                        <span>
                            <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            ${route.duration} min
                        </span>
                        <span>
                            <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:4px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            R$ ${route.price.toFixed(2)}
                        </span>
                    </div>
                </div>
            `).join('');
        }

    } catch (error) {
        console.error('[loadRoutes] Erro:', error);
        routesList.innerHTML = `<div class="empty-state" style="color:#ef4444;">Erro ao carregar rotas</div>`;
    }
}

function editRoute(routeId) {
    const route = allRoutes.find(r => r.id === routeId);
    if (!route) {
        showToast('Rota não encontrada', 'error');
        return;
    }

    document.getElementById('routeNumber').value = route.number;
    document.getElementById('routeName').value = route.name;
    document.getElementById('routeOrigin').value = route.origin;
    document.getElementById('routeDestination').value = route.destination;
    document.getElementById('routePrice').value = route.price;
    document.getElementById('routeFrequency').value = route.frequency || '';

    originCoords = route.originCoords;
    destCoords = route.destinationCoords;
    calculatedMetrics = {
        distance: route.distance,
        duration: route.duration,
        path: route.path
    };

    if (originMarker) routesMap.removeLayer(originMarker);
    if (destMarker) routesMap.removeLayer(destMarker);

    originMarker = L.marker([originCoords.lat, originCoords.lng], { icon: originIcon })
        .addTo(routesMap)
        .bindPopup('🟢 Origem');

    destMarker = L.marker([destCoords.lat, destCoords.lng], { icon: destIcon })
        .addTo(routesMap)
        .bindPopup('🔴 Destino');

    drawRouteLine(calculatedMetrics.path);

    document.getElementById('previewDistance').textContent = `${route.distance} km`;
    document.getElementById('previewDuration').textContent = `${route.duration} min`;
    document.getElementById('metricsPreview').classList.add('show');

    document.getElementById('btnSave').disabled = false;
    document.getElementById('btnSave').textContent = 'Atualizar Rota';

    editingRouteId = routeId;

    showToast('Editando rota. Altere os campos desejados.', 'info');
    updateInstructions('Editando rota. Clique em <strong>Atualizar Rota</strong> para salvar');

    document.querySelector('.routes-sidebar').scrollTop = 0;
}

async function deleteRoute(routeId, routeNumber) {
    if (adminSettings.confirmDelete && !confirm(`Deseja realmente deletar a rota ${routeNumber}?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        await db.collection('routes').doc(routeId).delete();
        showToast('Rota deletada com sucesso', 'success');
        await loadRoutes();

    } catch (error) {
        console.error('[deleteRoute] Erro:', error);
        showToast(`Erro ao deletar rota: ${error.message}`, 'error');
    }
}

function resetRouteForm() {
    document.getElementById('routeForm').reset();
    document.getElementById('routePrice').value = '4.80';
    document.getElementById('routeFrequency').value = '10-15 min';

    originCoords = null;
    destCoords = null;
    calculatedMetrics = null;
    editingRouteId = null;

    if (originMarker) {
        routesMap.removeLayer(originMarker);
        originMarker = null;
    }
    if (destMarker) {
        routesMap.removeLayer(destMarker);
        destMarker = null;
    }
    if (routeLine) {
        routesMap.removeLayer(routeLine);
        routeLine = null;
    }

    document.getElementById('metricsPreview').classList.remove('show');
    document.getElementById('btnSave').disabled = true;
    document.getElementById('btnSave').textContent = 'Salvar Rota';

    updateInstructions('Clique no mapa para marcar <strong>origem</strong>, depois clique novamente para marcar <strong>destino</strong>');

    routesMap.setView([-27.0945, -52.6166], 13);
}

function resetRoute() {
    originCoords = null;
    destCoords = null;
    calculatedMetrics = null;

    document.getElementById('routeOrigin').value = '';
    document.getElementById('routeDestination').value = '';

    if (originMarker) {
        routesMap.removeLayer(originMarker);
        originMarker = null;
    }
    if (destMarker) {
        routesMap.removeLayer(destMarker);
        destMarker = null;
    }
    if (routeLine) {
        routesMap.removeLayer(routeLine);
        routeLine = null;
    }

    document.getElementById('metricsPreview').classList.remove('show');
    document.getElementById('btnSave').disabled = true;

    updateInstructions('Clique no mapa para marcar <strong>origem</strong>, depois clique novamente para marcar <strong>destino</strong>');
}

// ========================================
// TAB: USUÁRIOS
// ========================================

async function loadUsersForAdmin() {
    try {
        const snapshot = await db.collection('users').get();
        allUsers = [];
        snapshot.forEach(doc => {
            allUsers.push({
                id: doc.id,
                ...doc.data()
            });
        });

        const usersTableBody = document.getElementById('usersTableBody');
        const totalUsersElement = document.getElementById('totalUsers');
        const adminCountElement = document.getElementById('adminCount');
        const activeUsersElement = document.getElementById('activeUsers');

        if (usersTableBody) {
            if (allUsers.length === 0) {
                usersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Nenhum usuário encontrado</td></tr>';
            } else {
                usersTableBody.innerHTML = allUsers.map(user => {
                    const createdDate = user.createdAt?.toDate?.() || new Date();
                    const userType = user.isAdmin ? 'Admin' : 'Usuário';
                    const typeClass = user.isAdmin ? 'admin' : 'user';

                    return `
                        <tr>
                            <td>${user.name || 'N/A'}</td>
                            <td>${user.email || 'N/A'}</td>
                            <td><span class="badge ${typeClass}">${userType}</span></td>
                            <td>${createdDate.toLocaleDateString('pt-BR')}</td>
                            <td>
                                <button class="btn-icon" onclick="openEditUserModal('${user.id}')">
                                    <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                                    </svg>
                                    Editar
                                </button>
                                <button class="btn-icon danger" onclick="confirmDeleteUser('${user.id}', '${user.name}')">
                                    <svg style="display:inline-block;width:14px;height:14px;vertical-align:middle;margin-right:3px;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        if (totalUsersElement) totalUsersElement.textContent = allUsers.length;
        if (adminCountElement) adminCountElement.textContent = allUsers.filter(u => u.isAdmin).length;
        if (activeUsersElement) activeUsersElement.textContent = allUsers.filter(u => (u.balance || 0) > 0).length;

    } catch (error) {
        console.error('[loadUsersForAdmin] Erro:', error);
        showToast('Erro ao carregar usuários', 'error');
    }
}

function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showToast('Usuário não encontrado', 'error');
        return;
    }

    editingUserId = userId;

    // Preencher formulário
    document.getElementById('editUserName').value = user.name || '';
    document.getElementById('editUserEmail').value = user.email || '';

    // Mostrar modal
    document.getElementById('editUserModal').classList.add('show');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
    editingUserId = null;
}

async function handleEditUserSubmit(e) {
    e.preventDefault();

    if (!editingUserId) {
        showToast('Erro: nenhum usuário selecionado', 'error');
        return;
    }

    const name = document.getElementById('editUserName').value.trim();
    const email = document.getElementById('editUserEmail').value.trim();

    if (!name || !email) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    try {
        await db.collection('users').doc(editingUserId).update({
            name: name,
            email: email,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Usuário atualizado com sucesso!', 'success');
        closeEditUserModal();
        await loadUsersForAdmin();

    } catch (error) {
        console.error('[handleEditUserSubmit] Erro:', error);
        showToast(`Erro ao atualizar usuário: ${error.message}`, 'error');
    }
}

async function confirmDeleteUser(userId, userName) {
    if (adminSettings.confirmDelete && !confirm(`Tem certeza que deseja deletar o usuário "${userName}"?\n\nEsta ação não pode ser desfeita.`)) {
        return;
    }

    try {
        await db.collection('users').doc(userId).delete();
        showToast('Usuário deletado com sucesso', 'success');
        await loadUsersForAdmin();
    } catch (error) {
        console.error('[confirmDeleteUser] Erro:', error);
        showToast('Erro ao deletar usuário', 'error');
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

// ========== EXPOR FUNÇÕES GLOBALMENTE ==========

window.switchTab = switchTab;
window.logout = logout;
window.resetRouteForm = resetRouteForm;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.confirmDeleteUser = confirmDeleteUser;
window.markAsRead = markAsRead;
window.markAsUnread = markAsUnread;
window.selectFeedbackForReply = selectFeedbackForReply;

console.log('[admin-dashboard] Script carregado');
