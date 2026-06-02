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
let currentUserFilter = 'all';
let currentUsersSort = {
    key: 'name',
    direction: 'asc'
};
let cachedAssignableRoutes = [];

// Motoristas
let allDrivers = [];
let driversRefreshInterval = null;
let editingDriverRouteId = null;

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
        window.location.href = '../../index.html';
        return;
    }

    const sessionData = JSON.parse(session);
    currentUserId = sessionData.uid || sessionData.id;

    if (!sessionData.isAdmin) {
        alert('Acesso negado. Apenas administradores.');
        window.location.href = '../user/user-dashboard.html';
        return;
    }

    // Inicializar tab Rotas (ativo por padrão)
    initRoutesTab();
    initSettingsTab();
    initFeedbacksTab();
    initDriversTab();

    // Setup form submit
    document.getElementById('routeForm').addEventListener('submit', handleRouteSubmit);
    document.getElementById('editUserForm').addEventListener('submit', handleEditUserSubmit);
    document.getElementById('createUserForm').addEventListener('submit', handleCreateUserSubmit);
    document.getElementById('editDriverRouteForm').addEventListener('submit', handleEditDriverRouteSubmit);

    const createUserRole = document.getElementById('createUserRole');
    if (createUserRole) {
        createUserRole.addEventListener('change', () => {
            handleRoleChange('create');
        });
    }

    const editUserRole = document.getElementById('editUserRole');
    if (editUserRole) {
        editUserRole.addEventListener('change', () => {
            handleRoleChange('edit');
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeCreateUserModal();
        }
    });

    const createUserModal = document.getElementById('createUserModal');
    if (createUserModal) {
        createUserModal.addEventListener('click', (event) => {
            if (event.target === createUserModal) {
                closeCreateUserModal();
            }
        });
    }

    // Permite selecionar/desselecionar múltiplas rotas com clique simples.
    enableMultiSelectToggle('createAssignedRoute');
    enableMultiSelectToggle('editAssignedRoute');
    enableMultiSelectToggle('driverRouteSelect');

    bindRouteCheckboxSync('createAssignedRoute');
    bindRouteCheckboxSync('editAssignedRoute');
    bindRouteCheckboxSync('driverRouteSelect');
});

// ========== NAVEGAÇÃO ENTRE TABS ==========

