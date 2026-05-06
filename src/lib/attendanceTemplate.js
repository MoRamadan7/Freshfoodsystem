export function generateAttendanceHTML(data, settings, period = '') {
  const isAr = (settings.language || 'ar') === 'ar'
  const color = settings.invoice_color || '#10b981'

  return `
    <!DOCTYPE html>
    <html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <title>${isAr ? 'تقرير الحضور والغياب' : 'Attendance Report'}</title>
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
      <style>
        body { font-family: 'Cairo', sans-serif; padding: 40px; color: #1e293b; }
        .header { text-align: center; margin-bottom: 40px; border-bottom: 2px solid ${color}; padding-bottom: 20px; }
        .logo { max-height: 80px; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #f8fafc; padding: 12px; text-align: ${isAr ? 'right' : 'left'}; border-bottom: 2px solid #e2e8f0; font-size: 13px; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .footer { margin-top: 50px; text-align: center; font-size: 11px; color: #64748b; border-top: 1px solid #eee; padding-top: 20px; }
        .badge { padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
        .present { background: #dcfce7; color: #166534; }
        .absent { background: #fee2e2; color: #991b1b; }
        @media print { .no-print { display: none; } }
        .print-btn { position: fixed; top: 20px; right: 20px; background: #000; color: #fff; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; }
      </style>
    </head>
    <body>
      <button class="print-btn no-print" onclick="window.print()">${isAr ? 'طباعة' : 'Print'}</button>
      <div class="header">
        ${settings.logo_url ? `<img src="${settings.logo_url}" class="logo">` : `<h1>${settings.company_name}</h1>`}
        <h2>${isAr ? 'كشف الحضور والغياب' : 'Attendance Report'}</h2>
        <p>${period || (isAr ? 'التاريخ:' : 'Date:') + ' ' + new Date().toLocaleDateString()}</p>
      </div>
      <table>
        <thead>
          <tr>
            <th>${isAr ? 'الموظف' : 'Employee'}</th>
            <th>${isAr ? 'الحالة' : 'Status'}</th>
            <th>${isAr ? 'الحضور' : 'In'}</th>
            <th>${isAr ? 'الانصراف' : 'Out'}</th>
            <th>${isAr ? 'الإضافي' : 'OT'}</th>
            <th>${isAr ? 'ملاحظات' : 'Notes'}</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(r => `
            <tr>
              <td style="font-weight:bold">${r.employees?.name}</td>
              <td><span class="badge ${r.status === 'present' ? 'present' : 'absent'}">${isAr ? (r.status === 'present' ? 'حاضر' : 'غائب') : r.status}</span></td>
              <td>${r.check_in || '—'}</td>
              <td>${r.check_out || '—'}</td>
              <td>${r.daily_overtime || 0} ${isAr ? 'س' : 'h'}</td>
              <td>${r.notes || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="footer">
        ${settings.company_name} | ${settings.address || ''} | ${settings.phone || ''}
      </div>
    </body>
    </html>
  `
}
