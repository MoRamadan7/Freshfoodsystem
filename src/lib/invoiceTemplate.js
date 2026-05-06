/**
 * FreshFood - Professional A4 Invoice HTML Template
 * Features:
 *  - True A4 format (210mm × 297mm)
 *  - Centered stamp image
 *  - Very faint watermark logo behind content
 *  - All data centered / balanced on page
 *  - Print-ready
 */
export function generateInvoiceHTML(invoice, settings) {
  const isAr = (settings.language || 'ar') === 'ar'
  const color = settings.invoice_color || '#10b981'
  const currency = settings.currency_symbol || settings.currency || 'ج.م'
  const items = invoice.invoice_items || []

  const subtotal = Number(invoice.subtotal || 0)
  const taxRate  = Number(invoice.tax_rate  || 0)
  const taxAmt   = Number(invoice.tax_amount || 0)
  const total    = Number(invoice.total     || 0)

  const logoUrl     = settings.logo_url      || ''
  const stampUrl    = settings.stamp_url     || '/company_stamp.png'
  const watermarkUrl= settings.watermark_url || settings.logo_url || ''

  const itemsHTML = items.map((it, i) => `
    <tr>
      <td>${i + 1}</td>
      <td class="desc">${it.description || '—'}</td>
      <td>${Number(it.quantity).toLocaleString()}</td>
      <td>${Number(it.unit_price).toLocaleString()} ${currency}</td>
      <td class="total-cell">${Number(it.total).toLocaleString()} ${currency}</td>
    </tr>
  `).join('')

  return `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${isAr ? 'ar' : 'en'}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${isAr ? 'فاتورة' : 'Invoice'} ${invoice.invoice_number || ''}</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
  <style>
    /* ── Reset & Base ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Cairo', 'Arial', sans-serif;
      background: #f0f4f8;
      color: #1e293b;
      direction: ${isAr ? 'rtl' : 'ltr'};
    }

    /* ── A4 Sheet ── */
    .page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Watermark ── */
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 160mm;
      height: 160mm;
      opacity: 0.04;
      pointer-events: none;
      z-index: 0;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .watermark img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }

    /* ── Content (above watermark) ── */
    .content {
      position: relative;
      z-index: 1;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, ${color} 0%, ${color}cc 100%);
      padding: 20mm 15mm 10mm;
      color: white;
      text-align: center;
    }
    .header .logo-wrap {
      margin-bottom: 6mm;
    }
    .header .logo-wrap img {
      max-height: 18mm;
      max-width: 50mm;
      object-fit: contain;
      filter: brightness(0) invert(1);
      opacity: 0.95;
    }
    .header h1 {
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: 3px;
      margin-bottom: 2mm;
    }
    .header .inv-number {
      font-size: 12pt;
      opacity: 0.85;
      font-weight: 400;
    }

    /* ── Info Strip ── */
    .info-strip {
      background: #f8fafc;
      border-bottom: 1px solid #e2e8f0;
      padding: 6mm 15mm;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8mm;
    }
    .info-block h4 {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: ${color};
      font-weight: 700;
      margin-bottom: 2mm;
    }
    .info-block p {
      font-size: 9.5pt;
      color: #334155;
      line-height: 1.6;
    }
    .info-block p strong { font-weight: 700; color: #0f172a; }

    /* ── Body ── */
    .body { padding: 8mm 15mm; flex: 1; }

    /* ── Table ── */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8mm;
      font-size: 9.5pt;
    }
    thead tr {
      background: ${color};
      color: white;
    }
    thead th {
      padding: 3mm 4mm;
      font-weight: 700;
      text-align: center;
      font-size: 8.5pt;
    }
    thead th:first-child { width: 8mm; }
    /* Description column slightly wider, but still centered */
    thead th:nth-child(2) { width: 40%; }

    tbody tr { border-bottom: 1px solid #f1f5f9; }
    tbody tr:nth-child(even) { background: #f8fafc; }
    tbody td {
      padding: 2.5mm 4mm;
      color: #334155;
      text-align: center;
    }
    tbody td:first-child { color: #94a3b8; font-size: 8pt; }
    tbody td.desc { font-weight: 600; color: #0f172a; text-align: center; }
    tbody td.total-cell {
      font-weight: 700;
      color: ${color};
    }

    /* ── Totals ── */
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 8mm;
    }
    .totals-box {
      width: 80mm;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 2mm 0;
      font-size: 9.5pt;
      color: #475569;
      border-bottom: 1px solid #f1f5f9;
    }
    .totals-row.grand {
      border-top: 2px solid ${color};
      border-bottom: none;
      margin-top: 2mm;
      padding-top: 3mm;
      font-size: 13pt;
      font-weight: 800;
      color: ${color};
    }

    /* ── Notes ── */
    .notes-box {
      background: #f8fafc;
      border-${isAr ? 'right' : 'left'}: 3px solid ${color};
      padding: 4mm;
      border-radius: 2mm;
      margin-bottom: 8mm;
      font-size: 9pt;
      color: #475569;
      line-height: 1.6;
    }
    .notes-box strong { color: ${color}; display: block; margin-bottom: 1mm; font-size: 8.5pt; }

    /* ── Stamp (Centered) ── */
    .stamp-section {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 6mm 0 4mm;
    }
    .stamp-section img {
      max-height: 35mm;
      max-width: 70mm;
      object-fit: contain;
      opacity: 0.92;
    }

    /* ── Footer ── */
    .footer {
      background: linear-gradient(135deg, ${color} 0%, ${color}cc 100%);
      padding: 6mm 15mm;
      margin-top: auto;
    }
    .footer-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6mm;
      color: white;
      font-size: 8pt;
      margin-bottom: 4mm;
    }
    .footer-col h5 {
      font-size: 7pt;
      text-transform: uppercase;
      letter-spacing: 1px;
      opacity: 0.7;
      margin-bottom: 2mm;
    }
    .footer-col p { opacity: 0.9; line-height: 1.6; }
    .footer-tagline {
      text-align: center;
      color: rgba(255,255,255,0.7);
      font-size: 8pt;
      border-top: 1px solid rgba(255,255,255,0.2);
      padding-top: 3mm;
    }

    /* ── Print button (not printed) ── */
    .print-btn {
      position: fixed;
      top: 10mm;
      ${isAr ? 'left' : 'right'}: 10mm;
      background: ${color};
      color: white;
      border: none;
      padding: 3mm 6mm;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-weight: 700;
      font-size: 10pt;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 999;
      transition: 0.2s;
    }
    .print-btn:hover { opacity: 0.9; transform: translateY(-1px); }

    /* ── Print styles ── */
    @media print {
      body { background: white; }
      .page { margin: 0; box-shadow: none; }
      .print-btn { display: none; }
      @page { size: A4; margin: 0; }
    }

    @media screen {
      .page {
        margin: 10mm auto;
        box-shadow: 0 4px 40px rgba(0,0,0,0.15);
        border-radius: 2mm;
      }
    }
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">
    🖨️ ${isAr ? 'طباعة / PDF' : 'Print / PDF'}
  </button>

  <div class="page">
    <!-- Watermark -->
    ${watermarkUrl ? `
    <div class="watermark">
      <img src="${watermarkUrl}" alt="watermark">
    </div>` : ''}

    <div class="content">
      <!-- Header -->
      <div class="header">
        ${logoUrl ? `<div class="logo-wrap"><img src="${logoUrl}" alt="Logo"></div>` : ''}
        <h1>${isAr ? 'فاتورة ضريبية' : 'TAX INVOICE'}</h1>
        <div class="inv-number"># ${invoice.invoice_number || '—'}</div>
      </div>

      <!-- Info Strip -->
      <div class="info-strip">
        <div class="info-block">
          <h4>${isAr ? 'فاتورة إلى' : 'Bill To'}</h4>
          <p><strong>${invoice.clients?.client_name || '—'}</strong></p>
          ${invoice.clients?.phone ? `<p>${invoice.clients.phone}</p>` : ''}
          ${invoice.clients?.email ? `<p>${invoice.clients.email}</p>` : ''}
          ${invoice.clients?.country_city ? `<p>${invoice.clients.country_city}</p>` : ''}
        </div>
        <div class="info-block" style="text-align:${isAr ? 'left' : 'right'}">
          <h4>${isAr ? 'بيانات الفاتورة' : 'Invoice Details'}</h4>
          <p><strong>${isAr ? 'تاريخ الإصدار:' : 'Issue Date:'}</strong> ${invoice.issue_date || '—'}</p>
          ${invoice.due_date ? `<p><strong>${isAr ? 'تاريخ الاستحقاق:' : 'Due Date:'}</strong> ${invoice.due_date}</p>` : ''}
          <p><strong>${isAr ? 'الحالة:' : 'Status:'}</strong>
            <span style="color:${invoice.status === 'paid' ? '#10b981' : '#f59e0b'}">
              ${invoice.status === 'paid' ? (isAr ? 'مدفوعة' : 'Paid') :
                invoice.status === 'sent' ? (isAr ? 'مُرسلة' : 'Sent') :
                invoice.status === 'draft' ? (isAr ? 'مسودة' : 'Draft') : invoice.status}
            </span>
          </p>
          <p style="margin-top:2mm;font-size:8pt;color:#94a3b8">
            ${settings.company_name || ''}${settings.tax_number ? ` | ${isAr ? 'ضريبي:' : 'Tax:'} ${settings.tax_number}` : ''}
          </p>
        </div>
      </div>

      <!-- Body -->
      <div class="body">
        <!-- Items Table -->
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>${isAr ? 'الوصف' : 'Description'}</th>
              <th>${isAr ? 'الكمية' : 'Qty'}</th>
              <th>${isAr ? 'سعر الوحدة' : 'Unit Price'}</th>
              <th>${isAr ? 'الإجمالي' : 'Total'}</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML || `<tr><td colspan="5" style="text-align:center;color:#94a3b8;padding:6mm">${isAr ? 'لا توجد بنود' : 'No items'}</td></tr>`}
          </tbody>
        </table>

        <!-- Totals -->
        <div class="totals-wrap">
          <div class="totals-box">
            ${taxRate > 0 ? `
            <div class="totals-row">
              <span>${isAr ? 'المجموع الفرعي:' : 'Subtotal:'}</span>
              <span>${subtotal.toLocaleString()} ${currency}</span>
            </div>
            <div class="totals-row">
              <span>${isAr ? `ضريبة (${taxRate}%):` : `Tax (${taxRate}%):`}</span>
              <span>${taxAmt.toLocaleString()} ${currency}</span>
            </div>` : ''}
            <div class="totals-row grand">
              <span>${isAr ? 'الإجمالي:' : 'Grand Total:'}</span>
              <span>${total.toLocaleString()} ${currency}</span>
            </div>
          </div>
        </div>

        <!-- Notes -->
        ${(invoice.notes || settings.invoice_notes) ? `
        <div class="notes-box">
          <strong>${isAr ? 'ملاحظات:' : 'Notes:'}</strong>
          ${invoice.notes || settings.invoice_notes}
        </div>` : ''}

        <!-- Stamp (Centered) -->
        <div class="stamp-section">
          <img src="${stampUrl}" alt="${isAr ? 'ختم الشركة' : 'Company Stamp'}"
               onerror="this.style.display='none'">
        </div>
      </div>

      <!-- Footer -->
      <div class="footer">
        <div class="footer-grid">
          <div class="footer-col">
            <h5>${isAr ? 'تواصل معنا' : 'Contact'}</h5>
            ${settings.phone ? `<p>📞 ${settings.phone}</p>` : ''}
            ${settings.email ? `<p>✉️ ${settings.email}</p>` : ''}
          </div>
          <div class="footer-col" style="text-align:center">
            <h5>${isAr ? 'السجلات الرسمية' : 'Legal'}</h5>
            ${settings.commercial_register ? `<p>${isAr ? 'س.ت:' : 'CR:'} ${settings.commercial_register}</p>` : ''}
            ${settings.tax_card ? `<p>${isAr ? 'ضريبي:' : 'Tax:'} ${settings.tax_card}</p>` : ''}
          </div>
          <div class="footer-col" style="text-align:${isAr ? 'left' : 'right'}">
            <h5>${isAr ? 'العنوان' : 'Address'}</h5>
            ${settings.address ? `<p>${settings.address}</p>` : ''}
          </div>
        </div>
        <div class="footer-tagline">
          ${settings.invoice_footer || (isAr ? '✦ شكراً لثقتكم ✦' : '✦ Thank You For Your Trust ✦')}
        </div>
      </div>
    </div>
  </div>
</body>
</html>`
}
