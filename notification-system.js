// Sistema de Notificações Avançado
class NotificationSystem {
    constructor() {
        this.notifications = JSON.parse(localStorage.getItem('busway_notifications')) || [];
        this.subscriptions = JSON.parse(localStorage.getItem('notification_subscriptions')) || {};
        this.permission = 'default';
        this.init();
    }

    async init() {
        // Verificar e solicitar permissões
        await this.requestPermission();
        
        // Configurar service worker se disponível
        this.setupServiceWorker();
        
        // Limpar notificações antigas (mais de 7 dias)
        this.cleanOldNotifications();
        
        // Inicializar notificações programadas
        this.setupScheduledNotifications();
    }

    async requestPermission() {
        if ('Notification' in window) {
            this.permission = await Notification.requestPermission();
            
            if (this.permission === 'granted') {
                this.showSystemNotification('Busway', 'Notificações ativadas! Você receberá alertas sobre seus ônibus.');
            }
        }
    }

    setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            // Registrar service worker para notificações em background
            navigator.serviceWorker.register('/sw.js').catch(err => {
                console.log('Service Worker não disponível:', err);
            });
        }
    }

    // Adicionar nova notificação
    addNotification(title, message, type = 'info', options = {}) {
        // Filtrar notificações de transporte apenas para rotas rastreadas
        if (type === 'transport' && options.route) {
            const routeId = options.route.id;
            // Verificar se existe activeTrackings global
            if (window.activeTrackings && !window.activeTrackings.has(routeId)) {
                console.log('Notificação de transporte ignorada - rota não rastreada:', routeId);
                return null;
            }
        }
        
        const notification = {
            id: Date.now() + Math.random(),
            title,
            message,
            type, // info, success, warning, error, transport, financial
            timestamp: new Date().toISOString(),
            read: false,
            actions: options.actions || [],
            persistent: options.persistent || false,
            route: options.route || null,
            location: options.location || null,
            priority: options.priority || 'normal' // low, normal, high, urgent
        };

        this.notifications.unshift(notification);
        
        // Limitar a 100 notificações
        if (this.notifications.length > 100) {
            this.notifications = this.notifications.slice(0, 100);
        }

        this.saveNotifications();
        this.updateUI();
        
        // Mostrar notificação do sistema se permitido
        if (this.permission === 'granted' && options.showSystem !== false) {
            this.showSystemNotification(title, message, options);
        }

        // Mostrar toast na interface
        this.showToast(title, message, type);

        return notification;
    }

    // Notificação do sistema operacional
    showSystemNotification(title, message, options = {}) {
        if (this.permission !== 'granted') return;

        const systemNotification = new Notification(title, {
            body: message,
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            tag: options.tag || 'busway',
            requireInteraction: options.persistent || false,
            actions: options.actions ? options.actions.map(action => ({
                action: action.id,
                title: action.title
            })) : []
        });

        // Auto-fechar após 5 segundos (se não for persistente)
        if (!options.persistent) {
            setTimeout(() => systemNotification.close(), 5000);
        }

        // Eventos da notificação
        systemNotification.onclick = () => {
            window.focus();
            if (options.onclick) options.onclick();
            systemNotification.close();
        };
    }

    // Toast na interface
    showToast(title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `notification-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <div class="toast-icon">${this.getTypeIcon(type)}</div>
                <div class="toast-text">
                    <div class="toast-title">${title}</div>
                    <div class="toast-message">${message}</div>
                </div>
                <button class="toast-close" onclick="this.parentElement.remove()">×</button>
            </div>
        `;

        // Adicionar ao container
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        container.appendChild(toast);

        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 100);

        // Auto-remover após 4 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // Notificações específicas de transporte
    notifyBusArrival(route, eta, location) {
        return this.addNotification(
            `Ônibus ${route.number} Chegando`,
            `Chegada prevista em ${eta} minutos na parada ${location}`,
            'transport',
            {
                priority: 'high',
                route: route,
                location: location,
                actions: [
                    { id: 'track', title: 'Rastrear' },
                    { id: 'dismiss', title: 'Dispensar' }
                ]
            }
        );
    }

    notifyRouteDelay(route, delay, reason) {
        return this.addNotification(
            `Atraso na Linha ${route.number}`,
            `${delay} minutos de atraso. Motivo: ${reason}`,
            'warning',
            {
                priority: 'high',
                route: route,
                persistent: true
            }
        );
    }

    notifyLowBalance(balance, threshold) {
        return this.addNotification(
            'Saldo Baixo',
            `Seu saldo está baixo: R$ ${balance.toFixed(2)}. Considere recarregar.`,
            'warning',
            {
                priority: 'normal',
                actions: [
                    { id: 'recharge', title: 'Recarregar' },
                    { id: 'remind_later', title: 'Lembrar depois' }
                ]
            }
        );
    }

    notifyTripCompleted(route, origin, destination, cost) {
        return this.addNotification(
            'Viagem Concluída',
            `${origin} → ${destination} na linha ${route.number}. Custo: R$ ${cost.toFixed(2)}`,
            'success',
            {
                route: route,
                actions: [
                    { id: 'rate', title: 'Avaliar' },
                    { id: 'receipt', title: 'Comprovante' }
                ]
            }
        );
    }

    // Notificações programadas
    scheduleNotification(title, message, triggerTime, options = {}) {
        const scheduledNotification = {
            id: Date.now() + Math.random(),
            title,
            message,
            triggerTime: new Date(triggerTime).toISOString(),
            options,
            active: true
        };

        let scheduled = JSON.parse(localStorage.getItem('scheduled_notifications')) || [];
        scheduled.push(scheduledNotification);
        localStorage.setItem('scheduled_notifications', JSON.stringify(scheduled));

        // Configurar timeout se for para hoje
        const now = new Date();
        const trigger = new Date(triggerTime);
        if (trigger > now && trigger.getDate() === now.getDate()) {
            const timeout = trigger.getTime() - now.getTime();
            setTimeout(() => {
                this.addNotification(title, message, 'info', options);
            }, timeout);
        }

        return scheduledNotification;
    }

    setupScheduledNotifications() {
        // Verificar notificações programadas a cada minuto
        setInterval(() => {
            this.checkScheduledNotifications();
        }, 60000);
    }

    checkScheduledNotifications() {
        const scheduled = JSON.parse(localStorage.getItem('scheduled_notifications')) || [];
        const now = new Date();

        scheduled.forEach(notification => {
            const triggerTime = new Date(notification.triggerTime);
            
            if (notification.active && triggerTime <= now) {
                this.addNotification(
                    notification.title,
                    notification.message,
                    'info',
                    notification.options
                );
                
                // Marcar como executada
                notification.active = false;
            }
        });

        // Remover notificações antigas/executadas
        const activeScheduled = scheduled.filter(n => 
            n.active && new Date(n.triggerTime) > now
        );
        
        localStorage.setItem('scheduled_notifications', JSON.stringify(activeScheduled));
    }

    // Gerenciar assinaturas
    subscribe(type, routeId = null) {
        if (!this.subscriptions[type]) {
            this.subscriptions[type] = [];
        }
        
        if (routeId && !this.subscriptions[type].includes(routeId)) {
            this.subscriptions[type].push(routeId);
        } else if (!routeId && !this.subscriptions[type].includes('global')) {
            this.subscriptions[type].push('global');
        }

        this.saveSubscriptions();
    }

    unsubscribe(type, routeId = null) {
        if (!this.subscriptions[type]) return;

        const target = routeId || 'global';
        const index = this.subscriptions[type].indexOf(target);
        
        if (index > -1) {
            this.subscriptions[type].splice(index, 1);
        }

        this.saveSubscriptions();
    }

    // Marcar como lida
    markAsRead(notificationId) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (notification) {
            notification.read = true;
            this.saveNotifications();
            this.updateUI();
        }
    }

    markAllAsRead() {
        this.notifications.forEach(n => n.read = true);
        this.saveNotifications();
        this.updateUI();
    }

    // Remover notificação
    removeNotification(notificationId) {
        this.notifications = this.notifications.filter(n => n.id !== notificationId);
        this.saveNotifications();
        this.updateUI();
    }

    clearAll() {
        this.notifications = [];
        this.saveNotifications();
        this.updateUI();
    }

    // Utilitários
    getUnreadCount() {
        return this.notifications.filter(n => !n.read).length;
    }

    getNotificationsByType(type) {
        return this.notifications.filter(n => n.type === type);
    }

    getRecentNotifications(hours = 24) {
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        return this.notifications.filter(n => 
            new Date(n.timestamp) > cutoff
        );
    }

    getTypeIcon(type) {
        const icons = {
            info: '📢',
            success: '✅',
            warning: '⚠️',
            error: '❌',
            transport: '🚌',
            financial: '💰'
        };
        return icons[type] || '📢';
    }

    cleanOldNotifications() {
        const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 dias
        this.notifications = this.notifications.filter(n => 
            new Date(n.timestamp) > cutoff || n.persistent
        );
        this.saveNotifications();
    }

    // Atualizar interface
    updateUI() {
        const unreadCount = this.getUnreadCount();
        
        // Atualizar badge
        const badge = document.getElementById('notificationBadge');
        if (badge) {
            badge.style.display = unreadCount > 0 ? 'block' : 'none';
            badge.textContent = unreadCount > 99 ? '99+' : unreadCount;
        }

        // Atualizar lista
        const list = document.getElementById('notificationsList');
        if (list) {
            this.renderNotificationsList(list);
        }
    }

    renderNotificationsList(container) {
        const recent = this.notifications.slice(0, 20);
        
        if (recent.length === 0) {
            container.innerHTML = '<p class="no-notifications">Nenhuma notificação</p>';
            return;
        }

        container.innerHTML = recent.map(notification => `
            <div class="notification-item ${!notification.read ? 'unread' : ''}" 
                 data-id="${notification.id}" 
                 onclick="notificationSystem.markAsRead(${notification.id})">
                <div class="notification-icon">${this.getTypeIcon(notification.type)}</div>
                <div class="notification-content">
                    <div class="notification-title">${notification.title}</div>
                    <div class="notification-message">${notification.message}</div>
                    <div class="notification-time">${this.formatTime(notification.timestamp)}</div>
                </div>
                <button class="notification-remove" onclick="event.stopPropagation(); notificationSystem.removeNotification(${notification.id})">×</button>
            </div>
        `).join('');
    }

    formatTime(timestamp) {
        const now = new Date();
        const time = new Date(timestamp);
        const diff = Math.floor((now - time) / 1000);

        if (diff < 60) return 'Agora';
        if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
        
        return time.toLocaleDateString('pt-BR', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // Persistência
    saveNotifications() {
        localStorage.setItem('busway_notifications', JSON.stringify(this.notifications));
    }

    saveSubscriptions() {
        localStorage.setItem('notification_subscriptions', JSON.stringify(this.subscriptions));
    }
}

// CSS para toasts (inserir automaticamente)
const toastCSS = `
.toast-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    pointer-events: none;
}

.notification-toast {
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    margin-bottom: 10px;
    transform: translateX(400px);
    transition: transform 0.3s ease;
    pointer-events: auto;
    max-width: 350px;
}

.notification-toast.show {
    transform: translateX(0);
}

.toast-content {
    display: flex;
    align-items: flex-start;
    padding: 15px;
    gap: 12px;
}

.toast-icon {
    font-size: 20px;
    flex-shrink: 0;
}

.toast-text {
    flex: 1;
}

.toast-title {
    font-weight: 600;
    font-size: 14px;
    margin-bottom: 4px;
    color: #333;
}

.toast-message {
    font-size: 13px;
    color: #666;
    line-height: 1.4;
}

.toast-close {
    background: none;
    border: none;
    font-size: 18px;
    color: #999;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.toast-transport {
    border-left: 4px solid #667eea;
}

.toast-financial {
    border-left: 4px solid #10b981;
}

.toast-warning {
    border-left: 4px solid #f59e0b;
}

.toast-error {
    border-left: 4px solid #ef4444;
}

.toast-success {
    border-left: 4px solid #10b981;
}
`;

// Inserir CSS
const style = document.createElement('style');
style.textContent = toastCSS;
document.head.appendChild(style);

// Inicializar sistema global
const notificationSystem = new NotificationSystem();

// Exportar para uso global
window.NotificationSystem = NotificationSystem;
window.notificationSystem = notificationSystem;