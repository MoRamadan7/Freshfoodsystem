import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { generateInvoiceHTML } from '../lib/invoiceTemplate'
import { exportToExcel } from '../lib/exportHelpers'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import {
  Plus, Search, FileText, Printer, Download, Eye,
  CheckCircle, XCircle, Send, Trash2, Pencil, FileDown, MessageSquare
} from 'lucide-react'

const STATUS_CONFIG = {
  draft:     { ar: 'مسودة',   en: 'Draft',     color: 'bg-gray-100 text-gray-600' },
  sent:      { ar: 'مرسلة',   en: 'Sent',      color: 'bg-blue-100 text-blue-700' },
  paid:      { ar: 'مدفوعة',  en: 'Paid',      color: 'bg-emerald-100 text-emerald-700' },
  cancelled: { ar: 'ملغاة',   en: 'Cancelled', color: 'bg-red-100 text-red-700' },
  overdue:   { ar: 'متأخرة',  en: 'Overdue',   color: 'bg-orange-100 text-orange-700' },
}

const emptyItem = { description: '', quantity: 1, unit_price: '', total: 0 }
const emptyForm = {
  client_id: '', deal_id: '', issue_date: new Date().toISOString().split('T')[0],
  due_date: '', status: 'draft', notes: '', tax_rate: '',
}

