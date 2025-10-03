document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const menuToggle = document.getElementById('menuToggle');
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    const sectionTitle = document.getElementById('sectionTitle');
    const logoutBtn = document.getElementById('logoutBtn');
    const notification = document.getElementById('notification');
    
    const userNameElement = document.getElementById('userName');
    const userRoleElement = document.getElementById('userRole');
    const userInitialElement = document.getElementById('userInitial');
    
    const totalUsersElement = document.getElementById('totalUsers');
    const activeUsersElement = document.getElementById('activeUsers');
    const adminCountElement = document.getElementById('adminCount');
    const newTodayElement = document.getElementById('newToday');
    const usersTableBody = document.getElementById('usersTableBody');

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

    function loadUserInfo() {
        const session = checkSession();
        
        if (session) {
            userNameElement.textContent = session.name;
            userRoleElement.textContent = session.isAdmin ? 'Admin' : 'Usuário';
            userInitialElement.textContent = session.name.charAt(0).toUpperCase();
            
            if (!session.isAdmin) {
                showNotification('Redirecionando para dashboard de usuário...', 'info');
                setTimeout(() => {
                    window.location.href = 'user-dashboard.html';
                }, 1000);
                return;
            }
            
            updateStats();
        }
    }

    function updateStats() {
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        const today = new Date().toDateString();
        
        const totalUsers = users.length;
        const adminCount = users.filter(user => user.isAdmin).length;
        const newToday = users.filter(user => {
            const userDate = new Date(user.createdAt).toDateString();
            return userDate === today;
        }).length;
        
        totalUsersElement.textContent = totalUsers;
        adminCountElement.textContent = adminCount;
        newTodayElement.textContent = newToday;
        activeUsersElement.textContent = '1';
        
        updateUsersTable(users);
        updateRecentActivities();
    }
    
    function updateRecentActivities() {
        const activityList = document.getElementById('activityList');
        if (!activityList) return;
        
        // Coletar atividades de diferentes fontes
        const activities = [];
        
        // 1. Adicionar transações financeiras
        const transactions = JSON.parse(localStorage.getItem('transactions') || '[]');
        transactions.forEach(transaction => {
            activities.push({
                type: transaction.type,
                category: transaction.category,
                description: transaction.description,
                amount: transaction.amount,
                timestamp: transaction.timestamp,
                icon: transaction.type === 'income' ? '💰' : '💳',
                color: transaction.type === 'income' ? 'success' : 'danger'
            });
        });
        
        // 2. Adicionar novos usuários
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        users.forEach(user => {
            activities.push({
                type: 'user',
                category: 'cadastro',
                description: `Novo usuário: ${user.name}`,
                timestamp: user.createdAt,
                icon: '👤',
                color: 'info'
            });
        });
        
        // 3. Adicionar atividades de rotas (simulado)
        const routeActivities = [
            {
                type: 'route',
                category: 'transporte',
                description: 'Rota 101 iniciada',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                icon: '🚌',
                color: 'primary'
            },
            {
                type: 'route',
                category: 'transporte',
                description: 'Rota 302 concluída',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                icon: '✅',
                color: 'success'
            }
        ];
        activities.push(...routeActivities);
        
        // Ordenar por timestamp (mais recente primeiro)
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Limitar às 10 atividades mais recentes
        const recentActivities = activities.slice(0, 10);
        
        // Renderizar atividades
        if (recentActivities.length === 0) {
            activityList.innerHTML = '<p class="no-activity">Nenhuma atividade recente</p>';
        } else {
            activityList.innerHTML = recentActivities.map(activity => {
                const time = formatTimeAgo(activity.timestamp);
                const amountDisplay = activity.amount ? 
                    `<span class="activity-amount ${activity.type}">${activity.type === 'income' ? '+' : '-'}R$ ${activity.amount.toFixed(2)}</span>` : '';
                
                return `
                    <div class="activity-item ${activity.color}">
                        <div class="activity-icon">${activity.icon}</div>
                        <div class="activity-content">
                            <div class="activity-description">
                                ${activity.description}
                                ${amountDisplay}
                            </div>
                            <div class="activity-meta">
                                <span class="activity-category">${activity.category}</span>
                                <span class="activity-time">${time}</span>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
    
    function formatTimeAgo(timestamp) {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = Math.floor((now - date) / 1000); // diferença em segundos
        
        if (diff < 60) return 'Agora mesmo';
        if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        if (diff < 604800) return `${Math.floor(diff / 86400)} dias atrás`;
        
        return date.toLocaleDateString('pt-BR');
    }
    
    function initializeSampleTransactions() {
        const transactions = localStorage.getItem('transactions');
        
        if (!transactions) {
            const sampleTransactions = [
                {
                    id: Date.now() + 1,
                    type: 'income',
                    category: 'recarga',
                    amount: 50.00,
                    description: 'Recarga de cartão',
                    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 min atrás
                    method: 'pix'
                },
                {
                    id: Date.now() + 2,
                    type: 'expense',
                    category: 'passagem',
                    amount: 4.50,
                    description: 'Passagem linha 101',
                    timestamp: new Date(Date.now() - 900000).toISOString(), // 15 min atrás
                    route: '101 - Centro/Efapi'
                },
                {
                    id: Date.now() + 3,
                    type: 'income',
                    category: 'recarga',
                    amount: 100.00,
                    description: 'Recarga de cartão mensal',
                    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hora atrás
                    method: 'cartão de crédito'
                },
                {
                    id: Date.now() + 4,
                    type: 'expense',
                    category: 'passagem',
                    amount: 4.50,
                    description: 'Passagem linha 302',
                    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 horas atrás
                    route: '302 - Unochapecó/UFFS'
                },
                {
                    id: Date.now() + 5,
                    type: 'expense',
                    category: 'passagem',
                    amount: 6.00,
                    description: 'Passagem linha 501 - Expresso',
                    timestamp: new Date(Date.now() - 10800000).toISOString(), // 3 horas atrás
                    route: '501 - Expresso Aeroporto'
                },
                {
                    id: Date.now() + 6,
                    type: 'income',
                    category: 'promocao',
                    amount: 20.00,
                    description: 'Bônus de fidelidade',
                    timestamp: new Date(Date.now() - 86400000).toISOString(), // 1 dia atrás
                    method: 'crédito automático'
                }
            ];
            
            localStorage.setItem('transactions', JSON.stringify(sampleTransactions));
            
            // Calcular saldo inicial baseado nas transações
            const totalIncome = sampleTransactions
                .filter(t => t.type === 'income')
                .reduce((sum, t) => sum + t.amount, 0);
            const totalExpense = sampleTransactions
                .filter(t => t.type === 'expense')
                .reduce((sum, t) => sum + t.amount, 0);
            const balance = totalIncome - totalExpense;
            
            localStorage.setItem('userBalance', balance.toString());
        }
    }

    function updateUsersTable(users) {
        usersTableBody.innerHTML = '';
        
        users.forEach(user => {
            const row = document.createElement('tr');
            const createdDate = new Date(user.createdAt).toLocaleDateString('pt-BR');
            
            row.innerHTML = `
                <td>${user.name}</td>
                <td>${user.email}</td>
                <td><span class="user-badge ${user.isAdmin ? 'admin' : 'user'}">${user.isAdmin ? 'Admin' : 'Usuário'}</span></td>
                <td>${createdDate}</td>
                <td>
                    <button class="btn-secondary" onclick="editUser('${user.id}')">Editar</button>
                </td>
            `;
            
            usersTableBody.appendChild(row);
        });
    }

    window.editUser = function(userId) {
        showNotification('Edição de usuários em desenvolvimento', 'info');
    };

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    });

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            navItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');
            
            const sectionId = item.dataset.section;
            sections.forEach(section => {
                section.classList.remove('active');
                if (section.id === sectionId + 'Section') {
                    section.classList.add('active');
                }
            });
            
            const titles = {
                overview: 'Visão Geral',
                users: 'Usuários',
                routes: 'Rotas',
                analytics: 'Análises',
                settings: 'Configurações'
            };
            
            sectionTitle.textContent = titles[sectionId] || 'Dashboard';
            
            if (window.innerWidth <= 768) {
                sidebar.classList.add('collapsed');
                mainContent.classList.add('expanded');
            }
        });
    });

    logoutBtn.addEventListener('click', () => {
        showNotification('Saindo...', 'info');
        sessionStorage.removeItem('buswaySession');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });

    document.getElementById('addUserBtn')?.addEventListener('click', () => {
        showNotification('Adição de usuários em desenvolvimento', 'info');
    });

    document.getElementById('darkMode')?.addEventListener('change', function() {
        if (this.checked) {
            document.body.classList.add('dark-mode');
            showNotification('Modo escuro ativado', 'success');
        } else {
            document.body.classList.remove('dark-mode');
            showNotification('Modo claro ativado', 'success');
        }
    });

    document.getElementById('notifications')?.addEventListener('change', function() {
        if (this.checked) {
            showNotification('Notificações ativadas', 'success');
        } else {
            showNotification('Notificações desativadas', 'info');
        }
    });

    document.querySelectorAll('.btn-secondary').forEach(btn => {
        if (!btn.onclick) {
            btn.addEventListener('click', function() {
                showNotification(`${this.textContent} - Em desenvolvimento`, 'info');
            });
        }
    });

    loadUserInfo();
    
    // Criar transações de exemplo se não existirem
    initializeSampleTransactions();
    
    setInterval(() => {
        checkSession();
    }, 60000);
});