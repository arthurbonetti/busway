// Sistema de rotas com mapas reais e APIs
let map = null;
let routingControl = null;
let busMarker = null;
let userMarker = null;
let selectedRoute = null;
let userBalance = 0;
let favoriteRoutes = JSON.parse(localStorage.getItem('favoriteRoutes')) || [];
let notifications = [];
let trackingInterval = null;
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// Sistema de rastreamento
let activeTrackings = new Map(); // Armazena rastreamentos ativos: routeId -> {route, interval, marker, currentStop}
let busMarkers = new Map(); // Armazena marcadores de ônibus por rota

// Expor activeTrackings globalmente para sistema de notificações
window.activeTrackings = activeTrackings;

// Coordenadas de Chapecó, SC
const CHAPECO_COORDS = [-27.0965, -52.6181];

// Locais populares de Chapecó para sugestões
const popularLocations = [
    { name: 'Terminal Central', coords: [-27.0965, -52.6181], type: 'terminal' },
    { name: 'UFFS - Universidade Federal', coords: [-27.1084, -52.6392], type: 'university' },
    { name: 'Hospital Regional', coords: [-27.0895, -52.6125], type: 'hospital' },
    { name: 'Arena Condá', coords: [-27.0825, -52.6285], type: 'stadium' },
    { name: 'Shopping Pátio Chapecó', coords: [-27.0885, -52.6245], type: 'shopping' },
    { name: 'Centro da Cidade', coords: [-27.0965, -52.6150], type: 'downtown' },
    { name: 'Efapi', coords: [-27.1145, -52.6425], type: 'neighborhood' },
    { name: 'São Cristóvão', coords: [-27.0845, -52.6085], type: 'neighborhood' },
    { name: 'Belvedere', coords: [-27.0765, -52.6345], type: 'neighborhood' },
    { name: 'Bairro Jardim América', coords: [-27.0785, -52.6195], type: 'neighborhood' },
    { name: 'Bairro São Pedro', coords: [-27.1025, -52.6075], type: 'neighborhood' },
    { name: 'Seminário', coords: [-27.1185, -52.6095], type: 'neighborhood' },
    { name: 'Aeroporto de Chapecó', coords: [-27.1325, -52.6565], type: 'airport' },
    { name: 'Unochapecó', coords: [-27.0984, -52.6343], type: 'university' }
];

// Dados reais de rotas de Chapecó (baseado em informações públicas e distâncias reais)
const realRoutes = [
    {
        id: '101',
        number: '101',
        name: 'Centro - Efapi',
        origin: 'Terminal Central',
        destination: 'Efapi',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.1145, -52.6425],
        price: 'R$ 4,50',
        baseDistance: 8.5, // km reais pela rota via centro
        baseDuration: 25, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Av. Getúlio Vargas', coords: [-27.0985, -52.6195] },
            { name: 'Rua XV de Novembro', coords: [-27.1005, -52.6210] },
            { name: 'UFFS', coords: [-27.1084, -52.6392] },
            { name: 'Efapi', coords: [-27.1145, -52.6425] }
        ]
    },
    {
        id: '102',
        number: '102',
        name: 'Centro - São Cristóvão',
        origin: 'Terminal Central',
        destination: 'São Cristóvão',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0845, -52.6085],
        price: 'R$ 4,50',
        baseDistance: 4.2, // km reais pela rota
        baseDuration: 18, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Praça Central', coords: [-27.0955, -52.6175] },
            { name: 'Hospital Regional', coords: [-27.0895, -52.6125] },
            { name: 'São Cristóvão', coords: [-27.0845, -52.6085] }
        ]
    },
    {
        id: '103',
        number: '103',
        name: 'Centro - Belvedere',
        origin: 'Terminal Central',
        destination: 'Belvedere',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0765, -52.6345],
        price: 'R$ 4,50',
        baseDistance: 6.8, // km reais pela rota via shopping
        baseDuration: 22, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Shopping Pátio Chapecó', coords: [-27.0885, -52.6245] },
            { name: 'Arena Condá', coords: [-27.0825, -52.6285] },
            { name: 'Belvedere', coords: [-27.0765, -52.6345] }
        ]
    },
    {
        id: '104',
        number: '104',
        name: 'Centro - Aeroporto',
        origin: 'Terminal Central',
        destination: 'Aeroporto de Chapecó',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.1325, -52.6565],
        price: 'R$ 5,50',
        baseDistance: 12.5, // km reais pela rota via Unochapecó
        baseDuration: 35, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Unochapecó', coords: [-27.0984, -52.6343] },
            { name: 'Seminário', coords: [-27.1185, -52.6095] },
            { name: 'Aeroporto de Chapecó', coords: [-27.1325, -52.6565] }
        ]
    },
    {
        id: '105',
        number: '105',
        name: 'Centro - Jardim América',
        origin: 'Terminal Central',
        destination: 'Bairro Jardim América',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0785, -52.6195],
        price: 'R$ 4,50',
        baseDistance: 2.8, // km reais pela rota
        baseDuration: 12, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Centro da Cidade', coords: [-27.0965, -52.6150] },
            { name: 'Bairro Jardim América', coords: [-27.0785, -52.6195] }
        ]
    },
    {
        id: '201',
        number: '201',
        name: 'Circular Norte',
        origin: 'Terminal Central',
        destination: 'Terminal Central',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0965, -52.6181],
        price: 'R$ 4,50',
        baseDistance: 18.5, // km reais pela rota completa
        baseDuration: 55, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'São Pedro', coords: [-27.1025, -52.6075] },
            { name: 'UFFS', coords: [-27.1095, -52.6385] },
            { name: 'Efapi', coords: [-27.1145, -52.6425] },
            { name: 'Centro', coords: [-27.0965, -52.6150] },
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] }
        ]
    },
    {
        id: '202',
        number: '202',
        name: 'Circular Sul',
        origin: 'Terminal Central',
        destination: 'Terminal Central',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0965, -52.6181],
        price: 'R$ 4,50',
        baseDistance: 15.2, // km reais pela rota completa
        baseDuration: 45, // minutos reais
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'São Cristóvão', coords: [-27.0845, -52.6085] },
            { name: 'Hospital Regional', coords: [-27.0895, -52.6125] },
            { name: 'Shopping', coords: [-27.0885, -52.6245] },
            { name: 'Arena Condá', coords: [-27.0825, -52.6285] },
            { name: 'Belvedere', coords: [-27.0765, -52.6345] },
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] }
        ]
    },
    {
        id: '301',
        number: '301',
        name: 'UFFS - Unochapecó',
        origin: 'UFFS',
        destination: 'Unochapecó',
        originCoords: [-27.1084, -52.6392],
        destinationCoords: [-27.0984, -52.6343],
        price: 'R$ 4,50',
        baseDistance: 6.7,
        baseDuration: 18,
        stops: [
            { name: 'UFFS', coords: [-27.1084, -52.6392] },
            { name: 'Av. Fernando Machado', coords: [-27.1055, -52.6360] },
            { name: 'Centro da Cidade', coords: [-27.0965, -52.6150] },
            { name: 'Av. Getúlio Vargas', coords: [-27.0985, -52.6195] },
            { name: 'Unochapecó', coords: [-27.0984, -52.6343] }
        ]
    },
    {
        id: '302',
        number: '302',
        name: 'Unochapecó - UFFS (via Shopping)',
        origin: 'Unochapecó',
        destination: 'UFFS',
        originCoords: [-27.0984, -52.6343],
        destinationCoords: [-27.1084, -52.6392],
        price: 'R$ 4,50',
        baseDistance: 7.8,
        baseDuration: 22,
        stops: [
            { name: 'Unochapecó', coords: [-27.0984, -52.6343] },
            { name: 'Shopping Pátio Chapecó', coords: [-27.0885, -52.6245] },
            { name: 'Arena Condá', coords: [-27.0825, -52.6285] },
            { name: 'Av. Fernando Machado', coords: [-27.1055, -52.6360] },
            { name: 'UFFS', coords: [-27.1084, -52.6392] }
        ]
    },
    {
        id: '401',
        number: '401',
        name: 'Terminal - Hospital',
        origin: 'Terminal Central',
        destination: 'Hospital Regional',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.0895, -52.6125],
        price: 'R$ 3,00',
        baseDistance: 1.8,
        baseDuration: 8,
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'Praça Central', coords: [-27.0955, -52.6175] },
            { name: 'Hospital Regional', coords: [-27.0895, -52.6125] }
        ]
    },
    {
        id: '402',
        number: '402',
        name: 'Hospital Regional - UFFS',
        origin: 'Hospital Regional',
        destination: 'UFFS',
        originCoords: [-27.0895, -52.6125],
        destinationCoords: [-27.1084, -52.6392],
        price: 'R$ 4,50',
        baseDistance: 4.5,
        baseDuration: 15,
        stops: [
            { name: 'Hospital Regional', coords: [-27.0895, -52.6125] },
            { name: 'São Cristóvão', coords: [-27.0845, -52.6085] },
            { name: 'Centro da Cidade', coords: [-27.0965, -52.6150] },
            { name: 'Av. Fernando Machado', coords: [-27.1055, -52.6360] },
            { name: 'UFFS', coords: [-27.1084, -52.6392] }
        ]
    },
    {
        id: '403',
        number: '403',
        name: 'UFFS - Hospital Regional',
        origin: 'UFFS',
        destination: 'Hospital Regional',
        originCoords: [-27.1084, -52.6392],
        destinationCoords: [-27.0895, -52.6125],
        price: 'R$ 4,50',
        baseDistance: 4.5,
        baseDuration: 15,
        stops: [
            { name: 'UFFS', coords: [-27.1084, -52.6392] },
            { name: 'Av. Fernando Machado', coords: [-27.1055, -52.6360] },
            { name: 'Centro da Cidade', coords: [-27.0965, -52.6150] },
            { name: 'São Cristóvão', coords: [-27.0845, -52.6085] },
            { name: 'Hospital Regional', coords: [-27.0895, -52.6125] }
        ]
    },
    {
        id: '501',
        number: '501',
        name: 'Expresso Aeroporto',
        origin: 'Terminal Central',
        destination: 'Aeroporto de Chapecó',
        originCoords: [-27.0965, -52.6181],
        destinationCoords: [-27.1325, -52.6565],
        price: 'R$ 6,00',
        baseDistance: 8.7,
        baseDuration: 22,
        stops: [
            { name: 'Terminal Central', coords: [-27.0965, -52.6181] },
            { name: 'UFFS', coords: [-27.1095, -52.6385] },
            { name: 'Aeroporto de Chapecó', coords: [-27.1325, -52.6565] }
        ]
    }
];

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    const session = loadUserSession();
    if (session) {
        initializeMap();
        loadBalance();
        loadTransactions();
        setupNotifications();
        setupGeolocation();
        updateRoutesWithRealData();
        setupAutocomplete();
        showPopularDestinations();
    }
});

