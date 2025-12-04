const TEST_MODE = true;

class BusSimulator {
    constructor(activeTripId, routePath, speed = 40, preRoutePath = null) {
        this.activeTripId = activeTripId;
        this.routePath = routePath; // Array de {lat, lon} da rota principal (origem → destino)
        this.preRoutePath = preRoutePath; // Array de {lat, lon} da pré-rota (ponto aleatório → origem)
        this.speed = speed; // km/h
        this.currentIndex = 0;
        this.isRunning = false;
        this.intervalId = null;
        this.lastUpdateTime = Date.now();
        this.isInPreRoute = (preRoutePath && preRoutePath.length > 0); // Se está fazendo o trajeto até a origem

        // Configuração do modo de teste
        if (TEST_MODE) {
            console.log('MODO DE TESTE ATIVADO: Viagens de 10s para origem + 10s para destino');
            this.testModeEnabled = true;
            this.testPhaseStartTime = Date.now();
        } else {
            this.testModeEnabled = false;
        }
    }

    /**
     * Inicia o simulador
     */
    start() {
        if (this.isRunning) {
            console.warn('[BusSimulator] Simulador já está rodando');
            return;
        }

        console.log('[BusSimulator] Iniciando simulador para trip:', this.activeTripId);
        this.isRunning = true;

        // Atualizar posição inicial imediatamente
        this.updatePosition();

        // Atualizar a cada 10 segundos (10000 ms)
        this.intervalId = setInterval(() => {
            this.updatePosition();
        }, 10000); // 10 segundos
    }

