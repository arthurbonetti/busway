// firestore-service.js - VERSÃO V8 (compatível com seu código)


// ========== HELPER: Get Timestamp ==========
function getTimestamp() {
    return firebase.firestore.FieldValue.serverTimestamp();
}

// ========== USUÁRIOS ==========

/**
 * Busca dados de um usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>}
 */
async function getUserData(userId) {
    try {

        const doc = await db.collection('users').doc(userId).get();

        if (doc.exists) {
            return doc.data();
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

/**
 * Cria um novo usuário
 * @param {string} userId - ID do usuário
 * @param {Object} userData - Dados do usuário
 * @returns {Promise<Object>}
 */
async function createUser(userId, userData) {
    try {

        const defaultData = {
            balance: 0,
            isAdmin: false,
            createdAt: getTimestamp(),
            ...userData
        };

        await db.collection('users').doc(userId).set(defaultData);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza dados do usuário
 * @param {string} userId - ID do usuário
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<Object>}
 */
async function updateUserData(userId, updates) {
    try {

        await db.collection('users').doc(userId).update(updates);

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== SALDO ==========

/**
 * Busca saldo do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<number>}
 */
async function getUserBalance(userId) {
    console.log('[getUserBalance] Buscando saldo para userId:', userId);
    const userData = await getUserData(userId);
    const balance = userData?.balance || 0;
    console.log('[getUserBalance] Saldo encontrado:', balance, 'userData:', userData);
    return balance;
}

/**
 * Adiciona saldo (recarga)
 * @param {string} userId - ID do usuário
 * @param {number} amount - Valor a adicionar
 * @returns {Promise<Object>}
 */
async function rechargeBalance(userId, amount) {
    try {
        console.log('[rechargeBalance] Iniciando transação - UserID:', userId, 'Valor:', amount);

        // Validações
        if (!userId) {
            throw new Error('userId inválido');
        }

        if (!amount || isNaN(amount) || amount <= 0) {
            throw new Error('Valor inválido para recarga');
        }

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            console.log('[rechargeBalance] Documento do usuário existe?', userDoc.exists);

            let currentBalance = 0;

            if (!userDoc.exists) {
                console.log('[rechargeBalance] Criando novo documento de usuário');
                // Criar usuário automaticamente com saldo inicial já somado
                currentBalance = 0;
                const newBalance = currentBalance + amount;

                transaction.set(userRef, {
                    balance: newBalance,
                    isAdmin: false,
                    createdAt: getTimestamp()
                });

                console.log('[rechargeBalance] Documento criado com saldo:', newBalance);

            } else {
                currentBalance = userDoc.data().balance || 0;
                const newBalance = currentBalance + amount;

                console.log('[rechargeBalance] Saldo atual:', currentBalance, '→ Novo saldo:', newBalance);

                // Atualizar saldo
                transaction.update(userRef, { balance: newBalance });
            }

            const finalBalance = currentBalance + amount;

            // Registrar transação (COMPATÍVEL COM SEU CÓDIGO)
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                userId: userId,
                type: 'credit',        // ← Entrada de dinheiro
                category: 'recarga',   // ← Seu padrão atual
                amount: amount,
                balance_after: finalBalance,
                timestamp: getTimestamp(),
                status: 'completed',
                description: `Recarga de R$ ${amount.toFixed(2)}`
            });

            console.log('[rechargeBalance] Transação registrada - Saldo final:', finalBalance);

            return { oldBalance: currentBalance, newBalance: finalBalance };
        });

        console.log('[rechargeBalance] Transação Firestore concluída com sucesso:', result);
        return { success: true, ...result };

    } catch (error) {
        console.error('[rechargeBalance] Erro na transação:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Compra passagem (debita do saldo)
 * @param {string} userId - ID do usuário
 * @param {string} routeId - ID da rota
 * @param {number} price - Preço
 * @param {Object} routeInfo - Informações adicionais da rota (origin, destination, routeNumber)
 * @returns {Promise<Object>}
 */
async function purchaseTicket(userId, routeId, price, routeInfo = {}) {
    try {

        const result = await db.runTransaction(async (transaction) => {
            const userRef = db.collection('users').doc(userId);
            const userDoc = await transaction.get(userRef);

            if (!userDoc.exists) {
                throw new Error('Usuário não encontrado');
            }

            const currentBalance = userDoc.data().balance || 0;

            if (currentBalance < price) {
                throw new Error('Saldo insuficiente');
            }

            const newBalance = currentBalance - price;
            const ticketId = 'TICKET_' + Date.now();

            // Atualizar saldo
            transaction.update(userRef, { balance: newBalance });

            // Criar descrição com nome da rota
            let description = 'Passagem';
            if (routeInfo.origin && routeInfo.destination) {
                description = `${routeInfo.origin} → ${routeInfo.destination}`;
            } else if (routeInfo.routeNumber) {
                description = `Passagem - Linha ${routeInfo.routeNumber}`;
            } else {
                description = `Passagem - Rota ${routeId}`;
            }

            // Registrar transação (COMPATÍVEL COM SEU CÓDIGO)
            const transactionRef = db.collection('transactions').doc();
            transaction.set(transactionRef, {
                userId: userId,
                type: 'expense',       // ← Seu padrão atual
                category: 'transporte', // ← Seu padrão atual
                amount: price,
                balance_after: newBalance,
                timestamp: getTimestamp(),
                status: 'completed',
                ticketId: ticketId,
                routeId: routeId,
                description: description
            });

            return {
                oldBalance: currentBalance,
                newBalance: newBalance,
                ticketId: ticketId
            };
        });

        return { success: true, ...result };

    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== TRANSAÇÕES ==========

/**
 * Busca transações do usuário
 * @param {string} userId - ID do usuário
 * @param {number} limit - Quantidade máxima
 * @returns {Promise<Array>}
 */
async function getTransactions(userId, limit = 10) {
    try {
        console.log('[getTransactions] Buscando transações para userId:', userId, 'limit:', limit);

        const snapshot = await db.collection('transactions')
            .where('userId', '==', userId)
            .get();

        const transactions = [];
        snapshot.forEach(doc => {
            transactions.push({ id: doc.id, ...doc.data() });
        });

        console.log('[getTransactions] Transações encontradas:', transactions.length);

        // Ordenar no cliente para evitar necessidade de índice composto
        transactions.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return dateB - dateA;
        });

        // Aplicar limite após ordenação
        return transactions.slice(0, limit);
    } catch (error) {
        console.error('[getTransactions] Erro ao buscar transações:', error);
        return [];
    }
}

// ========== FAVORITOS ==========

/**
 * Adiciona rota aos favoritos
 * @param {string} userId - ID do usuário
 * @param {string} routeId - ID da rota
 * @returns {Promise<Object>}
 */
async function addFavorite(userId, routeId) {
    try {
        await db.collection('favorites').add({
            userId: userId,
            routeId: routeId,
            createdAt: getTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Busca favoritos do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Array>}
 */
async function getFavorites(userId) {
    try {
        const snapshot = await db.collection('favorites')
            .where('userId', '==', userId)
            .get();

        const favorites = [];
        snapshot.forEach(doc => {
            favorites.push({ id: doc.id, ...doc.data() });
        });

        return favorites;
    } catch (error) {
        return [];
    }
}

/**
 * Remove favorito
 * @param {string} favoriteId - ID do favorito
 * @returns {Promise<Object>}
 */
async function removeFavorite(favoriteId) {
    try {
        await db.collection('favorites').doc(favoriteId).delete();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== TEMPO REAL ==========

/**
 * Observa mudanças no saldo
 * @param {string} userId - ID do usuário
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchBalance(userId, callback) {
    console.log('[watchBalance] Iniciando observador para userId:', userId);
    return db.collection('users').doc(userId)
        .onSnapshot(doc => {
            if (doc.exists) {
                const balance = doc.data().balance || 0;
                console.log('[watchBalance] Saldo atualizado no Firestore:', balance);
                callback(balance);
            } else {
                console.log('[watchBalance] Documento do usuário não existe, retornando saldo 0');
                callback(0);
            }
        });
}

/**
 * Observa mudanças nas transações
 * @param {string} userId - ID do usuário
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchTransactions(userId, callback) {
    console.log('[watchTransactions] Iniciando observador para userId:', userId);
    return db.collection('transactions')
        .where('userId', '==', userId)
        .onSnapshot(snapshot => {
            const transactions = [];
            snapshot.forEach(doc => {
                transactions.push({ id: doc.id, ...doc.data() });
            });

            // Ordenar no cliente para evitar necessidade de índice composto
            transactions.sort((a, b) => {
                const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
                const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
                return dateB - dateA;
            });

            console.log('[watchTransactions] Transações atualizadas:', transactions.length);
            callback(transactions);
        });
}

// ========== VIAGENS (TRIPS) ==========

/**
 * Cria registro de viagem
 * @param {string} userId - ID do usuário
 * @param {Object} tripData - Dados da viagem
 * @returns {Promise<Object>}
 */
async function createTrip(userId, tripData) {
    try {

        const trip = {
            userId: userId,
            routeId: tripData.routeId,
            routeName: tripData.routeName,
            routeNumber: tripData.routeNumber,
            origin: tripData.origin,
            destination: tripData.destination,
            price: tripData.price,
            timestamp: getTimestamp(),
            status: 'completed',
            ...tripData
        };

        const tripRef = await db.collection('trips').add(trip);

        return { success: true, tripId: tripRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Busca histórico de viagens do usuário
 * @param {string} userId - ID do usuário
 * @param {number} limit - Quantidade máxima
 * @returns {Promise<Array>}
 */
async function getTripHistory(userId, limit = 20) {
    try {
        const snapshot = await db.collection('trips')
            .where('userId', '==', userId)
            .orderBy('timestamp', 'desc')
            .limit(limit)
            .get();

        const trips = [];
        snapshot.forEach(doc => {
            trips.push({ id: doc.id, ...doc.data() });
        });

        return trips;
    } catch (error) {
        return [];
    }
}

/**
 * Cancela uma viagem
 * @param {string} tripId - ID da viagem
 * @returns {Promise<Object>}
 */
async function cancelTrip(tripId) {
    try {
        await db.collection('trips').doc(tripId).update({
            status: 'cancelled',
            cancelledAt: getTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== PREFERÊNCIAS DO USUÁRIO ==========

/**
 * Busca preferências do usuário
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object|null>}
 */
async function getUserPreferences(userId) {
    try {
        const userData = await getUserData(userId);
        return userData?.preferences || null;
    } catch (error) {
        return null;
    }
}

/**
 * Atualiza preferências do usuário
 * @param {string} userId - ID do usuário
 * @param {Object} preferences - Preferências a atualizar
 * @returns {Promise<Object>}
 */
async function updateUserPreferences(userId, preferences) {
    try {

        await db.collection('users').doc(userId).update({
            preferences: preferences
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== NOTIFICAÇÕES ==========

/**
 * Cria uma notificação para o usuário
 * @param {string} userId - ID do usuário
 * @param {Object} notificationData - Dados da notificação
 * @returns {Promise<Object>}
 */
async function createNotification(userId, notificationData) {
    try {
        const notification = {
            userId: userId,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type || 'info',
            read: false,
            createdAt: getTimestamp(),
            ...notificationData
        };

        const notifRef = await db.collection('notifications').add(notification);
        return { success: true, notificationId: notifRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Busca notificações do usuário
 * @param {string} userId - ID do usuário
 * @param {boolean} unreadOnly - Apenas não lidas
 * @returns {Promise<Array>}
 */
async function getNotifications(userId, unreadOnly = false) {
    try {
        let query = db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');

        if (unreadOnly) {
            query = query.where('read', '==', false);
        }

        const snapshot = await query.limit(50).get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        return notifications;
    } catch (error) {
        return [];
    }
}

/**
 * Marca notificação como lida
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<Object>}
 */
async function markNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: getTimestamp()
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deleta uma notificação
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<Object>}
 */
async function deleteNotification(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).delete();
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Observa notificações em tempo real
 * @param {string} userId - ID do usuário
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchNotifications(userId, callback) {
    return db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            callback(notifications);
        });
}

// ========== FUNÇÕES ADMIN ==========

/**
 * Busca todos os usuários (apenas admin)
 * @param {number} limit - Quantidade máxima
 * @returns {Promise<Array>}
 */
async function getAllUsers(limit = 100) {
    try {
        const snapshot = await db.collection('users')
            .limit(limit)
            .get();

        const users = [];
        snapshot.forEach(doc => {
            users.push({ id: doc.id, ...doc.data() });
        });

        return users;
    } catch (error) {
        return [];
    }
}

/**
 * Busca estatísticas gerais (apenas admin)
 * @returns {Promise<Object>}
 */
async function getStatistics() {
    try {
        // Total de usuários
        const usersSnapshot = await db.collection('users').get();
        const totalUsers = usersSnapshot.size;

        // Contar admins e novos usuários hoje
        let totalAdmins = 0;
        let newUsersToday = 0;
        let activeUsers = 0;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = today.getTime();

        usersSnapshot.forEach(doc => {
            const data = doc.data();

            // Contar admins
            if (data.isAdmin === true) {
                totalAdmins++;
            }

            // Contar novos usuários de hoje
            if (data.createdAt) {
                const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
                if (createdDate.getTime() >= todayTimestamp) {
                    newUsersToday++;
                }
            }

            // Contar usuários ativos (com saldo > 0 ou viagens recentes)
            if ((data.balance && data.balance > 0) || data.lastActivity) {
                activeUsers++;
            }
        });

        // Total de rotas
        const routesSnapshot = await db.collection('routes').get();
        const totalRoutes = routesSnapshot.size;

        // Total de transações
        const transactionsSnapshot = await db.collection('transactions').get();
        const totalTransactions = transactionsSnapshot.size;

        // Total de viagens
        const tripsSnapshot = await db.collection('trips').get();
        const totalTrips = tripsSnapshot.size;

        // Calcular receita total
        let totalRevenue = 0;
        let totalExpenses = 0;

        transactionsSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.status === 'completed') {
                if (data.type === 'income') {
                    totalRevenue += data.amount || 0;
                } else if (data.type === 'expense') {
                    totalExpenses += data.amount || 0;
                }
            }
        });

        return {
            totalUsers,
            totalAdmins,
            newUsersToday,
            activeUsers,
            totalRoutes,
            totalTransactions,
            totalTrips,
            totalRevenue,
            totalExpenses,
            netRevenue: totalRevenue - totalExpenses
        };
    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        return {
            totalUsers: 0,
            totalAdmins: 0,
            newUsersToday: 0,
            activeUsers: 0,
            totalRoutes: 0,
            totalTransactions: 0,
            totalTrips: 0,
            totalRevenue: 0,
            totalExpenses: 0,
            netRevenue: 0
        };
    }
}

/**
 * Atualiza status de admin de um usuário
 * @param {string} userId - ID do usuário
 * @param {boolean} isAdmin - Novo status admin
 * @returns {Promise<Object>}
 */
async function updateAdminStatus(userId, isAdmin) {
    try {
        await db.collection('users').doc(userId).update({
            isAdmin: isAdmin
        });
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== ROTAS (ROUTES) ==========

/**
 * Busca todas as rotas ativas
 * @param {boolean} includeInactive - Incluir rotas inativas
 * @returns {Promise<Array>}
 */
async function getRoutes(includeInactive = false) {
    try {
        let query = db.collection('routes');

        if (!includeInactive) {
            query = query.where('active', '==', true);
        }

        const snapshot = await query.orderBy('number', 'asc').get();

        const routes = [];
        snapshot.forEach(doc => {
            const data = doc.data();

            // Converter path de volta para array de arrays (para compatibilidade com código legado)
            if (data.path && Array.isArray(data.path)) {
                data.path = data.path.map(coord => {
                    if (coord && typeof coord === 'object' && 'lat' in coord) {
                        return [coord.lat, coord.lon];
                    }
                    return coord;
                });
            }

            routes.push({ id: doc.id, ...data });
        });

        return routes;
    } catch (error) {
        return [];
    }
}

/**
 * Busca rota por ID
 * @param {string} routeId - ID da rota
 * @returns {Promise<Object|null>}
 */
async function getRouteById(routeId) {
    try {
        const doc = await db.collection('routes').doc(routeId).get();

        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Busca rotas entre origem e destino
 * @param {string} originName - Nome da origem
 * @param {string} destinationName - Nome do destino
 * @returns {Promise<Array>}
 */
async function searchRoutes(originName, destinationName) {
    try {
        const allRoutes = await getRoutes();

        const originLower = originName.toLowerCase();
        const destLower = destinationName.toLowerCase();

        // Buscar rotas que contenham origem e destino no nome ou paradas
        const filtered = allRoutes.filter(route => {
            const routeName = (route.name || '').toLowerCase();
            const origin = (route.origin?.name || '').toLowerCase();
            const destination = (route.destination?.name || '').toLowerCase();

            const hasOrigin = routeName.includes(originLower) ||
                            origin.includes(originLower);
            const hasDestination = routeName.includes(destLower) ||
                                  destination.includes(destLower);

            return hasOrigin && hasDestination;
        });

        return filtered;
    } catch (error) {
        return [];
    }
}

/**
 * Cria nova rota (ADMIN)
 * @param {Object} routeData - Dados da rota
 * @returns {Promise<Object>}
 */
async function createRoute(routeData) {
    try {
        // Converter path de array de arrays para array de objetos (Firestore não suporta nested arrays)
        let pathConverted = [];
        if (routeData.path && Array.isArray(routeData.path)) {
            pathConverted = routeData.path.map(coord => {
                // Se já é objeto {lat, lon}, manter
                if (coord && typeof coord === 'object' && 'lat' in coord) {
                    return { lat: coord.lat, lon: coord.lon };
                }
                // Se é array [lat, lon], converter para objeto
                if (Array.isArray(coord) && coord.length >= 2) {
                    return { lat: coord[0], lon: coord[1] };
                }
                return null;
            }).filter(c => c !== null);
        }

        const route = {
            number: routeData.number,
            name: routeData.name,
            origin: routeData.origin,
            destination: routeData.destination,
            stops: routeData.stops || [],
            price: routeData.price || 4.50,
            duration: routeData.duration || '',
            distance: routeData.distance || '',
            frequency: routeData.frequency || '',
            operatingHours: routeData.operatingHours || { start: '05:00', end: '23:00' },
            path: pathConverted,
            active: routeData.active !== false,
            featured: routeData.featured || false,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        };

        // Usar ID específico se fornecido, senão gerar automaticamente
        const routeId = routeData.id || db.collection('routes').doc().id;
        await db.collection('routes').doc(routeId).set(route);

        return { success: true, routeId: routeId };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza rota existente (ADMIN)
 * @param {string} routeId - ID da rota
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<Object>}
 */
async function updateRoute(routeId, updates) {
    try {
        await db.collection('routes').doc(routeId).update({
            ...updates,
            updatedAt: getTimestamp()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deleta/desativa rota (ADMIN)
 * @param {string} routeId - ID da rota
 * @param {boolean} hardDelete - Se true, deleta permanentemente
 * @returns {Promise<Object>}
 */
async function deleteRoute(routeId, hardDelete = false) {
    try {
        if (hardDelete) {
            await db.collection('routes').doc(routeId).delete();
        } else {
            await db.collection('routes').doc(routeId).update({
                active: false,
                updatedAt: getTimestamp()
            });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Observa mudanças nas rotas em tempo real
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchRoutes(callback) {
    return db.collection('routes')
        .where('active', '==', true)
        .orderBy('number', 'asc')
        .onSnapshot(snapshot => {
            const routes = [];
            snapshot.forEach(doc => {
                routes.push({ id: doc.id, ...doc.data() });
            });
            callback(routes);
        });
}

// ========== PARADAS (STOPS) ==========

/**
 * Busca todas as paradas
 * @param {boolean} includeInactive - Incluir paradas inativas
 * @returns {Promise<Array>}
 */
async function getStops(includeInactive = false) {
    try {
        let query = db.collection('stops');

        if (!includeInactive) {
            query = query.where('active', '==', true);
        }

        const snapshot = await query.orderBy('name', 'asc').get();

        const stops = [];
        snapshot.forEach(doc => {
            stops.push({ id: doc.id, ...doc.data() });
        });

        return stops;
    } catch (error) {
        return [];
    }
}

/**
 * Busca parada por ID
 * @param {string} stopId - ID da parada
 * @returns {Promise<Object|null>}
 */
async function getStopById(stopId) {
    try {
        const doc = await db.collection('stops').doc(stopId).get();

        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Busca paradas de uma rota específica
 * @param {string} routeNumber - Número da rota
 * @returns {Promise<Array>}
 */
async function getStopsByRoute(routeNumber) {
    try {
        const snapshot = await db.collection('stops')
            .where('routes', 'array-contains', routeNumber)
            .where('active', '==', true)
            .get();

        const stops = [];
        snapshot.forEach(doc => {
            stops.push({ id: doc.id, ...doc.data() });
        });

        return stops;
    } catch (error) {
        return [];
    }
}

/**
 * Busca paradas próximas a uma localização
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {number} radiusKm - Raio de busca em km (padrão 2km)
 * @returns {Promise<Array>}
 */
async function getNearbyStops(lat, lon, radiusKm = 2) {
    try {
        // Firestore não tem query geoespacial nativo, então buscamos todas e filtramos
        const allStops = await getStops();

        // Função auxiliar para calcular distância (Haversine)
        const getDistance = (lat1, lon1, lat2, lon2) => {
            const R = 6371; // Raio da Terra em km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                     Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                     Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            return R * c;
        };

        // Filtrar por distância
        const nearby = allStops.filter(stop => {
            if (!stop.location) return false;
            const distance = getDistance(lat, lon, stop.location.lat, stop.location.lon);
            stop.distance = distance; // Adicionar distância ao objeto
            return distance <= radiusKm;
        });

        // Ordenar por distância
        nearby.sort((a, b) => a.distance - b.distance);

        return nearby;
    } catch (error) {
        return [];
    }
}

/**
 * Cria nova parada (ADMIN)
 * @param {Object} stopData - Dados da parada
 * @returns {Promise<Object>}
 */
async function createStop(stopData) {
    try {
        const stop = {
            name: stopData.name,
            shortName: stopData.shortName || stopData.name,
            location: stopData.location,
            address: stopData.address || '',
            routes: stopData.routes || [],
            facilities: stopData.facilities || {
                covered: false,
                bench: false,
                accessibility: false,
                lighting: false
            },
            active: stopData.active !== false,
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        };

        const docRef = await db.collection('stops').add(stop);

        return { success: true, stopId: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza parada existente (ADMIN)
 * @param {string} stopId - ID da parada
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<Object>}
 */
async function updateStop(stopId, updates) {
    try {
        await db.collection('stops').doc(stopId).update({
            ...updates,
            updatedAt: getTimestamp()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deleta/desativa parada (ADMIN)
 * @param {string} stopId - ID da parada
 * @param {boolean} hardDelete - Se true, deleta permanentemente
 * @returns {Promise<Object>}
 */
async function deleteStop(stopId, hardDelete = false) {
    try {
        if (hardDelete) {
            await db.collection('stops').doc(stopId).delete();
        } else {
            await db.collection('stops').doc(stopId).update({
                active: false,
                updatedAt: getTimestamp()
            });
        }

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// ========== NOTIFICAÇÕES FIRESTORE (melhorado) ==========

/**
 * Cria notificação no Firestore
 * @param {string} userId - ID do usuário
 * @param {Object} notificationData - Dados da notificação
 * @returns {Promise<Object>}
 */
async function createFirestoreNotification(userId, notificationData) {
    try {
        const notification = {
            userId: userId,
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type || 'info',
            routeId: notificationData.routeId || null,
            stopId: notificationData.stopId || null,
            actionUrl: notificationData.actionUrl || null,
            read: false,
            readAt: null,
            priority: notificationData.priority || 'normal',
            persistent: notificationData.persistent || false,
            expiresAt: notificationData.expiresAt || null,
            createdAt: getTimestamp()
        };

        const docRef = await db.collection('notifications').add(notification);

        return { success: true, notificationId: docRef.id };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Busca notificações do usuário do Firestore
 * @param {string} userId - ID do usuário
 * @param {boolean} unreadOnly - Apenas não lidas
 * @param {number} limit - Limite de resultados
 * @returns {Promise<Array>}
 */
async function getFirestoreNotifications(userId, unreadOnly = false, limit = 50) {
    try {
        let query = db.collection('notifications')
            .where('userId', '==', userId)
            .orderBy('createdAt', 'desc');

        if (unreadOnly) {
            query = query.where('read', '==', false);
        }

        const snapshot = await query.limit(limit).get();

        const notifications = [];
        snapshot.forEach(doc => {
            notifications.push({ id: doc.id, ...doc.data() });
        });

        return notifications;
    } catch (error) {
        return [];
    }
}

/**
 * Marca notificação como lida no Firestore
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<Object>}
 */
async function markFirestoreNotificationAsRead(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).update({
            read: true,
            readAt: getTimestamp()
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Marca todas as notificações do usuário como lidas
 * @param {string} userId - ID do usuário
 * @returns {Promise<Object>}
 */
async function markAllNotificationsAsRead(userId) {
    try {
        const snapshot = await db.collection('notifications')
            .where('userId', '==', userId)
            .where('read', '==', false)
            .get();

        const batch = db.batch();
        snapshot.forEach(doc => {
            batch.update(doc.ref, {
                read: true,
                readAt: getTimestamp()
            });
        });

        await batch.commit();

        return { success: true, count: snapshot.size };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Deleta notificação do Firestore
 * @param {string} notificationId - ID da notificação
 * @returns {Promise<Object>}
 */
async function deleteFirestoreNotification(notificationId) {
    try {
        await db.collection('notifications').doc(notificationId).delete();

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Observa notificações do usuário em tempo real
 * @param {string} userId - ID do usuário
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchFirestoreNotifications(userId, callback) {
    return db.collection('notifications')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .onSnapshot(snapshot => {
            const notifications = [];
            snapshot.forEach(doc => {
                notifications.push({ id: doc.id, ...doc.data() });
            });
            callback(notifications);
        });
}

// ========== CONFIGURAÇÕES DO SISTEMA ==========

/**
 * Busca configuração do sistema
 * @param {string} configType - Tipo de configuração (pricing, features, messages)
 * @returns {Promise<Object|null>}
 */
async function getConfig(configType) {
    try {
        const doc = await db.collection('config').doc(configType).get();

        if (doc.exists) {
            return doc.data();
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Atualiza configuração do sistema (ADMIN)
 * @param {string} configType - Tipo de configuração
 * @param {Object} updates - Campos a atualizar
 * @returns {Promise<Object>}
 */
async function updateConfig(configType, updates) {
    try {
        await db.collection('config').doc(configType).set({
            ...updates,
            updatedAt: getTimestamp()
        }, { merge: true });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Observa configuração em tempo real
 * @param {string} configType - Tipo de configuração
 * @param {Function} callback - Função chamada quando muda
 * @returns {Function} Função para cancelar observer
 */
function watchConfig(configType, callback) {
    return db.collection('config').doc(configType)
        .onSnapshot(doc => {
            if (doc.exists) {
                callback(doc.data());
            }
        });
}

// ========== ESTATÍSTICAS AVANÇADAS (DASHBOARD ADMIN) ==========

/**
 * Busca rotas mais usadas (baseado em viagens)
 * @param {number} limit - Quantidade de rotas
 * @returns {Promise<Array>}
 */
async function getMostUsedRoutes(limit = 5) {
    try {
        // Buscar todas as viagens
        const tripsSnapshot = await db.collection('trips').get();

        // Contar viagens por rota
        const routeUsageMap = {};

        tripsSnapshot.forEach(doc => {
            const data = doc.data();
            const routeId = data.routeId;

            if (routeId) {
                if (!routeUsageMap[routeId]) {
                    routeUsageMap[routeId] = {
                        routeId: routeId,
                        routeNumber: data.routeNumber || 'N/A',
                        routeName: data.routeName || 'Sem nome',
                        count: 0,
                        revenue: 0
                    };
                }

                routeUsageMap[routeId].count++;
                routeUsageMap[routeId].revenue += (data.price || 0);
            }
        });

        // Converter para array e ordenar
        const routesArray = Object.values(routeUsageMap);
        routesArray.sort((a, b) => b.count - a.count);

        // Retornar top N rotas
        return routesArray.slice(0, limit);

    } catch (error) {
        console.error('Erro ao buscar rotas mais usadas:', error);
        return [];
    }
}

/**
 * Busca transações agrupadas por dia (para gráficos)
 * @param {number} days - Número de dias para trás
 * @returns {Promise<Object>}
 */
async function getTransactionsByDay(days = 7) {
    try {
        const now = new Date();
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        const snapshot = await db.collection('transactions')
            .where('timestamp', '>=', firebase.firestore.Timestamp.fromDate(startDate))
            .orderBy('timestamp', 'asc')
            .get();

        // Agrupar por dia
        const dailyData = {};

        // Inicializar todos os dias com 0
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
            dailyData[dateKey] = {
                date: dateKey,
                income: 0,
                expenses: 0,
                count: 0
            };
        }

        // Preencher com dados reais
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.timestamp.toDate();
            const dateKey = timestamp.toISOString().split('T')[0];

            if (dailyData[dateKey]) {
                dailyData[dateKey].count++;

                if (data.type === 'income') {
                    dailyData[dateKey].income += (data.amount || 0);
                } else if (data.type === 'expense') {
                    dailyData[dateKey].expenses += (data.amount || 0);
                }
            }
        });

        // Converter para array ordenado
        const result = Object.values(dailyData);
        result.sort((a, b) => a.date.localeCompare(b.date));

        return result;

    } catch (error) {
        console.error('Erro ao buscar transações por dia:', error);
        return [];
    }
}

/**
 * Busca crescimento de usuários por dia
 * @param {number} days - Número de dias para trás
 * @returns {Promise<Array>}
 */
async function getUserGrowthByDay(days = 30) {
    try {
        const now = new Date();
        const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));

        const snapshot = await db.collection('users')
            .where('createdAt', '>=', firebase.firestore.Timestamp.fromDate(startDate))
            .orderBy('createdAt', 'asc')
            .get();

        // Agrupar por dia
        const dailyGrowth = {};

        // Inicializar todos os dias
        for (let i = 0; i < days; i++) {
            const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
            const dateKey = date.toISOString().split('T')[0];
            dailyGrowth[dateKey] = {
                date: dateKey,
                newUsers: 0,
                newAdmins: 0
            };
        }

        // Preencher com dados reais
        snapshot.forEach(doc => {
            const data = doc.data();
            const timestamp = data.createdAt.toDate();
            const dateKey = timestamp.toISOString().split('T')[0];

            if (dailyGrowth[dateKey]) {
                dailyGrowth[dateKey].newUsers++;
                if (data.isAdmin) {
                    dailyGrowth[dateKey].newAdmins++;
                }
            }
        });

        // Converter para array
        const result = Object.values(dailyGrowth);
        result.sort((a, b) => a.date.localeCompare(b.date));

        return result;

    } catch (error) {
        console.error('Erro ao buscar crescimento de usuários:', error);
        return [];
    }
}

/**
 * Estatísticas financeiras detalhadas
 * @returns {Promise<Object>}
 */
async function getFinancialStats() {
    try {
        const snapshot = await db.collection('transactions').get();

        let totalIncome = 0;
        let totalExpenses = 0;
        let totalPending = 0;

        const incomeByCategory = {};
        const expensesByCategory = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const amount = data.amount || 0;
            const category = data.category || 'outros';

            if (data.status === 'completed') {
                if (data.type === 'income') {
                    totalIncome += amount;
                    incomeByCategory[category] = (incomeByCategory[category] || 0) + amount;
                } else if (data.type === 'expense') {
                    totalExpenses += amount;
                    expensesByCategory[category] = (expensesByCategory[category] || 0) + amount;
                }
            } else if (data.status === 'pending') {
                totalPending += amount;
            }
        });

        return {
            totalIncome,
            totalExpenses,
            netRevenue: totalIncome - totalExpenses,
            totalPending,
            incomeByCategory,
            expensesByCategory,
            transactionCount: snapshot.size
        };

    } catch (error) {
        console.error('Erro ao buscar estatísticas financeiras:', error);
        return {
            totalIncome: 0,
            totalExpenses: 0,
            netRevenue: 0,
            totalPending: 0,
            incomeByCategory: {},
            expensesByCategory: {},
            transactionCount: 0
        };
    }
}

/**
 * Estatísticas de rotas (para dashboard)
 * @returns {Promise<Object>}
 */
async function getRoutesStats() {
    try {
        const routesSnapshot = await db.collection('routes').get();

        let totalRoutes = 0;
        let activeRoutes = 0;
        let totalDistance = 0;

        routesSnapshot.forEach(doc => {
            const data = doc.data();
            totalRoutes++;

            if (data.active === true) {
                activeRoutes++;
            }

            // Extrair distância (pode estar em formato "10 km" ou número)
            if (data.distance) {
                const distanceNum = parseFloat(String(data.distance).replace(/[^0-9.]/g, ''));
                if (!isNaN(distanceNum)) {
                    totalDistance += distanceNum;
                }
            }
        });

        return {
            totalRoutes,
            activeRoutes,
            inactiveRoutes: totalRoutes - activeRoutes,
            totalDistance: totalDistance.toFixed(2),
            averageDistance: totalRoutes > 0 ? (totalDistance / totalRoutes).toFixed(2) : 0
        };

    } catch (error) {
        console.error('Erro ao buscar estatísticas de rotas:', error);
        return {
            totalRoutes: 0,
            activeRoutes: 0,
            inactiveRoutes: 0,
            totalDistance: 0,
            averageDistance: 0
        };
    }
}

// ========== LOCATIONS (Pontos de Origem/Destino) ==========

/**
 * Cria uma nova localização (terminal, ponto de ônibus, etc.)
 */
async function createLocation(locationData) {
    try {
        const location = {
            name: locationData.name,
            lat: locationData.lat,
            lon: locationData.lon,
            type: locationData.type || 'other', // bus_stop, terminal, landmark, other
            address: locationData.address || '',
            source: locationData.source || 'manual', // manual, osm
            osmId: locationData.osmId || null,
            active: true,
            createdAt: getTimestamp()
        };

        const locationId = locationData.id || db.collection('locations').doc().id;
        await db.collection('locations').doc(locationId).set(location);

        console.log('Location criada:', locationId);
        return { success: true, locationId: locationId };
    } catch (error) {
        console.error('Erro ao criar location:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca todas as localizações ativas
 */
async function getLocations(includeInactive = false) {
    try {
        let query = db.collection('locations');

        if (!includeInactive) {
            query = query.where('active', '==', true);
        }

        const snapshot = await query.orderBy('name').get();
        const locations = [];

        snapshot.forEach(doc => {
            locations.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return locations;
    } catch (error) {
        console.error('Erro ao buscar locations:', error);
        return [];
    }
}

/**
 * Busca uma localização por ID
 */
async function getLocationById(locationId) {
    try {
        const doc = await db.collection('locations').doc(locationId).get();

        if (!doc.exists) {
            return null;
        }

        return {
            id: doc.id,
            ...doc.data()
        };
    } catch (error) {
        console.error('Erro ao buscar location:', error);
        return null;
    }
}

/**
 * Busca localizações por nome (para autocomplete)
 */
async function searchLocationsByName(query, limit = 10) {
    try {
        const snapshot = await db.collection('locations')
            .where('active', '==', true)
            .orderBy('name')
            .get();

        const locations = [];
        const queryLower = query.toLowerCase();

        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.name.toLowerCase().includes(queryLower)) {
                locations.push({
                    id: doc.id,
                    ...data
                });
            }
        });

        return locations.slice(0, limit);
    } catch (error) {
        console.error('Erro ao buscar locations por nome:', error);
        return [];
    }
}

/**
 * Atualiza uma localização
 */
async function updateLocation(locationId, updates) {
    try {
        await db.collection('locations').doc(locationId).update(updates);
        console.log('Location atualizada:', locationId);
        return { success: true };
    } catch (error) {
        console.error('Erro ao atualizar location:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta uma localização (soft delete por padrão)
 */
async function deleteLocation(locationId, hardDelete = false) {
    try {
        if (hardDelete) {
            await db.collection('locations').doc(locationId).delete();
            console.log('Location deletada permanentemente:', locationId);
        } else {
            await db.collection('locations').doc(locationId).update({ active: false });
            console.log('Location desativada:', locationId);
        }
        return { success: true };
    } catch (error) {
        console.error('Erro ao deletar location:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca localizações próximas a uma coordenada
 */
async function getNearbyLocations(lat, lon, radiusKm = 5) {
    try {
        const locations = await getLocations();
        const nearby = [];

        for (const location of locations) {
            const distance = calculateDistance(lat, lon, location.lat, location.lon);
            if (distance <= radiusKm) {
                nearby.push({
                    ...location,
                    distance: distance.toFixed(2)
                });
            }
        }

        // Ordenar por distância
        nearby.sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance));

        return nearby;
    } catch (error) {
        console.error('Erro ao buscar locations próximas:', error);
        return [];
    }
}

/**
 * Importa localizações do OpenStreetMap
 */
async function importLocationsFromOSM(coords, radius = 1000, type = 'bus_stop') {
    try {
        // Mapear tipos para tags OSM
        const osmTags = {
            'bus_stop': 'node["highway"="bus_stop"]',
            'terminal': 'node["amenity"="bus_station"]',
            'landmark': 'node["tourism"]'
        };

        const tag = osmTags[type] || osmTags['bus_stop'];

        // Construir query Overpass
        const query = `
            [out:json];
            ${tag}(around:${radius},${coords.lat},${coords.lon});
            out body;
        `;

        const response = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: query
        });

        if (!response.ok) {
            throw new Error('Erro na API do OSM');
        }

        const data = await response.json();
        const imported = [];

        for (const element of data.elements) {
            const locationData = {
                name: element.tags.name || `${type} ${element.id}`,
                lat: element.lat,
                lon: element.lon,
                type: type,
                address: element.tags['addr:full'] || element.tags['addr:street'] || '',
                source: 'osm',
                osmId: element.id
            };

            const result = await createLocation(locationData);
            if (result.success) {
                imported.push(result.locationId);
            }
        }

        console.log(`${imported.length} locations importadas do OSM`);
        return { success: true, count: imported.length, locationIds: imported };
    } catch (error) {
        console.error('Erro ao importar do OSM:', error);
        return { success: false, error: error.message };
    }
}

