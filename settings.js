// SETTINGS.JS - INTEGRADO COM FIRESTORE
document.addEventListener('DOMContentLoaded', async function() {
    const darkModeToggle = document.getElementById('darkModeToggle');
    const autoRechargeToggle = document.getElementById('autoRechargeToggle');
    const autoRechargeConfig = document.getElementById('autoRechargeConfig');
    const notification = document.getElementById('notification');

    let currentUserId = null;

    // Função para mostrar notificação
    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Verificar sessão
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
        currentUserId = sessionData.uid || sessionData.id;
        return sessionData;
    }

    // Carregar preferências do usuário do Firestore
    async function loadUserPreferences() {
        if (!currentUserId) return;

        try {
            const userDoc = await db.collection('users').doc(currentUserId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const preferences = userData.preferences || {};

                // Aplicar dark mode
                if (preferences.darkMode) {
                    darkModeToggle.checked = true;
                    document.body.classList.add('dark-theme');
                } else {
                    darkModeToggle.checked = false;
                    document.body.classList.remove('dark-theme');
                }

                // Aplicar configuração de recarga automática
                if (preferences.autoRecharge) {
                    autoRechargeToggle.checked = true;
                    autoRechargeConfig.style.display = 'block';

                    if (preferences.autoRechargeThreshold) {
                        document.getElementById('rechargeThreshold').value = preferences.autoRechargeThreshold;
                    }
                    if (preferences.autoRechargeAmount) {
                        document.getElementById('rechargeAmount').value = preferences.autoRechargeAmount;
                    }
                } else {
                    autoRechargeToggle.checked = false;
                    autoRechargeConfig.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Erro ao carregar preferências:', error);
        }
    }

    // Toggle Dark Mode
    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', async function() {
            const isDarkMode = this.checked;

            if (isDarkMode) {
                document.body.classList.add('dark-theme');
            } else {
                document.body.classList.remove('dark-theme');
            }

            // Salvar no Firestore
            if (currentUserId) {
                try {
                    await db.collection('users').doc(currentUserId).update({
                        'preferences.darkMode': isDarkMode
                    });
                    showNotification(
                        isDarkMode ? 'Modo noturno ativado' : 'Modo noturno desativado',
                        'success'
                    );
                } catch (error) {
                    console.error('Erro ao salvar preferência de tema:', error);
                    showNotification('Erro ao salvar preferência', 'error');
                }
            }
        });
    }

    // Toggle Auto Recharge
    if (autoRechargeToggle) {
        autoRechargeToggle.addEventListener('change', async function() {
            const isEnabled = this.checked;

            if (isEnabled) {
                autoRechargeConfig.style.display = 'block';
            } else {
                autoRechargeConfig.style.display = 'none';

                // Salvar no Firestore
                if (currentUserId) {
                    try {
                        await db.collection('users').doc(currentUserId).update({
                            'preferences.autoRecharge': false
                        });
                        showNotification('Recarga automática desativada', 'success');
                    } catch (error) {
                        console.error('Erro ao desativar recarga automática:', error);
                        showNotification('Erro ao salvar configuração', 'error');
                    }
                }
            }
        });
    }

    // Salvar configuração de recarga automática
    window.saveAutoRecharge = async function() {
        const threshold = parseFloat(document.getElementById('rechargeThreshold').value);
        const amount = parseFloat(document.getElementById('rechargeAmount').value);

        // Validação
        if (!threshold || threshold < 5) {
            showNotification('O valor mínimo deve ser de R$ 5,00', 'error');
            return;
        }

        if (!amount || amount < 5) {
            showNotification('O valor de recarga deve ser de pelo menos R$ 5,00', 'error');
            return;
        }

        if (threshold >= amount) {
            showNotification('O valor de recarga deve ser maior que o limite mínimo', 'error');
            return;
        }

        // Salvar no Firestore
        if (currentUserId) {
            try {
                await db.collection('users').doc(currentUserId).update({
                    'preferences.autoRecharge': true,
                    'preferences.autoRechargeThreshold': threshold,
                    'preferences.autoRechargeAmount': amount
                });

                showNotification('Configuração salva com sucesso!', 'success');
            } catch (error) {
                console.error('Erro ao salvar configuração de recarga:', error);
                showNotification('Erro ao salvar configuração', 'error');
            }
        }
    };

    // Inicialização
    const session = checkSession();
    if (session) {
        await loadUserPreferences();
    }
});
