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
                window.location.href = 'dashboard.html';
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

    logoutBtn.addEventListener('click', () => {
        showNotification('Saindo...', 'info');
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
    function loadUserBalance() {
        const balance = parseFloat(localStorage.getItem('userBalance')) || 0;
        const balanceElement = document.getElementById('currentBalance');
        if (balanceElement) {
            balanceElement.textContent = balance.toFixed(2).replace('.', ',');
        }
    }

    loadUserBalance();

    document.querySelectorAll('.recent-item').forEach(item => {
        item.addEventListener('click', function() {
            const title = this.querySelector('h4').textContent;
            showNotification(`Detalhes de: ${title}`, 'info');
        });
    });

    loadUserInfo();
    
    setInterval(() => {
        checkSession();
    }, 60000);
});