function switchTab(tabName, tabButton = null) {
    console.log('[switchTab]', tabName);

    if (tabName !== 'users') {
        stopUsersAutoRefresh();
    }

    if (tabName !== 'drivers') {
        stopDriversAutoRefresh();
    }

    // Atualizar botões de navegação
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.remove('active');
    });
    if (tabButton) {
        tabButton.classList.add('active');
    } else {
        const targetButton = document.querySelector(`.nav-tab[onclick*="'${tabName}'"]`);
        if (targetButton) {
            targetButton.classList.add('active');
        }
    }

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

    } else if (tabName === 'drivers') {
        document.getElementById('driversTab').classList.add('active');
        currentTab = 'drivers';
        
        // Carregar motoristas
        loadDriversForAdmin();
        startDriversAutoRefresh();

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

function toDateValue(value) {
    if (!value) return null;

    if (typeof value.toDate === 'function') {
        return value.toDate();
    }

    if (typeof value.toMillis === 'function') {
        return new Date(value.toMillis());
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getTripActivityDate(trip) {
    return toDateValue(
        trip?.liveTracking?.lastGpsAt ||
        trip?.busLocation?.timestamp ||
        trip?.updatedAt ||
        trip?.createdAt
    );
}

function getDriverStatus(driver, now = Date.now()) {
    const lastGpsAt = driver.currentTrip?.lastGpsAt || driver.currentTrip?.busLocationAt || driver.currentTrip?.updatedAt || driver.lastUpdate;
    const gpsAgeMs = lastGpsAt ? now - lastGpsAt.getTime() : null;
    const gpsAgeSeconds = gpsAgeMs !== null ? Math.max(0, Math.round(gpsAgeMs / 1000)) : null;
    const isGpsFresh = gpsAgeMs !== null && gpsAgeMs <= 45000;

    if (driver.isOnline === false) {
        return {
            label: 'Motorista indisponível',
            ledClass: 'deslogado',
            badgeClass: 'deslogado',
            emoji: '🔴',
            details: 'Motorista saiu do sistema',
            routeText: 'Sem rota ativa'
        };
    }

    if (!driver.isLoggedIn) {
        return {
            label: 'Motorista indisponível',
            ledClass: 'deslogado',
            badgeClass: 'deslogado',
            emoji: '🔴',
            details: 'Sem atividade recente',
            routeText: 'Sem rota ativa'
        };
    }

    if (driver.currentTrip && driver.isWorking && isGpsFresh) {
        return {
            label: 'Em rota',
            ledClass: 'active',
            badgeClass: 'active',
            emoji: '🟢',
            details: gpsAgeSeconds !== null ? `Último GPS há ${gpsAgeSeconds}s` : 'GPS recente',
            routeText: `Linha ${driver.currentTrip.routeNumber || 'N/A'} - ${driver.currentTrip.routeName || 'Rota'}`
        };
    }

    if (driver.currentTrip && driver.isWorking && !isGpsFresh) {
        return {
            label: 'Sem sinal',
            ledClass: 'warning',
            badgeClass: 'warning',
            emoji: '🟠',
            details: gpsAgeSeconds !== null ? `Sem GPS há ${gpsAgeSeconds}s` : 'Sem atualização GPS',
            routeText: `Linha ${driver.currentTrip.routeNumber || 'N/A'} - ${driver.currentTrip.routeName || 'Rota'}`
        };
    }

    if (driver.currentTrip && !driver.isWorking) {
        return {
            label: 'Aguardando GPS',
            ledClass: 'inactive',
            badgeClass: 'inactive',
            emoji: '⚪',
            details: 'Viagem criada, mas GPS não foi iniciado',
            routeText: `Linha ${driver.currentTrip.routeNumber || 'N/A'} - ${driver.currentTrip.routeName || 'Rota'}`
        };
    }

    return {
        label: 'Sem rota ativa',
        ledClass: 'inactive',
        badgeClass: 'inactive',
        emoji: '⚪',
        details: 'Motorista logado sem viagem em andamento',
        routeText: 'Sem rota ativa'
    };
}

function getVehicleText(driver) {
    const busLabel = driver.currentTrip?.busStartLocation?.name
        || driver.currentTrip?.busLabel
        || driver.currentTrip?.vehicleLabel
        || driver.currentTrip?.routeName;

    return busLabel ? `Ônibus: ${busLabel}` : 'Ônibus: não informado';
}

function setUserFilter(filter) {
    currentUserFilter = filter;

    document.querySelectorAll('.user-filter-tab').forEach((button) => {
        button.classList.toggle('active', button.dataset.userFilter === filter);
    });

    renderUsersForAdmin();
}

function getUsersSortValue(user, key) {
    const isDriver = user.isDriver || user.role === 'driver';
    const userType = user.isAdmin ? 'Admin' : (isDriver ? 'Motorista' : 'Usuário');

    if (key === 'name') {
        return (user.name || '').toLowerCase();
    }

    if (key === 'email') {
        return (user.email || '').toLowerCase();
    }

    if (key === 'type') {
        return userType.toLowerCase();
    }

    if (key === 'createdAt') {
        const dateValue = user.createdAt?.toDate?.() || new Date(0);
        return dateValue.getTime();
    }

    return '';
}

function sortUsersForAdmin(users) {
    const sortedUsers = [...users];
    const { key, direction } = currentUsersSort;

    sortedUsers.sort((a, b) => {
        const valueA = getUsersSortValue(a, key);
        const valueB = getUsersSortValue(b, key);

        if (typeof valueA === 'number' && typeof valueB === 'number') {
            return direction === 'asc' ? valueA - valueB : valueB - valueA;
        }

        const compareResult = String(valueA).localeCompare(String(valueB), 'pt-BR');
        return direction === 'asc' ? compareResult : -compareResult;
    });

    return sortedUsers;
}

function updateUsersTableSortIndicators() {
    document.querySelectorAll('.users-sortable').forEach((header) => {
        const key = header.dataset.sortKey;
        const indicator = header.querySelector('.users-sort-indicator');
        if (!indicator) return;

        header.classList.remove('active', 'asc', 'desc');

        if (key === currentUsersSort.key) {
            header.classList.add('active', currentUsersSort.direction);
            indicator.textContent = currentUsersSort.direction === 'asc' ? '▲' : '▼';
        } else {
            indicator.textContent = '↕';
        }
    });
}

function setUserSort(sortKey) {
    if (!sortKey) return;

    if (currentUsersSort.key === sortKey) {
        currentUsersSort.direction = currentUsersSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentUsersSort.key = sortKey;
        currentUsersSort.direction = sortKey === 'createdAt' ? 'desc' : 'asc';
    }

    renderUsersForAdmin();
}

async function fetchAssignableRoutes() {
    try {
        let snapshot = await db.collection('routes')
            .where('active', '==', true)
            .get();

        // Fallback para dados legados sem campo active definido.
        if (snapshot.empty) {
            snapshot = await db.collection('routes').get();
        }

        const routes = [];
        snapshot.forEach((doc) => {
            const routeData = doc.data() || {};
            if (routeData.active === false) {
                return;
            }

            routes.push({
                id: doc.id,
                ...routeData
            });
        });

        routes.sort((a, b) => {
            const aNum = String(a.number || '').toLowerCase();
            const bNum = String(b.number || '').toLowerCase();
            return aNum.localeCompare(bNum, 'pt-BR');
        });

        cachedAssignableRoutes = routes;
        return routes;
    } catch (error) {
        console.error('[fetchAssignableRoutes] Erro:', error);
        cachedAssignableRoutes = [];
        return [];
    }
}

function populateRouteSelect(selectId, selectedRouteId = '') {
    const routeSelect = document.getElementById(selectId);
    if (!routeSelect) return;

    const isMultiple = routeSelect.multiple;
    const selectedIds = Array.isArray(selectedRouteId)
        ? selectedRouteId.map((id) => String(id))
        : (selectedRouteId ? [String(selectedRouteId)] : []);

    routeSelect.innerHTML = isMultiple ? '' : '<option value="">Selecione uma rota</option>';

    cachedAssignableRoutes.forEach((route) => {
        const label = `Linha ${route.number || 'N/A'} - ${route.name || 'Sem nome'}`;
        const isSelected = selectedIds.includes(String(route.id));
        routeSelect.insertAdjacentHTML(
            'beforeend',
            `<option value="${route.id}"${isSelected ? ' selected' : ''}>${label}</option>`
        );
    });

    if (!isMultiple) {
        routeSelect.value = selectedIds[0] || '';
    }

    renderRouteCheckboxes(selectId);
}

function getRouteBoxesContainerId(selectId) {
    const map = {
        createAssignedRoute: 'createAssignedRoutesBoxes',
        editAssignedRoute: 'editAssignedRoutesBoxes',
        driverRouteSelect: 'driverRouteSelectBoxes'
    };

    return map[selectId] || '';
}

function renderRouteCheckboxes(selectId) {
    const select = document.getElementById(selectId);
    const containerId = getRouteBoxesContainerId(selectId);
    const container = containerId ? document.getElementById(containerId) : null;
    if (!select || !container || !select.multiple) {
        return;
    }

    const options = Array.from(select.options);
    if (!options.length) {
        container.innerHTML = '<div class="route-checkbox-empty">Nenhuma rota disponível.</div>';
        return;
    }

    container.innerHTML = options.map((option, index) => {
        const checked = option.selected ? 'checked' : '';
        const selectedClass = option.selected ? 'selected' : '';
        const value = String(option.value || '');
        const label = String(option.textContent || '').trim();

        return `
            <label class="route-checkbox-item ${selectedClass}" data-route-value="${value}" for="${selectId}_chk_${index}">
                <input id="${selectId}_chk_${index}" type="checkbox" value="${value}" ${checked}>
                <span class="route-checkbox-text">${label}</span>
            </label>
        `;
    }).join('');
}

function bindRouteCheckboxSync(selectId) {
    const select = document.getElementById(selectId);
    const containerId = getRouteBoxesContainerId(selectId);
    const container = containerId ? document.getElementById(containerId) : null;

    if (!select || !container || select.dataset.routeCheckboxBound === 'true') {
        return;
    }

    select.addEventListener('change', () => {
        renderRouteCheckboxes(selectId);
    });

    container.addEventListener('change', (event) => {
        const checkbox = event.target;
        if (!(checkbox instanceof HTMLInputElement) || checkbox.type !== 'checkbox') {
            return;
        }

        const option = Array.from(select.options).find((item) => String(item.value) === String(checkbox.value));
        if (option) {
            option.selected = checkbox.checked;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    select.dataset.routeCheckboxBound = 'true';
}

async function loadRouteOptionsForRole(selectId, selectedRouteId = '') {
    if (!cachedAssignableRoutes.length) {
        await fetchAssignableRoutes();
    }

    populateRouteSelect(selectId, selectedRouteId);
}

function enableMultiSelectToggle(selectId) {
    const select = document.getElementById(selectId);
    if (!select || !select.multiple || select.dataset.multiToggleBound === 'true') {
        return;
    }

    select.addEventListener('mousedown', (event) => {
        const option = event.target;
        if (!option || option.tagName !== 'OPTION') {
            return;
        }

        event.preventDefault();
        option.selected = !option.selected;
        select.dispatchEvent(new Event('change', { bubbles: true }));
    });

    select.dataset.multiToggleBound = 'true';
}

function getSelectedRouteIds(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return [];

    if (select.multiple) {
        return Array.from(select.selectedOptions)
            .map((option) => String(option.value || '').trim())
            .filter(Boolean);
    }

    const value = String(select.value || '').trim();
    return value ? [value] : [];
}

function clearRouteSelection(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (select.multiple) {
        Array.from(select.options).forEach((option) => {
            option.selected = false;
        });
        renderRouteCheckboxes(selectId);
        return;
    }

    select.value = '';
}

function normalizeRouteIdList(value) {
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

function getUserAssignedRouteIds(user = {}) {
    const multipleIds = normalizeRouteIdList(user.assignedRouteIds);

    if (multipleIds.length) {
        return Array.from(new Set(multipleIds));
    }

    const idsFromRouteObjects = (Array.isArray(user.assignedRoutes) ? user.assignedRoutes : [])
        .map((route) => String(route?.id || '').trim())
        .filter(Boolean);

    if (idsFromRouteObjects.length) {
        return Array.from(new Set(idsFromRouteObjects));
    }

    const legacyId = String(user.assignedRouteId || '').trim();
    return legacyId ? [legacyId] : [];
}

function buildAssignedRoutesPayload(routeIds = []) {
    const normalizedIds = Array.from(new Set(
        (Array.isArray(routeIds) ? routeIds : [])
            .map((id) => String(id || '').trim())
            .filter(Boolean)
    ));

    const selectedRoutes = normalizedIds
        .map((routeId) => {
            const route = cachedAssignableRoutes.find((item) => item.id === routeId);
            if (!route) return null;
            return {
                id: route.id,
                number: route.number || null,
                name: route.name || null
            };
        })
        .filter(Boolean);

    const assignedRouteIds = selectedRoutes.map((route) => route.id);
    const assignedRouteNumbers = selectedRoutes
        .map((route) => route.number)
        .filter((number) => number !== null && number !== undefined && String(number).trim() !== '');
    const assignedRouteNames = selectedRoutes
        .map((route) => route.name)
        .filter((name) => name !== null && name !== undefined && String(name).trim() !== '');
    const primaryRoute = selectedRoutes[0] || null;

    return {
        assignedRouteId: primaryRoute?.id || null,
        assignedRouteNumber: primaryRoute?.number || null,
        assignedRouteName: primaryRoute?.name || null,
        assignedRouteIds,
        assignedRouteNumbers,
        assignedRouteNames,
        assignedRoutes: selectedRoutes
    };
}

function getAssignedRoutesFromDriver(driver = {}) {
    const routeIds = getUserAssignedRouteIds(driver);

    const mappedRoutes = routeIds
        .map((routeId) => {
            const found = cachedAssignableRoutes.find((route) => route.id === routeId);
            if (found) {
                return {
                    id: found.id,
                    number: found.number || null,
                    name: found.name || null
                };
            }

            const fallback = (Array.isArray(driver.assignedRoutes) ? driver.assignedRoutes : [])
                .find((route) => String(route?.id || '').trim() === routeId);

            if (!fallback) return null;

            return {
                id: routeId,
                number: fallback.number || null,
                name: fallback.name || null
            };
        })
        .filter(Boolean);

    if (mappedRoutes.length) {
        return mappedRoutes;
    }

    const legacyRouteNumber = driver.assignedRouteNumber;
    const legacyRouteName = driver.assignedRouteName;
    if (legacyRouteNumber || legacyRouteName) {
        return [{
            id: String(driver.assignedRouteId || '').trim() || null,
            number: legacyRouteNumber || null,
            name: legacyRouteName || null
        }];
    }

    return [];
}

function formatAssignedRoutesLabel(driver = {}) {
    const routes = getAssignedRoutesFromDriver(driver);
    if (!routes.length) {
        return 'Sem rota designada';
    }

    return routes
        .map((route) => {
            if (route.number) {
                return `Linha ${route.number}${route.name ? ` - ${route.name}` : ''}`;
            }
            return route.name || 'Rota sem nome';
        })
        .join('<br>');
}

async function handleRoleChange(context) {
    const roleSelect = document.getElementById(context === 'create' ? 'createUserRole' : 'editUserRole');
    const routeGroup = document.getElementById(context === 'create' ? 'createDriverRouteGroup' : 'editDriverRouteGroup');
    const routeSelect = document.getElementById(context === 'create' ? 'createAssignedRoute' : 'editAssignedRoute');

    if (!roleSelect || !routeGroup || !routeSelect) return;

    if (roleSelect.value === 'driver') {
        routeGroup.classList.remove('hidden');
        routeSelect.required = true;
        await loadRouteOptionsForRole(routeSelect.id, getSelectedRouteIds(routeSelect.id));

        if (!cachedAssignableRoutes.length) {
            showToast('Nenhuma rota ativa encontrada. Cadastre uma rota antes de vincular motorista.', 'error');
        }

        return;
    }

    routeGroup.classList.add('hidden');
    routeSelect.required = false;
    clearRouteSelection(routeSelect.id);
}

function getFirebaseCreateUserApp() {
    const existingApp = firebase.apps.find((app) => app.name === 'admin-create-user-app');
    if (existingApp) {
        return existingApp;
    }

    if (typeof firebaseConfig === 'undefined') {
        throw new Error('Configuração do Firebase não encontrada');
    }

    return firebase.initializeApp(firebaseConfig, 'admin-create-user-app');
}

function getCreateUserErrorMessage(error) {
    const code = error?.code || '';

    if (code === 'auth/email-already-in-use') {
        return 'Este email já está em uso';
    }

    if (code === 'auth/invalid-email') {
        return 'Email inválido';
    }

    if (code === 'auth/weak-password') {
        return 'Senha fraca. Use pelo menos 6 caracteres';
    }

    if (code === 'auth/operation-not-allowed') {
        return 'Criação por email/senha não está habilitada no Firebase Auth';
    }

    return error?.message || 'Não foi possível criar o usuário';
}

async function handleCreateUserSubmit(e) {
    e.preventDefault();

    const createButton = document.getElementById('createUserBtn');
    const name = document.getElementById('createUserName').value.trim();
    const email = document.getElementById('createUserEmail').value.trim().toLowerCase();
    const password = document.getElementById('createUserPassword').value;
    const role = document.getElementById('createUserRole').value;
    const assignedRouteIds = getSelectedRouteIds('createAssignedRoute');

    if (!name || !email || !password) {
        showToast('Preencha nome, email e senha', 'error');
        return;
    }

    if (password.length < 6) {
        showToast('A senha deve ter no mínimo 6 caracteres', 'error');
        return;
    }

    if (role === 'driver' && !assignedRouteIds.length) {
        showToast('Selecione pelo menos uma rota para o motorista', 'error');
        return;
    }

    createButton.disabled = true;
    createButton.textContent = 'Criando...';

    let tempAuth = null;

    try {
        const createUserApp = getFirebaseCreateUserApp();
        tempAuth = createUserApp.auth();

        const credentials = await tempAuth.createUserWithEmailAndPassword(email, password);
        const userId = credentials.user.uid;
        const assignedRoutesPayload = buildAssignedRoutesPayload(assignedRouteIds);
        const isDriver = role === 'driver';

        await db.collection('users').doc(userId).set({
            name,
            email,
            role,
            isAdmin: role === 'admin',
            isDriver,
            assignedRouteId: isDriver ? assignedRoutesPayload.assignedRouteId : null,
            assignedRouteNumber: isDriver ? assignedRoutesPayload.assignedRouteNumber : null,
            assignedRouteName: isDriver ? assignedRoutesPayload.assignedRouteName : null,
            assignedRouteIds: isDriver ? assignedRoutesPayload.assignedRouteIds : [],
            assignedRouteNumbers: isDriver ? assignedRoutesPayload.assignedRouteNumbers : [],
            assignedRouteNames: isDriver ? assignedRoutesPayload.assignedRouteNames : [],
            assignedRoutes: isDriver ? assignedRoutesPayload.assignedRoutes : [],
            assignedRouteUpdatedAt: isDriver ? firebase.firestore.FieldValue.serverTimestamp() : null,
            balance: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            createdByAdmin: currentUserId || null
        }, { merge: true });

        showToast('Usuário criado com sucesso', 'success');
        document.getElementById('createUserForm').reset();
        closeCreateUserModal();
        await loadUsersForAdmin();
    } catch (error) {
        console.error('[handleCreateUserSubmit] Erro:', error);
        showToast(getCreateUserErrorMessage(error), 'error');
    } finally {
        if (tempAuth?.currentUser) {
            try {
                await tempAuth.signOut();
            } catch (signOutError) {
                console.warn('[handleCreateUserSubmit] Falha ao deslogar auth secundário:', signOutError);
            }
        }

        createButton.disabled = false;
        createButton.textContent = 'Criar usuário';
    }
}

function openCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (!modal) return;

    document.getElementById('createUserForm').reset();
    handleRoleChange('create');

    modal.classList.add('show');
}

function closeCreateUserModal() {
    const modal = document.getElementById('createUserModal');
    if (!modal) return;

    const routeGroup = document.getElementById('createDriverRouteGroup');
    const routeSelect = document.getElementById('createAssignedRoute');
    if (routeGroup) routeGroup.classList.add('hidden');
    if (routeSelect) {
        routeSelect.required = false;
        clearRouteSelection('createAssignedRoute');
    }

    modal.classList.remove('show');
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
    window.location.href = '../public/landing.html';
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

        renderUsersForAdmin();

        if (totalUsersElement) totalUsersElement.textContent = allUsers.length;
        if (adminCountElement) adminCountElement.textContent = allUsers.filter(u => u.isAdmin).length;
        if (activeUsersElement) activeUsersElement.textContent = allUsers.filter(u => (u.balance || 0) > 0).length;

    } catch (error) {
        console.error('[loadUsersForAdmin] Erro:', error);
        showToast('Erro ao carregar usuários', 'error');
    }
}

function getFilteredUsersForAdmin() {
    return allUsers.filter((user) => {
        const isDriver = user.isDriver || user.role === 'driver';

        if (currentUserFilter === 'drivers') return isDriver;
        if (currentUserFilter === 'users') return !isDriver && !user.isAdmin;
        if (currentUserFilter === 'admins') return user.isAdmin;
        return true;
    });
}

function renderUsersForAdmin() {
    const usersTableBody = document.getElementById('usersTableBody');
    if (!usersTableBody) return;

    const filteredUsers = sortUsersForAdmin(getFilteredUsersForAdmin());
    updateUsersTableSortIndicators();

    if (filteredUsers.length === 0) {
        usersTableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#9ca3af;">Nenhum usuário encontrado</td></tr>';
        return;
    }

    usersTableBody.innerHTML = filteredUsers.map(user => {
        const createdDate = user.createdAt?.toDate?.() || new Date();
        const isDriver = user.isDriver || user.role === 'driver';
        const userType = user.isAdmin ? 'Admin' : (isDriver ? 'Motorista' : 'Usuário');
        const typeClass = user.isAdmin ? 'admin' : (isDriver ? 'driver' : 'user');

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

async function openEditUserModal(userId) {
    const user = allUsers.find(u => u.id === userId);
    if (!user) {
        showToast('Usuário não encontrado', 'error');
        return;
    }

    editingUserId = userId;

    // Preencher formulário
    document.getElementById('editUserName').value = user.name || '';
    document.getElementById('editUserEmail').value = user.email || '';
    const role = user.isAdmin ? 'admin' : ((user.isDriver || user.role === 'driver') ? 'driver' : 'user');
    document.getElementById('editUserRole').value = role;

    await handleRoleChange('edit');
    if (role === 'driver') {
        const routeIds = getUserAssignedRouteIds(user);
        await loadRouteOptionsForRole('editAssignedRoute', routeIds);
    }

    // Mostrar modal
    document.getElementById('editUserModal').classList.add('show');
}

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('show');
    const routeGroup = document.getElementById('editDriverRouteGroup');
    const routeSelect = document.getElementById('editAssignedRoute');
    if (routeGroup) routeGroup.classList.add('hidden');
    if (routeSelect) {
        routeSelect.required = false;
        clearRouteSelection('editAssignedRoute');
    }
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
    const role = document.getElementById('editUserRole').value;
    const assignedRouteIds = getSelectedRouteIds('editAssignedRoute');

    if (!name || !email) {
        showToast('Preencha todos os campos', 'error');
        return;
    }

    if (role === 'driver' && !assignedRouteIds.length) {
        showToast('Selecione pelo menos uma rota para o motorista', 'error');
        return;
    }

    try {
        const assignedRoutesPayload = buildAssignedRoutesPayload(assignedRouteIds);
        const isDriver = role === 'driver';

        await db.collection('users').doc(editingUserId).update({
            name: name,
            email: email,
            role: role,
            isAdmin: role === 'admin',
            isDriver,
            assignedRouteId: isDriver ? assignedRoutesPayload.assignedRouteId : null,
            assignedRouteNumber: isDriver ? assignedRoutesPayload.assignedRouteNumber : null,
            assignedRouteName: isDriver ? assignedRoutesPayload.assignedRouteName : null,
            assignedRouteIds: isDriver ? assignedRoutesPayload.assignedRouteIds : [],
            assignedRouteNumbers: isDriver ? assignedRoutesPayload.assignedRouteNumbers : [],
            assignedRouteNames: isDriver ? assignedRoutesPayload.assignedRouteNames : [],
            assignedRoutes: isDriver ? assignedRoutesPayload.assignedRoutes : [],
            assignedRouteUpdatedAt: isDriver ? firebase.firestore.FieldValue.serverTimestamp() : null,
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

// ========================================
// TAB: MOTORISTAS
// ========================================

function initDriversTab() {
    console.log('[initDriversTab] Inicializando aba de motoristas');
    loadDriversForAdmin();
}

async function loadDriversForAdmin() {
    try {
        console.log('[loadDriversForAdmin] Carregando motoristas...');
        
        // 1. Carregar todos os motoristas
        const driversSnapshot = await db.collection('users')
            .where('role', '==', 'driver')
            .get();

        allDrivers = [];
        const TIMEOUT_MINUTES = 15; // 15 minutos de inatividade = deslogado
        const now = Date.now();
        
        for (const driverDoc of driversSnapshot.docs) {
            const driver = {
                id: driverDoc.id,
                ...driverDoc.data()
            };

            // Verificar se está deslogado
            const lastActive = driver.lastActive?.toMillis?.() || driver.lastActiveAt?.toMillis?.() || 0;
            const minutesInactive = (now - lastActive) / (1000 * 60);

            driver.isLoggedIn = driver.isOnline !== false && minutesInactive < TIMEOUT_MINUTES;
            driver.minutesInactive = Math.round(minutesInactive);

            // 2. Verificar se tem uma viagem ativa com GPS
            try {
                const activeTripsSnapshot = await db.collection('active_trips')
                    .where('driverId', '==', driver.id)
                    .where('status', 'in', ['approaching_origin', 'waiting_bus', 'in_transit'])
                    .get();

                const activeTrips = activeTripsSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data()
                }));

                activeTrips.sort((a, b) => {
                    const aDate = getTripActivityDate(a)?.getTime() || 0;
                    const bDate = getTripActivityDate(b)?.getTime() || 0;
                    return bDate - aDate;
                });

                if (activeTrips.length > 0) {
                    const trip = activeTrips[0];
                    driver.currentTrip = {
                        id: trip.id,
                        routeNumber: trip.routeNumber,
                        routeName: trip.routeName,
                        status: trip.status,
                        origin: trip.origin,
                        destination: trip.destination,
                        busStartLocation: trip.busStartLocation || null,
                        busLabel: trip.busLabel || null,
                        vehicleLabel: trip.vehicleLabel || null,
                        lastGpsAt: getTripActivityDate(trip),
                        busLocationAt: toDateValue(trip.busLocation?.timestamp),
                        updatedAt: toDateValue(trip.updatedAt)
                    };

                    // Verificar se GPS está ativo
                    driver.isWorking = !!(trip.liveTracking?.enabled && trip.liveTracking?.source === 'driver');
                    driver.lastUpdate = getTripActivityDate(trip);
                } else {
                    driver.currentTrip = null;
                    driver.isWorking = false;
                    driver.lastUpdate = null;
                }
            } catch (error) {
                console.warn('[loadDriversForAdmin] Erro ao carregar trip de', driver.name, ':', error);
                driver.currentTrip = null;
                driver.isWorking = false;
                driver.lastUpdate = null;
            }

            allDrivers.push(driver);
        }

        console.log('[loadDriversForAdmin] Motoristas carregados:', allDrivers.length);

        // 3. Renderizar cards
        renderDriversCards();
        renderDriversTable();
        updateDriversStats();

    } catch (error) {
        console.error('[loadDriversForAdmin] Erro:', error);
        showToast('Erro ao carregar motoristas', 'error');
    }
}

function updateDriversStats() {
    const totalEl = document.getElementById('totalDrivers');
    const activeEl = document.getElementById('activeDrivers');
    const offlineEl = document.getElementById('offlineDrivers');

    if (!totalEl) return;

    const total = allDrivers.length;
    const active = allDrivers.filter(d => getDriverStatus(d).label === 'Em rota').length;
    const offline = allDrivers.filter(d => getDriverStatus(d).label !== 'Em rota' && d.isLoggedIn).length;
    const deslogado = total - active - offline;

    if (totalEl) totalEl.textContent = total;
    if (activeEl) activeEl.textContent = active;
    if (offlineEl) offlineEl.textContent = deslogado;
}

function renderDriversCards() {
    const driversGrid = document.getElementById('driversGrid');
    if (!driversGrid) return;

    if (allDrivers.length === 0) {
        driversGrid.innerHTML = `
            <div style="text-align: center; grid-column: 1/-1; padding: 48px 24px; color: #a0aec0;">
                Nenhum motorista cadastrado
            </div>
        `;
        return;
    }

    driversGrid.innerHTML = allDrivers.map(driver => {
        const status = getDriverStatus(driver);
        const assignedRouteLabel = formatAssignedRoutesLabel(driver);
        const tripInfo = driver.currentTrip 
            ? `<strong>Linha ${driver.currentTrip.routeNumber || 'N/A'}</strong> - ${driver.currentTrip.routeName || 'Rota'}<br><small>${driver.currentTrip.origin || 'Origem'} → ${driver.currentTrip.destination || 'Destino'}</small>`
            : 'Nenhuma rota ativa';
        const tripClass = driver.currentTrip ? '' : 'no-trip';

        const lastUpdateText = driver.lastUpdate 
            ? driver.lastUpdate.toLocaleTimeString('pt-BR')
            : (driver.isLoggedIn ? '-' : `${driver.minutesInactive}min atrás`);

        return `
            <div class="driver-card">
                <div class="driver-card-status">
                    <div class="status-indicator ${status.badgeClass}">
                        <div class="status-led ${status.ledClass}"></div>
                        ${status.label}
                    </div>
                </div>
                <div class="driver-info">
                    <div class="driver-name">${driver.name || 'N/A'}</div>
                    <div class="driver-email">${driver.email || 'N/A'}</div>
                </div>
                <div class="driver-trip-info ${tripClass}">
                    <div class="driver-trip-route ${tripClass}">${status.emoji} ${tripInfo}</div>
                </div>
                <div class="driver-details">
                    <div class="driver-detail">
                        <div class="driver-detail-label">Status</div>
                        <div class="driver-detail-value">${status.label}</div>
                    </div>
                    <div class="driver-detail">
                        <div class="driver-detail-label">Último GPS / Ônibus</div>
                        <div class="driver-detail-value">${status.details}<br>${getVehicleText(driver)}</div>
                    </div>
                    <div class="driver-detail" style="grid-column: 1 / -1;">
                        <div class="driver-detail-label">Rota designada</div>
                        <div class="driver-detail-value">${assignedRouteLabel}</div>
                    </div>
                </div>
                <div class="driver-actions-row">
                    <button class="btn-icon" onclick="openDriverRouteModal('${driver.id}')">
                        Alterar rota
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderDriversTable() {
    const driversTableBody = document.getElementById('driversTableBody');
    if (!driversTableBody) return;

    if (allDrivers.length === 0) {
        driversTableBody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:#9ca3af;">Nenhum motorista cadastrado</td></tr>';
        return;
    }

    driversTableBody.innerHTML = allDrivers.map(driver => {
        const status = getDriverStatus(driver);
        const assignedRouteLabel = formatAssignedRoutesLabel(driver);
        const tripText = driver.currentTrip 
            ? `Linha ${driver.currentTrip.routeNumber || 'N/A'} - ${driver.currentTrip.routeName || 'Rota'}`
            : '-';

        const lastUpdateText = driver.lastUpdate 
            ? driver.lastUpdate.toLocaleTimeString('pt-BR')
            : (driver.isLoggedIn ? '-' : `${driver.minutesInactive}min atrás`);

        return `
            <tr>
                <td style="text-align: center; font-size: 16px;">${status.emoji}</td>
                <td>${driver.name || 'N/A'}</td>
                <td>${driver.email || 'N/A'}</td>
                <td>${tripText}</td>
                <td><strong>${status.label}</strong></td>
                <td>${assignedRouteLabel}</td>
                <td>${lastUpdateText}<br><small>${getVehicleText(driver)}</small></td>
                <td>
                    <button class="btn-icon" onclick="openDriverRouteModal('${driver.id}')">Alterar rota</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function openDriverRouteModal(driverId) {
    const driver = allDrivers.find((item) => item.id === driverId);
    if (!driver) {
        showToast('Motorista não encontrado', 'error');
        return;
    }

    editingDriverRouteId = driverId;
    document.getElementById('driverRouteName').textContent = driver.name || 'Motorista';

    await loadRouteOptionsForRole('driverRouteSelect', getUserAssignedRouteIds(driver));
    document.getElementById('editDriverRouteModal').classList.add('show');
}

function closeDriverRouteModal() {
    document.getElementById('editDriverRouteModal').classList.remove('show');
    clearRouteSelection('driverRouteSelect');
    editingDriverRouteId = null;
}

async function handleEditDriverRouteSubmit(e) {
    e.preventDefault();

    if (!editingDriverRouteId) {
        showToast('Nenhum motorista selecionado', 'error');
        return;
    }

    const routeIds = getSelectedRouteIds('driverRouteSelect');
    if (!routeIds.length) {
        showToast('Selecione pelo menos uma rota', 'error');
        return;
    }

    const assignedRoutesPayload = buildAssignedRoutesPayload(routeIds);
    if (!assignedRoutesPayload.assignedRouteIds.length) {
        showToast('Rota inválida', 'error');
        return;
    }

    try {
        await db.collection('users').doc(editingDriverRouteId).update({
            role: 'driver',
            isDriver: true,
            isAdmin: false,
            assignedRouteId: assignedRoutesPayload.assignedRouteId,
            assignedRouteNumber: assignedRoutesPayload.assignedRouteNumber,
            assignedRouteName: assignedRoutesPayload.assignedRouteName,
            assignedRouteIds: assignedRoutesPayload.assignedRouteIds,
            assignedRouteNumbers: assignedRoutesPayload.assignedRouteNumbers,
            assignedRouteNames: assignedRoutesPayload.assignedRouteNames,
            assignedRoutes: assignedRoutesPayload.assignedRoutes,
            assignedRouteUpdatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showToast('Rota do motorista atualizada', 'success');
        closeDriverRouteModal();
        await loadDriversForAdmin();
        await loadUsersForAdmin();
    } catch (error) {
        console.error('[handleEditDriverRouteSubmit] Erro:', error);
        showToast('Erro ao atualizar rota do motorista', 'error');
    }
}

function refreshDriversStatus() {
    console.log('[refreshDriversStatus] Atualizando status dos motoristas...');
    loadDriversForAdmin();
}

function startDriversAutoRefresh() {
    console.log('[startDriversAutoRefresh] Iniciando atualização automática de motoristas...');
    
    // Parar se já está rodando
    if (driversRefreshInterval) {
        clearInterval(driversRefreshInterval);
    }

    // Atualizar a cada 5 segundos
    driversRefreshInterval = setInterval(() => {
        if (currentTab === 'drivers') {
            loadDriversForAdmin();
        }
    }, 5000);
}

function stopDriversAutoRefresh() {
    console.log('[stopDriversAutoRefresh] Parando atualização automática de motoristas');
    if (driversRefreshInterval) {
        clearInterval(driversRefreshInterval);
        driversRefreshInterval = null;
    }
}

// ========================================
// EXPOR FUNÇÕES GLOBALMENTE ==========

window.switchTab = switchTab;
window.logout = logout;
window.resetRouteForm = resetRouteForm;
window.editRoute = editRoute;
window.deleteRoute = deleteRoute;
window.openEditUserModal = openEditUserModal;
window.closeEditUserModal = closeEditUserModal;
window.confirmDeleteUser = confirmDeleteUser;
window.openCreateUserModal = openCreateUserModal;
window.closeCreateUserModal = closeCreateUserModal;
window.openDriverRouteModal = openDriverRouteModal;
window.closeDriverRouteModal = closeDriverRouteModal;
window.setUserSort = setUserSort;
window.markAsRead = markAsRead;
window.markAsUnread = markAsUnread;
window.selectFeedbackForReply = selectFeedbackForReply;
window.refreshDriversStatus = refreshDriversStatus;

console.log('[admin-dashboard] Script carregado');
