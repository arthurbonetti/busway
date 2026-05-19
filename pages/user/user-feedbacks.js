// USER FEEDBACKS - Página dedicada para feedbacks
document.addEventListener('DOMContentLoaded', async function() {
    const feedbackText = document.getElementById('feedbackText');
    const charCount = document.getElementById('charCount');
    const feedbackList = document.getElementById('feedbackList');
    const emptyState = document.getElementById('emptyState');
    const notification = document.getElementById('notification');

    let currentUserId = null;

    function showNotification(message, type = 'info') {
        notification.textContent = message;
        notification.className = `notification show ${type}`;

        setTimeout(() => {
            notification.classList.remove('show');
        }, 3000);
    }

    function checkSession() {
        const session = sessionStorage.getItem('buswaySession');

        if (!session) {
            showNotification('Sessão expirada. Redirecionando para login...', 'error');
            setTimeout(() => {
                window.location.href = '../../index.html';
            }, 1500);
            return null;
        }

        const sessionData = JSON.parse(session);

        if (sessionData.isAdmin) {
            showNotification('Redirecionando para painel administrativo...', 'info');
            setTimeout(() => {
                window.location.href = '../admin/admin-dashboard.html';
            }, 1000);
            return null;
        }

        if (sessionData.isDriver || sessionData.role === 'driver') {
            showNotification('Redirecionando para painel do motorista...', 'info');
            setTimeout(() => {
                window.location.href = '../driver/driver-dashboard.html';
            }, 1000);
            return null;
        }

        return sessionData;
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function formatDateTime(value) {
        if (!value) return '';
        const date = value?.toDate ? value.toDate() : new Date(value);
        if (Number.isNaN(date.getTime())) return '';

        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function renderFeedbacks(feedbacks) {
        if (!feedbackList) return;

        if (!feedbacks.length) {
            feedbackList.innerHTML = '';
            emptyState.style.display = 'flex';
            return;
        }

        emptyState.style.display = 'none';

        feedbackList.innerHTML = feedbacks.map((feedback) => {
            const sentAt = formatDateTime(feedback.timestamp);
            const repliedAt = formatDateTime(feedback.respondedAt);
            const hasResponse = typeof feedback.adminResponse === 'string' && feedback.adminResponse.trim().length > 0;

            return `
                <div class="feedback-item ${hasResponse ? 'responded' : ''}">
                    <div class="feedback-meta">${sentAt}</div>
                    <p class="feedback-message">${escapeHtml(feedback.feedbackText || '')}</p>
                    ${hasResponse
                        ? `<div class="feedback-response">
                            <div class="feedback-response-title">Resposta da equipe ${repliedAt ? `• ${repliedAt}` : ''}</div>
                            <p class="feedback-response-text">${escapeHtml(feedback.adminResponse)}</p>
                        </div>`
                        : ''
                    }
                </div>
            `;
        }).join('');
    }

    async function loadFeedbacks() {
        if (!currentUserId || !feedbackList) return;

        try {
            const snapshot = await db.collection('feedback')
                .where('userId', '==', currentUserId)
                .get();

            const feedbacks = [];
            snapshot.forEach((doc) => {
                feedbacks.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            feedbacks.sort((a, b) => {
                const aTime = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
                const bTime = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
                return bTime - aTime;
            });

            renderFeedbacks(feedbacks);
        } catch (error) {
            console.error('Erro ao carregar feedbacks:', error);
        }
    }

    // Contador de caracteres
    if (feedbackText && charCount) {
        feedbackText.addEventListener('input', () => {
            const length = feedbackText.value.length;
            charCount.textContent = `${length}/500`;
        });
    }

    // Enviar feedback
    window.submitFeedback = async function() {
        if (!feedbackText) return;

        const text = feedbackText.value.trim();

        if (!text) {
            showNotification('Escreva um feedback antes de enviar', 'error');
            return;
        }

        if (text.length < 10) {
            showNotification('O feedback deve ter pelo menos 10 caracteres', 'error');
            return;
        }

        if (!currentUserId) {
            showNotification('Usuário não identificado', 'error');
            return;
        }

        try {
            const payload = {
                userId: currentUserId,
                feedbackText: text,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                status: 'unread'
            };

            const sessionData = JSON.parse(sessionStorage.getItem('buswaySession') || '{}');
            if (sessionData.email) {
                payload.userEmail = sessionData.email;
            }

            await db.collection('feedback').add(payload);

            feedbackText.value = '';
            if (charCount) charCount.textContent = '0/500';
            showNotification('Feedback enviado com sucesso!', 'success');
            await loadFeedbacks();
        } catch (error) {
            console.error('Erro ao enviar feedback:', error);
            showNotification('Erro ao enviar feedback. Tente novamente.', 'error');
        }
    };

    // Inicialização
    const session = checkSession();
    if (session) {
        currentUserId = session.uid || session.id;
        await loadFeedbacks();

        // Listener em tempo real para novos feedbacks
        db.collection('feedback')
            .where('userId', '==', currentUserId)
            .onSnapshot(() => {
                loadFeedbacks();
            });
    }
});
