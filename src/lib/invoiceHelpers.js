import { generateInvoicePDF } from './invoicePDF'
import { generateInvoiceHTML } from './invoiceTemplate'

/**
 * Opens a new window with the HTML invoice for printing or saving as PDF
 * @param {object} invoice 
 * @param {object} settings 
 */
export function printInvoiceHTML(invoice, settings) {
  const data = {
    ...invoice,
    invoice_items: invoice.invoice_items || invoice.items || []
  }
  
  const html = generateInvoiceHTML(data, settings)
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

/**
 * Generates and downloads the PDF invoice
 * @param {object} invoice 
 * @param {object} settings 
 * @param {string} action 
 */
export async function generateInvoicePDFWrapper(invoice, settings, action = 'download') {
  const data = {
    ...invoice,
    invoice_items: invoice.invoice_items || invoice.items || []
  }
  return generateInvoicePDF(data, settings, action)
}

export { generateInvoicePDFWrapper as generateInvoicePDF }
