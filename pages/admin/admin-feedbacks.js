// ADMIN FEEDBACKS - Gerenciamento de feedbacks dos usuários
document.addEventListener('DOMContentLoaded', async function() {
    const filterStatus = document.getElementById('filterStatus');
    const feedbacksContainer = document.getElementById('feedbacksContainer');
    const emptyState = document.getElementById('emptyState');
    const notification = document.getElementById('notification');

    let allFeedbacks = [];
    let currentFilter = 'unread';

    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    // Carregar feedbacks do Firestore
    async function loadFeedbacks() {
        try {
            const snapshot = await db.collection('feedback')
                .orderBy('timestamp', 'desc')
                .get();

            allFeedbacks = [];
            snapshot.forEach(doc => {
                allFeedbacks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            updateStats();
            renderFeedbacks();
        } catch (error) {
            console.error('Erro ao carregar feedbacks:', error);
            showNotification('Erro ao carregar feedbacks', 'error');
        }
    }

    // Atualizar estatísticas
    function updateStats() {
        const total = allFeedbacks.length;
        const unread = allFeedbacks.filter(f => f.status === 'unread').length;
        const read = allFeedbacks.filter(f => f.status === 'read').length;

        document.getElementById('totalFeedbacks').textContent = total;
        document.getElementById('unreadFeedbacks').textContent = unread;
        document.getElementById('readFeedbacks').textContent = read;
    }

    // Renderizar feedbacks
    function renderFeedbacks() {
        const filtered = allFeedbacks.filter(feedback => {
            if (currentFilter === 'all') return true;
            return feedback.status === currentFilter;
        });

        if (filtered.length === 0) {
            feedbacksContainer.style.display = 'none';
            emptyState.style.display = 'block';
            return;
        }

        feedbacksContainer.style.display = 'flex';
        emptyState.style.display = 'none';

        feedbacksContainer.innerHTML = filtered.map(feedback => {
            const date = feedback.timestamp?.toDate ?
                feedback.timestamp.toDate() :
                new Date(feedback.timestamp);

            const dateStr = date.toLocaleString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });

            // Pegar iniciais para o avatar
            const userIdentifier = feedback.userEmail || 'Usuário';
            const initials = userIdentifier.substring(0, 2).toUpperCase();

            const isUnread = feedback.status === 'unread';

            return `
                <div class="feedback-card ${isUnread ? 'unread' : ''}">
                    <div class="feedback-header">
                        <div class="feedback-user">
                            <div class="user-avatar">${initials}</div>
                            <div class="user-info">
                                <h4>${userIdentifier}</h4>
                                <p>${dateStr}</p>
                            </div>
                        </div>
                        <div class="feedback-actions">
                            ${isUnread ?
                                `<button class="btn-action btn-mark-read" onclick="markAsRead('${feedback.id}')">
                                    Marcar como Lido
                                </button>` :
                                `<button class="btn-action btn-mark-unread" onclick="markAsUnread('${feedback.id}')">
                                    Marcar como Não Lido
                                </button>`
                            }
                        </div>
                    </div>
                    <div class="feedback-content">
                        <p class="feedback-text">${feedback.feedbackText}</p>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Marcar como lido
    window.markAsRead = async function(feedbackId) {
        try {
            await db.collection('feedback').doc(feedbackId).update({
                status: 'read',
                readAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            showNotification('Feedback marcado como lido', 'success');
            await loadFeedbacks();
        } catch (error) {
            console.error('Erro ao marcar como lido:', error);
            showNotification('Erro ao atualizar feedback', 'error');
        }
    };

    // Marcar como não lido
    window.markAsUnread = async function(feedbackId) {
        try {
            await db.collection('feedback').doc(feedbackId).update({
                status: 'unread',
                readAt: null
            });

            showNotification('Feedback marcado como não lido', 'success');
            await loadFeedbacks();
        } catch (error) {
            console.error('Erro ao marcar como não lido:', error);
            showNotification('Erro ao atualizar feedback', 'error');
        }
    };

    // Event Listeners
    filterStatus.addEventListener('change', function() {
        currentFilter = this.value;
        renderFeedbacks();
    });

    // Inicialização
    await loadFeedbacks();

    // Listener em tempo real para novos feedbacks
    db.collection('feedback').onSnapshot(() => {
        loadFeedbacks();
    });
});