function setupAutocomplete() {
    const originInput = document.getElementById('origin');
    const destinationInput = document.getElementById('destination');
    const originSuggestions = document.getElementById('originSuggestions');
    const destinationSuggestions = document.getElementById('destinationSuggestions');
    
    let autoSearchTimeout = null;

    // Setup para origem
    originInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 0) {
            const filtered = filterLocations(query);
            showSuggestions(filtered, originSuggestions, (location) => {
                originInput.value = location.name;
                hideSuggestions(originSuggestions);
                // Atualizar rotas automaticamente
                clearTimeout(autoSearchTimeout);
                autoSearchTimeout = setTimeout(searchRoutes, 500);
            });
        } else {
            hideSuggestions(originSuggestions);
        }
        
        // Atualizar rotas após mudança na origem
        clearTimeout(autoSearchTimeout);
        autoSearchTimeout = setTimeout(() => {
            const destValue = destinationInput.value.trim();
            if (destValue && query.length > 0) {
                searchRoutes();
            }
        }, 800);
    });
    
    originInput.addEventListener('change', () => {
        const destValue = destinationInput.value.trim();
        if (destValue) {
            searchRoutes();
        }
    });

    // Setup para destino  
    destinationInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length > 0) {
            const filtered = filterLocations(query);
            showSuggestions(filtered, destinationSuggestions, (location) => {
                destinationInput.value = location.name;
                hideSuggestions(destinationSuggestions);
                // Atualizar rotas automaticamente
                clearTimeout(autoSearchTimeout);
                autoSearchTimeout = setTimeout(searchRoutes, 500);
            });
        } else {
            hideSuggestions(destinationSuggestions);
        }
        
        // Atualizar rotas após mudança no destino
        clearTimeout(autoSearchTimeout);
        autoSearchTimeout = setTimeout(() => {
            const originValue = originInput.value.trim();
            if (originValue && query.length > 0) {
                searchRoutes();
            }
        }, 800);
    });
    
    // Adicionar listener para mudança via teclado (quando usuário pressiona Enter ou Tab)
    originInput.addEventListener('change', () => {
        if (destinationInput.value.trim()) {
            clearTimeout(autoSearchTimeout);
            autoSearchTimeout = setTimeout(() => searchRoutes(), 300);
        }
    });
    
    destinationInput.addEventListener('change', () => {
        if (destinationInput.value.trim()) {
            clearTimeout(autoSearchTimeout);
            autoSearchTimeout = setTimeout(() => searchRoutes(), 300);
        }
    });

    // Esconder sugestões ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.location-input')) {
            hideSuggestions(originSuggestions);
            hideSuggestions(destinationSuggestions);
        }
    });
}

function filterLocations(query) {
    return popularLocations.filter(location => 
        location.name.toLowerCase().includes(query)
    ).slice(0, 5);
}

function showSuggestions(locations, container, onSelect) {
    if (locations.length === 0) {
        hideSuggestions(container);
        return;
    }

    container.innerHTML = locations.map(location => `
        <div class="suggestion-item" data-name="${location.name}">
            <div class="suggestion-icon">
                ${getLocationIcon(location.type)}
            </div>
            <div class="suggestion-text">
                <div class="suggestion-name">${location.name}</div>
                <div class="suggestion-type">${getLocationTypeText(location.type)}</div>
            </div>
        </div>
    `).join('');

    // Adicionar eventos de clique
    container.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
            const locationName = item.dataset.name;
            const location = popularLocations.find(loc => loc.name === locationName);
            onSelect(location);
        });
    });

    container.style.display = 'block';
}

function hideSuggestions(container) {
    container.style.display = 'none';
}

function getLocationIcon(type) {
    const icons = {
        terminal: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 16c0 .88.39 1.67 1 2.22V20a1 1 0 001 1h1a1 1 0 001-1v-1h8v1a1 1 0 001 1h1a1 1 0 001-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10z" fill="#667eea"/></svg>',
        university: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 3L1 9L12 15L21 9V16H23V9M5 13.18V17.18C5 17.95 5.67 18.77 7 19.81C8.33 20.84 10.67 21.81 12 21.81C13.33 21.81 15.67 20.84 17 19.81C18.33 18.77 19 17.95 19 17.18V13.18L12 9.27L5 13.18Z" fill="#10b981"/></svg>',
        hospital: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 2L13.09 6.26L22 9L13.09 11.74L12 16L10.91 11.74L2 9L10.91 6.26L12 2ZM19 15H17V13H15V15H13V17H15V19H17V17H19V15Z" fill="#ef4444"/></svg>',
        stadium: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7,10H12V15H7V10M19,19H5V8H19M19,6H5C3.89,6 3,6.89 3,8V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V8C21,6.89 20.1,6 19,6Z" fill="#f59e0b"/></svg>',
        shopping: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M7 4V2C7 1.45 7.45 1 8 1H16C16.55 1 17 1.45 17 2V4H20C20.55 4 21 4.45 21 5S20.55 6 20 6H19V19C19 20.1 18.1 21 17 21H7C5.9 21 5 20.1 5 19V6H4C3.45 6 3 5.55 3 5S3.45 4 4 4H7Z" fill="#8b5cf6"/></svg>',
        downtown: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15,11V5L12,2L9,5V7H3V21H21V11H15M7,19H5V17H7V19M7,15H5V13H7V15M7,11H5V9H7V11M13,19H11V17H13V19M13,15H11V13H13V15M13,11H11V9H13V11M13,7H11V5H13V7M19,19H17V17H19V19M19,15H17V13H19V15Z" fill="#3b82f6"/></svg>',
        neighborhood: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M10,20V14H14V20H19V12H22L12,3L2,12H5V20H10Z" fill="#64748b"/></svg>',
        airport: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M20.36 18L20.87 17.5C21.96 16.4 21.96 14.6 20.87 13.5L13.5 6.13C12.4 5.04 10.6 5.04 9.5 6.13L9 6.63C8.63 7 8.63 7.56 9 7.93L12.5 11.43L5.07 18.86C4.64 19.29 4.64 19.96 5.07 20.39L5.46 20.78C5.89 21.21 6.56 21.21 6.99 20.78L14.42 13.35L17.92 16.85C18.29 17.22 18.85 17.22 19.22 16.85L19.72 16.35C20.77 15.3 20.77 13.7 19.72 12.65L12.35 5.28C11.3 4.23 9.7 4.23 8.65 5.28L8.15 5.78C7.82 6.11 7.82 6.67 8.15 7L11.65 10.5L4.22 17.93C3.79 18.36 3.79 19.03 4.22 19.46L4.61 19.85C5.04 20.28 5.71 20.28 6.14 19.85L13.57 12.42L17.07 15.92C17.44 16.29 18 16.29 18.37 15.92L18.87 15.42C19.92 14.37 19.92 12.77 18.87 11.72L11.5 4.35C10.45 3.3 8.85 3.3 7.8 4.35L7.3 4.85C6.93 5.22 6.93 5.78 7.3 6.15L10.8 9.65L3.37 17.08C2.94 17.51 2.94 18.18 3.37 18.61L3.76 19C4.19 19.43 4.86 19.43 5.29 19L12.72 11.57L16.22 15.07C16.59 15.44 17.15 15.44 17.52 15.07L18.02 14.57C19.07 13.52 19.07 11.92 18.02 10.87L10.65 3.5C9.6 2.45 8 2.45 6.95 3.5L6.45 4C6.08 4.33 6.08 4.89 6.45 5.26L9.95 8.76L2.52 16.19C2.09 16.62 2.09 17.29 2.52 17.72L2.91 18.11C3.34 18.54 4.01 18.54 4.44 18.11L11.87 10.68L15.37 14.18C15.74 14.55 16.3 14.55 16.67 14.18L17.17 13.68C18.22 12.63 18.22 11.03 17.17 9.98L9.8 2.61C8.75 1.56 7.15 1.56 6.1 2.61L5.6 3.11C5.23 3.44 5.23 4 5.6 4.37L9.1 7.87L1.67 15.3C1.24 15.73 1.24 16.4 1.67 16.83L2.06 17.22C2.49 17.65 3.16 17.65 3.59 17.22L11.02 9.79L14.52 13.29C14.89 13.66 15.45 13.66 15.82 13.29L16.32 12.79C17.37 11.74 17.37 10.14 16.32 9.09L8.95 1.72C7.9 0.67 6.3 0.67 5.25 1.72L4.75 2.22C4.38 2.55 4.38 3.11 4.75 3.48L8.25 6.98L0.82 14.41C0.39 14.84 0.39 15.51 0.82 15.94L1.21 16.33C1.64 16.76 2.31 16.76 2.74 16.33L10.17 8.9L13.67 12.4C14.04 12.77 14.6 12.77 14.97 12.4L15.47 11.9C16.52 10.85 16.52 9.25 15.47 8.2L8.1 0.83C7.05 -0.22 5.45 -0.22 4.4 0.83L3.9 1.33C3.53 1.66 3.53 2.22 3.9 2.59L7.4 6.09L0 13.49L20.36 18Z" fill="#0891b2"/></svg>'
    };
    return icons[type] || icons.neighborhood;
}

