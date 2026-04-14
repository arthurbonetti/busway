// Sistema de Controle Financeiro Completo - INTEGRADO COM FIRESTORE
class FinancialControl {
    constructor() {
        this.transactions = [];
        this.balance = 0;
        this.userId = null;
        this.unsubscribers = []; // Para cancelar observers
        this.categories = {
            credit: {
                recarga: 'Recarga',
                refund: 'Reembolso',
                promotion: 'Promoção',
                transfer_in: 'Transferência Recebida'
            },
            debit: {
                transporte: 'Passagem',
                transfer_out: 'Transferência Enviada',
                service: 'Taxa de Serviço',
                penalty: 'Multa'
            }
        };
        this.init();
    }

    async init() {
        // Obter userId da sessão
        const session = sessionStorage.getItem('buswaySession');
        if (session) {
            const sessionData = JSON.parse(session);
            this.userId = sessionData.uid || sessionData.id;

            // Carregar dados do Firestore
            await this.loadFromFirestore();

            // Configurar observadores em tempo real
            this.setupRealtimeListeners();
        }

        this.setupEventListeners();
        this.updateDisplay();
        this.generateReports();
    }

    // Carregar dados do Firestore
    async loadFromFirestore() {
        if (!this.userId) return;

        try {
            console.log('[loadFromFirestore] Carregando saldo do usuário:', this.userId);
            // Carregar saldo
            this.balance = await getUserBalance(this.userId);
            console.log('[loadFromFirestore] Saldo carregado:', this.balance);

            // Carregar transações
            this.transactions = await getTransactions(this.userId, 100);
            console.log('[loadFromFirestore] Transações carregadas:', this.transactions.length);

        } catch (error) {
            console.error('[loadFromFirestore] Erro ao carregar dados:', error);
        }
    }

    // Configurar listeners em tempo real
    setupRealtimeListeners() {
        if (!this.userId) return;

        console.log('[setupRealtimeListeners] Configurando listeners para userId:', this.userId);

        // Observar mudanças no saldo
        const unsubBalance = watchBalance(this.userId, (newBalance) => {
            console.log('[setupRealtimeListeners] Callback do saldo - Novo valor:', newBalance);
            this.balance = newBalance;
            this.updateDisplay();
        });

        // Observar mudanças nas transações
        const unsubTransactions = watchTransactions(this.userId, (transactions) => {
            console.log('[setupRealtimeListeners] Callback de transações - Quantidade:', transactions.length);
            this.transactions = transactions;
            this.updateDisplay();
            this.generateReports();
        });

        this.unsubscribers.push(unsubBalance, unsubTransactions);
    }

    // Adicionar nova transação (recarga)
    async addTransaction(type, category, amount, description, metadata = {}) {
        if (!this.userId) {
            this.showNotification('Usuário não autenticado', 'error');
            return false;
        }

        amount = parseFloat(amount);

        try {
            if (type === 'income') {
                // Recarga de saldo
                const result = await rechargeBalance(this.userId, amount);

                if (result.success) {
                    this.showNotification(`Crédito de R$ ${amount.toFixed(2)} processado`, 'success');
                    return { success: true, newBalance: result.newBalance };
                } else {
                    this.showNotification(result.error || 'Erro ao processar crédito', 'error');
                    return false;
                }
            } else {
                // Débito (compra de passagem ou outro)
                if (this.balance < amount) {
                    this.showNotification('Saldo insuficiente!', 'error');
                    return false;
                }

                // Usar purchaseTicket se for passagem
                if (category === 'transporte') {
                    const routeId = metadata.routeId || 'generic';
                    const result = await purchaseTicket(this.userId, routeId, amount);

                    if (result.success) {
                        this.showNotification(`Débito de R$ ${amount.toFixed(2)} processado`, 'success');
                        return { success: true, newBalance: result.newBalance };
                    } else {
                        this.showNotification(result.error || 'Erro ao processar débito', 'error');
                        return false;
                    }
                } else {
                    // Outros tipos de débito (implementar função genérica se necessário)
                    this.showNotification('Tipo de débito não suportado ainda', 'warning');
                    return false;
                }
            }
        } catch (error) {
            this.showNotification('Erro ao processar transação', 'error');
            return false;
        }
    }

