// Helper: generate invoice PDF using jsPDF
// All settings read from company_settings (passed as param)
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

/**
 * Generate and download/preview a PDF invoice
 * @param {object} invoice   - Invoice data (with items array and client object)
 * @param {object} settings  - Company settings from SettingsContext
 * @param {string} action    - 'download' | 'preview'
 */
export async function generateInvoicePDF(invoice, settings, action = 'download') {
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })

  const isAr = (settings.language || 'ar') === 'ar'
  const color = hexToRgb(settings.invoice_color || '#10b981')
  const currency = settings.currency_symbol || settings.currency || 'ج.م'
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // ── Header Background Strip ──────────────────────────────────
  doc.setFillColor(color.r, color.g, color.b)
  doc.rect(0, 0, pageW, 38, 'F')

  // ── Company Name ──────────────────────────────────────────────
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  const companyName = settings.company_name || 'Company'
  doc.text(companyName, margin, 16)

  // ── Invoice Label (right side) ────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const invLabel = isAr ? 'فاتورة' : 'INVOICE'
  doc.text(invLabel, pageW - margin, 12, { align: 'right' })
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(invoice.invoice_number || '', pageW - margin, 20, { align: 'right' })

  // ── Company Info (below header) ───────────────────────────────
  doc.setTextColor(80, 80, 80)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  let infoY = 44
  const companyInfo = [
    settings.address,
    settings.phone,
    settings.email,
    settings.tax_number ? (isAr ? `رقم ضريبي: ${settings.tax_number}` : `Tax No: ${settings.tax_number}`) : null,
  ].filter(Boolean)
  companyInfo.forEach(line => {
    doc.text(line, margin, infoY)
    infoY += 4.5
  })

  // ── Client Info ───────────────────────────────────────────────
  const clientLabel = isAr ? 'فاتورة إلى:' : 'Bill To:'
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(color.r, color.g, color.b)
  doc.text(clientLabel, pageW - margin, 44, { align: 'right' })
  doc.setTextColor(50, 50, 50)
  doc.setFont('helvetica', 'normal')
  const clientName = invoice.clients?.client_name || invoice.client_name || '—'
  doc.text(clientName, pageW - margin, 49, { align: 'right' })
  if (invoice.clients?.phone) doc.text(invoice.clients.phone, pageW - margin, 53.5, { align: 'right' })
  if (invoice.clients?.email) doc.text(invoice.clients.email, pageW - margin, 58, { align: 'right' })

  // ── Dates ─────────────────────────────────────────────────────
  const dateY = infoY + 4
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(color.r, color.g, color.b)
  doc.text(isAr ? 'تاريخ الإصدار:' : 'Issue Date:', margin, dateY)
  doc.setTextColor(50, 50, 50)
  doc.setFont('helvetica', 'normal')
  doc.text(invoice.issue_date || '—', margin + 28, dateY)
  if (invoice.due_date) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(color.r, color.g, color.b)
    doc.text(isAr ? 'تاريخ الاستحقاق:' : 'Due Date:', margin, dateY + 5)
    doc.setTextColor(50, 50, 50)
    doc.setFont('helvetica', 'normal')
    doc.text(invoice.due_date, margin + 30, dateY + 5)
  }

  // ── Items Table ───────────────────────────────────────────────
  const tableY = Math.max(dateY + 12, 72)
  const headers = isAr
    ? [['#', 'الوصف', 'الكمية', 'سعر الوحدة', 'الإجمالي']]
    : [['#', 'Description', 'Qty', 'Unit Price', 'Total']]

  const items = (invoice.invoice_items || []).map((item, i) => [
    i + 1,
    item.description,
    item.quantity,
    `${Number(item.unit_price).toLocaleString()} ${currency}`,
    `${Number(item.total).toLocaleString()} ${currency}`,
  ])

  autoTable(doc, {
    startY: tableY,
    head: headers,
    body: items,
    margin: { left: margin, right: margin },
    headStyles: { 
      fillColor: [color.r, color.g, color.b], 
      textColor: [255, 255, 255], 
      font: 'helvetica', 
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: { 
      font: 'helvetica', 
      fontSize: 9, 
      cellPadding: 4, 
      textColor: [50, 50, 50],
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 15 },
      1: { cellWidth: 'auto', halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 25 },
      3: { cellWidth: 35 },
      4: { cellWidth: 40, fontStyle: 'bold', textColor: [color.r, color.g, color.b] }
    },
  })

  // ── Totals ────────────────────────────────────────────────────
  const finalY = doc.lastAutoTable.finalY + 6
  const totalsX = pageW - margin - 60
  const valX = pageW - margin

  const subtotal = Number(invoice.subtotal || 0)
  const taxRate = Number(invoice.tax_rate || 0)
  const taxAmount = Number(invoice.tax_amount || 0)
  const total = Number(invoice.total || 0)

  doc.setFontSize(9)
  let totY = finalY

  if (settings.invoice_show_tax && taxRate > 0) {
    doc.setTextColor(80, 80, 80)
    doc.text(isAr ? 'المجموع الفرعي:' : 'Subtotal:', totalsX, totY)
    doc.text(`${subtotal.toLocaleString()} ${currency}`, valX, totY, { align: 'right' })
    totY += 6
    doc.text(isAr ? `ضريبة (${taxRate}%):` : `Tax (${taxRate}%):`, totalsX, totY)
    doc.text(`${taxAmount.toLocaleString()} ${currency}`, valX, totY, { align: 'right' })
    totY += 6
    doc.setDrawColor(color.r, color.g, color.b)
    doc.line(totalsX, totY, valX, totY)
    totY += 4
  }

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(color.r, color.g, color.b)
  doc.setFontSize(11)
  doc.text(isAr ? 'الإجمالي:' : 'Total:', totalsX, totY)
  doc.text(`${total.toLocaleString()} ${currency}`, valX, totY, { align: 'right' })

  // ── Notes ─────────────────────────────────────────────────────
  if (invoice.notes || settings.invoice_notes) {
    const noteY = totY + 12
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(color.r, color.g, color.b)
    doc.text(isAr ? 'ملاحظات:' : 'Notes:', margin, noteY)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(invoice.notes || settings.invoice_notes || '', margin, noteY + 5, { maxWidth: pageW - margin * 2 })
  }

  // ── Company Stamp ─────────────────────────────────────────────
  try {
    const stampUrl = settings.stamp_url || '/company_stamp.png'
    const stampWidth = 50 
    const stampHeight = 25 
    const stampX = (pageW - stampWidth) / 2 // Centered horizontally
    doc.addImage(stampUrl, 'PNG', stampX, totY + 5, stampWidth, stampHeight)
  } catch (e) {
    console.warn('Failed to add stamp to PDF:', e)
  }

  // ── Footer ────────────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 14
  doc.setFillColor(color.r, color.g, color.b)
  doc.rect(0, footerY - 4, pageW, 18, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  const footerText = settings.invoice_footer || settings.invoice_notes || ''
  if (footerText) doc.text(footerText, pageW / 2, footerY + 3, { align: 'center', maxWidth: pageW - 20 })

  // ── Output ────────────────────────────────────────────────────
  const filename = `${invoice.invoice_number || 'invoice'}.pdf`
  if (action === 'preview') {
    const blob = doc.output('blob')
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } else {
    doc.save(filename)
  }
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 16, g: 185, b: 129 }
}