function getLocationTypeText(type) {
    const types = {
        terminal: 'Terminal',
        university: 'Universidade',
        hospital: 'Hospital',
        stadium: 'Estádio',
        shopping: 'Shopping',
        downtown: 'Centro',
        neighborhood: 'Bairro',
        airport: 'Aeroporto'
    };
    return types[type] || 'Local';
}

function showPopularDestinations() {
    // Mostrar destinos populares antes da busca
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = `
        <div class="popular-destinations">
            <h3>Destinos Populares</h3>
            <div class="popular-grid">
                ${popularLocations.slice(0, 6).map(location => `
                    <div class="popular-item" onclick="selectPopularDestination('${location.name}')">
                        <div class="popular-icon">
                            ${getLocationIcon(location.type)}
                        </div>
                        <div class="popular-name">${location.name}</div>
                        <div class="popular-type">${getLocationTypeText(location.type)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

function selectPopularDestination(locationName) {
    document.getElementById('destination').value = locationName;
    searchRoutes();
}

function loadUserSession() {
    const sessionData = sessionStorage.getItem('buswaySession');
    
    if (!sessionData) {
        localStorage.removeItem('buswaySession');
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        const session = JSON.parse(sessionData);
        return session;
    } catch (error) {
        console.error('Erro ao fazer parse da sessão:', error);
        sessionStorage.removeItem('buswaySession');
        window.location.href = 'index.html';
        return false;
    }
}

function initializeMap() {
    console.log('Inicializando mapa...');
    
    // Verificar se o container existe
    const mapContainer = document.getElementById('mapContainer');
    if (!mapContainer) {
        console.error('Container do mapa não encontrado');
        return;
    }

    // Inicializar mapa centrado em Chapecó
    map = L.map('mapContainer', {
        zoomControl: false
    }).setView(CHAPECO_COORDS, 13);

    // Adicionar tiles do OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Adicionar controles customizados
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // Adicionar marcadores dos pontos importantes
    addCityLandmarks();
    
    console.log('Mapa inicializado com sucesso');
}

function addCityLandmarks() {
    // Terminal Central
    L.marker([-27.0965, -52.6181])
        .addTo(map)
        .bindPopup('<strong>Terminal Central</strong><br>Principal terminal de ônibus')
        .openPopup();

    // Outros pontos importantes
    const landmarks = [
        { name: 'UFFS', coords: [-27.1095, -52.6385] },
        { name: 'Hospital Regional', coords: [-27.0895, -52.6125] },
        { name: 'Arena Condá', coords: [-27.0825, -52.6285] }
    ];

    landmarks.forEach(landmark => {
        L.marker(landmark.coords)
            .addTo(map)
            .bindPopup(`<strong>${landmark.name}</strong>`);
    });
}

function setupGeolocation() {
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userCoords = [position.coords.latitude, position.coords.longitude];
                
                // Verificar se o usuário está em Chapecó (raio aproximado)
                const distanceToChapeco = getDistance(userCoords, CHAPECO_COORDS);
                
                if (distanceToChapeco < 50) { // 50km de raio
                    userMarker = L.marker(userCoords, {
                        icon: L.divIcon({
                            className: 'user-location-marker',
                            html: '<div class="user-dot"></div>',
                            iconSize: [20, 20]
                        })
                    }).addTo(map).bindPopup('Sua localização');
                    
                    // Centralizar no usuário se estiver em Chapecó
                    map.setView(userCoords, 15);
                    showToast('Localização encontrada!', 'success');
                } else {
                    showToast('Você está fora da área de cobertura', 'info');
                }
            },
            (error) => {
                console.log('Erro de geolocalização:', error);
                showToast('Não foi possível obter sua localização', 'info');
            }
        );
    }
}

async function searchRoutes() {
    const originInput = document.getElementById('origin').value.trim();
    const destinationInput = document.getElementById('destination').value.trim();
    
    if (!destinationInput) {
        showToast('Por favor, digite um destino', 'error');
        return;
    }

    showToast('Buscando rotas...', 'info');
    
    try {
        // Tentar encontrar coordenadas dos locais
        let originCoords = findLocationByName(originInput);
        let destinationCoords = findLocationByName(destinationInput);
        
        // Se não encontrou por nome, tentar geocodificação
        if (!originCoords) {
            originCoords = await geocodeAddress(originInput + ', Chapecó, SC');
        }
        
        if (!destinationCoords) {
            destinationCoords = await geocodeAddress(destinationInput + ', Chapecó, SC');
        }
        
        // Se ainda não encontrou, usar coordenadas padrão
        if (!originCoords) {
            originCoords = CHAPECO_COORDS; // Terminal Central como padrão
        }
        
        if (!destinationCoords) {
            destinationCoords = CHAPECO_COORDS; // Terminal Central como padrão
        }

        console.log('Buscando rotas de', originInput, 'para', destinationInput);
        console.log('Origem coords:', originCoords);
        console.log('Destino coords:', destinationCoords);

        // Encontrar as 2 melhores rotas para o trajeto
        const bestRoutes = findBestRoutesForJourney(originCoords, destinationCoords, originInput, destinationInput);
        
        if (bestRoutes.length === 0) {
            showToast('Nenhuma rota encontrada para este trajeto', 'info');
            displayNoRoutesFound();
            return;
        }

        // Calcular distâncias e tempos reais para cada rota
        const routesWithRealData = await Promise.all(
            bestRoutes.map(async route => {
                const routeData = await calculateRealRouteData(originCoords, destinationCoords, route);
                return { ...route, ...routeData };
            })
        );

        // Ordenar por tempo (mais rápida primeiro)
        routesWithRealData.sort((a, b) => a.duration - b.duration);

        console.log('Rotas encontradas:', routesWithRealData.length);
        displayRoutes(routesWithRealData);
        showRouteOnMap(originCoords, destinationCoords, routesWithRealData[0]);
        document.getElementById('financialSection').style.display = 'block';
        
    } catch (error) {
        console.error('Erro ao buscar rotas:', error);
        showToast('Erro ao buscar rotas. Tente novamente.', 'error');
        displayNoRoutesFound();
    }
}

function findLocationByName(name) {
    const location = popularLocations.find(loc => 
        loc.name.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(loc.name.toLowerCase())
    );
    return location ? location.coords : null;
}

