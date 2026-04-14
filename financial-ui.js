// Interface do Usuário para Controle Financeiro
class FinancialUI {
    constructor() {
        this.currentPeriod = 'month';
        this.currentPage = 0;
        this.transactionsPerPage = 20;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateUI();
        this.setupAutoRecharge();
    }

    setupEventListeners() {
        // Tabs de período
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.currentPeriod = btn.dataset.period;
                this.updateStatistics();
            });
        });

        // Botões de valor no modal
        document.querySelectorAll('.amount-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.amount-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById('customAmount').value = btn.dataset.amount;
            });
        });

        // Toggle de recarga automática
        const autoRechargeToggle = document.getElementById('autoRechargeToggle');
        autoRechargeToggle.addEventListener('change', (e) => {
            const settings = document.getElementById('autoRechargeSettings');
            if (e.target.checked) {
                settings.classList.add('active');
            } else {
                settings.classList.remove('active');
            }
        });

        // Filtros
        document.getElementById('categoryFilter').addEventListener('change', () => this.applyFilters());
        document.getElementById('typeFilter').addEventListener('change', () => this.applyFilters());

        // Views de transação
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.changeView(btn.dataset.view);
            });
        });
    }

    updateUI() {
        this.updateBalance();
        this.updateStatistics();
        this.updateTransactionsList();
        this.updateCharts();
    }

    updateBalance() {
        const mainBalance = document.getElementById('mainBalance');
        if (mainBalance) {
            mainBalance.textContent = financialControl.balance.toFixed(2).replace('.', ',');
        }

        const stats = financialControl.getStatistics('month');
        
        const monthlyIncome = document.getElementById('monthlyIncome');
        if (monthlyIncome) {
            monthlyIncome.textContent = stats.totalIncome.toFixed(2).replace('.', ',');
        }

        const monthlyExpense = document.getElementById('monthlyExpense');
        if (monthlyExpense) {
            monthlyExpense.textContent = stats.totalExpense.toFixed(2).replace('.', ',');
        }
    }

    updateStatistics() {
        const stats = financialControl.getStatistics(this.currentPeriod);
        
        // Gasto médio diário
        const dailyAverage = document.getElementById('dailyAverage');
        if (dailyAverage) {
            dailyAverage.textContent = stats.dailyAverage.toFixed(2).replace('.', ',');
        }

        // Previsão mensal
        const prediction = financialControl.predictExpenses(30);
        const monthlyPrediction = document.getElementById('monthlyPrediction');
        if (monthlyPrediction) {
            monthlyPrediction.textContent = prediction.predictedExpense.toFixed(2).replace('.', ',');
        }

        const suggestion = document.getElementById('suggestion');
        if (suggestion) {
            suggestion.textContent = prediction.suggestion;
        }

        // Viagens do mês
        const tripTransactions = financialControl.getTransactions({
            type: 'debit',
            category: 'trip',
            startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1)
        });

        const monthlyTrips = document.getElementById('monthlyTrips');
        if (monthlyTrips) {
            monthlyTrips.textContent = tripTransactions.length;
        }

        // Economia estimada (vs táxi/uber)
        const savings = tripTransactions.length * 15; // Economia média por viagem
        const savingsEl = document.getElementById('savings');
        if (savingsEl) {
            savingsEl.textContent = savings.toFixed(2).replace('.', ',');
        }

        // Tendência
        this.updateTrend();
    }

    updateTrend() {
        const currentStats = financialControl.getStatistics(this.currentPeriod);
        const previousPeriod = this.getPreviousPeriod();
        const previousStats = financialControl.getStatistics(previousPeriod);
        
        const change = ((currentStats.dailyAverage - previousStats.dailyAverage) / previousStats.dailyAverage) * 100;
        const trendEl = document.getElementById('dailyTrend');
        
        if (trendEl) {
            const arrow = change > 0 ? '↑' : '↓';
            const color = change > 0 ? '#ef4444' : '#10b981';
            trendEl.innerHTML = `<span style="color: ${color}">${arrow} ${Math.abs(change).toFixed(1)}%</span>`;
        }
    }

    getPreviousPeriod() {
        switch(this.currentPeriod) {
            case 'day':
                return new Date(Date.now() - 24 * 60 * 60 * 1000);
            case 'week':
                return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                const lastMonth = new Date();
                lastMonth.setMonth(lastMonth.getMonth() - 1);
                return lastMonth;
            case 'year':
                const lastYear = new Date();
                lastYear.setFullYear(lastYear.getFullYear() - 1);
                return lastYear;
        }
    }

    updateTransactionsList() {
        const container = document.getElementById('transactionsList');
        if (!container) return;

        const filters = this.getCurrentFilters();
        const transactions = financialControl.getTransactions(filters)
            .slice(0, (this.currentPage + 1) * this.transactionsPerPage);

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>Nenhuma transação encontrada</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(t => this.renderTransaction(t)).join('');
    }

    renderTransaction(transaction) {
        const typeIcon = transaction.type === 'credit' ? '↓' : '↑';
        const formattedDate = new Date(transaction.date).toLocaleString('pt-BR');
        const categoryName = financialControl.getCategoryName(transaction.category);
        
        return `
            <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
                <div class="transaction-icon">${typeIcon}</div>
                <div class="transaction-details">
                    <div class="transaction-desc">${transaction.description}</div>
                    <div class="transaction-date">${formattedDate}</div>
                    <div class="transaction-category">${categoryName}</div>
                    ${transaction.status === 'failed' ? `
                        <div class="transaction-error">
                            Falhou: ${transaction.failure_reason}
                        </div>
                    ` : ''}
                </div>
                <div class="transaction-amount ${transaction.type}">
                    ${transaction.type === 'credit' ? '+' : '-'} ${financialControl.formatCurrency(transaction.amount)}
                </div>
            </div>
        `;
    }

    getCurrentFilters() {
        return {
            category: document.getElementById('categoryFilter')?.value || '',
            type: document.getElementById('typeFilter')?.value || '',
            startDate: this.getPeriodStartDate()
        };
    }

    getPeriodStartDate() {
        const now = new Date();
        switch(this.currentPeriod) {
            case 'day':
                return new Date(now.getFullYear(), now.getMonth(), now.getDate());
            case 'week':
                return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                return new Date(now.getFullYear(), now.getMonth(), 1);
            case 'year':
                return new Date(now.getFullYear(), 0, 1);
            default:
                return null;
        }
    }

    applyFilters() {
        this.currentPage = 0;
        this.updateTransactionsList();
    }

    changeView(view) {
        const container = document.getElementById('transactionsList');
        if (view === 'grid') {
            container.classList.add('grid-view');
        } else {
            container.classList.remove('grid-view');
        }
    }

    updateCharts() {
        // Gráfico de tendência
        this.renderTrendChart();
        
        // Gráfico de categorias
        this.renderCategoryChart();
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
            
            days.push(date.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric' }));
            
            const dayTransactions = financialControl.getTransactions({
                startDate: new Date(dayStr),
                endDate: new Date(dayStr + 'T23:59:59'),
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
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => 'R$ ' + value.toFixed(2)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    renderCategoryChart() {
        const canvas = document.getElementById('expenseChart');
        if (!canvas) return;

        const stats = financialControl.getStatistics(this.currentPeriod);
        const categories = Object.keys(stats.categorySummary);
        const values = categories.map(c => stats.categorySummary[c].total);

        if (categories.length === 0) {
            canvas.style.display = 'none';
            return;
        }

        canvas.style.display = 'block';

        new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: categories.map(c => financialControl.getCategoryName(c)),
                datasets: [{
                    data: values,
                    backgroundColor: [
                        '#667eea', '#764ba2', '#f093fb', '#c7ecee',
                        '#778beb', '#f8b500', '#18dcff', '#fd79a8',
                        '#a29bfe', '#6c5ce7', '#fd79a8', '#fdcb6e'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const percentage = ((value / values.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                                return `${context.label}: R$ ${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    setupAutoRecharge() {
        const saved = localStorage.getItem('autoRecharge');
        if (saved) {
            const config = JSON.parse(saved);
            document.getElementById('autoRechargeToggle').checked = config.enabled;
            document.getElementById('rechargeThreshold').value = config.threshold;
            document.getElementById('rechargeAmount').value = config.amount;
            document.getElementById('rechargeMethod').value = config.paymentMethod;
            
            if (config.enabled) {
                document.getElementById('autoRechargeSettings').classList.add('active');
            }
        }
    }
}

// Funções globais para interação com UI
function openAddFundsModal() {
    document.getElementById('addFundsModal').style.display = 'flex';
}

function closeAddFundsModal() {
    document.getElementById('addFundsModal').style.display = 'none';
    document.getElementById('fundAmount').value = '';
    document.getElementById('displayAmount').textContent = '0,00';
}

// Atualizar display do valor enquanto digita
document.addEventListener('DOMContentLoaded', function() {
    const fundAmountInput = document.getElementById('fundAmount');
    if (fundAmountInput) {
        fundAmountInput.addEventListener('input', (e) => {
            const amount = parseFloat(e.target.value) || 0;
            document.getElementById('displayAmount').textContent = amount.toFixed(2).replace('.', ',');
        });
    }
});

async function processFundAddition() {
    const amount = parseFloat(document.getElementById('fundAmount').value);
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;

    console.log('[processFundAddition] Iniciando recarga de R$', amount);

    if (isNaN(amount) || amount < 5) {
        alert('Valor mínimo: R$ 5,00');
        return;
    }

    // Obter userId da sessão
    const session = sessionStorage.getItem('buswaySession');
    if (!session) {
        alert('Sessão inválida. Faça login novamente.');
        return;
    }

    const sessionData = JSON.parse(session);
    const userId = sessionData.uid || sessionData.id;

    console.log('[processFundAddition] UserID:', userId);

    if (!userId) {
        alert('Erro: ID do usuário não encontrado');
        return;
    }

    try {
        // Chamar função de recarga do Firestore diretamente
        console.log('[processFundAddition] Chamando rechargeBalance...');
        const result = await rechargeBalance(userId, amount);

        console.log('[processFundAddition] Resultado da recarga:', result);

        if (result && result.success) {
            console.log('[processFundAddition] Recarga bem-sucedida! Novo saldo:', result.newBalance);
            alert(`R$ ${amount.toFixed(2)} adicionado com sucesso via ${paymentMethod.toUpperCase()}!`);
            closeAddFundsModal();

            // Atualizar display do saldo na página
            if (document.getElementById('mainBalance')) {
                document.getElementById('mainBalance').textContent = result.newBalance.toFixed(2).replace('.', ',');
            }

            // Recarregar página para atualizar todas as informações
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } else {
            console.error('[processFundAddition] Erro na recarga:', result.error);
            alert('Erro ao processar recarga: ' + (result.error || 'Erro desconhecido'));
        }
    } catch (error) {
        console.error('[processFundAddition] Exceção capturada:', error);
        alert('Erro ao processar recarga: ' + error.message);
    }
}

function saveAutoRecharge() {
    const config = {
        enabled: document.getElementById('autoRechargeToggle').checked,
        threshold: parseFloat(document.getElementById('rechargeThreshold').value),
        amount: parseFloat(document.getElementById('rechargeAmount').value),
        paymentMethod: document.getElementById('rechargeMethod').value
    };

    financialControl.setupAutoRecharge(config);
    financialControl.showNotification('Configurações salvas!', 'success');
}

function loadMoreTransactions() {
    financialUI.currentPage++;
    financialUI.updateTransactionsList();
}

function applyFilters() {
    financialUI.applyFilters();
}

// Inicializar UI
const financialUI = new FinancialUI();

// Exportar para uso global
window.FinancialUI = FinancialUI;
window.financialUI = financialUI;