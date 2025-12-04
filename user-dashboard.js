document.addEventListener('DOMContentLoaded', function() {
    const userNameElement = document.getElementById('userName');
    const welcomeMessage = document.getElementById('welcomeMessage');
    const logoutBtn = document.getElementById('logoutBtn');
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
        
        const sessionData = JSON.parse(session);
        
        if (sessionData.isAdmin) {
            showNotification('Redirecionando para painel administrativo...', 'info');
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 1000);
            return null;
        }
        
        return sessionData;
    }

    function loadUserInfo() {
        const session = checkSession();
        
        if (session) {
            userNameElement.textContent = session.name;
            welcomeMessage.textContent = `Olá, ${session.name}! Bem-vindo de volta.`;
        }
    }

    logoutBtn.addEventListener('click', async () => {
        showNotification('Saindo...', 'info');

        try {
            // Fazer logout do Firebase
            await auth.signOut();
        } catch (error) {
        }

        sessionStorage.removeItem('buswaySession');

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });

    document.querySelectorAll('.feature-btn').forEach(btn => {
        // Só adiciona evento se não tem onclick definido no HTML
        if (!btn.onclick) {
            btn.addEventListener('click', function() {
                const featureName = this.parentElement.querySelector('h3').textContent;
                showNotification(`Funcionalidade "${featureName}" em desenvolvimento`, 'info');
            });
        }
    });

    // Carregar saldo do usuário
    async function loadUserBalance() {
        const session = sessionStorage.getItem('buswaySession');
        if (!session) return;

        const sessionData = JSON.parse(session);
        const userId = sessionData.uid || sessionData.id;

        const balanceElement = document.getElementById('currentBalance');
        if (!balanceElement) return;

        try {
            // Tentar carregar do Firestore
            const balance = await getUserBalance(userId);
            balanceElement.textContent = balance.toFixed(2).replace('.', ',');

            // Observar mudanças em tempo real
            watchBalance(userId, (newBalance) => {
                balanceElement.textContent = newBalance.toFixed(2).replace('.', ',');
            });
        } catch (error) {
            // Fallback para localStorage
            const balance = parseFloat(localStorage.getItem('userBalance')) || 0;
            balanceElement.textContent = balance.toFixed(2).replace('.', ',');
        }
    }

    loadUserBalance();

    // Sistema de Atividades Recentes
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) return `Há ${diffHours} ${diffHours === 1 ? 'hora' : 'horas'}`;
        if (diffDays === 1) return 'Ontem';
        if (diffDays < 7) return `Há ${diffDays} dias`;
        
        return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
    }

    function getActivityIcon(type) {
        const icons = {
            'credit': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="#0071e3"/></svg>',
            'debit': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.11 0-1.99.89-1.99 2L2 18c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V6c0-1.11-.89-2-2-2zm0 14H4v-6h16v6zm0-10H4V6h16v2z" fill="#ff3b30"/></svg>',
            'trip': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z" fill="#0071e3"/></svg>',
            'route': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#0071e3"/></svg>',
            'favorite': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#ff3b30"/></svg>',
            'default': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z" fill="#0071e3"/></svg>'
        };
        return icons[type] || icons['default'];
    }

    function collectActivities() {
        const activities = [];

        // 1. Transações financeiras
        try {
            const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
            transactions.forEach(transaction => {
                const timestamp = transaction.timestamp || transaction.date || new Date().toISOString();
                activities.push({
                    type: transaction.type === 'credit' ? 'credit' : 'debit',
                    title: transaction.type === 'credit' ? 'Crédito adicionado' : 'Pagamento realizado',
                    description: transaction.description || `${transaction.type === 'credit' ? 'Crédito' : 'Débito'} de R$ ${(transaction.amount || 0).toFixed(2).replace('.', ',')}`,
                    amount: transaction.amount,
                    timestamp: timestamp,
                    icon: transaction.type === 'credit' ? 'credit' : 'debit'
                });
            });
        } catch (e) {
        }

        // 2. Rotas favoritas
        try {
            const favorites = JSON.parse(localStorage.getItem('favoriteRoutes') || '[]');
            favorites.forEach((favorite, index) => {
                // Verificar se é um objeto ou apenas um ID
                if (typeof favorite === 'object' && favorite.addedAt) {
                    // É um objeto com metadados
                    const addedDate = new Date(favorite.addedAt);
                    const hoursDiff = (Date.now() - addedDate.getTime()) / (1000 * 60 * 60);
                    if (hoursDiff < 24) {
                        activities.push({
                            type: 'favorite',
                            title: 'Rota favoritada',
                            description: `Linha ${favorite.number || favorite.id || 'N/A'} - ${favorite.name || favorite.routeName || 'Rota'}`,
                            timestamp: favorite.addedAt,
                            icon: 'favorite'
                        });
                    }
                } else if (typeof favorite === 'string') {
                    // É apenas um ID, tentar buscar dados da rota
                    // Para rotas recentes, assumir que foi adicionado recentemente
                    // (isso é uma limitação, mas melhor que nada)
                    const recentTrips = JSON.parse(localStorage.getItem('recentTrips') || '[]');
                    const trip = recentTrips.find(t => t.routeId === favorite);
                    if (trip && trip.timestamp) {
                        const tripDate = new Date(trip.timestamp);
                        const hoursDiff = (Date.now() - tripDate.getTime()) / (1000 * 60 * 60);
                        if (hoursDiff < 24) {
                            activities.push({
                                type: 'favorite',
                                title: 'Rota favoritada',
                                description: `Linha ${trip.routeNumber || favorite} - ${trip.routeName || 'Rota'}`,
                                timestamp: trip.timestamp,
                                icon: 'favorite'
                            });
                        }
                    }
                }
            });
        } catch (e) {
        }

        // 3. Viagens recentes (se existir no localStorage)
        try {
            const recentTrips = JSON.parse(localStorage.getItem('recentTrips') || '[]');
            recentTrips.forEach(trip => {
                activities.push({
                    type: 'trip',
                    title: 'Viagem realizada',
                    description: `${trip.origin || 'Origem'} → ${trip.destination || 'Destino'} - Linha ${trip.routeNumber || 'N/A'}`,
                    timestamp: trip.timestamp || trip.date || new Date().toISOString(),
                    icon: 'trip'
                });
            });
        } catch (e) {
            // Não há problema se não existir
        }

        // Ordenar por timestamp (mais recente primeiro)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return activities;
    }

    function renderRecentActivities(containerId, limit = 3) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const activities = collectActivities();
        const recentActivities = activities.slice(0, limit);

        if (recentActivities.length === 0) {
            container.innerHTML = `
                <div class="recent-item">
                    <div class="recent-icon">
                        ${getActivityIcon('default')}
                    </div>
                    <div class="recent-info">
                        <h4>Nenhuma atividade recente</h4>
                        <p>Suas ações aparecerão aqui</p>
                        <span class="recent-time">--</span>
                    </div>
                </div>
            `;
            return;
        }

        container.innerHTML = recentActivities.map(activity => `
            <div class="recent-item">
                <div class="recent-icon">
                    ${getActivityIcon(activity.icon)}
                </div>
                <div class="recent-info">
                    <h4>${activity.title}</h4>
                    <p>${activity.description}</p>
                    <span class="recent-time">${formatTimeAgo(activity.timestamp)}</span>
                </div>
            </div>
        `).join('');

        // Adicionar event listeners aos itens
        setTimeout(() => {
            container.querySelectorAll('.recent-item').forEach(item => {
                item.addEventListener('click', function() {
                    const title = this.querySelector('h4')?.textContent;
                    if (title && title !== 'Nenhuma atividade recente') {
                        showNotification(`Detalhes de: ${title}`, 'info');
                    }
                });
            });
        }, 100);
    }

    // Carregar atividades recentes
    function loadRecentActivities() {
        renderRecentActivities('recentActivitiesList', 3);
    }

    // Carregar atividades inicialmente
    loadRecentActivities();

    // Interceptar mudanças no localStorage
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.apply(this, arguments);
        
        // Se for uma chave relevante, atualizar atividades
        const relevantKeys = ['transactions', 'userBalance', 'favoriteRoutes', 'recentTrips'];
        if (relevantKeys.includes(key)) {
            // Usar setTimeout para garantir que o valor foi atualizado
            setTimeout(() => {
                loadRecentActivities();
                loadUserBalance(); // Também atualizar saldo
            }, 100);
        }
    };

    // Monitorar eventos de storage (para mudanças em outras abas)
    window.addEventListener('storage', function(e) {
        const relevantKeys = ['transactions', 'userBalance', 'favoriteRoutes', 'recentTrips'];
        if (relevantKeys.includes(e.key)) {
            loadRecentActivities();
            loadUserBalance();
        }
    });

    // Atualizar quando a página volta ao foco (usuário retorna de outra página)
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            loadRecentActivities();
            loadUserBalance();
        }
    });

    // Atualizar quando a janela recebe foco
    window.addEventListener('focus', function() {
        loadRecentActivities();
        loadUserBalance();
    });

    // Atualizar timestamps a cada minuto
    setInterval(() => {
        loadRecentActivities();
    }, 60000);

    // Função para verificar viagem ativa
    async function checkActiveTrip() {
        const session = sessionStorage.getItem('buswaySession') ||
                       sessionStorage.getItem('user_session') ||
                       localStorage.getItem('user_session');
        if (!session) {
            showNotification('Você precisa estar logado', 'error');
            return;
        }

        const sessionData = JSON.parse(session);
        const userId = sessionData.uid || sessionData.id;

        try {
            // Verificar se há viagem ativa no Firestore
            const snapshot = await db.collection('active_trips')
                .where('userId', '==', userId)
                .where('status', 'in', ['waiting_bus', 'in_transit'])
                .limit(1)
                .get();

            if (!snapshot.empty) {
                window.location.href = 'location-simple.html';
            } else {
                showNotification('Nenhuma viagem ativa. Selecione uma rota primeiro.', 'info');
                setTimeout(() => {
                    window.location.href = 'routes-simple.html';
                }, 1500);
            }
        } catch (error) {
            console.error('Erro ao verificar viagem ativa:', error);
            showNotification('Erro ao verificar viagem. Tente novamente.', 'error');
        }
    }

    // Expor globalmente
    window.checkActiveTrip = checkActiveTrip;

    loadUserInfo();

    // Aplicar tema ao carregar
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

    initTheme();

    setInterval(() => {
        checkSession();
    }, 60000);

    // Initialize Ad Carousel
    initAdCarousel();
});