// Nova função inteligente para encontrar as 2 melhores rotas
function findBestRoutesForJourney(originCoords, destinationCoords, originName, destinationName) {
    console.log('Procurando rotas entre', originName, 'e', destinationName);
    
    // Calcular distância entre origem e destino
    const directDistance = getDistance(originCoords, destinationCoords);
    console.log('Distância direta:', directDistance, 'km');
    
    // Primeiro, buscar rotas por nome dos locais
    const routesByName = realRoutes.filter(route => {
        const originMatch = route.origin.toLowerCase().includes(originName.toLowerCase()) ||
                           originName.toLowerCase().includes(route.origin.toLowerCase()) ||
                           route.name.toLowerCase().includes(originName.toLowerCase());
        
        const destinationMatch = route.destination.toLowerCase().includes(destinationName.toLowerCase()) ||
                                destinationName.toLowerCase().includes(route.destination.toLowerCase()) ||
                                route.name.toLowerCase().includes(destinationName.toLowerCase());
        
        return originMatch || destinationMatch;
    });
    
    console.log('Rotas por nome:', routesByName.length);
    
    // Segundo, buscar rotas por proximidade geográfica
    const routesByProximity = realRoutes.filter(route => {
        if (!route.stops || route.stops.length === 0) return false;
        
        // Verificar se a rota passa perto da origem
        const nearOrigin = route.stops.some(stop => 
            getDistance(originCoords, stop.coords) < 2.0 // 2km de raio
        );
        
        // Verificar se a rota passa perto do destino
        const nearDestination = route.stops.some(stop => 
            getDistance(destinationCoords, stop.coords) < 2.0 // 2km de raio
        );
        
        // Aceitar se passa perto de pelo menos um dos pontos
        return nearOrigin || nearDestination;
    });
    
    console.log('Rotas por proximidade:', routesByProximity.length);
    
    // Combinar e remover duplicatas
    const allCandidates = [...new Set([...routesByName, ...routesByProximity])];
    
    if (allCandidates.length === 0) {
        // Se não encontrou nada, pegar as 2 rotas mais próximas geograficamente
        console.log('Nenhuma rota específica encontrada, usando rotas mais próximas');
        const routesWithDistance = realRoutes.map(route => {
            if (!route.stops || route.stops.length === 0) {
                return { route, minDistance: 999 };
            }
            
            // Encontrar a menor distância entre os pontos da rota e origem/destino
            const distancesToOrigin = route.stops.map(stop => getDistance(originCoords, stop.coords));
            const distancesToDestination = route.stops.map(stop => getDistance(destinationCoords, stop.coords));
            
            const minDistanceToOrigin = Math.min(...distancesToOrigin);
            const minDistanceToDestination = Math.min(...distancesToDestination);
            
            // Usar a média das menores distâncias
            const avgDistance = (minDistanceToOrigin + minDistanceToDestination) / 2;
            
            return { route, minDistance: avgDistance };
        });
        
        // Ordenar por proximidade e pegar as 2 melhores
        routesWithDistance.sort((a, b) => a.minDistance - b.minDistance);
        return routesWithDistance.slice(0, 2).map(item => item.route);
    }
    
    // Se encontrou candidatos, escolher os 2 melhores baseado em critérios
    const scoredRoutes = allCandidates.map(route => {
        let score = 0;
        
        // Pontuação por nome (correspondência exata vale mais)
        const originMatch = route.origin.toLowerCase().includes(originName.toLowerCase()) ||
                           originName.toLowerCase().includes(route.origin.toLowerCase());
        const destinationMatch = route.destination.toLowerCase().includes(destinationName.toLowerCase()) ||
                                destinationName.toLowerCase().includes(route.destination.toLowerCase());
        
        if (originMatch && destinationMatch) score += 100; // Correspondência perfeita
        else if (originMatch || destinationMatch) score += 50; // Correspondência parcial
        
        // Pontuação por proximidade geográfica
        if (route.stops && route.stops.length > 0) {
            const distancesToOrigin = route.stops.map(stop => getDistance(originCoords, stop.coords));
            const distancesToDestination = route.stops.map(stop => getDistance(destinationCoords, stop.coords));
            
            const minDistanceToOrigin = Math.min(...distancesToOrigin);
            const minDistanceToDestination = Math.min(...distancesToDestination);
            
            // Quanto mais próximo, maior a pontuação
            score += Math.max(0, 20 - minDistanceToOrigin * 2);
            score += Math.max(0, 20 - minDistanceToDestination * 2);
        }
        
        // Bonus para rotas que conectam bem os pontos
        if (route.stops && route.stops.length > 0) {
            const hasGoodCoverage = route.stops.some(stop => getDistance(originCoords, stop.coords) < 1.5) &&
                                   route.stops.some(stop => getDistance(destinationCoords, stop.coords) < 1.5);
            if (hasGoodCoverage) score += 30;
        }
        
        return { route, score };
    });
    
    // Ordenar por pontuação e retornar as 2 melhores
    scoredRoutes.sort((a, b) => b.score - a.score);
    const selectedRoutes = scoredRoutes.slice(0, 2).map(item => item.route);
    
    console.log('Rotas selecionadas:', selectedRoutes.map(r => `${r.number} - ${r.name}`));
    
    // Se só encontrou 1 rota, adicionar uma segunda baseada em proximidade
    if (selectedRoutes.length === 1) {
        const remainingRoutes = realRoutes.filter(route => !selectedRoutes.includes(route));
        if (remainingRoutes.length > 0) {
            const alternativeRoute = remainingRoutes.reduce((best, current) => {
                if (!current.stops || current.stops.length === 0) return best;
                if (!best.stops || best.stops.length === 0) return current;
                
                const currentMinDist = Math.min(
                    ...current.stops.map(stop => getDistance(destinationCoords, stop.coords))
                );
                const bestMinDist = Math.min(
                    ...best.stops.map(stop => getDistance(destinationCoords, stop.coords))
                );
                
                return currentMinDist < bestMinDist ? current : best;
            });
            
            selectedRoutes.push(alternativeRoute);
        }
    }
    
    return selectedRoutes;
}

function findRoutesByDestinationName(destinationName) {
    return realRoutes.filter(route => 
        route.destination.toLowerCase().includes(destinationName.toLowerCase()) ||
        route.name.toLowerCase().includes(destinationName.toLowerCase()) ||
        route.stops.some(stop => stop.name.toLowerCase().includes(destinationName.toLowerCase()))
    ).map(route => ({
        ...route,
        duration: '20-35 min',
        distance: '5-15 km',
        nextDeparture: `${Math.floor(Math.random() * 15) + 5} min`,
        occupancy: `${Math.floor(Math.random() * 60) + 20}%`
    }));
}

function findRoutesByDestination(destinationCoords) {
    return realRoutes.filter(route => {
        return route.stops.some(stop => 
            getDistance(destinationCoords, stop.coords) < 2
        );
    });
}

async function geocodeAddress(address) {
    try {
        const response = await fetch(
            `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`
        );
        const data = await response.json();
        
        if (data.length > 0) {
            return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
        }
        return null;
    } catch (error) {
        console.error('Erro na geocodificação:', error);
        return null;
    }
}

function findNearbyRoutes(originCoords, destinationCoords) {
    return realRoutes.filter(route => {
        // Verificar se as coordenadas estão próximas de qualquer parada da rota
        const originNearRoute = route.stops.some(stop => 
            getDistance(originCoords, stop.coords) < 1.5
        );
        
        const destinationNearRoute = route.stops.some(stop => 
            getDistance(destinationCoords, stop.coords) < 1.5
        );
        
        return originNearRoute || destinationNearRoute;
    });
}

// Cache para armazenar rotas já calculadas
const routeCache = new Map();

