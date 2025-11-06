document.addEventListener('DOMContentLoaded', function() {
    const userNameElement = document.getElementById('userName');
    const logoutBtn = document.getElementById('logoutBtn');
    const notification = document.getElementById('notification');
    const passwordModal = document.getElementById('passwordModal');
    const changePasswordBtn = document.getElementById('changePasswordBtn');
    const closePasswordModal = document.getElementById('closePasswordModal');
    const cancelPasswordBtn = document.getElementById('cancelPasswordBtn');
    const submitPasswordBtn = document.getElementById('submitPasswordBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');
    const autoRechargeCheckbox = document.getElementById('autoRecharge');
    const autoRechargeConfig = document.getElementById('autoRechargeConfig');
    const autoRechargeAmount = document.getElementById('autoRechargeAmount');

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
            document.getElementById('userEmail').textContent = session.email || 'Email não disponível';
        }
    }

    function loadSettings() {
        // Carregar configurações de notificações
        const notifSettings = JSON.parse(localStorage.getItem('notificationSettings') || '{}');
        document.getElementById('notifSystem').checked = notifSettings.system !== false;
        document.getElementById('notifTransport').checked = notifSettings.transport !== false;
        document.getElementById('notifFinancial').checked = notifSettings.financial !== false;
        document.getElementById('notifPromotions').checked = notifSettings.promotions === true;
        document.getElementById('notifFavoriteRoutes').checked = notifSettings.favoriteRoutes !== false;
        document.getElementById('notifBrowser').checked = notifSettings.browser === true;

        // Carregar configurações de preferências
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        document.getElementById('themeSelect').value = preferences.theme || 'light';
        document.getElementById('languageSelect').value = preferences.language || 'pt-BR';
        
        // Carregar configurações de recarga automática
        const autoRecharge = JSON.parse(localStorage.getItem('autoRecharge') || '{}');
        if (autoRecharge.enabled) {
            document.getElementById('autoRecharge').checked = true;
            autoRechargeConfig.style.display = 'flex';
            autoRechargeAmount.style.display = 'flex';
            document.getElementById('rechargeThreshold').value = autoRecharge.threshold || 10;
            document.getElementById('rechargeAmount').value = autoRecharge.amount || 50;
        }

        // Carregar configurações de privacidade
        const privacy = JSON.parse(localStorage.getItem('privacySettings') || '{}');
        document.getElementById('shareLocation').checked = privacy.location !== false;
        document.getElementById('shareAnalytics').checked = privacy.analytics === true;
    }

    function saveSettings() {
        // Salvar configurações de notificações
        const notifSettings = {
            system: document.getElementById('notifSystem').checked,
            transport: document.getElementById('notifTransport').checked,
            financial: document.getElementById('notifFinancial').checked,
            promotions: document.getElementById('notifPromotions').checked,
            favoriteRoutes: document.getElementById('notifFavoriteRoutes').checked,
            browser: document.getElementById('notifBrowser').checked
        };
        localStorage.setItem('notificationSettings', JSON.stringify(notifSettings));

        // Salvar configurações de preferências
        const preferences = {
            theme: document.getElementById('themeSelect').value,
            language: document.getElementById('languageSelect').value
        };
        localStorage.setItem('userPreferences', JSON.stringify(preferences));

        // Salvar configurações de recarga automática
        const autoRecharge = {
            enabled: document.getElementById('autoRecharge').checked,
            threshold: parseFloat(document.getElementById('rechargeThreshold').value) || 10,
            amount: parseFloat(document.getElementById('rechargeAmount').value) || 50
        };
        localStorage.setItem('autoRecharge', JSON.stringify(autoRecharge));

        // Salvar configurações de privacidade
        const privacy = {
            location: document.getElementById('shareLocation').checked,
            analytics: document.getElementById('shareAnalytics').checked
        };
        localStorage.setItem('privacySettings', JSON.stringify(privacy));

        // Solicitar permissão de notificações do navegador se ativado
        if (notifSettings.browser && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    showNotification('Permissão de notificações concedida!', 'success');
                }
            });
        }

        showNotification('Configurações salvas com sucesso!', 'success');

        // Aplicar tema se mudou
        applyTheme(preferences.theme);
    }

    function applyTheme(theme) {
        if (theme === 'dark') {
            document.body.classList.add('dark-theme');
        } else if (theme === 'auto') {
            // Detectar preferência do sistema
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

    // Aplicar tema ao carregar
    function initTheme() {
        const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');
        const theme = preferences.theme || 'light';
        applyTheme(theme);
        
        // Se for automático, ouvir mudanças na preferência do sistema
        if (theme === 'auto') {
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
                applyTheme('auto');
            });
        }
    }

    function changePassword() {
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        // Validações
        if (!currentPassword || !newPassword || !confirmPassword) {
            showNotification('Por favor, preencha todos os campos', 'error');
            return;
        }

        if (newPassword.length < 6) {
            showNotification('A nova senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        if (newPassword !== confirmPassword) {
            showNotification('As senhas não coincidem', 'error');
            return;
        }

        // Verificar senha atual
        const session = checkSession();
        if (!session) return;

        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        const user = users.find(u => u.email === session.email);

        if (!user) {
            showNotification('Usuário não encontrado', 'error');
            return;
        }

        if (user.password !== currentPassword) {
            showNotification('Senha atual incorreta', 'error');
            return;
        }

        // Atualizar senha
        user.password = newPassword;
        localStorage.setItem('buswayUsers', JSON.stringify(users));

        // Limpar campos
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';

        // Fechar modal
        passwordModal.classList.remove('show');
        passwordModal.style.display = 'none';

        showNotification('Senha alterada com sucesso!', 'success');
    }

    // Event Listeners
    logoutBtn.addEventListener('click', () => {
        showNotification('Saindo...', 'info');
        sessionStorage.removeItem('buswaySession');
        
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1000);
    });

    changePasswordBtn.addEventListener('click', () => {
        passwordModal.classList.add('show');
        passwordModal.style.display = 'flex';
    });

    closePasswordModal.addEventListener('click', () => {
        passwordModal.classList.remove('show');
        passwordModal.style.display = 'none';
    });

    cancelPasswordBtn.addEventListener('click', () => {
        passwordModal.classList.remove('show');
        passwordModal.style.display = 'none';
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
    });

    submitPasswordBtn.addEventListener('click', changePassword);

    // Fechar modal ao clicar fora
    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            passwordModal.classList.remove('show');
            passwordModal.style.display = 'none';
        }
    });

    saveSettingsBtn.addEventListener('click', saveSettings);

    // Mostrar/ocultar configurações de recarga automática
    autoRechargeCheckbox.addEventListener('change', () => {
        if (autoRechargeCheckbox.checked) {
            autoRechargeConfig.style.display = 'flex';
            autoRechargeAmount.style.display = 'flex';
        } else {
            autoRechargeConfig.style.display = 'none';
            autoRechargeAmount.style.display = 'none';
        }
    });

    // Inicialização
    loadUserInfo();
    loadSettings();
    initTheme();

    // Verificar sessão periodicamente
    setInterval(() => {
        checkSession();
    }, 60000);
});

