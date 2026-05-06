/**
 * Export data array to CSV file with UTF-8 BOM for Arabic support in Excel
 */
export function exportToCSV(data, filename, columns) {
  if (!data || !data.length) return

  // Create header row
  const headers = columns.map(col => col.label).join(',')
  
  // Create data rows
  const rows = data.map(row => {
    return columns.map(col => {
      let val = row[col.key]
      
      // Handle nested or computed values if a formatter is provided
      if (col.formatter) {
        val = col.formatter(row)
      }
      
      // Escape quotes and wrap in quotes to handle commas/newlines in data
      if (val === null || val === undefined) val = ''
      val = String(val).replace(/"/g, '""')
      return `"${val}"`
    }).join(',')
  })

  // Combine headers and rows
  const csvContent = [headers, ...rows].join('\n')

  // Add UTF-8 BOM to ensure Excel reads Arabic correctly
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' })
  
  // Create download link
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
