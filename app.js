// ==========================================================================
// APPLICATION CONTROLLER - DASHBOARD COMERCIAL (ANTIGRAVITY SALES INTELLIGENCE)
// ==========================================================================

const bootDashboard = () => {
    // 1. Initial State
    const state = {
        data: DASHBOARD_DATA,
        activeTab: 'general',
        monthlyComparisonMode: 'net',
        searchQuery: '',
        statusFilter: 'all',
        sortColumn: 'id',
        sortDirection: 'asc',
        selectedAgentId: null,
        selectedRankingAgentId: null,
        selectedClientMonthlyKey: null,
        selectedFranchiseYear: '2026',
        franchiseClientSearchQuery: '',
        clientSearchQuery: '',
        clientMonthlySearchQuery: '',
        charts: {
            monthlyTrend: null,
            agentShare: null,
            agentMonthly: null,
            rankingAgentMonthly: null,
            franchiseShare: null,
            franchiseStacked: null,
            franchiseProgression: null
        }
    };

    const ALERT_THRESHOLDS = {
        lowMarginPct: 5,
        criticalDeviationPct: -10
    };

    const toNumber = (val) => parseFloat(val || 0);
    const monthsKeys = state.data.months || ['FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC', 'ENE'];

    const buildMonthlyMap = (sourceMap = {}) => {
        const result = {};
        monthsKeys.forEach(month => {
            result[month] = toNumber(sourceMap[month]);
        });
        return result;
    };

    const compareClientCodeAsc = (a, b) => {
        const aNum = Number(a.id);
        const bNum = Number(b.id);
        const aIsNum = Number.isFinite(aNum);
        const bIsNum = Number.isFinite(bNum);

        if (aIsNum && bIsNum) return aNum - bNum;
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;
        return String(a.id).localeCompare(String(b.id));
    };

    // Calculate dynamic state-wide calculated fields for agents
    state.data.agents = state.data.agents.map(agent => {
        const sales_2026 = toNumber(agent.sales_2026_ytd);
        const budget_2026 = toNumber(agent.budget_2026_ytd);
        const sales_2025 = toNumber(agent.sales_2025_ytd);
        const profit_2026 = toNumber(agent.profit_2026_ytd);

        const deviation_pct = budget_2026 > 0 ? ((sales_2026 - budget_2026) / budget_2026) * 100 : 0;
        const growth_pct = sales_2025 > 0 ? ((sales_2026 - sales_2025) / sales_2025) * 100 : 0;
        const margin_pct = sales_2026 > 0 ? (profit_2026 / sales_2026) * 100 : 0;

        const clients = (agent.clients || []).map(client => {
            const cSales2025Monthly = buildMonthlyMap(client.sales_2025_monthly);
            const cBudget2026Monthly = buildMonthlyMap(client.budget_2026_monthly);
            const cSales2026Monthly = buildMonthlyMap(client.sales_2026_monthly);
            const cProfit2026Monthly = buildMonthlyMap(client.profit_2026_monthly);
            const cSales2025 = toNumber(client.sales_2025);
            const cBudget2026 = toNumber(client.budget_2026);
            const cSales2026 = toNumber(client.sales_2026 || client.sales_2026_ytd);
            const cProfit2026 = toNumber(client.profit_2026 || client.profit_2026_ytd);

            return {
                ...client,
                sales_2025: cSales2025,
                budget_2026: cBudget2026,
                sales_2026: cSales2026,
                profit_2026: cProfit2026,
                sales_2025_monthly: cSales2025Monthly,
                budget_2026_monthly: cBudget2026Monthly,
                sales_2026_monthly: cSales2026Monthly,
                profit_2026_monthly: cProfit2026Monthly,
                deviation_pct: cBudget2026 > 0 ? ((cSales2026 - cBudget2026) / cBudget2026) * 100 : 0,
                growth_pct: cSales2025 > 0 ? ((cSales2026 - cSales2025) / cSales2025) * 100 : 0,
                margin_pct: cSales2026 > 0 ? (cProfit2026 / cSales2026) * 100 : 0
            };
        });

        return {
            ...agent,
            sales_2026_ytd: sales_2026,
            budget_2026_ytd: budget_2026,
            sales_2025_ytd: sales_2025,
            profit_2026_ytd: profit_2026,
            deviation_pct,
            growth_pct,
            margin_pct,
            clients
        };
    });

    const getYtdPeriodLabel = () => {
        const ytd = state.data.ytd_months || [];
        if (ytd.length === 0) return 'Sin datos reales';
        if (ytd.length === 1) return ytd[0].toLowerCase().replace(/^./, c => c.toUpperCase());
        const first = ytd[0].toLowerCase().replace(/^./, c => c.toUpperCase());
        const last = ytd[ytd.length - 1].toLowerCase().replace(/^./, c => c.toUpperCase());
        return `${first} - ${last}`;
    };

    // Default to the first agent in the list for the Detail view
    if (state.data.agents.length > 0) {
        // Keep a stable base order by agent ID (ascending)
        state.data.agents.sort((a, b) => a.id - b.id);
        state.selectedAgentId = state.data.agents[0].id;
        state.selectedRankingAgentId = state.data.agents[0].id;
    }

    // Chart.js Global Configuration for Premium Look
    Chart.defaults.font.family = "'Outfit', sans-serif";
    Chart.defaults.font.size = 12;
    Chart.defaults.color = 'hsl(220, 16%, 66%)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'hsl(224, 40%, 10%)';
    Chart.defaults.plugins.tooltip.borderColor = 'hsla(222, 30%, 20%, 0.6)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.titleFont = { size: 13, weight: 700 };
    Chart.defaults.plugins.tooltip.bodyFont = { size: 12 };
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 8;

    // 2. Formatters Helpers
    const formatCurrency = (val) => {
        return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
    };

    const formatPercent = (val) => {
        const sign = val > 0 ? '+' : '';
        return `${sign}${new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(val)}%`;
    };

    const formatShortNum = (val) => {
        if (Math.abs(val) >= 1e6) {
            return (val / 1e6).toFixed(1) + 'M €';
        } else if (Math.abs(val) >= 1e3) {
            return (val / 1e3).toFixed(0) + 'k €';
        }
        return val.toFixed(0) + ' €';
    };

    const formatAsOfDate = (rawDate) => {
        if (!rawDate) return 'Sin fecha';

        // data.js usa ISO (YYYY-MM-DD), y mostramos formato operativo DD-MM-YYYY.
        if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
            const [year, month, day] = rawDate.split('-');
            return `${day}-${month}-${year}`;
        }

        if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
            const [day, month, year] = rawDate.split('/');
            return `${day}-${month}-${year}`;
        }

        return rawDate;
    };

    // 3. Navigation setup
    const setupNavigation = () => {
        const menuButtons = document.querySelectorAll('.menu-item');
        menuButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                
                // Remove active classes
                menuButtons.forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(tc => tc.classList.remove('active'));
                
                // Add active classes
                btn.classList.add('active');
                const targetEl = document.getElementById(`tab-${targetTab}`);
                if (targetEl) targetEl.classList.add('active');
                
                // Update header text based on active tab
                const pageTitle = document.getElementById('page-title');
                const pageSubtitle = document.getElementById('page-subtitle');
                
                if (targetTab === 'general') {
                    pageTitle.innerText = "Dashboard Directivo de Ventas";
                    pageSubtitle.innerText = "Análisis comparativo de Ventas Reales vs. Presupuestos y Año Anterior";
                    renderGeneralTab();
                } else if (targetTab === 'ranking') {
                    pageTitle.innerText = "Ranking de Agentes Comerciales";
                    pageSubtitle.innerText = "Desempeño acumulado, cumplimiento de presupuestos y variaciones interanuales";
                    renderRankingTab();
                } else if (targetTab === 'agente-detalle') {
                    pageTitle.innerText = "Ficha del Agente Comercial";
                    pageSubtitle.innerText = "Evolución de ventas individualizadas y análisis de cartera de clientes asignados";
                    renderAgentDetailTab();
                } else if (targetTab === 'franquicias') {
                    pageTitle.innerText = "Franquicias";
                    pageSubtitle.innerText = "Cuota de ventas de franquicias sobre Canal DI, evolución mensual y detalle por cliente";
                    renderFranchisesTab();
                }
                
                state.activeTab = targetTab;
            });
        });
    };

    // 4. Render General Tab
    const renderGeneralTab = () => {
        const totals = state.data.global_totals;
        const forecast = state.data.forecast || {};

        // Populate KPIs
        document.getElementById('kpi-sales-real').innerText = formatCurrency(totals.sales_2026_ytd);
        document.getElementById('kpi-budget-ytd').innerText = formatCurrency(totals.budget_2026_ytd);
        document.getElementById('kpi-sales-prev').innerText = formatCurrency(totals.sales_2025_ytd);
        document.getElementById('kpi-profit-ytd').innerText = formatCurrency(totals.profit_2026_ytd);
        
        // Deviation calculation
        const deviationPct = ((totals.sales_2026_ytd - totals.budget_2026_ytd) / totals.budget_2026_ytd) * 100;
        const devEl = document.getElementById('kpi-deviation-trend');
        const devPctEl = document.getElementById('kpi-deviation-pct');
        devPctEl.innerText = formatPercent(deviationPct);
        devEl.className = 'kpi-trend ' + (deviationPct >= 0 ? 'trend-up' : 'trend-down');
        devEl.querySelector('i')?.remove(); // Clear old icon
        devEl.insertAdjacentHTML('afterbegin', deviationPct >= 0 ? '<i class="fa-solid fa-caret-up"></i>' : '<i class="fa-solid fa-caret-down"></i>');
        
        // Growth calculation
        const growthPct = ((totals.sales_2026_ytd - totals.sales_2025_ytd) / totals.sales_2025_ytd) * 100;
        const growEl = document.getElementById('kpi-growth-trend');
        const growPctEl = document.getElementById('kpi-growth-pct');
        growPctEl.innerText = formatPercent(growthPct);
        growEl.className = 'kpi-trend ' + (growthPct >= 0 ? 'trend-up' : 'trend-down');
        growEl.querySelector('i')?.remove(); // Clear old icon
        growEl.insertAdjacentHTML('afterbegin', growthPct >= 0 ? '<i class="fa-solid fa-caret-up"></i>' : '<i class="fa-solid fa-caret-down"></i>');
        
        // Margin calculation
        const marginPct = (totals.profit_2026_ytd / totals.sales_2026_ytd) * 100;
        const marginEl = document.getElementById('kpi-margin-pct');
        marginEl.innerText = marginPct.toFixed(1) + '%';
        marginEl.parentElement.className = 'kpi-trend ' + (marginPct >= 0 ? 'trend-up' : 'trend-down');

        const forecastSales = toNumber(forecast.forecast_sales_month_end);
        const forecastMargin = toNumber(forecast.forecast_margin_pct_month_end);
        const requiredDaily = toNumber(forecast.required_daily_sales_to_budget);
        const expectedCompliance = toNumber(forecast.expected_compliance_pct_month_end);
        const currentMonthSales = toNumber(forecast.current_month_sales);
        const currentMonthKey = forecast.current_month_key || '-';
        const currentMonthBudget = currentMonthKey !== '-' ? toNumber(totals.budget_2026_monthly?.[currentMonthKey]) : 0;
        const budgetGapPct = currentMonthBudget > 0 ? Math.max(0, ((currentMonthBudget - currentMonthSales) / currentMonthBudget) * 100) : 0;
        const monthProgressPct = forecastSales > 0 ? (currentMonthSales / forecastSales) * 100 : 0;

        const currentMonthSalesEl = document.getElementById('kpi-current-month-sales');
        const currentMonthKeyEl = document.getElementById('kpi-current-month-key');
        const currentMonthProgressEl = document.getElementById('kpi-current-month-progress');
        const currentMonthBudgetEl = document.getElementById('kpi-current-month-budget');
        const currentMonthBudgetKeyEl = document.getElementById('kpi-current-month-budget-key');
        const budgetGapPctEl = document.getElementById('kpi-budget-gap-pct');
        const budgetGapWrapEl = document.getElementById('kpi-budget-gap-wrap');
        const currentMonthSales2025El = document.getElementById('kpi-current-month-sales-2025');
        const currentMonthGrowthEl = document.getElementById('kpi-current-month-growth');
        const currentMonthGrowthTrendEl = document.getElementById('kpi-current-month-growth-trend');

        const monthSales2025SameDate = Number.isFinite(toNumber(forecast.current_month_sales_2025_same_date))
            ? toNumber(forecast.current_month_sales_2025_same_date)
            : (currentMonthKey !== '-' ? toNumber(totals.sales_2025_monthly?.[currentMonthKey]) : 0);
        const monthGrowthVs2025Pct = monthSales2025SameDate > 0
            ? ((currentMonthSales - monthSales2025SameDate) / monthSales2025SameDate) * 100
            : 0;

        if (currentMonthSalesEl) currentMonthSalesEl.innerText = formatCurrency(currentMonthSales);
        if (currentMonthKeyEl) currentMonthKeyEl.innerText = currentMonthKey;
        if (currentMonthProgressEl) currentMonthProgressEl.innerText = `${monthProgressPct.toFixed(1)}%`;
        if (currentMonthBudgetEl) currentMonthBudgetEl.innerText = formatCurrency(currentMonthBudget);
        if (currentMonthBudgetKeyEl) currentMonthBudgetKeyEl.innerText = currentMonthKey;
        if (budgetGapPctEl) budgetGapPctEl.innerText = `${budgetGapPct.toFixed(1)}%`;
        if (currentMonthSales2025El) currentMonthSales2025El.innerText = formatCurrency(monthSales2025SameDate);
        if (currentMonthGrowthEl) currentMonthGrowthEl.innerText = formatPercent(monthGrowthVs2025Pct);
        if (budgetGapWrapEl) {
            budgetGapWrapEl.className = budgetGapPct > 0 ? 'kpi-trend trend-down' : 'kpi-trend trend-up';
        }
        if (currentMonthGrowthTrendEl) {
            currentMonthGrowthTrendEl.className = monthGrowthVs2025Pct >= 0 ? 'kpi-trend trend-up' : 'kpi-trend trend-down';
        }

        const forecastSalesEl = document.getElementById('kpi-prevision-eom');
        const forecastMarginEl = document.getElementById('kpi-prevision-margin');
        const requiredDailyEl = document.getElementById('kpi-required-daily');
        const forecastComplianceEl = document.getElementById('kpi-prevision-compliance');
        const forecastComplianceWrapEl = document.getElementById('kpi-prevision-compliance-wrap');

        if (forecastSalesEl) forecastSalesEl.innerText = formatCurrency(forecastSales);
        if (forecastMarginEl) forecastMarginEl.innerText = `${forecastMargin.toFixed(1)}%`;
        if (requiredDailyEl) requiredDailyEl.innerText = formatCurrency(requiredDaily);
        if (forecastComplianceEl) forecastComplianceEl.innerText = `${expectedCompliance.toFixed(1)}%`;
        if (forecastComplianceWrapEl) {
            if (expectedCompliance >= 100) {
                forecastComplianceWrapEl.className = 'kpi-trend trend-up';
            } else if (expectedCompliance >= 90) {
                forecastComplianceWrapEl.className = 'kpi-trend trend-neutral';
            } else {
                forecastComplianceWrapEl.className = 'kpi-trend trend-down';
            }
        }

        // Render Monthly Evolution Chart
        renderMonthlyTrendChart();

        // Render Share Chart
        renderAgentShareChart();

        // Render Lists
        renderTopLists();

        // Render Global Monthly Summary Table
        renderGlobalMonthlyTable();
    };

    const renderGlobalMonthlyTable = () => {
        const tbody = document.getElementById('global-monthly-table-body');
        tbody.innerHTML = '';
        
        const totals = state.data.global_totals;
        const monthsLabel = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        
        monthsLabel.forEach(m => {
            const mKey = m.toUpperCase();
            const sales_2025 = totals.sales_2025_monthly[mKey] || 0;
            const budget_2026 = totals.budget_2026_monthly[mKey] || 0;
            
            const isYtd = state.data.ytd_months.includes(mKey);
            const sales_2026 = isYtd ? (totals.sales_2026_monthly[mKey] || 0) : 0;
            const profit_2026 = isYtd ? (totals.profit_2026_monthly[mKey] || 0) : 0;
            
            const deviation_pct = isYtd && budget_2026 > 0 ? ((sales_2026 - budget_2026) / budget_2026) * 100 : 0;
            const growth_pct = isYtd && sales_2025 > 0 ? ((sales_2026 - sales_2025) / sales_2025) * 100 : 0;
            const margin_pct = isYtd && sales_2026 > 0 ? (profit_2026 / sales_2026) * 100 : 0;
            
            let devHtml = '-';
            if (isYtd) {
                const devClass = deviation_pct >= 0 ? 'extra-success' : 'extra-danger';
                devHtml = `<span class="bold ${devClass}">${formatPercent(deviation_pct)}</span>`;
            }
            
            let growthHtml = '-';
            if (isYtd) {
                const growthClass = growth_pct >= 0 ? 'extra-success' : 'extra-danger';
                growthHtml = `<span class="bold ${growthClass}">${formatPercent(growth_pct)}</span>`;
            }
            
            let profitHtml = '-';
            let marginHtml = '-';
            if (isYtd) {
                profitHtml = `<span class="${profit_2026 < 0 ? 'text-coral bold' : 'bold'}">${formatCurrency(profit_2026)}</span>`;
                const marginClass = margin_pct >= 0 ? 'extra-success' : 'extra-danger';
                marginHtml = `<span class="bold ${marginClass}">${margin_pct.toFixed(1)}%</span>`;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="bold text-left">${m}</td>
                <td>${formatCurrency(sales_2025)}</td>
                <td>${formatCurrency(budget_2026)}</td>
                <td class="bold">${isYtd ? formatCurrency(sales_2026) : '-'}</td>
                <td>${devHtml}</td>
                <td>${growthHtml}</td>
                <td>${profitHtml}</td>
                <td>${marginHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    const renderMonthlyTrendChart = () => {
        if (state.charts.monthlyTrend) state.charts.monthlyTrend.destroy();
        
        const ctx = document.getElementById('monthlyTrendChart').getContext('2d');
        const totals = state.data.global_totals;
        
        const monthsLabel = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        const data2025 = monthsLabel.map(m => totals.sales_2025_monthly[m.toUpperCase()]);
        const dataBudget = monthsLabel.map(m => totals.budget_2026_monthly[m.toUpperCase()]);

        const dataReal2026 = monthsLabel.map(m => {
            const mKey = m.toUpperCase();
            if (state.data.ytd_months.includes(mKey)) {
                return totals.sales_2026_monthly[mKey];
            }
            return null; // Don't plot future months
        });

        const legendEl = document.getElementById('monthly-chart-legend');
        const subtitleEl = document.getElementById('monthly-chart-subtitle');

        if (state.monthlyComparisonMode === 'margin') {
            const compliancePct = monthsLabel.map(m => {
                const key = m.toUpperCase();
                if (!state.data.ytd_months.includes(key)) return null;
                const budget = totals.budget_2026_monthly[key] || 0;
                const real = totals.sales_2026_monthly[key] || 0;
                return budget > 0 ? (real / budget) * 100 : null;
            });

            const marginPct = monthsLabel.map(m => {
                const key = m.toUpperCase();
                if (!state.data.ytd_months.includes(key)) return null;
                const sales = totals.sales_2026_monthly[key] || 0;
                const profit = totals.profit_2026_monthly[key] || 0;
                return sales > 0 ? (profit / sales) * 100 : null;
            });

            const targetLine = monthsLabel.map(() => 100);

            if (legendEl) {
                legendEl.innerHTML = `
                    <span class="leg-item"><span class="dot compliance"></span>Cumplimiento %</span>
                    <span class="leg-item"><span class="dot margin"></span>Margen % Real</span>
                    <span class="leg-item"><span class="dot budget"></span>Objetivo 100%</span>
                `;
            }
            if (subtitleEl) {
                subtitleEl.innerText = 'Comparativa mensual del cumplimiento de presupuesto y margen real';
            }

            state.charts.monthlyTrend = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: monthsLabel,
                    datasets: [
                        {
                            label: 'Cumplimiento presupuesto %',
                            data: compliancePct,
                            borderColor: 'hsl(188, 82%, 48%)',
                            backgroundColor: 'hsla(188, 82%, 48%, 0.18)',
                            pointBackgroundColor: 'hsl(188, 82%, 48%)',
                            borderWidth: 3,
                            tension: 0.2,
                            yAxisID: 'y1'
                        },
                        {
                            label: 'Margen real %',
                            data: marginPct,
                            borderColor: 'hsl(38, 92%, 53%)',
                            backgroundColor: 'hsla(38, 92%, 53%, 0.15)',
                            pointBackgroundColor: 'hsl(38, 92%, 53%)',
                            borderWidth: 3,
                            tension: 0.2,
                            yAxisID: 'y2'
                        },
                        {
                            label: 'Objetivo cumplimiento 100%',
                            data: targetLine,
                            borderColor: 'hsl(217, 90%, 60%)',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            pointRadius: 0,
                            tension: 0,
                            yAxisID: 'y1'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: {
                            grid: { display: false }
                        },
                        y1: {
                            type: 'linear',
                            position: 'left',
                            grid: { color: 'hsla(220, 20%, 20%, 0.3)' },
                            ticks: {
                                callback: (val) => `${val}%`
                            },
                            title: {
                                display: true,
                                text: 'Cumplimiento %'
                            }
                        },
                        y2: {
                            type: 'linear',
                            position: 'right',
                            grid: { drawOnChartArea: false },
                            ticks: {
                                callback: (val) => `${val}%`
                            },
                            title: {
                                display: true,
                                text: 'Margen %'
                            }
                        }
                    }
                }
            });
            return;
        }

        if (legendEl) {
            legendEl.innerHTML = `
                <span class="leg-item"><span class="dot prev"></span>Ventas 2025</span>
                <span class="leg-item"><span class="dot budget"></span>Ppto 2026</span>
                <span class="leg-item"><span class="dot real"></span>Ventas 2026</span>
            `;
        }
        if (subtitleEl) {
            subtitleEl.innerText = 'Progresión de ventas reales contra presupuesto por mes';
        }

        state.charts.monthlyTrend = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsLabel,
                datasets: [
                    {
                        label: 'Ventas 2026',
                        data: dataReal2026,
                        backgroundColor: dataReal2026.map((v, i) => {
                            if (v === null || v === undefined) return 'transparent';
                            const budget = toNumber(dataBudget[i]);
                            return v >= budget ? 'hsl(142, 70%, 45%)' : 'hsl(352, 80%, 55%)';
                        }),
                        borderRadius: 6,
                        order: 1
                    },
                    {
                        label: 'Presupuesto 2026',
                        data: dataBudget,
                        type: 'line',
                        borderColor: 'hsl(217, 90%, 60%)',
                        borderWidth: 3,
                        pointBackgroundColor: 'hsl(217, 90%, 60%)',
                        pointHoverRadius: 6,
                        fill: false,
                        tension: 0.2,
                        order: 0
                    },
                    {
                        label: 'Ventas Históricas 2025',
                        data: data2025,
                        type: 'line',
                        borderColor: 'hsla(220, 16%, 66%, 0.4)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: 'hsla(220, 16%, 66%, 0.4)',
                        fill: false,
                        tension: 0.2,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        grid: { color: 'hsla(220, 20%, 20%, 0.3)' },
                        ticks: {
                            callback: (val) => formatShortNum(val)
                        }
                    }
                }
            }
        });
    };

    const renderAgentShareChart = () => {
        if (state.charts.agentShare) state.charts.agentShare.destroy();
        
        const ctx = document.getElementById('agentShareChart').getContext('2d');
        
        // Sort agents by sales YTD to get top ones
        const sortedAgents = [...state.data.agents]
            .sort((a, b) => b.sales_2026_ytd - a.sales_2026_ytd);
            
        const top5 = sortedAgents.slice(0, 5);
        const othersSum = sortedAgents.slice(5).reduce((acc, curr) => acc + curr.sales_2026_ytd, 0);
        
        const labels = [...top5.map(a => a.name), 'Otros'];
        const dataset = [...top5.map(a => a.sales_2026_ytd), othersSum];
        
        state.charts.agentShare = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: dataset,
                    backgroundColor: [
                        'hsl(217, 90%, 60%)',
                        'hsl(142, 70%, 45%)',
                        'hsl(270, 75%, 55%)',
                        'hsl(38, 90%, 55%)',
                        'hsl(352, 80%, 55%)',
                        'hsla(220, 16%, 66%, 0.3)'
                    ],
                    borderWidth: 2,
                    borderColor: 'hsl(224, 40%, 10%)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 15,
                            boxWidth: 10,
                            font: { size: 10 }
                        }
                    }
                },
                cutout: '70%'
            }
        });
    };

    const renderTopLists = () => {
        // Sort for Top 5
        const topAgents = [...state.data.agents]
            .sort((a, b) => b.sales_2026_ytd - a.sales_2026_ytd)
            .slice(0, 5);
            
        const topListEl = document.getElementById('top-agents-list');
        topListEl.innerHTML = '';
        topAgents.forEach((agent, index) => {
            const devPct = agent.deviation_pct;
            const devClass = devPct >= 0 ? 'extra-success' : 'extra-danger';
            
            const html = `
                <div class="list-item">
                    <div class="rank-badge">${index + 1}</div>
                    <div class="item-info">
                        <span class="item-name">${agent.name}</span>
                        <span class="item-sub">ID: ${agent.id} | Margen: ${agent.margin_pct.toFixed(1)}%</span>
                    </div>
                    <div class="item-values">
                        <span class="item-val">${formatCurrency(agent.sales_2026_ytd)}</span>
                        <span class="item-extra ${devClass}">${formatPercent(devPct)} vs ppto</span>
                    </div>
                </div>
            `;
            topListEl.insertAdjacentHTML('beforeend', html);
        });

        // Underperforming YTD (lowest deviation, below 100%)
        const underperforming = [...state.data.agents]
            .filter(a => a.budget_2026_ytd > 0 && a.sales_2026_ytd < a.budget_2026_ytd)
            .sort((a, b) => a.deviation_pct - b.deviation_pct)
            .slice(0, 5);
            
        const underListEl = document.getElementById('underperforming-agents-list');
        underListEl.innerHTML = '';
        underperforming.forEach((agent, index) => {
            const html = `
                <div class="list-item">
                    <div class="rank-badge"><i class="fa-solid fa-triangle-exclamation"></i></div>
                    <div class="item-info">
                        <span class="item-name">${agent.name}</span>
                        <span class="item-sub">Ppto acumulado: ${formatCurrency(agent.budget_2026_ytd)}</span>
                    </div>
                    <div class="item-values">
                        <span class="item-val text-coral">${formatCurrency(agent.sales_2026_ytd)}</span>
                        <span class="item-extra extra-danger">${formatPercent(agent.deviation_pct)} de desv.</span>
                    </div>
                </div>
            `;
            underListEl.insertAdjacentHTML('beforeend', html);
        });
    };

    // 5. Render Ranking Tab
    const renderRankingAgentMonthlyChart = (agent) => {
        const canvas = document.getElementById('rankingAgentMonthlyChart');
        if (!canvas || !agent) return;

        if (state.charts.rankingAgentMonthly) {
            state.charts.rankingAgentMonthly.destroy();
        }

        const ctx = canvas.getContext('2d');
        const monthLabels = monthsKeys.map(m => m.charAt(0) + m.slice(1).toLowerCase());
        const sales2026 = monthsKeys.map(m => toNumber(agent.sales_2026_monthly?.[m]));
        const budget2026 = monthsKeys.map(m => toNumber(agent.budget_2026_monthly?.[m]));
        const sales2025 = monthsKeys.map(m => toNumber(agent.sales_2025_monthly?.[m]));
        const ytdMonths = state.data.ytd_months || [];

        state.charts.rankingAgentMonthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthLabels,
                datasets: [
                    {
                        label: 'Ventas 2026',
                        data: sales2026,
                        backgroundColor: sales2026.map((v, i) => {
                            const monthKey = monthsKeys[i];
                            if (!ytdMonths.includes(monthKey)) return 'transparent';
                            const budget = toNumber(budget2026[i]);
                            return v >= budget ? 'hsl(142, 70%, 45%)' : 'hsl(352, 80%, 55%)';
                        }),
                        borderRadius: 5,
                        order: 1
                    },
                    {
                        label: 'Ppto 2026',
                        data: budget2026,
                        type: 'line',
                        borderColor: 'hsl(217, 90%, 60%)',
                        borderWidth: 3,
                        pointBackgroundColor: 'hsl(217, 90%, 60%)',
                        pointRadius: 3,
                        pointHoverRadius: 6,
                        fill: false,
                        tension: 0.2,
                        order: 0
                    },
                    {
                        label: 'Ventas 2025',
                        data: sales2025,
                        type: 'line',
                        borderColor: 'hsla(220, 16%, 66%, 0.6)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: 'hsla(220, 16%, 66%, 0.6)',
                        pointRadius: 2,
                        fill: false,
                        tension: 0.15,
                        order: 2
                    }
                ]
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
                    x: {
                        grid: { display: false }
                    },
                    y: {
                        grid: { color: 'hsla(220, 20%, 20%, 0.3)' },
                        ticks: {
                            callback: (val) => formatShortNum(val)
                        }
                    }
                }
            }
        });
    };

    const renderRankingSnapshotPanel = () => {
        const selector = document.getElementById('ranking-agent-selector');
        if (!selector) return;

        const agents = state.data.agents || [];
        const totals = state.data.global_totals || {};

        if (agents.length === 0) return;

        if (!state.selectedRankingAgentId || !agents.some(a => a.id === state.selectedRankingAgentId)) {
            state.selectedRankingAgentId = agents[0].id;
        }

        if (!selector.dataset.bound) {
            selector.addEventListener('change', (e) => {
                state.selectedRankingAgentId = parseInt(e.target.value, 10);
                renderRankingSnapshotPanel();
            });
            selector.dataset.bound = '1';
        }

        const sortedAgents = [...agents].sort((a, b) => a.id - b.id);
        if (selector.options.length !== sortedAgents.length) {
            selector.innerHTML = '';
            sortedAgents.forEach(agent => {
                const opt = document.createElement('option');
                opt.value = agent.id;
                opt.innerText = `[ID ${agent.id}] ${agent.name}`;
                selector.appendChild(opt);
            });
        }

        selector.value = state.selectedRankingAgentId;

        const selectedAgent = agents.find(a => a.id === state.selectedRankingAgentId);
        if (!selectedAgent) return;

        const globalSales = toNumber(totals.sales_2026_ytd);

        const agentSales = toNumber(selectedAgent.sales_2026_ytd);
        const agentBudget = toNumber(selectedAgent.budget_2026_ytd);
        const agentCompliance = agentBudget > 0 ? (agentSales / agentBudget) * 100 : 0;
        const agentShare = globalSales > 0 ? (agentSales / globalSales) * 100 : 0;

        const agentSalesEl = document.getElementById('ranking-agent-sales');
        const agentShareEl = document.getElementById('ranking-agent-share');
        const agentBudgetYtdEl = document.getElementById('ranking-agent-budget-ytd');
        const agentBudgetPeriodEl = document.getElementById('ranking-agent-budget-period');
        const agentComplianceEl = document.getElementById('ranking-agent-compliance');
        const agentDeviationEl = document.getElementById('ranking-agent-deviation');
        const agentDeviationWrapEl = document.getElementById('ranking-agent-deviation-wrap');
        const agentPrevSalesEl = document.getElementById('ranking-agent-prev-sales');
        const agentYoyEl = document.getElementById('ranking-agent-yoy');
        const agentYoyWrapEl = document.getElementById('ranking-agent-yoy-wrap');
        const agentProfitEl = document.getElementById('ranking-agent-profit');
        const agentMarginEl = document.getElementById('ranking-agent-margin');
        const agentGrowthEl = document.getElementById('ranking-agent-growth');
        const agentGrowthWrapEl = document.getElementById('ranking-agent-growth-wrap');

        if (agentSalesEl) agentSalesEl.innerText = formatCurrency(agentSales);
        if (agentShareEl) agentShareEl.innerText = `${agentShare.toFixed(1)}%`;
        if (agentBudgetYtdEl) agentBudgetYtdEl.innerText = formatCurrency(agentBudget);
        if (agentBudgetPeriodEl) agentBudgetPeriodEl.innerText = getYtdPeriodLabel();
        if (agentComplianceEl) agentComplianceEl.innerText = `${agentCompliance.toFixed(1)}%`;
        if (agentDeviationEl) agentDeviationEl.innerText = formatPercent(selectedAgent.deviation_pct);
        if (agentDeviationWrapEl) {
            agentDeviationWrapEl.className = `kpi-trend ${selectedAgent.deviation_pct >= 0 ? 'trend-up' : 'trend-down'}`;
        }
        if (agentPrevSalesEl) agentPrevSalesEl.innerText = formatCurrency(selectedAgent.sales_2025_ytd);
        if (agentYoyEl) agentYoyEl.innerText = formatPercent(selectedAgent.growth_pct);
        if (agentYoyWrapEl) {
            agentYoyWrapEl.className = `kpi-trend ${selectedAgent.growth_pct >= 0 ? 'trend-up' : 'trend-down'}`;
        }
        if (agentProfitEl) agentProfitEl.innerText = formatCurrency(selectedAgent.profit_2026_ytd);
        if (agentMarginEl) agentMarginEl.innerText = `${selectedAgent.margin_pct.toFixed(1)}%`;
        if (agentGrowthEl) agentGrowthEl.innerText = formatPercent(selectedAgent.growth_pct);
        if (agentGrowthWrapEl) {
            agentGrowthWrapEl.className = `kpi-trend ${selectedAgent.growth_pct >= 0 ? 'trend-up' : 'trend-down'}`;
        }

        renderRankingAgentMonthlyChart(selectedAgent);
    };

    const renderRankingTab = () => {
        renderRankingSnapshotPanel();

        // Renders Table Rows
        const tbody = document.getElementById('ranking-table-body');
        tbody.innerHTML = '';

        // Apply filters & search
        let filtered = state.data.agents.filter(agent => {
            const matchesSearch = agent.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                                  agent.id.toString().includes(state.searchQuery);
                                  
            let matchesStatus = true;
            if (state.statusFilter === 'over') {
                matchesStatus = agent.deviation_pct >= 0;
            } else if (state.statusFilter === 'near') {
                matchesStatus = agent.deviation_pct >= -10 && agent.deviation_pct < 0;
            } else if (state.statusFilter === 'under') {
                matchesStatus = agent.deviation_pct < -10;
            } else if (state.statusFilter === 'loss') {
                matchesStatus = agent.profit_2026_ytd < 0;
            }
            
            return matchesSearch && matchesStatus;
        });

        // Sorting
        filtered.sort((a, b) => {
            let valA = a[state.sortColumn];
            let valB = b[state.sortColumn];
            
            if (typeof valA === 'string') {
                return state.sortDirection === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
            }
            
            return state.sortDirection === 'asc' ? valA - valB : valB - valA;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="10" class="text-left text-muted" style="padding: 30px; text-align: center;">
                        <i class="fa-solid fa-ban" style="font-size: 1.5rem; margin-bottom: 8px; display: block;"></i>
                        No se encontraron agentes con los criterios seleccionados.
                    </td>
                </tr>
            `;
            return;
        }

        filtered.forEach(agent => {
            // Style deviation badge
            let devClass = 'bg-success';
            if (agent.deviation_pct < -10) devClass = 'bg-danger';
            else if (agent.deviation_pct < 0) devClass = 'bg-warn';
            
            // Style growth badge
            let growthClass = 'extra-success';
            if (agent.growth_pct < 0) growthClass = 'extra-danger';
            
            // Style Margin
            let marginClass = 'extra-success';
            if (agent.margin_pct < 0) marginClass = 'extra-danger';
            else if (agent.margin_pct < 5) marginClass = 'extra-warn';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="bold text-muted">${agent.id}</td>
                <td class="text-left bold">${agent.name}</td>
                <td class="bold">${formatCurrency(agent.sales_2026_ytd)}</td>
                <td>${formatCurrency(agent.budget_2026_ytd)}</td>
                <td><span class="badge-row ${devClass}">${formatPercent(agent.deviation_pct)}</span></td>
                <td>${formatCurrency(agent.sales_2025_ytd)}</td>
                <td class="${growthClass} bold">${formatPercent(agent.growth_pct)}</td>
                <td class="${agent.profit_2026_ytd < 0 ? 'text-coral bold' : ''}">${formatCurrency(agent.profit_2026_ytd)}</td>
                <td class="${marginClass} bold">${agent.margin_pct.toFixed(1)}%</td>
                <td>
                    <button class="btn-icon view-agent-btn" data-agent-id="${agent.id}" title="Ver Ficha Detallada">
                        <i class="fa-solid fa-arrow-right"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(tr);
        });

        // Attach action click listeners
        document.querySelectorAll('.view-agent-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const agentId = parseInt(btn.getAttribute('data-agent-id'));
                state.selectedAgentId = agentId;
                
                // Navigate to agent detail tab
                const agentDetailBtn = document.querySelector('.menu-item[data-tab="agente-detalle"]');
                if (agentDetailBtn) agentDetailBtn.click();
            });
        });
    };

    const FR_MONTH_LABELS = {
        FEB: 'Feb', MAR: 'Mar', ABR: 'Abr', MAY: 'May', JUN: 'Jun', JUL: 'Jul',
        AGO: 'Ago', SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DIC: 'Dic', ENE: 'Ene'
    };

    // Gráfico 1: Barras apiladas Franquicias vs Resto Canal DI
    const renderFranchiseStackedChart = (monthlyRows = [], selectedYear = '2026') => {
        if (state.charts.franchiseStacked) state.charts.franchiseStacked.destroy();
        const canvas = document.getElementById('franchiseStackedChart');
        if (!canvas) return;
        const ytdMonths = state.data.ytd_months || [];
        const targetYear = selectedYear === '2025' ? '2025' : '2026';
        const labels = monthlyRows.map(r => FR_MONTH_LABELS[r.month] || r.month);
        const franchiseYear = monthlyRows.map(r => ytdMonths.includes(r.month) ? toNumber(r[`franchise_${targetYear}`]) : null);
        const restoDIYear   = monthlyRows.map(r => ytdMonths.includes(r.month) ? Math.max(0, toNumber(r[`channel_${targetYear}`]) - toNumber(r[`franchise_${targetYear}`])) : null);
        const shareYear     = monthlyRows.map(r => ytdMonths.includes(r.month) ? toNumber(r[`share_${targetYear}`]) : null);

        const quotaLabelsPlugin = {
            id: 'quotaLabelsPlugin',
            afterDatasetsDraw(chart) {
                const meta = chart.getDatasetMeta(2);
                const data = chart.data.datasets[2].data || [];
                const franchiseMeta = chart.getDatasetMeta(0);
                const franchiseData = chart.data.datasets[0].data || [];
                const restoMeta = chart.getDatasetMeta(1);
                const restoData = chart.data.datasets[1].data || [];
                const ctx = chart.ctx;

                ctx.save();
                ctx.font = '600 11px Outfit, sans-serif';
                ctx.fillStyle = 'hsl(188, 82%, 48%)';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';

                meta.data.forEach((point, i) => {
                    const v = data[i];
                    if (v === null || v === undefined || Number.isNaN(v)) return;
                    ctx.fillText(`${toNumber(v).toFixed(1)}%`, point.x, point.y - 8);
                });

                // Etiqueta de ventas franquicias en euros (segmento verde)
                ctx.font = '700 12px Outfit, sans-serif';
                ctx.fillStyle = '#000000';
                franchiseMeta.data.forEach((bar, i) => {
                    const val = franchiseData[i];
                    if (val === null || val === undefined || Number.isNaN(val) || !bar) return;
                    ctx.textBaseline = 'middle';
                    ctx.fillText(formatCurrency(toNumber(val)), bar.x, bar.y + (bar.base - bar.y) / 2);
                });

                // Etiqueta de total Canal DI en euros (tope de barra apilada)
                ctx.font = '700 12px Outfit, sans-serif';
                ctx.fillStyle = 'hsl(220, 16%, 66%)';
                ctx.textBaseline = 'bottom';
                restoMeta.data.forEach((bar, i) => {
                    const franVal = toNumber(franchiseData[i]);
                    const restoVal = toNumber(restoData[i]);
                    if (!bar || !Number.isFinite(franVal) || !Number.isFinite(restoVal)) return;
                    const totalVal = franVal + restoVal;
                    if (totalVal <= 0) return;
                    ctx.fillText(formatCurrency(totalVal), bar.x, bar.y - 6);
                });

                ctx.restore();
            }
        };

        state.charts.franchiseStacked = new Chart(canvas.getContext('2d'), {
            plugins: [quotaLabelsPlugin],
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: `Franquicias ${targetYear} (€)`,
                        data: franchiseYear,
                        backgroundColor: franchiseYear.map(v => (v === null || v === undefined) ? 'transparent' : 'hsl(142, 70%, 45%)'),
                        borderRadius: 3,
                        stack: `s${targetYear}`,
                        yAxisID: 'yEuros',
                        order: 2
                    },
                    {
                        label: `Resto Canal DI ${targetYear} (€)`,
                        data: restoDIYear,
                        backgroundColor: 'hsla(142, 70%, 45%, 0.2)',
                        borderRadius: 3,
                        stack: `s${targetYear}`,
                        yAxisID: 'yEuros',
                        order: 3
                    },
                    {
                        label: `Cuota franq. ${targetYear} (%)`,
                        data: shareYear,
                        type: 'line',
                        borderColor: 'hsl(188, 82%, 48%)',
                        backgroundColor: 'transparent',
                        pointBackgroundColor: 'hsl(188, 82%, 48%)',
                        borderWidth: 2,
                        pointRadius: 5,
                        tension: 0.25,
                        yAxisID: 'yPct',
                        order: 0
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => {
                                const v = ctx.raw;
                                if (v === null || v === undefined) return null;
                                if (ctx.dataset.yAxisID === 'yPct') return `${ctx.dataset.label}: ${toNumber(v).toFixed(1)}%`;
                                return `${ctx.dataset.label}: ${formatCurrency(toNumber(v))}`;
                            }
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false }, stacked: true },
                    yEuros: {
                        display: false,
                        type: 'linear',
                        position: 'left',
                        stacked: true,
                        grid: { color: 'hsla(220,20%,20%,0.3)' },
                        ticks: { callback: val => formatShortNum(val) }
                    },
                    yPct: {
                        display: false,
                        type: 'linear',
                        position: 'right',
                        grid: { drawOnChartArea: false },
                        ticks: { callback: val => `${toNumber(val).toFixed(0)}%` },
                        min: 0,
                        suggestedMax: 40
                    }
                }
            }
        });
    };

    // Gráfico 2: Doughnut acumulado YTD (Franquicias vs resto Canal DI)
    const renderFranchiseShareChart = (summary = {}, monthlyRows = [], selectedYear = '2026') => {
        if (state.charts.franchiseShare) state.charts.franchiseShare.destroy();
        const canvas = document.getElementById('franchiseShareChart');
        if (!canvas) return;
        const ytdMonths = state.data.ytd_months || [];
        const targetYear = selectedYear === '2025' ? '2025' : '2026';

        const franchiseYtd = targetYear === '2026'
            ? toNumber(summary.franchise_2026_ytd)
            : monthlyRows.reduce((acc, row) => ytdMonths.includes(row.month) ? acc + toNumber(row.franchise_2025) : acc, 0);
        const channelYtd = targetYear === '2026'
            ? toNumber(summary.channel_2026_ytd)
            : monthlyRows.reduce((acc, row) => ytdMonths.includes(row.month) ? acc + toNumber(row.channel_2025) : acc, 0);
        const restYtd = Math.max(0, channelYtd - franchiseYtd);
        const shareYtd = channelYtd > 0 ? (franchiseYtd / channelYtd) * 100 : 0;

        const centerTextPlugin = {
            id: 'franchiseYtdCenterText',
            afterDraw(chart) {
                const meta = chart.getDatasetMeta(0);
                if (!meta || !meta.data || !meta.data[0]) return;
                const centerX = meta.data[0].x;
                const centerY = meta.data[0].y;
                const ctx = chart.ctx;

                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                ctx.font = '700 20px Outfit, sans-serif';
                ctx.fillStyle = 'hsl(188, 82%, 48%)';
                ctx.fillText(`${shareYtd.toFixed(1)}%`, centerX, centerY - 6);

                ctx.font = '500 11px Outfit, sans-serif';
                ctx.fillStyle = 'hsl(220, 16%, 66%)';
                ctx.fillText(`Cuota acumulada ${targetYear}`, centerX, centerY + 12);

                ctx.restore();
            }
        };

        state.charts.franchiseShare = new Chart(canvas.getContext('2d'), {
            plugins: [centerTextPlugin],
            type: 'doughnut',
            data: {
                labels: [`Franquicias ${targetYear}`, `Resto Canal DI ${targetYear}`],
                datasets: [
                    {
                        data: [franchiseYtd, restYtd],
                        backgroundColor: ['hsl(142, 70%, 45%)', 'hsla(142, 70%, 45%, 0.2)'],
                        borderColor: ['hsl(142, 70%, 45%)', 'hsla(142, 70%, 45%, 0.2)'],
                        borderWidth: 1,
                        hoverOffset: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '66%',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => {
                                const value = toNumber(ctx.raw);
                                const pct = channelYtd > 0 ? (value / channelYtd) * 100 : 0;
                                return `${ctx.label}: ${formatShortNum(value)} (${pct.toFixed(1)}%)`;
                            }
                        }
                    }
                }
            }
        });
    };

    const renderFranchisesTab = () => {
        const franchiseData = state.data.franchises || {};
        const summary = franchiseData.summary || {};
        const monthlyRows = franchiseData.monthly || [];
        const clients = franchiseData.clients || [];

        const sales2026Ytd = toNumber(summary.franchise_2026_ytd);
        const sales2025Ytd = toNumber(summary.franchise_2025_ytd);
        const channel2026Ytd = toNumber(summary.channel_2026_ytd);
        const share2026Ytd = toNumber(summary.share_2026_ytd);
        const budgetYtd = toNumber(summary.franchise_budget_ytd);
        const budgetCompliancePct = budgetYtd > 0 ? (sales2026Ytd / budgetYtd) * 100 : 0;
        const growthSalesPct = sales2025Ytd > 0 ? ((sales2026Ytd - sales2025Ytd) / sales2025Ytd) * 100 : 0;

        const elSales2026 = document.getElementById('fr-kpi-sales-2026');
        const elShare2026 = document.getElementById('fr-kpi-share-2026');
        const elGrowthYoy = document.getElementById('fr-kpi-growth-yoy');
        const elSales2026Ref = document.getElementById('fr-kpi-sales-2026-ref');
        const elSales2025 = document.getElementById('fr-kpi-sales-2025');
        const elGrowthWrap = document.getElementById('fr-kpi-growth-wrap');
        const elMatched = document.getElementById('fr-kpi-matched-clients');
        const elChannel2026 = document.getElementById('fr-kpi-channel-2026');
        const elBudgetYtd = document.getElementById('fr-kpi-budget-ytd');
        const elBudgetCompliance = document.getElementById('fr-kpi-budget-compliance');
        const elBudgetComplianceWrap = document.getElementById('fr-kpi-budget-compliance-wrap');

        if (elSales2026) elSales2026.innerText = formatCurrency(sales2026Ytd);
        if (elShare2026) elShare2026.innerText = `${share2026Ytd.toFixed(1)}%`;
        if (elGrowthYoy) elGrowthYoy.innerText = formatPercent(growthSalesPct);
        if (elSales2026Ref) elSales2026Ref.innerText = formatCurrency(sales2026Ytd);
        if (elSales2025) elSales2025.innerText = formatCurrency(sales2025Ytd);
        if (elGrowthWrap) elGrowthWrap.className = growthSalesPct >= 0 ? 'kpi-trend trend-up' : 'kpi-trend trend-down';
        if (elMatched) elMatched.innerText = (franchiseData.matched_clients || 0).toString();
        if (elChannel2026) elChannel2026.innerText = formatCurrency(channel2026Ytd);
        if (elBudgetYtd) elBudgetYtd.innerText = formatCurrency(budgetYtd);
        if (elBudgetCompliance) elBudgetCompliance.innerText = `${budgetCompliancePct.toFixed(1)}%`;
        if (elBudgetComplianceWrap) elBudgetComplianceWrap.className = budgetCompliancePct >= 100 ? 'kpi-trend trend-up' : (budgetCompliancePct >= 90 ? 'kpi-trend trend-neutral' : 'kpi-trend trend-down');

        const yearFilterEl = document.getElementById('fr-year-filter');
        const activeFranchiseYear = String(state.selectedFranchiseYear || '2026');
        if (yearFilterEl) {
            yearFilterEl.value = activeFranchiseYear;
            yearFilterEl.onchange = (e) => {
                state.selectedFranchiseYear = e.target.value;
                renderFranchisesTab();
            };
        }

        const stackedFranchiseLegend = document.getElementById('fr-legend-franchise-year');
        const stackedRestoLegend = document.getElementById('fr-legend-rest-year');
        const stackedShareLegend = document.getElementById('fr-legend-share-year');
        const shareLegendFranchise = document.getElementById('fr-share-legend-franchise-year');
        const shareLegendResto = document.getElementById('fr-share-legend-rest-year');
        if (stackedFranchiseLegend) stackedFranchiseLegend.innerText = `Franquicias ${activeFranchiseYear} (€)`;
        if (stackedRestoLegend) stackedRestoLegend.innerText = `Resto Canal DI ${activeFranchiseYear} (€)`;
        if (stackedShareLegend) stackedShareLegend.innerText = `Cuota ${activeFranchiseYear} (%)`;
        if (shareLegendFranchise) shareLegendFranchise.innerText = `Franquicias ${activeFranchiseYear}`;
        if (shareLegendResto) shareLegendResto.innerText = `Resto Canal DI ${activeFranchiseYear}`;

        renderFranchiseStackedChart(monthlyRows, activeFranchiseYear);
        renderFranchiseShareChart(summary, monthlyRows, activeFranchiseYear);

        const monthlyBody = document.getElementById('franchise-monthly-table-body');
        if (monthlyBody) {
            monthlyBody.innerHTML = '';
            if (monthlyRows.length === 0) {
                monthlyBody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-left text-muted" style="padding: 24px; text-align: center;">
                            No hay datos de franquicias. Añade el archivo FRANQUICIAS.xlsx en la carpeta Datos.
                        </td>
                    </tr>
                `;
            } else {
                const monthLabels = {
                    FEB: 'Feb', MAR: 'Mar', ABR: 'Abr', MAY: 'May', JUN: 'Jun', JUL: 'Jul', AGO: 'Ago',
                    SEP: 'Sep', OCT: 'Oct', NOV: 'Nov', DIC: 'Dic', ENE: 'Ene'
                };
                let accFranchise2025 = 0;
                let accChannel2025 = 0;
                let accFranchise2026 = 0;
                let accChannel2026 = 0;
                monthlyRows.forEach(row => {
                    const tr = document.createElement('tr');
                    accFranchise2025 += toNumber(row.franchise_2025);
                    accChannel2025 += toNumber(row.channel_2025);
                    accFranchise2026 += toNumber(row.franchise_2026);
                    accChannel2026 += toNumber(row.channel_2026);

                    const accShare2025 = accChannel2025 > 0 ? (accFranchise2025 / accChannel2025) * 100 : 0;
                    const accShare2026 = accChannel2026 > 0 ? (accFranchise2026 / accChannel2026) * 100 : 0;
                    const accProgressionPp = accShare2026 - accShare2025;
                    const progressionClass = accProgressionPp >= 0 ? 'extra-success' : 'extra-danger';
                    tr.innerHTML = `
                        <td class="bold text-left">${monthLabels[row.month] || row.month}</td>
                        <td>${formatCurrency(toNumber(row.franchise_2026))}</td>
                        <td>${formatCurrency(toNumber(row.channel_2026))}</td>
                        <td class="bold">${toNumber(row.share_2026).toFixed(1)}%</td>
                        <td>${formatCurrency(toNumber(row.franchise_2025))}</td>
                        <td>${formatCurrency(toNumber(row.channel_2025))}</td>
                        <td>${toNumber(row.share_2025).toFixed(1)}%</td>
                        <td class="bold ${progressionClass}">${accProgressionPp.toFixed(1)}%</td>
                    `;
                    monthlyBody.appendChild(tr);
                });
            }
        }

        const clientsBody = document.getElementById('franchise-clients-table-body');
        if (clientsBody) {
            const query = (state.franchiseClientSearchQuery || '').toLowerCase().trim();
            const filteredClients = query
                ? clients.filter(c => String(c.id).toLowerCase().includes(query) || String(c.name).toLowerCase().includes(query))
                : clients;

            clientsBody.innerHTML = '';
            if (filteredClients.length === 0) {
                clientsBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-left text-muted" style="padding: 24px; text-align: center;">
                            No se encontraron clientes franquicia para el filtro aplicado.
                        </td>
                    </tr>
                `;
            } else {
                filteredClients.forEach(client => {
                    const growth = toNumber(client.growth_pct);
                    const growthClass = growth >= 0 ? 'extra-success' : 'extra-danger';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td class="bold text-muted">${client.id}</td>
                        <td class="text-left bold">${client.name}</td>
                        <td class="bold">${formatCurrency(toNumber(client.sales_2026_ytd))}</td>
                        <td>${formatCurrency(toNumber(client.sales_2025_ytd))}</td>
                        <td class="bold ${growthClass}">${formatPercent(growth)}</td>
                    `;
                    clientsBody.appendChild(tr);
                });
            }
        }
    };

    // Setup sorting header event handlers
    const setupTableSorting = () => {
        const headers = document.querySelectorAll('#ranking-table th');

        // Show initial sorting state in header icons on first load.
        const initialHeader = document.querySelector(`#ranking-table th[data-sort="${state.sortColumn}"]`);
        if (initialHeader) {
            const initialIcon = initialHeader.querySelector('i');
            if (initialIcon) {
                initialIcon.className = state.sortDirection === 'desc' ? 'fa-solid fa-sort-down' : 'fa-solid fa-sort-up';
            }
        }

        headers.forEach(th => {
            const colName = th.getAttribute('data-sort');
            if (!colName) return; // Skip columns without sorting
            
            th.addEventListener('click', () => {
                // Remove sort indicators from other columns
                headers.forEach(h => {
                    if (h !== th) {
                        const icon = h.querySelector('i');
                        if (icon) icon.className = 'fa-solid fa-sort';
                    }
                });
                
                const icon = th.querySelector('i');
                if (state.sortColumn === colName) {
                    state.sortDirection = state.sortDirection === 'desc' ? 'asc' : 'desc';
                } else {
                    state.sortColumn = colName;
                    state.sortDirection = 'desc';
                }
                
                // Update current icon class
                if (icon) {
                    icon.className = state.sortDirection === 'desc' ? 'fa-solid fa-sort-down' : 'fa-solid fa-sort-up';
                }
                
                renderRankingTab();
            });
        });

        // Search Input handler
        document.getElementById('agent-search').addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderRankingTab();
        });

        // Filter dropdown handler
        document.getElementById('status-filter').addEventListener('change', (e) => {
            state.statusFilter = e.target.value;
            renderRankingTab();
        });

        // Client Search Input in Agent Details Tab
        document.getElementById('det-client-search').addEventListener('input', (e) => {
            state.clientSearchQuery = e.target.value;
            const agent = state.data.agents.find(a => a.id === state.selectedAgentId);
            if (agent) {
                renderAgentClients(agent);
            }
        });

        const monthlyClientSearch = document.getElementById('det-client-monthly-search');
        if (monthlyClientSearch) {
            monthlyClientSearch.addEventListener('input', (e) => {
                state.clientMonthlySearchQuery = e.target.value;
                const agent = state.data.agents.find(a => a.id === state.selectedAgentId);
                if (agent) {
                    renderClientMonthlySection(agent);
                }
            });
        }

        const monthlyModeSelect = document.getElementById('monthly-comparison-mode');
        if (monthlyModeSelect) {
            monthlyModeSelect.addEventListener('change', (e) => {
                state.monthlyComparisonMode = e.target.value;
                renderMonthlyTrendChart();
            });
        }

        const franchiseSearch = document.getElementById('franchise-client-search');
        if (franchiseSearch) {
            franchiseSearch.addEventListener('input', (e) => {
                state.franchiseClientSearchQuery = e.target.value;
                if (state.activeTab === 'franquicias') {
                    renderFranchisesTab();
                }
            });
        }
    };

    // 6. Render Agent Detail Tab
    const renderAgentDetailTab = () => {
        const selector = document.getElementById('agent-selector');
        
        // Populate agent selector if not populated
        if (selector.children.length <= 1) {
            selector.innerHTML = '';
            // Show agents ordered by ID ascending
            const sortedAgents = [...state.data.agents].sort((a, b) => a.id - b.id);
            sortedAgents.forEach(agent => {
                const opt = document.createElement('option');
                opt.value = agent.id;
                opt.innerText = `[ID ${agent.id}] ${agent.name}`;
                if (agent.id === state.selectedAgentId) opt.selected = true;
                selector.appendChild(opt);
            });
            
            // Selector change listener
            selector.addEventListener('change', (e) => {
                state.selectedAgentId = parseInt(e.target.value);
                loadAgentProfile();
            });
        } else {
            // Set current selection
            selector.value = state.selectedAgentId;
        }

        loadAgentProfile();
    };

    const loadAgentProfile = () => {
        const agent = state.data.agents.find(a => a.id === state.selectedAgentId);
        if (!agent) return;

        // Reset client search
        state.clientSearchQuery = '';
        const searchInput = document.getElementById('det-client-search');
        if (searchInput) searchInput.value = '';
        state.clientMonthlySearchQuery = '';
        const monthlySearchInput = document.getElementById('det-client-monthly-search');
        if (monthlySearchInput) monthlySearchInput.value = '';

        // Reveal panel
        document.getElementById('agent-profile-details').style.display = 'grid';

        // Load profile header
        document.getElementById('det-agent-name').innerText = agent.name;
        
        // Determine status badge
        const badge = document.getElementById('det-agent-status');
        if (agent.deviation_pct >= 0) {
            badge.innerText = 'Cumpliendo Objetivos';
            badge.className = 'badge bg-success';
        } else if (agent.deviation_pct >= -10) {
            badge.innerText = 'Desviación Leve';
            badge.className = 'badge bg-warn';
        } else {
            badge.innerText = 'Bajo Presupuesto';
            badge.className = 'badge bg-danger';
        }

        // Mini KPI cards
        document.getElementById('det-sales-ytd').innerText = formatCurrency(agent.sales_2026_ytd);
        document.getElementById('det-margin-pct').innerText = agent.margin_pct.toFixed(1) + '%';
        
        // Efficiency (accomplishment %)
        const efficiency = agent.budget_2026_ytd > 0 ? (agent.sales_2026_ytd / agent.budget_2026_ytd) * 100 : 100;
        document.getElementById('det-efficiency-pct').innerText = efficiency.toFixed(0) + '%';

        // Right side detail metrics
        document.getElementById('det-annual-budget').innerText = formatCurrency(agent.total_budget_2026);
        document.getElementById('det-ytd-budget').innerText = formatCurrency(agent.budget_2026_ytd);
        const ytdBudgetDesc = document.getElementById('det-ytd-budget-desc');
        if (ytdBudgetDesc) {
            ytdBudgetDesc.innerText = `Meta para ${getYtdPeriodLabel()} ${new Date().getFullYear()}`;
        }

        const sales2026YtdEl = document.getElementById('det-sales-2026-ytd');
        if (sales2026YtdEl) {
            sales2026YtdEl.innerText = formatCurrency(agent.sales_2026_ytd);
        }
        const sales2026YtdDesc = document.getElementById('det-sales-2026-ytd-desc');
        if (sales2026YtdDesc) {
            sales2026YtdDesc.innerText = `Real ${getYtdPeriodLabel()} ${new Date().getFullYear()}`;
        }

        document.getElementById('det-prev-ytd-sales').innerText = formatCurrency(agent.sales_2025_ytd);
        
        const prevGrowth = document.getElementById('det-prev-ytd-growth');
        prevGrowth.innerText = `Crecimiento YoY: ${formatPercent(agent.growth_pct)}`;
        prevGrowth.className = agent.growth_pct >= 0 ? 'det-desc extra-success bold' : 'det-desc extra-danger bold';

        const profitVal = document.getElementById('det-ytd-profit');
        profitVal.innerText = formatCurrency(agent.profit_2026_ytd);
        profitVal.className = agent.profit_2026_ytd >= 0 ? 'det-val extra-success' : 'det-val text-coral';
        
        const profitDesc = document.getElementById('det-ytd-profit-desc');
        profitDesc.innerText = `Margen Comercial real: ${agent.margin_pct.toFixed(1)}%`;

        // Render Agent specific clients (all clients, with search filter)
        renderAgentClients(agent);

        // Render monthly detail for selected client
        renderClientMonthlySection(agent);

        // Render Agent specific Monthly Chart
        renderAgentMonthlyChart(agent);

        // Render Agent detailed monthly table
        renderAgentMonthlyTable(agent);
    };

    const renderAgentClients = (agent) => {
        const clientsTbody = document.getElementById('det-clients-table-body');
        clientsTbody.innerHTML = '';
        
        const query = (state.clientSearchQuery || '').toLowerCase().trim();
        
        let filteredClients = agent.clients || [];
        if (query) {
            filteredClients = filteredClients.filter(c => 
                c.name.toLowerCase().includes(query) || 
                c.id.toString().includes(query)
            );
        }
        
        document.getElementById('det-client-count').innerText = filteredClients.length;
        
        if (filteredClients.length > 0) {
            filteredClients.forEach(client => {
                const marginClass = client.margin_pct < 0 ? 'extra-danger' : (client.margin_pct < ALERT_THRESHOLDS.lowMarginPct ? 'extra-warn' : 'extra-success');
                const devClass = client.deviation_pct < 0 ? 'extra-danger' : 'extra-success';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td class="bold text-muted">${client.id}</td>
                    <td class="text-left bold">${client.name}</td>
                    <td>${formatCurrency(client.sales_2025)}</td>
                    <td class="bold" style="color: var(--color-primary);">${formatCurrency(client.budget_2026)}</td>
                    <td class="bold">${formatCurrency(client.sales_2026)}</td>
                    <td class="${client.profit_2026 < 0 ? 'text-coral bold' : 'bold'}">${formatCurrency(client.profit_2026)}</td>
                    <td class="bold ${marginClass}">${client.margin_pct.toFixed(1)}%</td>
                    <td class="bold ${devClass}">${formatPercent(client.deviation_pct)}</td>
                `;
                clientsTbody.appendChild(tr);
            });
        } else {
            clientsTbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-left text-muted" style="padding: 20px; text-align: center;">
                        <i class="fa-solid fa-ban" style="font-size: 1.2rem; margin-bottom: 6px; display: block;"></i>
                        No se encontraron clientes asignados.
                    </td>
                </tr>
            `;
        }
    };

    const renderAgentMonthlyTable = (agent) => {
        const tbody = document.getElementById('det-monthly-table-body');
        tbody.innerHTML = '';
        
        const monthsLabel = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        
        monthsLabel.forEach(m => {
            const mKey = m.toUpperCase();
            const sales_2025 = agent.sales_2025_monthly[mKey] || 0;
            const budget_2026 = agent.budget_2026_monthly[mKey] || 0;
            
            const isYtd = state.data.ytd_months.includes(mKey);
            const sales_2026 = isYtd ? (agent.sales_2026_monthly[mKey] || 0) : 0;
            const profit_2026 = isYtd ? (agent.profit_2026_monthly[mKey] || 0) : 0;
            
            const deviation_pct = isYtd && budget_2026 > 0 ? ((sales_2026 - budget_2026) / budget_2026) * 100 : 0;
            const growth_pct = isYtd && sales_2025 > 0 ? ((sales_2026 - sales_2025) / sales_2025) * 100 : 0;
            const margin_pct = isYtd && sales_2026 > 0 ? (profit_2026 / sales_2026) * 100 : 0;
            
            let devHtml = '-';
            if (isYtd) {
                const devClass = deviation_pct >= 0 ? 'extra-success' : 'extra-danger';
                devHtml = `<span class="bold ${devClass}">${formatPercent(deviation_pct)}</span>`;
            }
            
            let growthHtml = '-';
            if (isYtd) {
                const growthClass = growth_pct >= 0 ? 'extra-success' : 'extra-danger';
                growthHtml = `<span class="bold ${growthClass}">${formatPercent(growth_pct)}</span>`;
            }
            
            let profitHtml = '-';
            let marginHtml = '-';
            if (isYtd) {
                profitHtml = `<span class="${profit_2026 < 0 ? 'text-coral bold' : 'bold'}">${formatCurrency(profit_2026)}</span>`;
                const marginClass = margin_pct >= 0 ? 'extra-success' : 'extra-danger';
                marginHtml = `<span class="bold ${marginClass}">${margin_pct.toFixed(1)}%</span>`;
            }
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="bold text-left">${m}</td>
                <td>${formatCurrency(sales_2025)}</td>
                <td>${formatCurrency(budget_2026)}</td>
                <td class="bold">${isYtd ? formatCurrency(sales_2026) : '-'}</td>
                <td>${devHtml}</td>
                <td>${growthHtml}</td>
                <td>${profitHtml}</td>
                <td>${marginHtml}</td>
            `;
            tbody.appendChild(tr);
        });
    };

    const getClientMonthlyKey = (client) => `${client.id}::${client.name}`;

    const renderClientMonthlySection = (agent) => {
        const selector = document.getElementById('det-client-monthly-selector');
        const tbody = document.getElementById('det-client-monthly-table-body');
        if (!selector || !tbody) return;

        const allClients = [...(agent.clients || [])].sort(compareClientCodeAsc);
        const monthlyQuery = (state.clientMonthlySearchQuery || '').toLowerCase().trim();
        const clients = monthlyQuery
            ? allClients.filter(client =>
                String(client.id).toLowerCase().includes(monthlyQuery) ||
                String(client.name).toLowerCase().includes(monthlyQuery)
            )
            : allClients;

        selector.innerHTML = '';

        if (clients.length === 0) {
            state.selectedClientMonthlyKey = null;
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-left text-muted" style="padding: 16px; text-align: center;">
                        No se encontraron clientes para el filtro aplicado.
                    </td>
                </tr>
            `;
            return;
        }

        clients.forEach(client => {
            const option = document.createElement('option');
            option.value = getClientMonthlyKey(client);
            option.textContent = `[${client.id}] ${client.name}`;
            selector.appendChild(option);
        });

        const hasSelection = clients.some(c => getClientMonthlyKey(c) === state.selectedClientMonthlyKey);
        if (!state.selectedClientMonthlyKey || !hasSelection) {
            state.selectedClientMonthlyKey = getClientMonthlyKey(clients[0]);
        }
        selector.value = state.selectedClientMonthlyKey;

        const selectedClient = clients.find(c => getClientMonthlyKey(c) === state.selectedClientMonthlyKey) || clients[0];
        if (!selectedClient) return;

        const monthLabels = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        tbody.innerHTML = '';

        monthLabels.forEach(label => {
            const month = label.toUpperCase();
            const sales2025 = toNumber(selectedClient.sales_2025_monthly?.[month]);
            const budget2026 = toNumber(selectedClient.budget_2026_monthly?.[month]);
            const sales2026 = toNumber(selectedClient.sales_2026_monthly?.[month]);
            const profit2026 = toNumber(selectedClient.profit_2026_monthly?.[month]);
            const diffVs2025 = sales2026 - sales2025;
            const yoyPctVs2025 = sales2025 > 0 ? (diffVs2025 / sales2025) * 100 : null;

            const marginPct = sales2026 > 0 ? (profit2026 / sales2026) * 100 : 0;
            const deviationPct = budget2026 > 0 ? ((sales2026 - budget2026) / budget2026) * 100 : 0;

            const marginClass = marginPct < 0 ? 'extra-danger' : (marginPct < ALERT_THRESHOLDS.lowMarginPct ? 'extra-warn' : 'extra-success');
            const deviationClass = deviationPct < 0 ? 'extra-danger' : 'extra-success';
            const diffClass = diffVs2025 < 0 ? 'extra-danger' : 'extra-success';
            const yoyClass = yoyPctVs2025 !== null && yoyPctVs2025 < 0 ? 'extra-danger' : 'extra-success';
            const yoyHtml = yoyPctVs2025 === null ? '-' : `<span class="bold ${yoyClass}">${formatPercent(yoyPctVs2025)}</span>`;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="bold text-left">${label}</td>
                <td>${formatCurrency(sales2025)}</td>
                <td>${formatCurrency(budget2026)}</td>
                <td class="bold">${formatCurrency(sales2026)}</td>
                <td class="bold ${diffClass}">${formatCurrency(diffVs2025)}</td>
                <td>${yoyHtml}</td>
                <td class="${profit2026 < 0 ? 'text-coral bold' : 'bold'}">${formatCurrency(profit2026)}</td>
                <td class="bold ${marginClass}">${marginPct.toFixed(1)}%</td>
                <td class="bold ${deviationClass}">${formatPercent(deviationPct)}</td>
            `;
            tbody.appendChild(tr);
        });

        selector.onchange = (e) => {
            state.selectedClientMonthlyKey = e.target.value;
            renderClientMonthlySection(agent);
        };
    };

    const renderAgentMonthlyChart = (agent) => {
        if (state.charts.agentMonthly) state.charts.agentMonthly.destroy();

        const ctx = document.getElementById('agentMonthlyChart').getContext('2d');
        const monthsLabel = ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic', 'Ene'];
        
        const data2025 = monthsLabel.map(m => agent.sales_2025_monthly[m.toUpperCase()]);
        const dataBudget = monthsLabel.map(m => agent.budget_2026_monthly[m.toUpperCase()]);
        
        const dataReal2026 = monthsLabel.map(m => {
            const mKey = m.toUpperCase();
            if (state.data.ytd_months.includes(mKey)) {
                return agent.sales_2026_monthly[mKey];
            }
            return null;
        });

        state.charts.agentMonthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: monthsLabel,
                datasets: [
                    {
                        label: 'Ventas 2026',
                        data: dataReal2026,
                        backgroundColor: dataReal2026.map((v, i) => {
                            if (v === null || v === undefined) return 'transparent';
                            const budget = toNumber(dataBudget[i]);
                            return v >= budget ? 'hsl(142, 70%, 45%)' : 'hsl(352, 80%, 55%)';
                        }),
                        borderRadius: 4,
                        order: 1
                    },
                    {
                        label: 'Ppto 2026',
                        data: dataBudget,
                        type: 'line',
                        borderColor: 'hsl(217, 90%, 60%)',
                        borderWidth: 2,
                        pointBackgroundColor: 'hsl(217, 90%, 60%)',
                        fill: false,
                        tension: 0.1,
                        order: 0
                    },
                    {
                        label: 'Histórico 2025',
                        data: data2025,
                        type: 'line',
                        borderColor: 'hsla(220, 16%, 66%, 0.3)',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        pointBackgroundColor: 'hsla(220, 16%, 66%, 0.3)',
                        fill: false,
                        tension: 0.1,
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: { boxWidth: 12 }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: 'hsla(220, 20%, 20%, 0.3)' },
                        ticks: { callback: (val) => formatShortNum(val) }
                    }
                }
            }
        });
    };

    // 7. Bootstrap Dashboard
    const init = () => {
        // Set last sync date
        document.getElementById('sync-date').innerText = state.data.last_updated;

        const periodLabel = state.data.period_label || getYtdPeriodLabel();
        const periodLabelEl = document.getElementById('period-label');
        if (periodLabelEl) periodLabelEl.innerText = periodLabel;
        const asOfDateEl = document.getElementById('as-of-date');
        if (asOfDateEl) asOfDateEl.innerText = formatAsOfDate(state.data.as_of_date);
        const kpiPeriodEl = document.getElementById('kpi-sales-period');
        if (kpiPeriodEl) kpiPeriodEl.innerText = periodLabel;

        // Setup handlers
        setupNavigation();
        setupTableSorting();

        // Load general tab first
        renderGeneralTab();
    };

    // Run
    init();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootDashboard);
} else {
    bootDashboard();
}