async function calculateRealRouteData(originCoords, destinationCoords, route) {
    let totalDistance = 0;
    let totalDuration = 0;
    
    try {
        if (route && route.stops && route.stops.length > 0) {
            // Se a rota tem dados base pré-calculados e estamos usando a rota completa
            const isFullRoute = 
                getDistance(originCoords, route.originCoords) < 0.8 && 
                getDistance(destinationCoords, route.destinationCoords) < 0.8;
            
            if (isFullRoute && route.baseDistance && route.baseDuration) {
                // Usar dados reais pré-calculados para a rota completa
                return {
                    duration: `${route.baseDuration} min`,
                    distance: `${route.baseDistance} km`,
                    nextDeparture: `${Math.floor(Math.random() * 15) + 5} min`,
                    occupancy: `${Math.floor(Math.random() * 60) + 20}%`,
                    realDistance: route.baseDistance,
                    realDuration: route.baseDuration
                };
            }
            
            // Forçar uso de dados base para rotas específicas conhecidas
            const isKnownRoute = route.baseDistance && route.baseDuration && (
                (route.origin === 'UFFS' && route.destination === 'Unochapecó') ||
                (route.origin === 'Unochapecó' && route.destination === 'UFFS') ||
                (route.origin === 'Terminal Central')
            );
            
            if (isKnownRoute) {
                return {
                    duration: `${route.baseDuration} min`,
                    distance: `${route.baseDistance} km`,
                    nextDeparture: `${Math.floor(Math.random() * 15) + 5} min`,
                    occupancy: `${Math.floor(Math.random() * 60) + 20}%`,
                    realDistance: route.baseDistance,
                    realDuration: route.baseDuration
                };
            }
            
            // Encontrar a parada mais próxima da origem
            let originStopIndex = 0;
            let minOriginDistance = Infinity;
            route.stops.forEach((stop, index) => {
                const dist = getDistance(originCoords, stop.coords);
                if (dist < minOriginDistance) {
                    minOriginDistance = dist;
                    originStopIndex = index;
                }
            });
            
            // Encontrar a parada mais próxima do destino
            let destStopIndex = route.stops.length - 1;
            let minDestDistance = Infinity;
            route.stops.forEach((stop, index) => {
                const dist = getDistance(destinationCoords, stop.coords);
                if (dist < minDestDistance) {
                    minDestDistance = dist;
                    destStopIndex = index;
                }
            });
            
            // Garantir que o destino está depois da origem
            if (destStopIndex <= originStopIndex) {
                destStopIndex = route.stops.length - 1;
            }
            
            // Se temos dados base, calcular proporcionalmente
            if (route.baseDistance && route.baseDuration) {
                const totalStops = route.stops.length;
                const usedStops = destStopIndex - originStopIndex + 1;
                const proportion = Math.max(0.3, usedStops / totalStops); // Mínimo 30% da rota
                
                // Calcular distância e tempo proporcionais
                totalDistance = route.baseDistance * proportion;
                totalDuration = Math.round(route.baseDuration * proportion);
                
                // Não adicionar distâncias de acesso se forem muito pequenas (menos de 0.5km)
                const accessDistance = minOriginDistance + minDestDistance;
                if (accessDistance > 0.5) {
                    totalDistance += accessDistance;
                    totalDuration += Math.round(accessDistance / 20 * 60);
                }
                
                // Garantir distância mínima realista
                totalDistance = Math.max(totalDistance, 2.0);
                totalDuration = Math.max(totalDuration, 8);
            } else {
                // Calcular rota real através das paradas usando OSRM
                const waypoints = [
                    originCoords,
                    ...route.stops.slice(originStopIndex, destStopIndex + 1).map(s => s.coords),
                    destinationCoords
                ];
                
                // Criar chave de cache
                const cacheKey = waypoints.map(w => `${w[0]},${w[1]}`).join('|');
                
                // Verificar cache
                if (routeCache.has(cacheKey)) {
                    const cached = routeCache.get(cacheKey);
                    totalDistance = cached.distance;
                    totalDuration = cached.duration;
                } else {
                    // Calcular rota real usando OSRM
                    const osrmData = await calculateOSRMRoute(waypoints);
                    if (osrmData) {
                        totalDistance = osrmData.distance / 1000; // Converter para km
                        totalDuration = Math.round(osrmData.duration / 60); // Converter para minutos
                        
                        // Adicionar tempo de paradas (30 segundos por parada)
                        const numStops = destStopIndex - originStopIndex;
                        totalDuration += Math.round(numStops * 0.5);
                        
                        // Armazenar no cache
                        routeCache.set(cacheKey, { distance: totalDistance, duration: totalDuration });
                    } else {
                        // Fallback para cálculo estimado se OSRM falhar
                        totalDistance = calculateEstimatedDistance(waypoints);
                        totalDuration = Math.round((totalDistance / 18) * 60); // 18 km/h média com paradas
                    }
                }
            }
        } else {
            // Calcular rota direta
            const osrmData = await calculateOSRMRoute([originCoords, destinationCoords]);
            if (osrmData) {
                totalDistance = osrmData.distance / 1000;
                totalDuration = Math.round(osrmData.duration / 60);
            } else {
                totalDistance = getDistance(originCoords, destinationCoords) * 1.3;
                totalDuration = Math.round((totalDistance / 25) * 60);
            }
        }
        
    } catch (error) {
        console.error('Erro ao calcular rota:', error);
        // Fallback para cálculo estimado
        totalDistance = getDistance(originCoords, destinationCoords) * 1.3;
        totalDuration = Math.round((totalDistance / 20) * 60);
    }
    
    // Simular dados dinâmicos
    const occupancy = Math.floor(Math.random() * 60) + 20; // 20-80%
    const nextDeparture = Math.floor(Math.random() * 20) + 5; // 5-25 min
    
    return {
        duration: `${totalDuration} min`,
        distance: `${totalDistance.toFixed(1)} km`,
        nextDeparture: `${nextDeparture} min`,
        occupancy: `${occupancy}%`,
        realDistance: totalDistance,
        realDuration: totalDuration
    };
}

// Função para calcular rota usando OSRM (Open Source Routing Machine)
async function calculateOSRMRoute(waypoints) {
    try {
        // Construir URL para OSRM
        const coords = waypoints.map(w => `${w[1]},${w[0]}`).join(';');
        const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
        
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Erro na resposta OSRM:', response.status);
            return null;
        }
        
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
            const route = data.routes[0];
            return {
                distance: route.distance, // em metros
                duration: route.duration, // em segundos
                geometry: route.geometry
            };
        }
        
        return null;
    } catch (error) {
        console.error('Erro ao acessar OSRM:', error);
        return null;
    }
}

// Função para calcular distância estimada através de múltiplos pontos
function calculateEstimatedDistance(waypoints) {
    let totalDistance = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
        totalDistance += getDistance(waypoints[i], waypoints[i + 1]);
    }
    return totalDistance * 1.3; // Adicionar 30% para considerar ruas
}