    /**
     * Para o simulador
     */
    stop() {
        if (!this.isRunning) return;

        console.log('[BusSimulator] Parando simulador');
        this.isRunning = false;

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    /**
     * Calcula nova posição e atualiza no Firestore
     */
    async updatePosition() {
        // 🧪 MODO DE TESTE: Viagem simplificada
        if (this.testModeEnabled) {
            return await this.updatePositionTestMode();
        }

        const currentPath = this.isInPreRoute ? this.preRoutePath : this.routePath;

        if (!this.isRunning || this.currentIndex >= currentPath.length - 1) {
            // Se terminou a pré-rota, mudar para rota principal
            if (this.isInPreRoute) {
                console.log('[BusSimulator] ✅ Pré-rota concluída! Mudando para rota principal');
                this.isInPreRoute = false;
                this.currentIndex = 0;
                this.lastUpdateTime = Date.now();
                this.testPhaseStartTime = Date.now(); // Reset timer para próxima fase
                return;
            }

            // Se terminou a rota principal, completar viagem
            console.log('[BusSimulator] Fim da rota alcançado');
            await this.completeTrip();
            this.stop();
            return;
        }

        const now = Date.now();
        const elapsedSeconds = (now - this.lastUpdateTime) / 1000;

        // Calcular distância percorrida (km) - speed está em km/h
        const distanceTraveled = (this.speed / 3600) * elapsedSeconds;

        // Mover ao longo da rota (pré-rota ou rota principal)
        const newPosition = this.calculateNewPosition(distanceTraveled);

        const routeType = this.isInPreRoute ? 'PRÉ-ROTA' : 'ROTA PRINCIPAL';
        console.log(`[BusSimulator] [${routeType}] Nova posição:`, newPosition, 'Índice:', this.currentIndex);

        // Atualizar no Firestore
        try {
            await db.collection('active_trips').doc(this.activeTripId).update({
                busLocation: {
                    lat: newPosition.lat,
                    lon: newPosition.lon,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            console.log('[BusSimulator] Posição atualizada no Firestore');

            // Verificar se está próximo da ORIGEM (<200m) para debitar
            await this.checkOriginProximity(newPosition);

            // Verificar se está próximo do DESTINO (<200m) para completar
            await this.checkDestinationProximity(newPosition);

        } catch (error) {
            console.error('[BusSimulator] Erro ao atualizar posição:', error);
        }

        this.lastUpdateTime = now;
    }

    /**
     * Modo de teste: Viagem simplificada de 10s para origem + 10s para destino
     */
    async updatePositionTestMode() {
        const now = Date.now();
        const elapsedMs = now - this.testPhaseStartTime;
        const elapsedSeconds = elapsedMs / 1000;

        const currentPath = this.isInPreRoute ? this.preRoutePath : this.routePath;
        const phaseDuration = 10; // 10 segundos por fase

        // Verificar se a fase atual terminou
        if (elapsedSeconds >= phaseDuration) {
            // Se terminou a pré-rota, mudar para rota principal
            if (this.isInPreRoute) {
                console.log('[BusSimulator] 🧪 TEST MODE: Pré-rota concluída (10s)! Mudando para rota principal');
                this.isInPreRoute = false;
                this.currentIndex = 0;
                this.testPhaseStartTime = Date.now();
                this.lastUpdateTime = Date.now();

                // Posicionar no início da rota principal (origem)
                const originPosition = this.routePath[0];
                await db.collection('active_trips').doc(this.activeTripId).update({
                    busLocation: {
                        lat: originPosition.lat,
                        lon: originPosition.lon,
                        timestamp: firebase.firestore.FieldValue.serverTimestamp()
                    },
                    status: 'in_transit',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Debitar passagem
                const tripDoc = await db.collection('active_trips').doc(this.activeTripId).get();
                if (tripDoc.exists) {
                    await this.debitTrip(tripDoc.data());
                }

                return;
            }

            // Se terminou a rota principal, completar viagem
            console.log('[BusSimulator] 🧪 TEST MODE: Rota principal concluída (10s)! Completando viagem');
            await this.completeTrip();
            this.stop();
            return;
        }

        // Calcular progresso linear (0 a 1)
        const progress = Math.min(elapsedSeconds / phaseDuration, 1);
        const pathIndex = Math.floor(progress * (currentPath.length - 1));

        // Interpolar posição
        let newPosition;
        if (pathIndex >= currentPath.length - 1) {
            newPosition = currentPath[currentPath.length - 1];
        } else {
            const point1 = currentPath[pathIndex];
            const point2 = currentPath[pathIndex + 1];
            const segmentProgress = (progress * (currentPath.length - 1)) - pathIndex;

            newPosition = {
                lat: point1.lat + (point2.lat - point1.lat) * segmentProgress,
                lon: point1.lon + (point2.lon - point1.lon) * segmentProgress
            };
        }

        const routeType = this.isInPreRoute ? 'PRÉ-ROTA' : 'ROTA PRINCIPAL';
        console.log(`[BusSimulator] 🧪 TEST MODE [${routeType}] ${elapsedSeconds.toFixed(1)}s/10s - Progresso: ${(progress * 100).toFixed(1)}%`);

        // Atualizar no Firestore
        try {
            await db.collection('active_trips').doc(this.activeTripId).update({
                busLocation: {
                    lat: newPosition.lat,
                    lon: newPosition.lon,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                },
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Verificar proximidade mesmo em test mode
            if (!this.isInPreRoute) {
                await this.checkOriginProximity(newPosition);
                await this.checkDestinationProximity(newPosition);
            }

        } catch (error) {
            console.error('[BusSimulator] Erro ao atualizar posição (test mode):', error);
        }

        this.lastUpdateTime = now;
    }

    /**
     * Calcula nova posição ao longo do path
     */
    calculateNewPosition(distanceKm) {
        const currentPath = this.isInPreRoute ? this.preRoutePath : this.routePath;
        let remainingDistance = distanceKm;

        while (remainingDistance > 0 && this.currentIndex < currentPath.length - 1) {
            const current = currentPath[this.currentIndex];
            const next = currentPath[this.currentIndex + 1];

            const segmentDistance = this.haversineDistance(
                current.lat, current.lon,
                next.lat, next.lon
            );

            if (remainingDistance >= segmentDistance) {
                // Avançar para próximo ponto
                remainingDistance -= segmentDistance;
                this.currentIndex++;
            } else {
                // Interpolar posição dentro do segmento
                const fraction = remainingDistance / segmentDistance;
                return {
                    lat: current.lat + (next.lat - current.lat) * fraction,
                    lon: current.lon + (next.lon - current.lon) * fraction
                };
            }
        }

        // Se chegou ao fim
        return currentPath[this.currentIndex];
    }

    /**
     * Verifica proximidade da ORIGEM e debita se necessário
     */
    async checkOriginProximity(currentPosition) {
        try {
            const tripDoc = await db.collection('active_trips').doc(this.activeTripId).get();

            if (!tripDoc.exists) {
                console.warn('[BusSimulator] Viagem não encontrada');
                return;
            }

            const tripData = tripDoc.data();

            // Se já foi debitado, não fazer nada
            if (tripData.status !== 'approaching_origin') {
                return;
            }

            // Verificar proximidade com originCoords
            if (tripData.originCoords) {
                const distance = this.haversineDistance(
                    currentPosition.lat, currentPosition.lon,
                    tripData.originCoords.lat, tripData.originCoords.lng
                ) * 1000; // converter para metros

                console.log('[BusSimulator] Distância até ORIGEM:', distance.toFixed(0), 'm');

                // Se está a menos de 200m da origem
                if (distance < 200) {
                    console.log('[BusSimulator] ✅ Ônibus chegou na ORIGEM! Debitando...');
                    await this.debitTrip(tripData);
                }
            }

        } catch (error) {
            console.error('[BusSimulator] Erro ao verificar proximidade da origem:', error);
        }
    }

    /**
     * Verifica proximidade do DESTINO e completa viagem se necessário
     */
    async checkDestinationProximity(currentPosition) {
        try {
            const tripDoc = await db.collection('active_trips').doc(this.activeTripId).get();

            if (!tripDoc.exists) {
                console.warn('[BusSimulator] Viagem não encontrada');
                return;
            }

            const tripData = tripDoc.data();

            // Só verificar destino se já foi debitado (in_transit)
            if (tripData.status !== 'in_transit') {
                return;
            }

            // Verificar proximidade com destinationCoords
            if (tripData.destinationCoords) {
                const distance = this.haversineDistance(
                    currentPosition.lat, currentPosition.lon,
                    tripData.destinationCoords.lat, tripData.destinationCoords.lng
                ) * 1000; // converter para metros

                console.log('[BusSimulator] Distância até DESTINO:', distance.toFixed(0), 'm');

                // Se está a menos de 10m do destino
                if (distance < 10) {
                    console.log('[BusSimulator] ✅ Ônibus chegou no DESTINO! Completando viagem...');
                    await this.completeTrip();
                    this.stop();
                }
            }

        } catch (error) {
            console.error('[BusSimulator] Erro ao verificar proximidade do destino:', error);
        }
    }

    /**
     * Debita o valor da viagem
     */
    async debitTrip(tripData) {
        try {
            console.log('[BusSimulator] Debitando viagem:', tripData.price);

            // Preparar informações da rota para descrição
            const routeInfo = {
                origin: tripData.origin,
                destination: tripData.destination,
                routeNumber: tripData.routeNumber
            };

            // Usar a função purchaseTicket do firestore-service.js
            const result = await purchaseTicket(
                tripData.userId,
                tripData.routeId,
                tripData.price,
                routeInfo
            );

            if (result.success) {
                console.log('[BusSimulator] Débito bem-sucedido! Novo saldo:', result.newBalance);

                // Atualizar status da viagem para in_transit
                await db.collection('active_trips').doc(this.activeTripId).update({
                    status: 'in_transit',
                    debitedAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

            } else {
                console.error('[BusSimulator] Erro ao debitar:', result.error);

                // Atualizar status para failed
                await db.collection('active_trips').doc(this.activeTripId).update({
                    status: 'failed',
                    failureReason: result.error || 'Saldo insuficiente',
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                });

                // Parar simulador
                this.stop();
            }

        } catch (error) {
            console.error('[BusSimulator] Erro ao debitar viagem:', error);
        }
    }

    /**
     * Completa a viagem
     */
    async completeTrip() {
        try {
            console.log('[BusSimulator] Completando viagem');

            const tripDoc = await db.collection('active_trips').doc(this.activeTripId).get();

            if (!tripDoc.exists) return;

            const tripData = tripDoc.data();

            // Criar registro de trip no histórico
            await db.collection('trips').add({
                userId: tripData.userId,
                routeId: tripData.routeId,
                routeNumber: tripData.routeNumber,
                routeName: tripData.routeName,
                origin: tripData.origin,
                destination: tripData.destination,
                price: tripData.price,
                status: 'completed',
                timestamp: tripData.debitedAt || firebase.firestore.FieldValue.serverTimestamp(),
                completedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Deletar de active_trips (viagem concluída e movida para trips)
            await db.collection('active_trips').doc(this.activeTripId).delete();

            console.log('[BusSimulator] Viagem completada e movida para histórico!');

            // Disparar evento customizado para a interface
            if (typeof window !== 'undefined') {
                const event = new CustomEvent('tripCompleted', {
                    detail: {
                        tripId: this.activeTripId,
                        routeName: tripData.routeName,
                        routeNumber: tripData.routeNumber,
                        origin: tripData.origin,
                        destination: tripData.destination
                    }
                });
                window.dispatchEvent(event);
            }

        } catch (error) {
            console.error('[BusSimulator] Erro ao completar viagem:', error);
        }
    }

    /**
     * Calcula distância Haversine entre dois pontos (retorna km)
     */
    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Raio da Terra em km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Gera path de exemplo para testes (quando não há rota real)
     */
    static generateMockPath(startLat, startLon, endLat, endLon, numPoints = 20) {
        const path = [];

        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            path.push({
                lat: startLat + (endLat - startLat) * fraction,
                lon: startLon + (endLon - startLon) * fraction
            });
        }

        return path;
    }
}

// Exportar para uso global
if (typeof window !== 'undefined') {
    window.BusSimulator = BusSimulator;
}
