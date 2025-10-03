// Estado da aplicação
let selectedRoute = null;
let userBalance = 0;
let favoriteRoutes = JSON.parse(localStorage.getItem('favoriteRoutes')) || [];
let notifications = [];
let trackingInterval = null;
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// Dados simulados de rotas
const mockRoutes = [
    {
        id: '101',
        number: '101',
        name: 'Centro - Efapi',
        origin: 'Terminal Central',
        destination: 'Efapi',
        duration: '35 min',
        distance: '12 km',
        price: 'R$ 4,50',
        nextDeparture: '5 min',
        occupancy: '65%',
        stops: ['Terminal Central', 'Av. Getúlio Vargas', 'Rua XV de Novembro', 'UFFS', 'Efapi']
    },
    {
        id: '102',
        number: '102',
        name: 'Centro - São Cristóvão',
        origin: 'Terminal Central',
        destination: 'São Cristóvão',
        duration: '25 min',
        distance: '8 km',
        price: 'R$ 4,50',
        nextDeparture: '10 min',
        occupancy: '45%',
        stops: ['Terminal Central', 'Praça Central', 'Hospital Regional', 'São Cristóvão']
    },
    {
        id: '103',
        number: '103',
        name: 'Centro - Belvedere',
        origin: 'Terminal Central',
        destination: 'Belvedere',
        duration: '30 min',
        distance: '10 km',
        price: 'R$ 4,50',
        nextDeparture: '15 min',
        occupancy: '80%',
        stops: ['Terminal Central', 'Shopping', 'Arena Condá', 'Belvedere']
    },
    {
        id: '201',
        number: '201',
        name: 'Circular Norte',
        origin: 'Terminal Central',
        destination: 'Terminal Central',
        duration: '45 min',
        distance: '15 km',
        price: 'R$ 4,50',
        nextDeparture: '8 min',
        occupancy: '55%',
        stops: ['Terminal Central', 'Bairro Norte', 'Universidade', 'Centro', 'Terminal Central']
    }
];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const session = loadUserSession();
    if (session) {
        loadBalance();
        loadTransactions();
        setupNotifications();
        checkForActiveRoute();
    }
});

function loadUserSession() {
    const sessionData = sessionStorage.getItem('buswaySession');
    
    if (!sessionData) {
        // Limpar localStorage antigo se existir
        localStorage.removeItem('buswaySession');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const session = JSON.parse(sessionData);
        return session;
    } catch (error) {
        console.error('Erro ao fazer parse da sessão:', error);
        sessionStorage.removeItem('buswaySession');
        window.location.href = 'index.html';
        return false;
    }
}

function loadBalance() {
    userBalance = parseFloat(localStorage.getItem('userBalance')) || 0;
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement) {
        balanceElement.textContent = userBalance.toFixed(2).replace('.', ',');
    }
}

function loadTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (transactionsList) {
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p class="no-transactions">Nenhuma transação realizada</p>';
        } else {
            transactionsList.innerHTML = transactions.slice(-5).reverse().map(t => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-desc">${t.description}</div>
                        <div class="transaction-date">${new Date(t.date).toLocaleString('pt-BR')}</div>
                    </div>
                    <div class="transaction-amount ${t.type}">
                        ${t.type === 'credit' ? '+' : '-'} R$ ${t.amount.toFixed(2).replace('.', ',')}
                    </div>
                </div>
            `).join('');
        }
    }
}

function setupNotifications() {
    // Verificar permissão de notificações
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function swapLocations() {
    const origin = document.getElementById('origin');
    const destination = document.getElementById('destination');
    const temp = origin.value;
    origin.value = destination.value;
    destination.value = temp;
}

function searchRoutes() {
    const destination = document.getElementById('destination').value;
    
    if (!destination) {
        showToast('Por favor, digite um destino', 'error');
        return;
    }
    
    // Filtrar rotas baseado no destino
    const filteredRoutes = mockRoutes.filter(route => 
        route.destination.toLowerCase().includes(destination.toLowerCase()) ||
        route.name.toLowerCase().includes(destination.toLowerCase())
    );
    
    displayRoutes(filteredRoutes);
    
    // Mostrar seção financeira
    document.getElementById('financialSection').style.display = 'block';
}

function displayRoutes(routes) {
    const routesList = document.getElementById('routesList');
    
    if (routes.length === 0) {
        routesList.innerHTML = `
            <div class="empty-state">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                    <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <p>Nenhuma rota encontrada para este destino</p>
            </div>
        `;
        return;
    }
    
    routesList.innerHTML = routes.map(route => `
        <div class="route-card" data-route-id="${route.id}">
            <div class="route-header">
                <div>
                    <div class="route-number">${route.number}</div>
                    <div class="route-name">${route.name}</div>
                </div>
                <button class="btn-favorite ${favoriteRoutes.includes(route.id) ? 'active' : ''}" onclick="toggleFavorite('${route.id}')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
            </div>
            <div class="route-info">
                <div class="info-item">
                    <span class="info-label">Duração</span>
                    <span class="info-value">${route.duration}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Próxima saída</span>
                    <span class="info-value">${route.nextDeparture}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Lotação</span>
                    <span class="info-value">${route.occupancy}</span>
                </div>
            </div>
            <div class="route-actions">
                <button class="btn-select-route" onclick="selectRoute('${route.id}')">Selecionar Rota</button>
                <button class="btn-track" onclick="startTracking('${route.id}')">Rastrear</button>
            </div>
        </div>
    `).join('');
}

function filterRoutes(filter) {
    // Atualizar chips de filtro
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.classList.add('active');
    
    let filteredRoutes = [...mockRoutes];
    
    switch(filter) {
        case 'fastest':
            filteredRoutes.sort((a, b) => parseInt(a.duration) - parseInt(b.duration));
            break;
        case 'cheapest':
            // Todos têm o mesmo preço neste exemplo
            break;
        case 'favorites':
            filteredRoutes = mockRoutes.filter(r => favoriteRoutes.includes(r.id));
            break;
    }
    
    displayRoutes(filteredRoutes);
}

function toggleFavorite(routeId) {
    const index = favoriteRoutes.indexOf(routeId);
    if (index > -1) {
        favoriteRoutes.splice(index, 1);
        showToast('Rota removida dos favoritos', 'info');
    } else {
        favoriteRoutes.push(routeId);
        showToast('Rota adicionada aos favoritos', 'success');
    }
    
    localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
    
    // Atualizar visual
    const btn = document.querySelector(`[data-route-id="${routeId}"] .btn-favorite`);
    if (btn) {
        btn.classList.toggle('active');
    }
}

function selectRoute(routeId) {
    const route = mockRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    selectedRoute = route;
    localStorage.setItem('selectedRoute', JSON.stringify(route));
    
    // Destacar rota selecionada
    document.querySelectorAll('.route-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-route-id="${routeId}"]`).classList.add('selected');
    
    // Simular cobrança
    if (userBalance >= 4.50) {
        userBalance -= 4.50;
        localStorage.setItem('userBalance', userBalance.toString());
        
        // Adicionar transação
        const transaction = {
            id: Date.now(),
            description: `Passagem - Linha ${route.number}`,
            amount: 4.50,
            type: 'debit',
            date: new Date().toISOString()
        };
        transactions.push(transaction);
        localStorage.setItem('transactions', JSON.stringify(transactions));
        
        updateBalanceDisplay();
        loadTransactions();
        
        showToast(`Rota ${route.number} selecionada! Passagem debitada.`, 'success');
        
        // Criar notificação de próxima chegada
        setTimeout(() => {
            addNotification(`Ônibus ${route.number} chegando em 2 minutos!`, 'transport');
        }, 3000);
    } else {
        showToast('Saldo insuficiente! Adicione créditos ao seu cartão.', 'error');
        openAddCreditModal();
    }
}

