
const firebaseConfig = {
    apiKey: 
    authDomain: 
    projectId: 
    storageBucket: 
    messagingSenderId: 
    appId: 
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

const googleProvider = new firebase.auth.GoogleAuthProvider();

async function signInWithGoogle() {
    try {
        const result = await auth.signInWithPopup(googleProvider);
        const user = result.user;
        
        const userData = {
            id: user.uid,
            name: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            isVisitor: false
        };
        
        sessionStorage.setItem('buswaySession', JSON.stringify({
            ...userData,
            loginTime: new Date().toISOString()
        }));
        
    
        window.location.href = 'dashboard.html';
        
    } catch (error) {
        console.error('Erro no login com Google:', error);
        showNotification('Erro ao fazer login com Google', 'error');
    }
}

async function signInWithEmail(email, password) {
    try {
        const result = await auth.signInWithEmailAndPassword(email, password);
        const user = result.user;
        
        const userData = {
            id: user.uid,
            email: user.email,
            name: user.displayName || email.split('@')[0],
            isVisitor: false
        };
        
        sessionStorage.setItem('buswaySession', JSON.stringify({
            ...userData,
            loginTime: new Date().toISOString()
        }));
        
        return userData;
        
    } catch (error) {
        console.error('Erro no login:', error);
        throw error;
    }
}

async function registerWithEmail(name, email, password) {
    try {
        const result = await auth.createUserWithEmailAndPassword(email, password);
        const user = result.user;
        
        // Atualizar perfil com nome
        await user.updateProfile({
            displayName: name
        });
        
        return {
            id: user.uid,
            name: name,
            email: user.email
        };
        
    } catch (error) {
        console.error('Erro no cadastro:', error);
        throw error;
    }
}

async function signOut() {
    try {
        await auth.signOut();
        sessionStorage.removeItem('buswaySession');
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

auth.onAuthStateChanged((user) => {
    if (user) {
        console.log('Usuário autenticado:', user.email);
    } else {
        console.log('Usuário não autenticado');
    }
});