    // Buscar transações com filtros (local, após carregar do Firestore)
    getTransactions(filters = {}) {
        let filtered = [...this.transactions];

        if (filters.type) {
            filtered = filtered.filter(t => t.type === filters.type);
        }

        if (filters.category) {
            filtered = filtered.filter(t => t.category === filters.category);
        }

        if (filters.startDate) {
            filtered = filtered.filter(t => {
                const transDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                return transDate >= new Date(filters.startDate);
            });
        }

        if (filters.endDate) {
            filtered = filtered.filter(t => {
                const transDate = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                return transDate <= new Date(filters.endDate);
            });
        }

        if (filters.minAmount) {
            filtered = filtered.filter(t => t.amount >= filters.minAmount);
        }

        if (filters.maxAmount) {
            filtered = filtered.filter(t => t.amount <= filters.maxAmount);
        }

        return filtered.sort((a, b) => {
            const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp);
            const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
            return dateB - dateA;
        });
    }

    // Estatísticas financeiras
    getStatistics(period = 'month') {
        const now = new Date();
        let startDate;

        switch(period) {
            case 'day':
                startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                break;
            case 'week':
                startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                break;
            case 'month':
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'year':
                startDate = new Date(now.getFullYear(), 0, 1);
                break;
        }

        const periodTransactions = this.getTransactions({ startDate });

        const stats = {
            totalIncome: 0,
            totalExpense: 0,
            balance: this.balance,
            transactionCount: periodTransactions.length,
            averageTransaction: 0,
            categorySummary: {},
            dailyAverage: 0,
            peakHour: null,
            mostUsedRoute: null
        };

        // Calcular totais
        periodTransactions.forEach(t => {
            if (t.type === 'credit') {
                stats.totalIncome += t.amount;
            } else if (t.type === 'debit') {
                stats.totalExpense += t.amount;
            }

            // Agrupar por categoria
            if (!stats.categorySummary[t.category]) {
                stats.categorySummary[t.category] = {
                    count: 0,
                    total: 0,
                    percentage: 0
                };
            }
            stats.categorySummary[t.category].count++;
            stats.categorySummary[t.category].total += t.amount;
        });

        // Calcular médias
        if (periodTransactions.length > 0) {
            stats.averageTransaction = (stats.totalIncome + stats.totalExpense) / periodTransactions.length;

            const days = Math.ceil((now - startDate) / (1000 * 60 * 60 * 24));
            stats.dailyAverage = stats.totalExpense / days;
        }

        // Calcular porcentagens por categoria
        const totalSpent = stats.totalExpense;
        Object.keys(stats.categorySummary).forEach(cat => {
            stats.categorySummary[cat].percentage =
                totalSpent > 0 ? (stats.categorySummary[cat].total / totalSpent) * 100 : 0;
        });

        // Encontrar horário de pico
        const hourCounts = {};
        periodTransactions.forEach(t => {
            const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            const hour = date.getHours();
            hourCounts[hour] = (hourCounts[hour] || 0) + 1;
        });

        let maxCount = 0;
        Object.entries(hourCounts).forEach(([hour, count]) => {
            if (count > maxCount) {
                maxCount = count;
                stats.peakHour = parseInt(hour);
            }
        });

        return stats;
    }

    // Gerar relatório
    generateReport(period = 'month', format = 'html') {
        const stats = this.getStatistics(period);
        const transactions = this.getTransactions({
            startDate: period === 'month' ?
                new Date(new Date().getFullYear(), new Date().getMonth(), 1) :
                new Date(new Date().getFullYear(), 0, 1)
        });

        if (format === 'html') {
            return `
                <div class="financial-report">
                    <h2>Relatório Financeiro - ${period === 'month' ? 'Mensal' : 'Anual'}</h2>

                    <div class="summary-cards">
                        <div class="card income">
                            <h3>Entradas</h3>
                            <p class="amount">R$ ${stats.totalIncome.toFixed(2)}</p>
                        </div>
                        <div class="card expense">
                            <h3>Saídas</h3>
                            <p class="amount">R$ ${stats.totalExpense.toFixed(2)}</p>
                        </div>
                        <div class="card balance">
                            <h3>Saldo</h3>
                            <p class="amount">R$ ${stats.balance.toFixed(2)}</p>
                        </div>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="label">Transações:</span>
                            <span class="value">${stats.transactionCount}</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Média por transação:</span>
                            <span class="value">R$ ${stats.averageTransaction.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Gasto diário médio:</span>
                            <span class="value">R$ ${stats.dailyAverage.toFixed(2)}</span>
                        </div>
                        <div class="stat-item">
                            <span class="label">Horário de pico:</span>
                            <span class="value">${stats.peakHour !== null ? stats.peakHour + 'h' : 'N/A'}</span>
                        </div>
                    </div>

                    <div class="category-breakdown">
                        <h3>Gastos por Categoria</h3>
                        ${Object.entries(stats.categorySummary).map(([cat, data]) => `
                            <div class="category-item">
                                <span class="category-name">${this.getCategoryName(cat)}</span>
                                <div class="category-bar">
                                    <div class="category-fill" style="width: ${data.percentage}%"></div>
                                </div>
                                <span class="category-amount">R$ ${data.total.toFixed(2)} (${data.percentage.toFixed(1)}%)</span>
                            </div>
                        `).join('')}
                    </div>

                    <div class="chart-container">
                        <canvas id="expenseChart"></canvas>
                    </div>
                </div>
            `;
        }

        return stats;
    }

    // Exportar dados
    exportData(format = 'csv') {
        const transactions = this.getTransactions();

        if (format === 'csv') {
            let csv = 'Data,Tipo,Categoria,Descrição,Valor,Saldo Após\n';
            transactions.forEach(t => {
                const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                csv += `${date.toLocaleString('pt-BR')},`;
                csv += `${t.type === 'income' ? 'Crédito' : 'Débito'},`;
                csv += `${this.getCategoryName(t.category)},`;
                csv += `${t.description || 'N/A'},`;
                csv += `${t.amount.toFixed(2)},`;
                csv += `${t.balance_after.toFixed(2)}\n`;
            });

            // Download CSV
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `busway_extrato_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            this.showNotification('Extrato exportado com sucesso!', 'success');
        } else if (format === 'json') {
            const dataStr = JSON.stringify(transactions, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `busway_extrato_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            this.showNotification('Dados exportados com sucesso!', 'success');
        }
    }

    // Previsão de gastos
    predictExpenses(days = 30) {
        const lastMonth = this.getTransactions({
            startDate: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
        });

        const dailyExpenses = {};
        lastMonth.forEach(t => {
            if (t.type === 'expense') {
                const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
                const day = date.toISOString().split('T')[0];
                dailyExpenses[day] = (dailyExpenses[day] || 0) + t.amount;
            }
        });

        const avgDaily = Object.values(dailyExpenses).reduce((a, b) => a + b, 0) /
                        (Object.keys(dailyExpenses).length || 1);

        return {
            predictedExpense: avgDaily * days,
            dailyAverage: avgDaily,
            suggestion: this.generateSuggestion(avgDaily)
        };
    }

    generateSuggestion(avgDaily) {
        if (avgDaily > 20) {
            return 'Considere usar passes mensais para economizar';
        } else if (avgDaily > 10) {
            return 'Seu gasto está na média. Continue monitorando';
        } else {
            return 'Excelente controle de gastos!';
        }
    }

    // Configurar recarga automática
    async setupAutoRecharge(config) {
        const autoRecharge = {
            enabled: config.enabled,
            threshold: config.threshold || 10,
            amount: config.amount || 50,
            paymentMethod: config.paymentMethod || 'pix'
        };

        // Salvar configuração no Firestore (nas preferências do usuário)
        if (this.userId) {
            const currentPrefs = await getUserPreferences(this.userId) || {};
            await updateUserPreferences(this.userId, {
                ...currentPrefs,
                autoRecharge: autoRecharge
            });
        }

        if (autoRecharge.enabled && this.balance < autoRecharge.threshold) {
            this.processAutoRecharge(autoRecharge);
        }
    }

    async processAutoRecharge(config) {
        await this.addTransaction('income', 'recarga', config.amount,
            `Recarga automática via ${config.paymentMethod.toUpperCase()}`,
            { auto: true, method: config.paymentMethod }
        );
    }

    // Utilitários
    getCategoryName(category) {
        return this.categories.credit[category] ||
               this.categories.debit[category] ||
               category;
    }

    formatCurrency(value) {
        return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }

    setupEventListeners() {
        // Implementar listeners para UI
    }

    updateDisplay() {
        console.log('[updateDisplay] Atualizando display com saldo:', this.balance);

        // Atualizar elementos da interface
        const balanceEl = document.getElementById('mainBalance');
        if (balanceEl) {
            balanceEl.textContent = this.balance.toFixed(2).replace('.', ',');
            console.log('[updateDisplay] Saldo atualizado no HTML:', balanceEl.textContent);
        } else {
            console.warn('[updateDisplay] Elemento mainBalance não encontrado');
        }

        // Atualizar entradas e saídas mensais
        const stats = this.getStatistics('month');
        const monthlyIncomeEl = document.getElementById('monthlyIncome');
        const monthlyExpenseEl = document.getElementById('monthlyExpense');

        if (monthlyIncomeEl) {
            monthlyIncomeEl.textContent = stats.totalIncome.toFixed(2).replace('.', ',');
            console.log('[updateDisplay] Entradas mensais atualizadas:', stats.totalIncome);
        }

        if (monthlyExpenseEl) {
            monthlyExpenseEl.textContent = stats.totalExpense.toFixed(2).replace('.', ',');
            console.log('[updateDisplay] Saídas mensais atualizadas:', stats.totalExpense);
        }

        const transactionsEl = document.getElementById('transactionsList');
        if (transactionsEl) {
            this.renderTransactionsList(transactionsEl);
        }
    }

    renderTransactionsList(container) {
        const recentTransactions = this.getTransactions().slice(0, 10);

        if (recentTransactions.length === 0) {
            container.innerHTML = '<p class="no-transactions">Nenhuma transação realizada</p>';
            return;
        }

        container.innerHTML = recentTransactions.map(t => {
            const date = t.timestamp?.toDate ? t.timestamp.toDate() : new Date(t.timestamp);
            const isCredit = t.type === 'credit';
            return `
            <div class="transaction-item ${t.type}">
                <div class="transaction-icon">
                    ${isCredit ? '↓' : '↑'}
                </div>
                <div class="transaction-details">
                    <div class="transaction-desc">${t.description || 'Transação'}</div>
                    <div class="transaction-date">${date.toLocaleString('pt-BR')}</div>
                    <div class="transaction-category">${this.getCategoryName(t.category)}</div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${isCredit ? '+' : '-'} ${this.formatCurrency(t.amount)}
                </div>
            </div>
        `;
        }).join('');
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast') || document.getElementById('notification');
        if (toast) {
            toast.textContent = message;
            toast.className = `notification-toast ${type} show`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
        } else {
        }
    }

    generateReports() {
        // Gerar gráficos usando Chart.js se disponível
        if (typeof Chart !== 'undefined') {
            this.renderExpenseChart();
            this.renderTrendChart();
        }
    }

    renderExpenseChart() {
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;

        const stats = this.getStatistics('month');
        const categories = Object.keys(stats.categorySummary);
        const values = categories.map(c => stats.categorySummary[c].total);

        if (categories.length === 0) {
            canvas.parentElement.innerHTML = '<p style="text-align:center;color:#999;">Sem dados para exibir</p>';
            return;
        }

        new Chart(canvas, {
            type: 'pie',
            data: {
                labels: categories.map(c => this.getCategoryName(c)),
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#c7ecee',
                        '#778beb', '#f8b500', '#18dcff', '#fd79a8'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }

    renderTrendChart() {
        const canvas = document.getElementById('trendChart');
        if (!canvas) return;

        // Dados dos últimos 7 dias
        const days = [];
        const expenses = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dayStr = date.toISOString().split('T')[0];

            days.push(date.toLocaleDateString('pt-BR', { weekday: 'short' }));

            const dayTransactions = this.getTransactions({
                startDate: dayStr,
                endDate: dayStr + 'T23:59:59',
                type: 'expense'
            });

            const total = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
            expenses.push(total);
        }

        new Chart(canvas, {
            type: 'line',
            data: {
                labels: days,
                datasets: [{
                    label: 'Gastos Diários',
                    data: expenses,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => 'R$ ' + value.toFixed(2)
                        }
                    }
                }
            }
        });
    }

    // Limpar observers ao destruir
    destroy() {
        this.unsubscribers.forEach(unsubscribe => unsubscribe());
        this.unsubscribers = [];
    }
}

// Inicializar sistema financeiro
let financialControl;

// Aguardar DOM e Firebase carregar
document.addEventListener('DOMContentLoaded', async () => {
    // Aguardar um pouco para garantir que Firebase carregou
    await new Promise(resolve => setTimeout(resolve, 500));

    financialControl = new FinancialControl();

    // Exportar para uso global
    window.FinancialControl = FinancialControl;
    window.financialControl = financialControl;

});