function getDistance(coords1, coords2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (coords2[0] - coords1[0]) * Math.PI / 180;
    const dLon = (coords2[1] - coords1[1]) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(coords1[0] * Math.PI / 180) * Math.cos(coords2[0] * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

// Armazenar layers da rota atual
let currentRouteLayer = null;
let currentStopMarkers = [];

async function showRouteOnMap(originCoords, destinationCoords, route) {
    // Limpar rotas e marcadores anteriores
    if (currentRouteLayer) {
        map.removeLayer(currentRouteLayer);
    }
    currentStopMarkers.forEach(marker => map.removeLayer(marker));
    currentStopMarkers = [];

    try {
        // Mostrar apenas origem e destino com linha simplificada
        
        // Marcador de origem
        const originMarker = L.marker(originCoords, {
            icon: L.divIcon({
                className: 'origin-marker',
                html: `<div style="background: #10b981; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="none"/>
                        <circle cx="12" cy="12" r="3" fill="currentColor"/>
                    </svg>
                </div>`,
                iconSize: [38, 38]
            })
        }).addTo(map);
        
        // Marcador de destino
        const destinationMarker = L.marker(destinationCoords, {
            icon: L.divIcon({
                className: 'destination-marker',
                html: `<div style="background: #ef4444; color: white; width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="currentColor"/>
                        <circle cx="12" cy="9" r="2.5" fill="white"/>
                    </svg>
                </div>`,
                iconSize: [38, 38]
            })
        }).addTo(map);
        
        // Linha do trajeto usando as paradas da rota para tornar mais realista
        const routePath = route.stops && route.stops.length > 0 
            ? [originCoords, ...route.stops.map(stop => stop.coords), destinationCoords]
            : [originCoords, destinationCoords];
        
        // Desenhar linha do trajeto
        currentRouteLayer = L.polyline(routePath, {
            color: '#667eea',
            weight: 4,
            opacity: 0.7,
            smoothFactor: 2,
            dashArray: '10, 5'
        }).addTo(map);
        
        // Adicionar paradas principais (apenas algumas principais)
        if (route.stops && route.stops.length > 0) {
            route.stops.forEach((stop, index) => {
                // Mostrar apenas paradas importantes (primeira, meio e última)
                const isImportant = index === 0 || index === Math.floor(route.stops.length / 2) || index === route.stops.length - 1;
                
                if (isImportant) {
                    const stopMarker = L.marker(stop.coords, {
                        icon: L.divIcon({
                            className: 'stop-marker',
                            html: `<div style="background: #667eea; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.2);">
                                ${index + 1}
                            </div>`,
                            iconSize: [28, 28]
                        })
                    }).addTo(map);
                    
                    stopMarker.bindPopup(`<strong>${stop.name}</strong><br>Parada ${index + 1}`);
                    currentStopMarkers.push(stopMarker);
                }
            });
        }
        
        // Armazenar marcadores para limpeza posterior
        currentStopMarkers.push(originMarker, destinationMarker);
        
        // Centralizar mapa para mostrar toda a rota
        const bounds = L.latLngBounds(routePath);
        map.fitBounds(bounds, { padding: [20, 20] });
        
    } catch (error) {
        console.error('Erro ao mostrar rota no mapa:', error);
        
        // Fallback: mostrar linha simples entre origem e destino
        currentRouteLayer = L.polyline([originCoords, destinationCoords], {
            color: '#667eea',
            weight: 3,
            opacity: 0.6,
            dashArray: '5, 5'
        }).addTo(map);
        
        map.fitBounds([originCoords, destinationCoords], { padding: [50, 50] });
    }
}

// Nova função para alternar rastreamento
function toggleTracking(routeId) {
    const isTracking = activeTrackings.has(routeId);
    
    if (isTracking) {
        stopTracking(routeId);
    } else {
        startTracking(routeId);
    }
}

function startTracking(routeId) {
    const route = realRoutes.find(r => r.id === routeId);
    if (!route) {
        console.error('Rota não encontrada:', routeId);
        return;
    }
    
    // Verificar se já está sendo rastreada
    if (activeTrackings.has(routeId)) {
        console.log('Rota já está sendo rastreada:', route.number);
        return;
    }
    
    console.log('Iniciando rastreamento para rota:', route.number);
    
    // Mostrar seção de rastreamento
    const trackingSection = document.getElementById('trackingSection');
    trackingSection.style.display = 'block';
    
    // Garantir que o mapa existe antes de iniciar o rastreamento
    if (!map) {
        console.log('Mapa não existe, inicializando...');
        initializeMap();
    }
    
    // Aguardar um pouco para o DOM e mapa carregarem
    setTimeout(() => {
        // Forçar redimensionamento do mapa
        if (map) {
            console.log('Redimensionando mapa...');
            map.invalidateSize();
            
            // Centralizar no primeiro ponto da rota
            if (route.stops && route.stops.length > 0) {
                map.setView(route.stops[0].coords, 14);
                console.log('Mapa centralizado na primeira parada');
            }
            
            // Iniciar simulação de rastreamento
            simulateRealTimeTracking(route);
            
            // Atualizar botão para estado "rastreando"
            updateTrackingButton(routeId, true);
            
        } else {
            console.error('Mapa ainda não está disponível');
        }
    }, 1000);
    
    showToast(`Rastreando linha ${route.number}`, 'info');
    
    // Atualizar display de rastreamentos ativos
    updateActiveTrackingsDisplay();
    
    // Adicionar notificação
    addNotification(`Rastreamento iniciado para linha ${route.number}`, 'transport', {
        title: 'Rastreamento Ativo',
        route: route
    });
}

function stopTracking(routeId) {
    const trackingData = activeTrackings.get(routeId);
    if (!trackingData) {
        console.log('Rota não está sendo rastreada:', routeId);
        return;
    }
    
    const route = trackingData.route;
    console.log('Parando rastreamento para rota:', route.number);
    
    // Parar intervalo
    if (trackingData.interval) {
        clearInterval(trackingData.interval);
    }
    
    // Remover marcador do mapa
    if (trackingData.marker && map) {
        map.removeLayer(trackingData.marker);
    }
    
    // Remover dos rastreamentos ativos
    activeTrackings.delete(routeId);
    busMarkers.delete(routeId);
    
    // Atualizar botão para estado "parado"
    updateTrackingButton(routeId, false);
    
    // Se não há mais rastreamentos, esconder seção
    if (activeTrackings.size === 0) {
        document.getElementById('trackingSection').style.display = 'none';
    } else {
        // Atualizar para mostrar outro rastreamento ativo
        const firstActive = Array.from(activeTrackings.values())[0];
        updateTrackingDisplay(firstActive.route, firstActive.currentStop || 0);
    }
    
    showToast(`Rastreamento parado para linha ${route.number}`, 'info');
    
    // Atualizar display de rastreamentos ativos
    updateActiveTrackingsDisplay();
    
    // Adicionar notificação
    addNotification(`Rastreamento parado para linha ${route.number}`, 'transport', {
        title: 'Rastreamento Parado',
        route: route
    });
}

function updateTrackingButton(routeId, isTracking) {
    const button = document.getElementById(`track-btn-${routeId}`);
    if (!button) return;
    
    const textSpan = button.querySelector('.track-text');
    const iconSpan = button.querySelector('.track-icon');
    
    if (isTracking) {
        button.classList.add('tracking-active');
        textSpan.textContent = 'Parar';
        iconSpan.textContent = '⏹️';
        button.style.background = '#ef4444';
        button.style.color = 'white';
    } else {
        button.classList.remove('tracking-active');
        textSpan.textContent = 'Rastrear';
        iconSpan.textContent = '📍';
        button.style.background = '';
        button.style.color = '';
    }
}

function updateTrackingDisplay(route, currentStopIndex) {
    const stops = route.stops;
    if (!stops || stops.length === 0) return;
    
    document.getElementById('trackingLine').textContent = `${route.number} - ${route.name}`;
    
    const nextStopIndex = (currentStopIndex + 1) % stops.length;
    document.getElementById('trackingNextStop').textContent = stops[nextStopIndex].name;
    
    // Calcular ETA estimado
    const distance = getDistance(stops[currentStopIndex].coords, stops[nextStopIndex].coords);
    const timeToNext = Math.round((distance / 25) * 60); // 25 km/h média
    const baseETA = Math.max(1, timeToNext + Math.floor(Math.random() * 2));
    
    document.getElementById('trackingETA').textContent = `${baseETA} min`;
    document.getElementById('trackingSpeed').textContent = `${20 + Math.floor(Math.random() * 15)} km/h`;
}

function simulateRealTimeTracking(route) {
    let currentStopIndex = 0;
    const stops = route.stops;
    let isMoving = false;
    let busSpeed = 25; // km/h base
    
    console.log('Iniciando rastreamento para rota:', route.number);
    
    // Verificar se o mapa está disponível
    if (!map) {
        console.error('Mapa não inicializado');
        return;
    }
    
    // Remover marcador anterior desta rota se existir
    const existingMarker = busMarkers.get(route.id);
    if (existingMarker && map) {
        map.removeLayer(existingMarker);
    }
    
    // Criar marcador do ônibus específico para esta rota
    const routeColor = getRouteColor(route.id);
    const busMarker = L.marker(stops[0].coords, {
        icon: L.divIcon({
            className: 'bus-marker-real',
            html: `<div class="bus-icon" style="background: ${routeColor}; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                ${route.number}
            </div>`,
            iconSize: [42, 42]
        })
    }).addTo(map);
    
    // Armazenar marcador
    busMarkers.set(route.id, busMarker);
    
    console.log('Marcador do ônibus criado para rota:', route.number);
    
    // Definir funções auxiliares primeiro
    function getRandomInterval() {
        return 3000 + Math.floor(Math.random() * 4000); // 3-7 segundos para demo
    }
    
    function getTrafficConditions() {
        const hour = new Date().getHours();
        const random = Math.random();
        
        if (hour >= 7 && hour <= 9 || hour >= 17 && hour <= 19) {
            return {
                speed: 15 + Math.floor(random * 10),
                status: random < 0.3 ? '(lento)' : random < 0.7 ? '(normal)' : '(rápido)',
                delay: random < 0.2
            };
        } else {
            return {
                speed: 20 + Math.floor(random * 15),
                status: random < 0.1 ? '(lento)' : random < 0.8 ? '(normal)' : '(rápido)',
                delay: random < 0.05
            };
        }
    }
    
    function updateTrackingInfo(route, currentIndex, stops, conditions = null) {
        document.getElementById('trackingLine').textContent = `${route.number} - ${route.name}`;
        
        const nextStopIndex = (currentIndex + 1) % stops.length;
        document.getElementById('trackingNextStop').textContent = stops[nextStopIndex].name;
        
        const distance = getDistance(stops[currentIndex].coords, stops[nextStopIndex].coords);
        const timeToNext = Math.round((distance / busSpeed) * 60);
        const baseETA = Math.max(1, timeToNext + Math.floor(Math.random() * 2));
        
        document.getElementById('trackingETA').textContent = `${baseETA} min`;
        
        const displaySpeed = conditions ? 
            `${conditions.speed} km/h ${conditions.status}` : 
            `${busSpeed} km/h`;
        document.getElementById('trackingSpeed').textContent = displaySpeed;
    }
    
    function sendContextualNotifications(route, stopIndex, stops, conditions) {
        const currentStop = stops[stopIndex];
        const nextStop = stops[(stopIndex + 1) % stops.length];
        
        if (currentStop.name.includes('UFFS') || 
            currentStop.name.includes('Hospital') || 
            currentStop.name.includes('Shopping') ||
            currentStop.name.includes('Terminal')) {
            addNotification(`Chegou: ${currentStop.name}`, 'transport', {
                title: `Ônibus ${route.number}`,
                route: route
            });
        }
        
        if (conditions && conditions.delay) {
            addNotification(`Pequeno atraso devido ao trânsito`, 'transport', {
                title: `Ônibus ${route.number}`,
                route: route
            });
        }
        
        if (Math.random() < 0.2) {
            const occupancy = ['baixa', 'média', 'alta'][Math.floor(Math.random() * 3)];
            addNotification(`Lotação ${occupancy}`, 'transport', {
                title: `Ônibus ${route.number}`,
                route: route
            });
        }
    }
    
    function moveToNextStop() {
        currentStopIndex = (currentStopIndex + 1) % stops.length;
        const currentStop = stops[currentStopIndex];
        
        console.log(`Movendo para parada ${currentStopIndex}: ${currentStop.name}`);
        
        const conditions = getTrafficConditions();
        busSpeed = conditions.speed;
        
        // Mover ônibus com animação
        busMarker.setLatLng(currentStop.coords);
        
        // Centralizar mapa na nova posição
        map.panTo(currentStop.coords);
        
        updateTrackingInfo(route, currentStopIndex, stops, conditions);
        sendContextualNotifications(route, currentStopIndex, stops, conditions);
        
        if (currentStop.name.includes('Terminal')) {
            setTimeout(() => {
                addNotification(`Parada no terminal - 30 segundos`, 'transport', {
                    title: `Ônibus ${route.number}`,
                    route: route
                });
            }, 1000);
        }
        
        if (currentStopIndex === 0 && route.name.includes('Circular')) {
            addNotification(`Circuito completo`, 'transport', {
                title: `Ônibus ${route.number}`,
                route: route
            });
        }
    }
    
    // Atualizar informações iniciais
    updateTrackingDisplay(route, currentStopIndex);
    
    // Iniciar simulação
    const interval = setInterval(moveToNextStop, getRandomInterval());
    
    // Armazenar dados do rastreamento
    activeTrackings.set(route.id, {
        route: route,
        interval: interval,
        marker: busMarker,
        currentStop: currentStopIndex
    });
    
    console.log('Rastreamento ativo iniciado para rota:', route.number);
}

// Função para obter cor única para cada rota
function getRouteColor(routeId) {
    const colors = [
        '#0071e3', '#ef4444', '#10b981', '#f59e0b', 
        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316',
        '#ec4899', '#6366f1', '#14b8a6', '#eab308'
    ];
    
    const index = parseInt(routeId) % colors.length;
    return colors[index];
}

// Função para parar todos os rastreamentos
function stopAllTracking() {
    console.log('Parando todos os rastreamentos...');
    
    // Parar todos os rastreamentos ativos
    const activeRoutes = Array.from(activeTrackings.keys());
    activeRoutes.forEach(routeId => {
        stopTracking(routeId);
    });
    
    // Limpar dados
    activeTrackings.clear();
    busMarkers.clear();
    
    // Esconder seção de rastreamento
    document.getElementById('trackingSection').style.display = 'none';
    
    // Atualizar display de rastreamentos ativos
    updateActiveTrackingsDisplay();
    
    showToast('Todos os rastreamentos foram parados', 'info');
}

// Atualizar função closeTracking para usar novo sistema
function closeTracking() {
    stopAllTracking();
}

// Atualizar display de rastreamentos ativos
function updateActiveTrackingsDisplay() {
    const activeTrackingsElement = document.getElementById('activeTrackings');
    const activeCountElement = document.getElementById('activeCount');
    const activeRoutesListElement = document.getElementById('activeRoutesList');
    
    if (!activeTrackingsElement || !activeCountElement || !activeRoutesListElement) {
        console.log('Elementos de rastreamentos ativos não encontrados');
        return;
    }
    
    const activeCount = activeTrackings.size;
    
    // Atualizar contador
    activeCountElement.textContent = activeCount;
    
    if (activeCount === 0) {
        // Esconder painel de rastreamentos ativos
        activeTrackingsElement.style.display = 'none';
        return;
    }
    
    // Mostrar painel de rastreamentos ativos
    activeTrackingsElement.style.display = 'block';
    
    // Gerar lista de rotas ativas
    const activeRoutesList = Array.from(activeTrackings.entries()).map(([routeId, trackingData]) => {
        const route = trackingData.route;
        const currentStop = trackingData.currentStop || 0;
        const stops = route.stops || [];
        const nextStopName = stops[currentStop] ? stops[currentStop].name : 'Desconhecida';
        const routeColor = getRouteColor(routeId);
        
        return `
            <div class="active-route-item" data-route-id="${routeId}">
                <div class="route-indicator" style="background: ${routeColor};">
                    ${route.number}
                </div>
                <div class="route-details">
                    <div class="route-name">${route.name}</div>
                    <div class="route-status">Próxima: ${nextStopName}</div>
                </div>
                <div class="route-actions">
                    <button class="btn-route-select" onclick="focusOnRoute('${routeId}')" title="Focar no mapa">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="btn-route-stop" onclick="stopTracking('${routeId}')" title="Parar rastreamento">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <rect x="6" y="6" width="12" height="12" stroke="currentColor" stroke-width="2" fill="currentColor"/>
                        </svg>
                    </button>
                </div>
            </div>
        `;
    }).join('');
    
    activeRoutesListElement.innerHTML = activeRoutesList;
}

// Focar no mapa em uma rota específica
function focusOnRoute(routeId) {
    const trackingData = activeTrackings.get(routeId);
    if (!trackingData || !map) {
        console.log('Dados de rastreamento ou mapa não encontrados para rota:', routeId);
        return;
    }
    
    const route = trackingData.route;
    const marker = trackingData.marker;
    
    if (marker) {
        // Centralizar mapa no marcador do ônibus
        const position = marker.getLatLng();
        map.setView([position.lat, position.lng], 16);
        
        // Abrir popup com informações
        marker.bindPopup(`
            <div style="text-align: center;">
                <strong>Linha ${route.number}</strong><br>
                ${route.name}<br>
                <small>Clique no ônibus para mais detalhes</small>
            </div>
        `).openPopup();
        
        // Atualizar painel de informações
        updateTrackingDisplay(route, trackingData.currentStop || 0);
        
        showToast(`Focado na linha ${route.number}`, 'info');
    }
}

// Manter funções originais necessárias
function loadBalance() {
    userBalance = parseFloat(localStorage.getItem('userBalance')) || 0;
    updateBalanceDisplay();
}

function updateBalanceDisplay() {
    const balanceElement = document.getElementById('balanceAmount');
    if (balanceElement) {
        balanceElement.textContent = userBalance.toFixed(2).replace('.', ',');
    }
}

function loadTransactions() {
    const transactionsList = document.getElementById('transactionsList');
    if (transactionsList) {
        if (transactions.length === 0) {
            transactionsList.innerHTML = '<p class="no-transactions">Nenhuma transação realizada</p>';
        } else {
            transactionsList.innerHTML = transactions.slice(-5).reverse().map(t => `
                <div class="transaction-item">
                    <div class="transaction-info">
                        <div class="transaction-desc">${t.description}</div>
                        <div class="transaction-date">${new Date(t.date).toLocaleString('pt-BR')}</div>
                    </div>
                    <div class="transaction-amount ${t.type}">
                        ${t.type === 'credit' ? '+' : '-'} R$ ${t.amount.toFixed(2).replace('.', ',')}
                    </div>
                </div>
            `).join('');
        }
    }
}

function setupNotifications() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
    }
}

