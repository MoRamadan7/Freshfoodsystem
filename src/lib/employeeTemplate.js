export function generateEmployeeListHTML(data, settings) {
  const isAr = (settings.language || 'ar') === 'ar'
  const color = settings.invoice_color || '#10b981'

  return `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${isAr ? 'قائمة الموظفين' : 'Employee List'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${color}; padding-bottom: 20px; }
        .logo { max-height: 80px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; padding: 12px; text-align: ${isAr ? 'right' : 'left'}; border-bottom: 2px solid #e2e8f0; font-size: 13px; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #64748b; }
        @media print { .no-print { display: none; } }
        .print-btn { position: fixed; top: 20px; right: 20px; background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">${isAr ? 'طباعة' : 'Print'}</button>
      <div class="header">
        ${settings.logo_url ? `<img src="${settings.logo_url}" class="logo">` : `<h1>${settings.company_name}</h1>`}
        <h2>${isAr ? 'قائمة الموظفين والبيانات الوظيفية' : 'Employee & Job Details List'}</h2>
      </div>
      <table>
        <thead>
          <tr>
            <th>${isAr ? 'الاسم' : 'Name'}</th>
            <th>${isAr ? 'الوظيفة' : 'Role'}</th>
            <th>${isAr ? 'المحطة' : 'Station'}</th>
            <th>${isAr ? 'رقم الهاتف' : 'Phone'}</th>
            <th>${isAr ? 'البريد الإلكتروني' : 'Email'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td style="font-weight:bold">${r.name}</td>
              <td>${isAr ? (r.role === 'admin' ? 'مدير نظام' : r.role) : r.role}</td>
              <td>${r.stations?.name || '—'}</td>
              <td>${r.phone || '—'}</td>
              <td>${r.email || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        ${settings.company_name} | ${isAr ? 'إجمالي الموظفين:' : 'Total Employees:'} ${data.length} | ${new Date().toLocaleDateString()}
      </div>
    </body>
    </html>
  `
}
