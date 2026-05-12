// DARK MODE GLOBAL (Matheus aplicou em todas as páginas)

(async function initDarkMode() {
    // Função para aplicar o tema
    function applyDarkMode(enabled) {
        if (enabled) {
            document.body.classList.add('dark-theme');
            console.log('[DarkMode] Modo noturno ativado');
        } else {
            document.body.classList.remove('dark-theme');
            console.log('[DarkMode] Modo noturno desativado');
        }
    }

    // Verificar sessão do usuário
    function getUserSession() {
        const sessionData = sessionStorage.getItem('buswaySession') ||
                           sessionStorage.getItem('user_session') ||
                           localStorage.getItem('user_session');
        return sessionData ? JSON.parse(sessionData) : null;
    }

    // Aguardar Firestore estar disponível
    function waitForFirestore() {
        return new Promise((resolve) => {
            if (typeof db !== 'undefined') {
                resolve();
                return;
            }

            const checkInterval = setInterval(() => {
                if (typeof db !== 'undefined') {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 100);

            // Timeout de 5 segundos
            setTimeout(() => {
                clearInterval(checkInterval);
                console.warn('[DarkMode] Firestore não disponível');
                resolve();
            }, 5000);
        });
    }

    // Carregar preferência do Firestore
    async function loadDarkModePreference() {
        const session = getUserSession();

        if (!session) {
            console.log('[DarkMode] Sem sessão ativa');
            return;
        }

        const userId = session.uid || session.id;

        if (!userId) {
            console.log('[DarkMode] UserId não encontrado');
            return;
        }

        try {
            // Aguardar Firestore estar disponível
            await waitForFirestore();

            if (typeof db === 'undefined') {
                console.warn('[DarkMode] Firestore não disponível após timeout');
                return;
            }

            console.log('[DarkMode] Carregando preferência para userId:', userId);

            const userDoc = await db.collection('users').doc(userId).get();

            if (userDoc.exists) {
                const userData = userDoc.data();
                const darkModeEnabled = userData.preferences?.darkMode || false;

                console.log('[DarkMode] Preferência carregada:', darkModeEnabled);
                applyDarkMode(darkModeEnabled);

                // Configurar listener para mudanças em tempo real
                db.collection('users').doc(userId).onSnapshot((doc) => {
                    if (doc.exists) {
                        const data = doc.data();
                        const darkMode = data.preferences?.darkMode || false;
                        applyDarkMode(darkMode);
                    }
                });
            } else {
                console.log('[DarkMode] Documento do usuário não encontrado');
            }
        } catch (error) {
            console.error('[DarkMode] Erro ao carregar preferência:', error);
        }
    }

    // Inicializar quando o DOM estiver pronto
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadDarkModePreference);
    } else {
        // DOM já está pronto
        await loadDarkModePreference();
    }
})();
