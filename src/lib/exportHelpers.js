// Helper: export any data array to Excel file
import * as XLSX from 'xlsx'

/**
 * @param {Array}  data     - Array of objects
 * @param {string} filename - Filename without extension
 * @param {string} sheetName
 */
export function exportToExcel(data, filename = 'export', sheetName = 'Sheet1') {
  if (!data || data.length === 0) return
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

/**
 * Generate payroll PDF using jsPDF
 */
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function generatePayrollPDF(records, month, year, settings) {
  const doc = new jsPDF({ orientation: 'l', unit: 'mm', format: 'a4' })
  const isAr = (settings.language || 'ar') === 'ar'
  const color = hexToRgb(settings.invoice_color || '#10b981')
  const currency = settings.currency_symbol || settings.currency || 'ج.م'
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 14

  // Header
  doc.setFillColor(color.r, color.g, color.b)
  doc.rect(0, 0, pageW, 28, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(settings.company_name || '', margin, 14)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const title = isAr ? `كشف رواتب — ${month}/${year}` : `Payroll Sheet — ${month}/${year}`
  doc.text(title, pageW - margin, 14, { align: 'right' })

  // Table
  const headers = isAr
    ? [['الموظف', 'الراتب الأساسي', 'أيام الحضور', 'أيام الغياب', 'إضافي (ج)', 'مكافآت', 'خصومات', 'سلف', 'الصافي', 'الحالة']]
    : [['Employee', 'Basic', 'Present', 'Absent', 'Overtime', 'Bonuses', 'Deductions', 'Advances', 'Net', 'Status']]

  const body = records.map(r => [
    r.employee_name || r.employees?.name || '',
    `${Number(r.basic_salary).toLocaleString()} ${currency}`,
    r.attendance_days,
    r.absence_days,
    `${Number(r.overtime_amount).toLocaleString()} ${currency}`,
    `${Number(r.bonuses).toLocaleString()} ${currency}`,
    `${Number(r.deductions).toLocaleString()} ${currency}`,
    `${Number(r.advances).toLocaleString()} ${currency}`,
    `${Number(r.net_salary).toLocaleString()} ${currency}`,
    r.status === 'paid' ? (isAr ? 'مصروف' : 'Paid') : (isAr ? 'مسودة' : 'Draft'),
  ])

  autoTable(doc, {
    startY: 34,
    head: headers,
    body,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2.5 },
    headStyles: { fillColor: [color.r, color.g, color.b], textColor: [255,255,255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  })

  // Total
  const netTotal = records.reduce((s, r) => s + Number(r.net_salary || 0), 0)
  const finalY = doc.lastAutoTable.finalY + 6
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(color.r, color.g, color.b)
  doc.setFontSize(10)
  const totalLabel = isAr ? 'إجمالي الرواتب الصافية:' : 'Total Net Salaries:'
  doc.text(`${totalLabel} ${netTotal.toLocaleString()} ${currency}`, margin, finalY)

  doc.save(`payroll-${year}-${month}.pdf`)
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 16, g: 185, b: 129 }
}
