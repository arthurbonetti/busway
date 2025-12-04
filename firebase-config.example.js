// firebase-config.js - COMPATÍVEL COM V8 + FIRESTORE

// Suas credenciais do Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Inicializar Firebase (v8 - mantém compatibilidade)
firebase.initializeApp(firebaseConfig);

// Serviços
const auth = firebase.auth();
const db = firebase.firestore();

// Configurar Google Provider
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Log para confirmar
console.log('Firebase inicializado com sucesso!');