export default function Invoices() {
  const { settings, formatCurrency } = useSettings()
  const { t, lang, isRTL } = useLang()
  const { employee, isAdmin, normalizedRole } = useAuth()

  const [rows, setRows]         = useState([])
  const [clients, setClients]   = useState([])
  const [deals, setDeals]       = useState([])
  const [stations, setStations] = useState([])
  const [search, setSearch]     = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal]       = useState(false)   // create/edit modal
  const [editing, setEditing]   = useState(null)
  const [form, setForm]         = useState(emptyForm)
  const [items, setItems]       = useState([{ ...emptyItem }])
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)

  useEffect(() => { load(); loadLookups(); loadStations() }, [fromDate, toDate])

  async function loadStations() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }

  async function load() {
    if (!employee) return
    setLoading(true)
    let query = supabase
      .from('invoices')
      .select('*')
      .gte('issue_date', fromDate)
      .lte('issue_date', toDate)
      .order('created_at', { ascending: false })
      
    if (!isAdmin && normalizedRole !== 'manager') {
      query = query.eq('created_by', employee.id)
    }
      
    const { data, error } = await query
    if (error) {
      console.error('Invoice load error:', error)
      toast.error(error.message)
    }
    // mark overdue
    const today = new Date().toISOString().split('T')[0]
    const enriched = (data ?? []).map(inv => ({
      ...inv,
      displayStatus: inv.status !== 'paid' && inv.status !== 'cancelled' && inv.due_date && inv.due_date < today
        ? 'overdue' : inv.status
    }))
    setRows(enriched)
    setLoading(false)
  }

  async function loadLookups() {
    const [c, d] = await Promise.all([
      supabase.from('clients').select('id,client_name').order('client_name'),
      supabase.from('deals').select('id,clients(client_name),total_amount').order('created_at', { ascending: false }),
    ])
    setClients(c.data ?? [])
    setDeals(d.data ?? [])
  }

  // Auto-generate invoice number
  async function getNextNumber() {
    const prefix = settings.invoice_prefix || 'INV-'
    const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true })
    const num = String((count || 0) + 1).padStart(4, '0')
    return `${prefix}${num}`
  }

  function recalcItems(newItems) {
    return newItems.map(it => ({
      ...it,
      total: Number(it.quantity || 0) * Number(it.unit_price || 0)
    }))
  }

  function updateItem(idx, field, value) {
    const updated = recalcItems(items.map((it, i) => i === idx ? { ...it, [field]: value } : it))
    setItems(updated)
  }

  function addItem()       { setItems(prev => [...prev, { ...emptyItem }]) }
  function removeItem(idx) { setItems(prev => prev.filter((_, i) => i !== idx)) }

  const subtotal = items.reduce((s, it) => s + Number(it.total || 0), 0)
  const taxRate  = Number(form.tax_rate || settings.invoice_tax_rate || 0)
  const taxAmount = subtotal * taxRate / 100
  const total = subtotal + taxAmount

  async function openNew() {
    const num = await getNextNumber()
    setForm({ ...emptyForm, invoice_number: num, tax_rate: settings.invoice_tax_rate || 0, station_id: '' })
    setItems([{ ...emptyItem }])
    setEditing(null)
    setModal(true)
  }

  async function openEdit(inv) {
    const { data: invItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id)
    setForm({
      invoice_number: inv.invoice_number,
      client_id: inv.client_id || '',
      deal_id: inv.deal_id || '',
      station_id: inv.station_id || '',
      issue_date: inv.issue_date,
      due_date: inv.due_date || '',
      status: inv.status,
      notes: inv.notes || '',
      tax_rate: inv.tax_rate || 0,
    })
    setItems(invItems?.length ? invItems : [{ ...emptyItem }])
    setEditing(inv.id)
    setModal(true)
  }

  async function save() {
    if (!form.client_id) return toast.error(lang === 'ar' ? 'اختار العميل' : 'Select a client')
    if (items.every(it => !it.description)) return toast.error(lang === 'ar' ? 'أضف بنداً واحداً على الأقل' : 'Add at least one item')
    setSaving(true)
    try {
      const payload = {
        invoice_number: form.invoice_number,
        client_id: Number(form.client_id),
        deal_id: form.deal_id ? Number(form.deal_id) : null,
        station_id: form.station_id ? Number(form.station_id) : null,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        status: form.status,
        notes: form.notes,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        subtotal,
        total,
        created_by: employee?.id || null,
      }

      let invoiceId = editing
      if (editing) {
        const { error } = await supabase.from('invoices').update(payload).eq('id', editing)
        if (error) throw error
        await supabase.from('invoice_items').delete().eq('invoice_id', editing)
      } else {
        const { data, error } = await supabase.from('invoices').insert(payload).select().single()
        if (error) throw error
        invoiceId = data.id
      }

      const lineItems = items
        .filter(it => it.description)
        .map(it => ({ invoice_id: invoiceId, description: it.description, quantity: Number(it.quantity), unit_price: Number(it.unit_price), total: Number(it.total) }))
      await supabase.from('invoice_items').insert(lineItems)

      toast.success(lang === 'ar' ? 'تم الحفظ' : 'Saved')
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'الفواتير', invoiceId || 'جديد', `فاتورة رقم: ${form.invoice_number} بمبلغ ${total}`)
      setModal(false)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(id, status) {
    await supabase.from('invoices').update({ status }).eq('id', id)
    toast.success(lang === 'ar' ? 'تم التحديث' : 'Updated')
    const inv = rows.find(r => r.id === id)
    logActivity(employee, 'تعديل حالة', 'الفواتير', id, `فاتورة رقم: ${inv?.invoice_number} -> ${status}`)
    // If marking as paid, optionally add to transactions
    if (status === 'paid') {
      const inv = rows.find(r => r.id === id)
      if (inv) {
        await supabase.from('transactions').insert({
          date: new Date().toISOString().split('T')[0],
          type: 'revenue',
          amount: inv.total,
          client_id: inv.client_id,
          payment_method: 'cash',
          notes: `${lang === 'ar' ? 'سداد فاتورة' : 'Invoice payment'} ${inv.invoice_number}`,
        })
      }
    }
    load()
  }

  async function remove(id) {
    if (!confirm(t('confirmDelete'))) return
    const inv = rows.find(r => r.id === id)
    await supabase.from('invoices').delete().eq('id', id)
    toast.success(lang === 'ar' ? 'تم الحذف' : 'Deleted')
    logActivity(employee, 'حذف', 'الفواتير', id, `فاتورة رقم: ${inv?.invoice_number}`)
    load()
  }

  async function handlePDF(inv, action) {
    const { data: invItems } = await supabase.from('invoice_items').select('*').eq('invoice_id', inv.id)
    const html = generateInvoiceHTML({ ...inv, invoice_items: invItems }, settings)
    
    const win = window.open('', '_blank')
    win.document.write(html)
    win.document.close()
  }

  function handleWhatsApp(inv) {
    const phone = inv.clients?.phone?.replace(/\s/g, '')
    if (!phone) return toast.error(lang === 'ar' ? 'رقم الهاتف غير مسجل' : 'Phone number not found')
    
    const message = encodeURIComponent(
      `مرحباً ${inv.clients?.client_name},\n\n` +
      `تجدون مرفقاً تفاصيل الفاتورة رقم ${inv.invoice_number}\n` +
      `الإجمالي: ${formatCurrency(inv.total)}\n` +
      `تاريخ الاستحقاق: ${inv.due_date || '—'}\n\n` +
      `شكراً لتعاملكم معنا.\n${settings.company_name}`
    )
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank')
  }

  function handleExcelExport() {
    const data = filtered.map(inv => ({
      [lang === 'ar' ? 'رقم الفاتورة' : 'Invoice #']: inv.invoice_number,
      [lang === 'ar' ? 'العميل' : 'Client']: inv.clients?.client_name || '',
      [lang === 'ar' ? 'تاريخ الإصدار' : 'Issue Date']: inv.issue_date,
      [lang === 'ar' ? 'تاريخ الاستحقاق' : 'Due Date']: inv.due_date || '',
      [lang === 'ar' ? 'الإجمالي' : 'Total']: inv.total,
      [lang === 'ar' ? 'الحالة' : 'Status']: inv.status,
    }))
    exportToExcel(data, `invoices-${new Date().toLocaleDateString()}`, lang === 'ar' ? 'الفواتير' : 'Invoices')
  }

  const filtered = rows.filter(inv => {
    if (statusFilter && inv.displayStatus !== statusFilter) return false
    if (stationFilter && inv.station_id !== Number(stationFilter)) return false
    
    const clientName = clients.find(c => c.id === inv.client_id)?.client_name || ''
    return (inv.invoice_number?.includes(search) || clientName.includes(search))
  })

  const totalPaid = rows.filter(r => r.status === 'paid').reduce((s, r) => s + Number(r.total || 0), 0)
  const totalPending = rows.filter(r => ['draft','sent'].includes(r.status)).reduce((s, r) => s + Number(r.total || 0), 0)

  const SL = (key) => STATUS_CONFIG[key]?.[lang === 'ar' ? 'ar' : 'en'] ?? key

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('invoices')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lang === 'ar' ? 'مدفوع:' : 'Paid:'} <span className="text-emerald-600 font-medium">{formatCurrency(totalPaid)}</span>
            {' · '}
            {lang === 'ar' ? 'معلق:' : 'Pending:'} <span className="text-amber-600 font-medium">{formatCurrency(totalPending)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExcelExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <FileDown size={15} /> {t('export')}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> {t('newInvoice')}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-sm">
          <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'من' : 'From'}</label>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="text-sm bg-transparent border-none focus:ring-0 dark:text-gray-100" />
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg shadow-sm">
          <label className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'إلى' : 'To'}</label>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="text-sm bg-transparent border-none focus:ring-0 dark:text-gray-100" />
        </div>
        <div className="relative flex-1">
          <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === 'ar' ? 'ابحث برقم الفاتورة أو العميل...' : 'Search invoice or client...'}
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg ps-9 pe-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">{lang === 'ar' ? 'كل المحطات' : 'All Stations'}</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">{lang === 'ar' ? 'كل الحالات' : 'All Statuses'}</option>
          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
            <option key={k} value={k}>{lang === 'ar' ? v.ar : v.en}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">{t('invoiceNumber')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('client')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('invoiceDate')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('dueDate')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('total')}</th>
                  <th className="text-start px-4 py-3 font-medium">{t('status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-10">{t('noInvoices')}</td></tr>
                ) : filtered.map(inv => {
                  const sc = STATUS_CONFIG[inv.displayStatus] || STATUS_CONFIG.draft
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-800 dark:text-gray-200 block">{inv.invoice_number}</span>
                        <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                          {stations.find(s => s.id === inv.station_id)?.name || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                        {clients.find(c => c.id === inv.client_id)?.client_name || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{inv.issue_date}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">{inv.due_date || '—'}</td>
                      <td className="px-4 py-3 font-semibold text-gray-800 dark:text-gray-200">{formatCurrency(inv.total)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${sc.color}`}>
                          {sc[lang === 'ar' ? 'ar' : 'en']}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => handlePDF(inv, 'preview')} title={t('preview')}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handlePDF(inv, 'download')} title={t('exportPDF')}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-emerald-600 transition-colors">
                            <Download size={14} />
                          </button>
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button onClick={() => updateStatus(inv.id, 'paid')} title={t('markAsPaid')}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-emerald-600 transition-colors">
                              <CheckCircle size={14} />
                            </button>
                          )}
                          {inv.status === 'draft' && (
                            <button onClick={() => updateStatus(inv.id, 'sent')} title={t('markAsSent')}
                              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
                              <Send size={14} />
                            </button>
                          )}
                          <button onClick={() => openEdit(inv)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => handleWhatsApp(inv)} title="WhatsApp"
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-emerald-600 transition-colors">
                            <MessageSquare size={14} />
                          </button>
                          <button onClick={() => remove(inv.id)}
                            className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? (lang === 'ar' ? 'تعديل فاتورة' : 'Edit Invoice') : t('newInvoice')}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pe-1">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('invoiceNumber')}</label>
              <input value={form.invoice_number || ''} readOnly
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:text-gray-400 rounded-lg px-3 py-2 text-sm font-mono" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('status')}</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {Object.entries(STATUS_CONFIG).slice(0,4).map(([v, c]) => (
                  <option key={v} value={v}>{c[lang === 'ar' ? 'ar' : 'en']}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('station')} ({lang === 'ar' ? 'اختياري' : 'Optional'})</label>
              <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">—</option>
                {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('client')} *</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">— {lang === 'ar' ? 'اختار العميل' : 'Select Client'} —</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('deal')} ({lang === 'ar' ? 'اختياري' : 'Optional'})</label>
              <select value={form.deal_id} onChange={e => setForm(f => ({ ...f, deal_id: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="">—</option>
                {deals.map(d => <option key={d.id} value={d.id}>{d.clients?.client_name} — {formatCurrency(d.total_amount)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('invoiceDate')}</label>
              <input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('dueDate')}</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('invoiceTaxRate')}</label>
              <input type="number" min="0" max="100" step="0.5" value={form.tax_rate}
                onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-gray-700">{t('invoiceItems')}</label>
              <button onClick={addItem} className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <Plus size={12} /> {t('addItem')}
              </button>
            </div>
            <div className="space-y-2">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-gray-50 rounded-lg p-2">
                  <input value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)}
                    placeholder={t('description')}
                    className="col-span-5 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" />
                  <input type="number" min="0" value={it.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    placeholder={t('quantity')}
                    className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" />
                  <input type="number" min="0" value={it.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                    placeholder={t('unitPrice')}
                    className="col-span-2 border border-gray-200 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-400 bg-white" />
                  <div className="col-span-2 text-xs font-medium text-gray-700 text-end">{formatCurrency(it.total)}</div>
                  <button onClick={() => removeItem(idx)} className="col-span-1 flex justify-center text-gray-400 hover:text-red-500">
                    <XCircle size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>{t('subtotal')}</span><span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            {taxRate > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>{t('tax')} ({taxRate}%)</span><span className="font-medium">{formatCurrency(taxAmount)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-800 font-bold border-t border-gray-200 pt-1.5">
              <span>{t('total')}</span><span className="text-emerald-600">{formatCurrency(total)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('notes')}</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              placeholder={settings.invoice_notes || ''}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? t('saving') : t('save')}
          </button>
          <button onClick={() => setModal(false)}
            className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
            {t('cancel')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