function startTracking(routeId) {
    const route = mockRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    // Mostrar seção de rastreamento
    document.getElementById('trackingSection').style.display = 'block';
    
    // Atualizar informações
    document.getElementById('trackingLine').textContent = `${route.number} - ${route.name}`;
    document.getElementById('trackingETA').textContent = route.nextDeparture;
    document.getElementById('trackingNextStop').textContent = route.stops[1];
    document.getElementById('trackingSpeed').textContent = '35 km/h';
    
    // Simular movimento do ônibus
    let currentStop = 0;
    clearInterval(trackingInterval);
    
    trackingInterval = setInterval(() => {
        currentStop = (currentStop + 1) % route.stops.length;
        document.getElementById('trackingNextStop').textContent = route.stops[currentStop];
        
        // Atualizar ETA
        const eta = Math.max(1, parseInt(route.nextDeparture) - currentStop * 2);
        document.getElementById('trackingETA').textContent = `${eta} min`;
        
        // Notificar quando estiver próximo
        if (eta === 2) {
            addNotification(`Ônibus ${route.number} está chegando!`, 'transport');
        }
    }, 5000);
    
    showToast(`Rastreando linha ${route.number}`, 'info');
}

function closeTracking() {
    document.getElementById('trackingSection').style.display = 'none';
    clearInterval(trackingInterval);
}

function addNotification(message, type) {
    const notification = {
        id: Date.now(),
        message,
        type,
        time: new Date(),
        read: false
    };
    
    notifications.unshift(notification);
    updateNotificationsDisplay();
    
    // Mostrar notificação do navegador se permitido
    if (Notification.permission === 'granted') {
        new Notification('Busway', {
            body: message,
            icon: '/favicon.ico'
        });
    }
    
    // Mostrar toast
    showToast(message, 'info');
}

function updateNotificationsDisplay() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.style.display = 'block';
        badge.textContent = unreadCount;
    } else {
        badge.style.display = 'none';
    }
    
    const notificationsList = document.getElementById('notificationsList');
    if (notifications.length === 0) {
        notificationsList.innerHTML = '<p class="no-notifications">Nenhuma notificação</p>';
    } else {
        notificationsList.innerHTML = notifications.slice(0, 10).map(n => `
            <div class="notification-item ${!n.read ? 'unread' : ''}" onclick="markAsRead(${n.id})">
                <div>${n.message}</div>
                <div class="notification-time">${formatTime(n.time)}</div>
            </div>
        `).join('');
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function markAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        updateNotificationsDisplay();
    }
}

function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return new Date(date).toLocaleDateString('pt-BR');
}

function openAddCreditModal() {
    document.getElementById('addCreditModal').style.display = 'flex';
}

function closeAddCreditModal() {
    document.getElementById('addCreditModal').style.display = 'none';
}

function addCredit() {
    const amount = parseFloat(document.getElementById('creditAmount').value);
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    if (!amount || amount < 5) {
        showToast('Valor mínimo: R$ 5,00', 'error');
        return;
    }
    
    userBalance += amount;
    localStorage.setItem('userBalance', userBalance.toString());
    
    // Adicionar transação
    const transaction = {
        id: Date.now(),
        description: `Recarga via ${paymentMethod.toUpperCase()}`,
        amount: amount,
        type: 'credit',
        date: new Date().toISOString()
    };
    transactions.push(transaction);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    
    updateBalanceDisplay();
    loadTransactions();
    closeAddCreditModal();
    
    showToast(`Crédito de R$ ${amount.toFixed(2).replace('.', ',')} adicionado!`, 'success');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    toast.textContent = message;
    toast.className = `notification-toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

function checkForActiveRoute() {
    const activeRoute = JSON.parse(localStorage.getItem('selectedRoute'));
    if (activeRoute) {
        // Simular chegada do ônibus após alguns segundos
        setTimeout(() => {
            addNotification(`Ônibus ${activeRoute.number} está se aproximando!`, 'transport');
        }, 5000);
    }
}

// Simular atualizações em tempo real
setInterval(() => {
    // Atualizar horários de próxima saída
    mockRoutes.forEach(route => {
        const current = parseInt(route.nextDeparture);
        route.nextDeparture = Math.max(1, current - 1) + ' min';
    });
    
    // Se houver busca ativa, atualizar display
    const routesList = document.getElementById('routesList');
    if (routesList.querySelector('.route-card')) {
        const destination = document.getElementById('destination').value;
        if (destination) {
            searchRoutes();
        }
    }
}, 60000); // Atualizar a cada minuto