function updateRoutesWithRealData() {
    // Atualizar dados das rotas periodicamente
    setInterval(() => {
        realRoutes.forEach(route => {
            route.nextDeparture = Math.floor(Math.random() * 20) + 5 + ' min';
            route.occupancy = Math.floor(Math.random() * 60) + 20 + '%';
        });
    }, 30000); // A cada 30 segundos
}

function displayRoutes(routes) {
    const routesList = document.getElementById('routesList');
    
    if (routes.length === 0) {
        displayNoRoutesFound();
        return;
    }
    
    routesList.innerHTML = routes.map(route => `
        <div class="route-card" data-route-id="${route.id}">
            <div class="route-header">
                <div>
                    <div class="route-number">${route.number}</div>
                    <div class="route-name">${route.name}</div>
                </div>
                <button class="btn-favorite ${favoriteRoutes.some(r => (typeof r === 'object' ? r.id : r) === route.id) ? 'active' : ''}" onclick="toggleFavorite('${route.id}')">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                </button>
            </div>
            <div class="route-info">
                <div class="info-item">
                    <span class="info-label">Duração</span>
                    <span class="info-value">${route.duration}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Distância</span>
                    <span class="info-value">${route.distance}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Próxima saída</span>
                    <span class="info-value">${route.nextDeparture}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Lotação</span>
                    <span class="info-value">${route.occupancy}</span>
                </div>
            </div>
            <div class="route-actions">
                <button class="btn-select-route" onclick="selectRoute('${route.id}')">Selecionar Rota</button>
                <button class="btn-track" onclick="toggleTracking('${route.id}')" data-route-id="${route.id}" id="track-btn-${route.id}">
                    <span class="track-text">Rastrear</span>
                    <span class="track-icon">📍</span>
                </button>
            </div>
        </div>
    `).join('');
}

function displayNoRoutesFound() {
    const routesList = document.getElementById('routesList');
    routesList.innerHTML = `
        <div class="empty-state">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 9m0 8V9m0 0L9 7" stroke="#9ca3af" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <p>Nenhuma rota encontrada para este trajeto</p>
            <small>Tente buscar por um destino diferente em Chapecó</small>
        </div>
    `;
}

// Manter outras funções necessárias do arquivo original
function swapLocations() {
    const origin = document.getElementById('origin');
    const destination = document.getElementById('destination');
    const temp = origin.value;
    origin.value = destination.value;
    destination.value = temp;
    
    // Recalcular rotas automaticamente após trocar
    if (destination.value.trim()) {
        searchRoutes();
    }
}

