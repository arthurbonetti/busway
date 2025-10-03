// Teste para verificar o funcionamento do rastreamento
console.log('=== TESTE DE RASTREAMENTO ===');

// Verificar se as bibliotecas estão carregadas
if (typeof L === 'undefined') {
    console.error('❌ Leaflet não carregado');
} else {
    console.log('✅ Leaflet carregado');
}

// Verificar se existem rotas
if (typeof realRoutes === 'undefined') {
    console.error('❌ realRoutes não definido');
} else {
    console.log('✅ realRoutes carregado com', realRoutes.length, 'rotas');
}

// Verificar elementos do DOM
const elements = [
    'mapContainer',
    'trackingSection',
    'trackingLine',
    'trackingETA',
    'trackingNextStop',
    'trackingSpeed'
];

elements.forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        console.log(`✅ Elemento ${id} encontrado`);
    } else {
        console.error(`❌ Elemento ${id} não encontrado`);
    }
});

// Função de teste para rastreamento
function testTracking() {
    console.log('🚌 Testando rastreamento...');
    
    // Usar a primeira rota disponível
    if (realRoutes && realRoutes.length > 0) {
        const testRoute = realRoutes[0];
        console.log('Testando com rota:', testRoute.number, testRoute.name);
        
        // Simular clique no botão de rastrear
        setTimeout(() => {
            startTracking(testRoute.id);
        }, 2000);
    } else {
        console.error('❌ Nenhuma rota disponível para teste');
    }
}

// Executar teste após carregar página
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', testTracking);
} else {
    testTracking();
}

// Monitorar mudanças no mapa
let mapCheckInterval = setInterval(() => {
    if (window.map) {
        console.log('✅ Mapa global encontrado');
        clearInterval(mapCheckInterval);
    } else {
        console.log('⏳ Aguardando mapa...');
    }
}, 1000);

// Teste manual - exposição de função global
window.forceTestTracking = function() {
    console.log('🔧 Teste manual iniciado');
    
    if (realRoutes && realRoutes.length > 0) {
        startTracking(realRoutes[0].id);
    } else {
        console.error('Rotas não disponíveis');
    }
};

console.log('💡 Para teste manual, execute: forceTestTracking()');
console.log('=== FIM DO TESTE ===');