export function generatePayrollHTML(data, period, settings) {
  const isAr = (settings.language || 'ar') === 'ar'
  const color = settings.invoice_color || '#10b981'

  const formatCurrency = (val) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      style: 'currency', currency: settings.currency || 'EGP'
    }).format(val || 0)
  }

  return `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${isAr ? 'مسير الرواتب' : 'Payroll Sheet'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${color}; padding-bottom: 20px; }
        .logo { max-height: 80px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; padding: 10px; text-align: ${isAr ? 'right' : 'left'}; border-bottom: 2px solid #e2e8f0; font-size: 11px; }
        td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; font-size: 11px; }
        .total-row { background: #f1f5f9; font-weight: bold; }
        .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #64748b; }
        @media print { .no-print { display: none; } }
        .print-btn { position: fixed; top: 20px; right: 20px; background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">${isAr ? 'طباعة' : 'Print'}</button>
      <div class="header">
        ${settings.logo_url ? `<img src="${settings.logo_url}" class="logo">` : `<h1>${settings.company_name}</h1>`}
        <h2>${isAr ? 'مسير الرواتب لفترة' : 'Payroll Sheet for'} ${period}</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>${isAr ? 'الموظف' : 'Employee'}</th>
            <th>${isAr ? 'الأساسي' : 'Basic'}</th>
            <th>${isAr ? 'الحضور' : 'Att.'}</th>
            <th>${isAr ? 'الإضافي' : 'OT'}</th>
            <th>${isAr ? 'حوافز' : 'Bonus'}</th>
            <th>${isAr ? 'خصومات' : 'Ded.'}</th>
            <th>${isAr ? 'سلف' : 'Adv.'}</th>
            <th>${isAr ? 'الصافي' : 'Net'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td style="font-weight:bold">${r.employees?.name}</td>
              <td>${formatCurrency(r.basic_salary)}</td>
              <td>${r.attendance_days} ${isAr ? 'يوم' : 'd'}</td>
              <td>${formatCurrency(r.overtime_amount)}</td>
              <td>${formatCurrency(r.bonuses)}</td>
              <td>${formatCurrency(r.deductions)}</td>
              <td>${formatCurrency(r.advances)}</td>
              <td style="font-weight:bold; color:${color}">${formatCurrency(r.net_salary)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        ${settings.company_name} | ${settings.address || ''} | ${isAr ? 'تحريراً في:' : 'Issued on:'} ${new Date().toLocaleDateString()}
      </div>
    </body>
    </html>
  `
}
