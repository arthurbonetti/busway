document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const showRegisterLink = document.getElementById('showRegister');
    const showLoginLink = document.getElementById('showLogin');
    const loginFormElement = document.getElementById('loginFormElement');
    const registerFormElement = document.getElementById('registerFormElement');
    const googleLoginBtn = document.getElementById('googleLogin');
    const googleRegisterBtn = document.getElementById('googleRegister');
    const notification = document.getElementById('notification');

    const ADMIN_EMAIL = 'admin@busway.com';
    const ADMIN_PASSWORD = 'admin123';

    function initializeAdminAccount() {
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        const adminExists = users.some(user => user.email === ADMIN_EMAIL && user.isAdmin === true);
        
        if (!adminExists) {
            const adminUser = {
                id: 'admin-001',
                name: 'Administrador',
                email: ADMIN_EMAIL,
                password: ADMIN_PASSWORD,
                isAdmin: true,
                createdAt: new Date().toISOString()
            };
            users.push(adminUser);
            localStorage.setItem('buswayUsers', JSON.stringify(users));
            console.log('Conta administrativa criada automaticamente');
        }
        
        // Criar usuário de teste se não existir
        const testUserExists = users.some(user => user.email === 'teste@busway.com');
        if (!testUserExists) {
            const testUser = {
                id: 'test-user-001',
                name: 'Usuário Teste',
                email: 'teste@busway.com',
                password: '123456',
                isAdmin: false,
                createdAt: new Date().toISOString()
            };
            users.push(testUser);
            localStorage.setItem('buswayUsers', JSON.stringify(users));
            console.log('Usuário de teste criado: teste@busway.com / 123456');
        }
    }

    initializeAdminAccount();

    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;
        
        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function switchForms(showForm, hideForm) {
        hideForm.classList.add('hidden');
        showForm.classList.remove('hidden');
    }

    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForms(registerForm, loginForm);
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        switchForms(loginForm, registerForm);
    });

    function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    function validatePassword(password) {
        return password.length >= 6;
    }

    function saveUserData(userData) {
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        users.push(userData);
        localStorage.setItem('buswayUsers', JSON.stringify(users));
    }

    function findUser(email, password) {
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        return users.find(user => user.email === email && user.password === password);
    }

    function setSession(user) {
        const sessionData = {
            id: user.id || Date.now(),
            email: user.email,
            name: user.name,
            isAdmin: user.isAdmin || false,
            loginTime: new Date().toISOString()
        };
        
        sessionStorage.setItem('buswaySession', JSON.stringify(sessionData));
        return sessionData;
    }

    function checkExistingUser(email) {
        const users = JSON.parse(localStorage.getItem('buswayUsers') || '[]');
        return users.some(user => user.email === email);
    }

    loginFormElement.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        if (!validateEmail(email)) {
            showNotification('Por favor, insira um e-mail válido', 'error');
            return;
        }
        
        const user = findUser(email, password);
        
        if (user) {
            const session = setSession(user);
            
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('rememberedEmail', email);
            } else {
                localStorage.removeItem('rememberMe');
                localStorage.removeItem('rememberedEmail');
            }
            
            if (user.isAdmin) {
                showNotification('Bem-vindo, Administrador!', 'success');
            } else {
                showNotification('Login realizado com sucesso!', 'success');
            }
            
            setTimeout(() => {
                if (user.isAdmin) {
                    window.location.href = 'dashboard.html';
                } else {
                    window.location.href = 'user-dashboard.html';
                }
            }, 1500);
        } else {
            showNotification('E-mail ou senha incorretos', 'error');
        }
    });

    registerFormElement.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        
        if (!validateEmail(email)) {
            showNotification('Por favor, insira um e-mail válido', 'error');
            return;
        }
        
        if (!validatePassword(password)) {
            showNotification('A senha deve ter pelo menos 6 caracteres', 'error');
            return;
        }
        
        if (password !== confirmPassword) {
            showNotification('As senhas não coincidem', 'error');
            return;
        }
        
        if (!acceptTerms) {
            showNotification('Você deve aceitar os termos de uso', 'error');
            return;
        }
        
        if (checkExistingUser(email)) {
            showNotification('Este e-mail já está cadastrado', 'error');
            return;
        }
        
        const userData = {
            id: Date.now().toString(),
            name: name,
            email: email,
            password: password,
            isAdmin: false,
            createdAt: new Date().toISOString()
        };
        
        saveUserData(userData);
        showNotification('Conta criada com sucesso!', 'success');
        
        setTimeout(() => {
            switchForms(loginForm, registerForm);
            document.getElementById('loginEmail').value = email;
        }, 1500);
    });

    googleLoginBtn.addEventListener('click', () => {
        showNotification('Login com Google em breve', 'info');
    });

    googleRegisterBtn.addEventListener('click', () => {
        showNotification('Cadastro com Google em breve', 'info');
    });

    document.querySelector('.forgot-link').addEventListener('click', (e) => {
        e.preventDefault();
        showNotification('Recuperação de senha em desenvolvimento', 'info');
    });

    if (localStorage.getItem('rememberMe') === 'true') {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail) {
            document.getElementById('loginEmail').value = rememberedEmail;
            document.getElementById('rememberMe').checked = true;
        }
    }

    const existingSession = sessionStorage.getItem('buswaySession');
    if (existingSession) {
        const sessionData = JSON.parse(existingSession);
        showNotification('Sessão ativa detectada. Redirecionando...', 'info');
        setTimeout(() => {
            if (sessionData.isAdmin) {
                window.location.href = 'dashboard.html';
            } else {
                window.location.href = 'user-dashboard.html';
            }
        }, 1000);
    }
});