function toggleFavorite(routeId) {
    // Verificar se é array de objetos ou IDs
    const isObjectArray = favoriteRoutes.length > 0 && typeof favoriteRoutes[0] === 'object';
    
    let index = -1;
    if (isObjectArray) {
        index = favoriteRoutes.findIndex(r => r.id === routeId || r.routeId === routeId);
    } else {
        index = favoriteRoutes.indexOf(routeId);
    }
    
    if (index > -1) {
        favoriteRoutes.splice(index, 1);
        showToast('Rota removida dos favoritos', 'info');
    } else {
        const route = realRoutes.find(r => r.id === routeId);
        if (route) {
            // Adicionar como objeto com metadados
            favoriteRoutes.push({
                id: route.id,
                routeId: route.id,
                number: route.number,
                name: route.name,
                origin: route.origin,
                destination: route.destination,
                addedAt: new Date().toISOString()
            });
        } else {
            // Fallback: adicionar apenas ID
            favoriteRoutes.push(routeId);
        }
        showToast('Rota adicionada aos favoritos', 'success');
    }
    
    localStorage.setItem('favoriteRoutes', JSON.stringify(favoriteRoutes));
    
    const btn = document.querySelector(`[data-route-id="${routeId}"] .btn-favorite`);
    if (btn) {
        btn.classList.toggle('active');
    }
}

function selectRoute(routeId) {
    const route = realRoutes.find(r => r.id === routeId);
    if (!route) return;
    
    selectedRoute = route;
    localStorage.setItem('selectedRoute', JSON.stringify(route));
    
    document.querySelectorAll('.route-card').forEach(card => {
        card.classList.remove('selected');
    });
    document.querySelector(`[data-route-id="${routeId}"]`).classList.add('selected');
    
    // Calcular preço baseado na rota (rotas especiais como aeroporto custam mais)
    const routePrice = route.price ? parseFloat(route.price.replace('R$ ', '').replace(',', '.')) : 4.50;
    
    if (userBalance >= routePrice) {
        userBalance -= routePrice;
        localStorage.setItem('userBalance', userBalance.toString());
        
        // Usar sistema financeiro se disponível
        if (window.financialControl) {
            const originInput = document.getElementById('origin')?.value || 'Local atual';
            const destinationInput = document.getElementById('destination')?.value || route.destination;
            
            financialControl.addTransaction(
                'debit',
                'trip',
                routePrice,
                `Passagem - Linha ${route.number} (${originInput} → ${destinationInput})`,
                {
                    routeId: route.id,
                    routeName: route.name,
                    origin: originInput,
                    destination: destinationInput,
                    estimatedDuration: route.duration || '20 min',
                    estimatedDistance: route.distance || '5 km'
                }
            );
        } else {
            // Fallback para sistema antigo
            const transaction = {
                id: Date.now(),
                description: `Passagem - Linha ${route.number}`,
                amount: routePrice,
                type: 'debit',
                date: new Date().toISOString()
            };
            transactions.push(transaction);
            localStorage.setItem('transactions', JSON.stringify(transactions));
        }
        
        updateBalanceDisplay();
        loadTransactions();
        
        showToast(`Rota ${route.number} selecionada! Passagem de ${route.price} debitada.`, 'success');
        
        // Simular notificação de chegada
        setTimeout(() => {
            addNotification(`Ônibus ${route.number} chegando em 2 minutos!`, 'transport');
        }, 3000);
        
        // Adicionar notificação de viagem iniciada
        setTimeout(() => {
            addNotification(`Viagem iniciada na linha ${route.number}. Tenha uma boa viagem!`, 'transport');
        }, 5000);
        
        // Registrar viagem em recentTrips
        const originInput = document.getElementById('origin')?.value || 'Local atual';
        const destinationInput = document.getElementById('destination')?.value || route.destination;
        const recentTrips = JSON.parse(localStorage.getItem('recentTrips') || '[]');
        recentTrips.unshift({
            routeId: route.id,
            routeNumber: route.number,
            routeName: route.name,
            origin: originInput,
            destination: destinationInput,
            price: routePrice,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString()
        });
        // Manter apenas as últimas 50 viagens
        if (recentTrips.length > 50) {
            recentTrips.pop();
        }
        localStorage.setItem('recentTrips', JSON.stringify(recentTrips));
        
    } else {
        showToast('Saldo insuficiente! Adicione créditos ao seu cartão.', 'error');
        openAddCreditModal();
    }
}

function closeTracking() {
    document.getElementById('trackingSection').style.display = 'none';
    clearInterval(trackingInterval);
    if (busMarker) {
        map.removeLayer(busMarker);
    }
}

function addNotification(message, type, options = {}) {
    // Filtrar notificações apenas para rotas que estão sendo rastreadas
    if (options.route && type === 'transport') {
        const routeId = options.route.id;
        // Só mostrar notificação se a rota estiver sendo rastreada
        if (!activeTrackings.has(routeId)) {
            console.log('Notificação ignorada - rota não está sendo rastreada:', routeId);
            return;
        }
    }
    
    // Usar novo sistema de notificações se disponível
    if (window.notificationSystem) {
        const title = options.title || 'Busway';
        return notificationSystem.addNotification(title, message, type, options);
    }
    
    // Fallback para sistema antigo
    const notification = {
        id: Date.now(),
        message,
        type,
        time: new Date(),
        read: false
    };
    
    notifications.unshift(notification);
    updateNotificationsDisplay();
    
    if (Notification.permission === 'granted') {
        new Notification('Busway', {
            body: message,
            icon: '/favicon.ico'
        });
    }
    
    showToast(message, 'info');
    return notification;
}

function updateNotificationsDisplay() {
    const badge = document.getElementById('notificationBadge');
    const unreadCount = notifications.filter(n => !n.read).length;
    
    if (unreadCount > 0) {
        badge.style.display = 'block';
        badge.textContent = unreadCount;
    } else {
        badge.style.display = 'none';
    }
    
    const notificationsList = document.getElementById('notificationsList');
    if (notifications.length === 0) {
        notificationsList.innerHTML = '<p class="no-notifications">Nenhuma notificação</p>';
    } else {
        notificationsList.innerHTML = notifications.slice(0, 10).map(n => `
            <div class="notification-item ${!n.read ? 'unread' : ''}" onclick="markAsRead(${n.id})">
                <div>${n.message}</div>
                <div class="notification-time">${formatTime(n.time)}</div>
            </div>
        `).join('');
    }
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

function markAsRead(notificationId) {
    const notification = notifications.find(n => n.id === notificationId);
    if (notification) {
        notification.read = true;
        updateNotificationsDisplay();
    }
}

function formatTime(date) {
    const now = new Date();
    const diff = Math.floor((now - new Date(date)) / 1000);
    
    if (diff < 60) return 'Agora';
    if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return new Date(date).toLocaleDateString('pt-BR');
}

function openAddCreditModal() {
    document.getElementById('addCreditModal').style.display = 'flex';
}

function closeAddCreditModal() {
    document.getElementById('addCreditModal').style.display = 'none';
}

function addCredit() {
    const amount = parseFloat(document.getElementById('creditAmount').value);
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
    
    if (!amount || amount < 5) {
        showToast('Valor mínimo: R$ 5,00', 'error');
        return;
    }
    
    userBalance += amount;
    localStorage.setItem('userBalance', userBalance.toString());
    
    // Usar sistema financeiro se disponível
    if (window.financialControl) {
        financialControl.addTransaction(
            'credit',
            'recharge',
            amount,
            `Recarga via ${paymentMethod.toUpperCase()}`,
            {
                method: paymentMethod,
                location: 'app'
            }
        );
    } else {
        // Fallback para sistema antigo
        const transaction = {
            id: Date.now(),
            description: `Recarga via ${paymentMethod.toUpperCase()}`,
            amount: amount,
            type: 'credit',
            date: new Date().toISOString()
        };
        transactions.push(transaction);
        localStorage.setItem('transactions', JSON.stringify(transactions));
    }
    
    updateBalanceDisplay();
    loadTransactions();
    closeAddCreditModal();
    
    showToast(`Crédito de R$ ${amount.toFixed(2).replace('.', ',')} adicionado!`, 'success');
    
    // Verificar se há recarga automática configurada
    const autoRecharge = localStorage.getItem('autoRecharge');
    if (autoRecharge) {
        const config = JSON.parse(autoRecharge);
        if (config.enabled && userBalance < config.threshold) {
            setTimeout(() => {
                addNotification('Recarga automática pode ser ativada para evitar saldo baixo', 'info');
            }, 2000);
        }
    }
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('notificationToast');
    if (!toast) {
        console.error('Toast element not found');
        return;
    }
    
    // Adicionar ícone baseado no tipo
    const icons = {
        info: '📢',
        success: '✅',
        error: '❌',
        transport: '🚌'
    };
    
    const icon = icons[type] || '📢';
    toast.innerHTML = `<span class="toast-icon">${icon}</span><span class="toast-message">${message}</span>`;
    toast.className = `notification-toast ${type} show`;
    
    // Garantir que o toast seja visível
    toast.style.display = 'flex';
    toast.style.position = 'fixed';
    toast.style.bottom = '20px';
    toast.style.right = '20px';
    toast.style.zIndex = '10000';
    toast.style.minWidth = '300px';
    toast.style.maxWidth = '400px';
    
    // Animar entrada
    setTimeout(() => {
        toast.classList.add('toast-visible');
    }, 100);
    
    // Remover após tempo maior
    setTimeout(() => {
        toast.classList.remove('toast-visible', 'show');
        setTimeout(() => {
            toast.style.display = 'none';
        }, 300);
    }, 4000);
}