// ===== AD CAROUSEL =====
function initAdCarousel() {
    // Array de URLs das imagens de anúncio (você pode substituir por suas imagens)
    const adImages = [
        'assets/ads/ad1.jpg',
        'assets/ads/ad2.jpg',
        'assets/ads/ad3.jpg',
        'assets/ads/ad4.jpg',
        'assets/ads/ad5.jpg'
    ];

    let currentAdIndex = 0;
    const adImage = document.getElementById('adImage');
    const adIndicatorsContainer = document.getElementById('adIndicators');

    // Verificar se há imagens
    if (adImages.length === 0 || !adImage) return;

    // Criar indicadores
    adImages.forEach((_, index) => {
        const indicator = document.createElement('button');
        indicator.className = 'ad-indicator' + (index === 0 ? ' active' : '');
        indicator.setAttribute('aria-label', `Anúncio ${index + 1}`);
        indicator.onclick = () => showAd(index);
        adIndicatorsContainer.appendChild(indicator);
    });

    // Mostrar primeiro anúncio
    function showAd(index) {
        currentAdIndex = index;
        adImage.src = adImages[currentAdIndex];

        // Atualizar indicadores
        const indicators = document.querySelectorAll('.ad-indicator');
        indicators.forEach((ind, i) => {
            if (i === currentAdIndex) {
                ind.classList.add('active');
            } else {
                ind.classList.remove('active');
            }
        });
    }

    // Rotação automática a cada 6 segundos
    function rotateAd() {
        currentAdIndex = (currentAdIndex + 1) % adImages.length;
        showAd(currentAdIndex);
    }

    // Iniciar primeiro anúncio
    showAd(0);

    // Auto-rotation
    setInterval(rotateAd, 6000);
}

