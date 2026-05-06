export function generateReportHTML(stats, stationStats, recentTx, settings, period = '') {
  const isAr = (settings.language || 'ar') === 'ar'
  const color = settings.invoice_color || '#10b981'
  const currency = settings.currency_symbol || settings.currency || 'ج.م'

  const formatCurrency = (val) => {
    try {
      return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
        style: 'currency',
        currency: (settings.currency && settings.currency.length === 3) ? settings.currency : 'EGP',
        currencyDisplay: 'symbol'
      }).format(val || 0)
    } catch (e) {
      return `${Number(val || 0).toLocaleString()} ${currency}`
    }
  }

  return `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${isAr ? 'تقرير الأعمال' : 'Business Report'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; margin: 0; padding: 40px; color: #1e293b; background: #fff; line-height: 1.6; }
        .header-strip { position: absolute; top: 0; left: 0; right: 0; height: 12px; background: linear-gradient(to right, ${color}, #6366f1); }
        
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 50px; margin-top: 30px; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; }
        .logo-box img { max-height: 70px; }
        .report-title { text-align: ${isAr ? 'left' : 'right'}; }
        .report-title h1 { margin: 0; color: #0f172a; font-size: 28px; font-weight: 800; }
        .report-title p { margin: 5px 0 0; color: #64748b; font-size: 14px; font-weight: bold; }

        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 40px; }
        .stat-card { background: #f8fafc; border: 1px solid #e2e8f0; padding: 20px; border-radius: 12px; text-align: center; }
        .stat-label { font-size: 12px; color: #64748b; margin-bottom: 8px; font-weight: bold; }
        .stat-value { font-size: 18px; font-weight: 800; color: #0f172a; }
        .stat-value.profit { color: #059669; }
        .stat-value.expense { color: #dc2626; }

        .section { margin-bottom: 40px; }
        .section-header { display: flex; items-center; gap: 10px; margin-bottom: 20px; border-inline-start: 4px solid ${color}; padding-inline-start: 12px; }
        .section-header h2 { margin: 0; font-size: 18px; color: #0f172a; }

        table { width: 100%; border-collapse: collapse; background: #fff; }
        th { background: #f1f5f9; color: #475569; font-weight: bold; text-align: ${isAr ? 'right' : 'left'}; padding: 14px; font-size: 13px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 12px 14px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #334155; }
        tr:nth-child(even) { background: #fafafa; }

        .footer { margin-top: 60px; padding-top: 30px; border-top: 2px solid #f1f5f9; }
        .footer-content { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center; font-size: 11px; color: #64748b; }
        .footer-item strong { display: block; color: #334155; margin-bottom: 4px; }

        .official-stamp { margin-top: 40px; display: flex; justify-content: flex-end; padding-inline-end: 50px; }
        .stamp-box { width: 150px; height: 100px; border: 2px dashed #cbd5e1; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; transform: rotate(-5deg); }

        @media print {
          body { padding: 0; }
          .no-print { display: none; }
          @page { margin: 1.5cm; }
        }
        .btn-container { position: fixed; bottom: 30px; right: 30px; display: flex; gap: 10px; }
        .print-btn { background: #0f172a; color: white; border: none; padding: 12px 24px; border-radius: 12px; cursor: pointer; font-family: inherit; font-weight: bold; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); }
      </style>
    </head>
    <body>
      <div class="header-strip"></div>
      
      <div class="header">
        <div class="logo-box">
          ${settings.logo_url ? `<img src="${settings.logo_url}" alt="Logo">` : `<h2 style="color:${color}">${settings.company_name}</h2>`}
        </div>
        <div class="report-title">
          <h1>${isAr ? 'تقرير أداء الأعمال' : 'Business Performance Report'}</h1>
          <p>${period || new Date().toLocaleString(isAr ? 'ar-EG' : 'en-US', { month: 'long', year: 'numeric' })}</p>
        </div>
      </div>

      <div class="summary-grid">
        <div class="stat-card">
          <div class="stat-label">${isAr ? 'إجمالي الإيرادات' : 'Total Revenue'}</div>
          <div class="stat-value profit">${formatCurrency(stats.monthRevenue)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${isAr ? 'إجمالي المصاريف' : 'Total Expenses'}</div>
          <div class="stat-value expense">${formatCurrency(stats.monthExpense)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${isAr ? 'صافي الربح' : 'Net Profit'}</div>
          <div class="stat-value ${stats.netBalance >= 0 ? 'profit' : 'expense'}">${formatCurrency(stats.netBalance)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">${isAr ? 'الصفقات النشطة' : 'Active Deals'}</div>
          <div class="stat-value">${stats.activeDeals}</div>
        </div>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>${isAr ? 'مقارنة أداء المحطات' : 'Station Comparison'}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>${isAr ? 'المحطة' : 'Station'}</th>
              <th>${isAr ? 'الإيرادات' : 'Revenue'}</th>
              <th>${isAr ? 'المصاريف' : 'Expense'}</th>
              <th>${isAr ? 'صافي الربح' : 'Net Profit'}</th>
            </tr>
          </thead>
          <tbody>
            ${stationStats.map(st => `
              <tr>
                <td style="font-weight:bold">${st.name}</td>
                <td style="color:#059669">${formatCurrency(st.revenue)}</td>
                <td style="color:#dc2626">${formatCurrency(st.expense)}</td>
                <td style="font-weight:bold; color:${st.net >= 0 ? '#059669' : '#dc2626'}">${formatCurrency(st.net)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="section">
        <div class="section-header">
          <h2>${isAr ? 'آخر العمليات المالية' : 'Recent Transactions'}</h2>
        </div>
        <table>
          <thead>
            <tr>
              <th>${isAr ? 'التاريخ' : 'Date'}</th>
              <th>${isAr ? 'البيان' : 'Description'}</th>
              <th>${isAr ? 'النوع' : 'Type'}</th>
              <th>${isAr ? 'المبلغ' : 'Amount'}</th>
            </tr>
          </thead>
          <tbody>
            ${recentTx.map(tx => `
              <tr>
                <td>${tx.date}</td>
                <td>${tx.notes || '—'}</td>
                <td>${tx.type === 'revenue' ? (isAr ? 'إيراد' : 'Revenue') : (isAr ? 'مصروف' : 'Expense')}</td>
                <td style="font-weight:bold; color:${tx.type === 'revenue' ? '#059669' : '#1e293b'}">${tx.type === 'revenue' ? '+' : '-'}${formatCurrency(tx.amount)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <div class="official-stamp">
        <div class="stamp-box">${isAr ? 'ختم الشركة واعتماد المدير' : 'Company Stamp & Manager Approval'}</div>
      </div>

      <div class="footer">
        <div class="footer-content">
          <div class="footer-item">
            <strong>${isAr ? 'العنوان' : 'Address'}</strong>
            ${settings.address || '—'}
          </div>
          <div class="footer-item">
            <strong>${isAr ? 'للتواصل' : 'Contact'}</strong>
            ${settings.phone || ''} | ${settings.email || ''}
          </div>
          <div class="footer-item">
            <strong>${isAr ? 'السجلات الرسمية' : 'Official Records'}</strong>
            ${isAr ? 'س.ت:' : 'C.R:'} ${settings.commercial_register || '—'} | ${isAr ? 'ضريبي:' : 'Tax:'} ${settings.tax_card || '—'}
          </div>
        </div>
      </div>

      <div class="btn-container no-print">
        <button class="print-btn" onclick="window.print()">${isAr ? 'طباعة التقرير' : 'Print Report'}</button>
      </div>
    </body>
    </html>
  `
}
