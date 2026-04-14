// script.js - INTEGRADO COM FIRESTORE

document.addEventListener('DOMContentLoaded', function() {

    // Elementos do DOM
    const loginFormElement = document.getElementById('loginFormElement');
    const registerFormElement = document.getElementById('registerFormElement');
    const googleLoginBtn = document.getElementById('googleLogin');
    const googleRegisterBtn = document.getElementById('googleRegister');

    // ========== CADASTRO ==========
    registerFormElement?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;

        // Validações
        if (password.length < 6) {
            showNotification('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }

        try {
            // 1. Criar usuário no Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;


            // 2. Atualizar nome
            await user.updateProfile({ displayName: name });

            // 3. Criar documento no Firestore
            await createUser(user.uid, {
                name: name,
                email: email,
                photoURL: null
            });

            showNotification('Cadastro realizado com sucesso!', 'success');

            // Salvar na sessão
            sessionStorage.setItem('buswaySession', JSON.stringify({
                id: user.uid,
                uid: user.uid,
                name: name,
                email: email,
                balance: 0,
                isAdmin: false
            }));

            setTimeout(() => {
                window.location.href = 'user-dashboard.html';
            }, 1000);

        } catch (error) {
            let errorMessage = error.message;

            if (error.code === 'auth/email-already-in-use') {
                errorMessage = 'Este email já está em uso';
            } else if (error.code === 'auth/weak-password') {
                errorMessage = 'Senha muito fraca (mínimo 6 caracteres)';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email inválido';
            }

            showNotification(errorMessage, 'error');
        }
    });

    // ========== LOGIN ==========
    loginFormElement?.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;

        try {
            // 1. Autenticar
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;


            // 2. Buscar dados do Firestore
            const userData = await getUserData(user.uid);

            if (!userData) {
                throw new Error('Dados do usuário não encontrados no Firestore');
            }

            showNotification('Login realizado com sucesso!', 'success');

            // Salvar na sessão
            sessionStorage.setItem('buswaySession', JSON.stringify({
                id: user.uid,
                uid: user.uid,
                name: user.displayName || userData.name,
                email: user.email,
                photoURL: user.photoURL,
                ...userData
            }));

            setTimeout(() => {
                if (userData.isAdmin) {
                    window.location.href = 'admin-dashboard.html';
                } else {
                    window.location.href = 'user-dashboard.html';
                }
            }, 1000);

        } catch (error) {
            let errorMessage = error.message;

            if (error.code === 'auth/user-not-found') {
                errorMessage = 'Usuário não encontrado';
            } else if (error.code === 'auth/wrong-password') {
                errorMessage = 'Senha incorreta';
            } else if (error.code === 'auth/invalid-email') {
                errorMessage = 'Email inválido';
            }

            showNotification(errorMessage, 'error');
        }
    });

    // ========== LOGIN COM GOOGLE ==========
    googleLoginBtn?.addEventListener('click', async () => {
        await handleGoogleSignIn();
    });

    googleRegisterBtn?.addEventListener('click', async () => {
        await handleGoogleSignIn();
    });

    async function handleGoogleSignIn() {
        try {

            const result = await auth.signInWithPopup(googleProvider);
            const user = result.user;


            // Verificar se usuário já existe no Firestore
            let userData = await getUserData(user.uid);

            if (!userData) {
                // Criar novo usuário
                await createUser(user.uid, {
                    name: user.displayName,
                    email: user.email,
                    photoURL: user.photoURL
                });
                userData = await getUserData(user.uid);
            }

            // Salvar na sessão
            sessionStorage.setItem('buswaySession', JSON.stringify({
                id: user.uid,
                uid: user.uid,
                name: user.displayName,
                email: user.email,
                photoURL: user.photoURL,
                ...userData
            }));

            window.location.href = 'user-dashboard.html';

        } catch (error) {
            let errorMessage = error.message;

            if (error.code === 'auth/popup-closed-by-user') {
                errorMessage = 'Login cancelado';
            }

            showNotification(errorMessage, 'error');
        }
    }
});

// Função auxiliar para notificações
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (!notification) return;

    notification.textContent = message;
    notification.className = `notification show ${type}`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}
