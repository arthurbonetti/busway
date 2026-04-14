// firebase-config.js - COMPATÍVEL COM V8 + FIRESTORE

// Suas credenciais do Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyB5ncTZ8Jkr83iCUUI8CeaQkV3EkLJQhQw",
    authDomain: "busway-803d0.firebaseapp.com",
    projectId: "busway-803d0",
    storageBucket: "busway-803d0.firebasestorage.app",
    messagingSenderId: "865404562391",
    appId: "1:865404562391:web:08f5c81621ad698f8db992",
    measurementId: "G-CHWNY76V5M"
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
