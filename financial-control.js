// Sistema de Controle Financeiro Completo
class FinancialControl {
    constructor() {
        this.transactions = JSON.parse(localStorage.getItem('transactions')) || [];
        this.balance = parseFloat(localStorage.getItem('userBalance')) || 0;
        this.categories = {
            credit: {
                recharge: 'Recarga',
                refund: 'Reembolso',
                promotion: 'Promoção',
                transfer_in: 'Transferência Recebida'
            },
            debit: {
                trip: 'Passagem',
                transfer_out: 'Transferência Enviada',
                service: 'Taxa de Serviço',
                penalty: 'Multa'
            }
        };
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateDisplay();
        this.generateReports();
    }

    // Adicionar nova transação
    addTransaction(type, category, amount, description, metadata = {}) {
        const transaction = {
            id: Date.now() + Math.random(),
            type, // credit ou debit
            category,
            amount: parseFloat(amount),
            description,
            date: new Date().toISOString(),
            balance_after: this.balance + (type === 'credit' ? amount : -amount),
            metadata,
            status: 'completed'
        };

        // Atualizar saldo
        if (type === 'credit') {
            this.balance += amount;
        } else {
            if (this.balance >= amount) {
                this.balance -= amount;
            } else {
                transaction.status = 'failed';
                transaction.failure_reason = 'Saldo insuficiente';
                this.showNotification('Saldo insuficiente!', 'error');
                return false;
            }
        }

        this.transactions.push(transaction);
        this.saveData();
        this.updateDisplay();
        this.showNotification(`${type === 'credit' ? 'Crédito' : 'Débito'} de R$ ${amount.toFixed(2)} processado`, 'success');
        
        return transaction;
    }

    // Buscar transações com filtros
    getTransactions(filters = {}) {
        let filtered = [...this.transactions];

        if (filters.type) {
            filtered = filtered.filter(t => t.type === filters.type);
        }

        if (filters.category) {
            filtered = filtered.filter(t => t.category === filters.category);
        }

        if (filters.startDate) {
            filtered = filtered.filter(t => new Date(t.date) >= new Date(filters.startDate));
        }

        if (filters.endDate) {
            filtered = filtered.filter(t => new Date(t.date) <= new Date(filters.endDate));
        }

        if (filters.minAmount) {
            filtered = filtered.filter(t => t.amount >= filters.minAmount);
        }

        if (filters.maxAmount) {
            filtered = filtered.filter(t => t.amount <= filters.maxAmount);
        }

        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
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
            } else {
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
                (stats.categorySummary[cat].total / totalSpent) * 100;
        });

        // Encontrar horário de pico
        const hourCounts = {};
        periodTransactions.forEach(t => {
            const hour = new Date(t.date).getHours();
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
                            <span class="value">${stats.peakHour}h</span>
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
                csv += `${new Date(t.date).toLocaleString('pt-BR')},`;
                csv += `${t.type === 'credit' ? 'Crédito' : 'Débito'},`;
                csv += `${this.getCategoryName(t.category)},`;
                csv += `${t.description},`;
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
        } else if (format === 'json') {
            const dataStr = JSON.stringify(transactions, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `busway_extrato_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        }
    }

    // Previsão de gastos
    predictExpenses(days = 30) {
        const lastMonth = this.getTransactions({
            startDate: new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000)
        });

        const dailyExpenses = {};
        lastMonth.forEach(t => {
            if (t.type === 'debit') {
                const day = new Date(t.date).toISOString().split('T')[0];
                dailyExpenses[day] = (dailyExpenses[day] || 0) + t.amount;
            }
        });

        const avgDaily = Object.values(dailyExpenses).reduce((a, b) => a + b, 0) / 
                        Object.keys(dailyExpenses).length || 0;

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
    setupAutoRecharge(config) {
        const autoRecharge = {
            enabled: config.enabled,
            threshold: config.threshold || 10,
            amount: config.amount || 50,
            paymentMethod: config.paymentMethod || 'pix'
        };

        localStorage.setItem('autoRecharge', JSON.stringify(autoRecharge));

        if (autoRecharge.enabled && this.balance < autoRecharge.threshold) {
            this.processAutoRecharge(autoRecharge);
        }
    }

    processAutoRecharge(config) {
        this.addTransaction('credit', 'recharge', config.amount, 
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

    saveData() {
        localStorage.setItem('transactions', JSON.stringify(this.transactions));
        localStorage.setItem('userBalance', this.balance.toString());
    }

    setupEventListeners() {
        // Implementar listeners para UI
    }

    updateDisplay() {
        // Atualizar elementos da interface
        const balanceEl = document.getElementById('balanceAmount');
        if (balanceEl) {
            balanceEl.textContent = this.balance.toFixed(2).replace('.', ',');
        }

        const transactionsEl = document.getElementById('transactionsList');
        if (transactionsEl) {
            this.renderTransactionsList(transactionsEl);
        }
    }

    renderTransactionsList(container) {
        const recentTransactions = this.getTransactions().slice(0, 10);
        
        container.innerHTML = recentTransactions.map(t => `
            <div class="transaction-item ${t.type}">
                <div class="transaction-icon">
                    ${t.type === 'credit' ? '↓' : '↑'}
                </div>
                <div class="transaction-details">
                    <div class="transaction-desc">${t.description}</div>
                    <div class="transaction-date">${new Date(t.date).toLocaleString('pt-BR')}</div>
                    <div class="transaction-category">${this.getCategoryName(t.category)}</div>
                </div>
                <div class="transaction-amount ${t.type}">
                    ${t.type === 'credit' ? '+' : '-'} ${this.formatCurrency(t.amount)}
                </div>
            </div>
        `).join('') || '<p class="no-transactions">Nenhuma transação realizada</p>';
    }

    showNotification(message, type = 'info') {
        const toast = document.getElementById('notificationToast');
        if (toast) {
            toast.textContent = message;
            toast.className = `notification-toast ${type} show`;
            setTimeout(() => {
                toast.classList.remove('show');
            }, 3000);
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
                type: 'debit'
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
}

// Inicializar sistema financeiro
const financialControl = new FinancialControl();

// Exportar para uso global
window.FinancialControl = FinancialControl;
window.financialControl = financialControl;