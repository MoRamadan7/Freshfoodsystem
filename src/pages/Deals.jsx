import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react'
import { askAI } from '../lib/ai'

const STATUSES = [
  { v: 'contact', l: 'contact', color: 'bg-blue-100 text-blue-700' },
  { v: 'negotiation', l: 'negotiation', color: 'bg-amber-100 text-amber-700' },
  { v: 'contracted', l: 'contracted', color: 'bg-emerald-100 text-emerald-700' },
  { v: 'cancelled', l: 'cancelled', color: 'bg-red-100 text-red-700' },
]
const empty = { 
  client_id: '', employee_id: '', product_id: '', quantity: '', unit: 'kg',
  created_date: new Date().toISOString().split('T')[0], 
  expected_close_date: '', status: 'contact', 
  total_amount: '', commission_rate: '', 
  station_id: '', notes: '' 
}

export default function Deals() {
  const { employee, isAdmin, normalizedRole } = useAuth()
  const { t } = useLang()
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [clients, setClients] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const [products, setProducts] = useState([])
  
  useEffect(() => { load(); loadLookups() }, [])

  async function load() {
    if (!employee) return
    setLoading(true)
    let query = supabase.from('deals')
      .select('*, clients(client_name), employees(name), products(product_name)')
      .order('created_at', { ascending: false })
      
    if (!isAdmin && normalizedRole !== 'manager') {
      query = query.eq('employee_id', employee.id)
    }
    
    const { data } = await query
    setRows(data ?? [])
    setLoading(false)
  }

  async function loadLookups() {
    const [c, e, st, p] = await Promise.all([
      supabase.from('clients').select('id,client_name').order('client_name'),
      supabase.from('employees').select('id,name').eq('is_active', true).order('name'),
      supabase.from('stations').select('id,name').order('name'),
      supabase.from('products').select('id,product_name').order('product_name'),
    ])
    setClients(c.data ?? []); setEmployees(e.data ?? []); setStations(st.data ?? []); setProducts(p.data ?? [])
  }

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r) {
    setForm({
      client_id: r.client_id,
      employee_id: r.employee_id ?? '',
      product_id: r.product_id ?? '',
      quantity: r.quantity ?? '',
      unit: r.unit ?? 'kg',
      created_date: r.created_date,
      expected_close_date: r.expected_close_date ?? '',
      status: r.status,
      total_amount: r.total_amount,
      commission_rate: r.commission_rate,
      station_id: r.station_id ?? '',
      notes: r.notes ?? ''
    })
    setEditing(r.id); setModal(true)
  }

  // ─── مساعد: تشغيل الأتمتة عند إتمام الصفقة ─────────────────────────────
  async function runDealAutomation(dealId, payload, oldStatus) {
    const isNowContracted = payload.status === 'contracted'
    const wasAlreadyContracted = oldStatus === 'contracted'

    // نشغل الأتمتة فقط لما الصفقة بتتحول لـ contracted لأول مرة
    if (!isNowContracted || wasAlreadyContracted) return

    const productId = payload.product_id
    const qty = Number(payload.quantity) || 0
    const amount = Number(payload.total_amount) || 0
    const clientId = payload.client_id
    const employeeId = payload.employee_id
    const stationId = payload.station_id
    const commRate = Number(payload.commission_rate) || 0

    // أ. خصم الكمية من المخزون
    if (productId && qty > 0) {
      const { data: prod } = await supabase
        .from('products')
        .select('stock_quantity, product_name')
        .eq('id', productId)
        .single()

      if (prod) {
        const newStock = Math.max(0, Number(prod.stock_quantity || 0) - qty)
        await supabase
          .from('products')
          .update({ stock_quantity: newStock })
          .eq('id', productId)
      }
    }

    // ب. تسجيل المعاملة المالية في الخزنة
    await supabase.from('transactions').insert({
      date: payload.created_date || new Date().toISOString().split('T')[0],
      type: 'revenue',
      amount: amount,
      client_id: clientId,
      employee_id: employeeId,
      station_id: stationId,
      notes: `ناتج عن إتمام صفقة رقم: ${dealId}`
    })

    // ج. تسجيل عمولة موظف السيلز إن وجدت
    if (commRate > 0 && amount > 0 && employeeId) {
      const commAmount = (amount * commRate) / 100
      await supabase.from('transactions').insert({
        date: payload.created_date || new Date().toISOString().split('T')[0],
        type: 'commission',
        amount: commAmount,
        employee_id: employeeId,
        station_id: stationId,
        notes: `عمولة ${commRate}% على صفقة رقم: ${dealId}`
      })
    }

    // د. إنشاء فاتورة تلقائية
    // التحقق أولاً إن فاتورة لهذه الصفقة مش موجودة
    const { data: existingInv } = await supabase
      .from('invoices')
      .select('id')
      .eq('deal_id', dealId)
      .maybeSingle()

    if (!existingInv) {
      const { data: settings } = await supabase
        .from('company_settings')
        .select('invoice_prefix')
        .limit(1)
        .single()

      const prefix = settings?.invoice_prefix || 'INV-'
      const today = new Date()
      const dateStr = today.getFullYear().toString() +
        String(today.getMonth() + 1).padStart(2, '0') +
        String(today.getDate()).padStart(2, '0')
      const invoiceNum = `${prefix}${dateStr}-${dealId}`

      const { data: newInvoice, error: invErr } = await supabase
        .from('invoices')
        .insert({
          invoice_number: invoiceNum,
          client_id: clientId,
          deal_id: dealId,
          issue_date: payload.created_date || new Date().toISOString().split('T')[0],
          status: 'paid',
          subtotal: amount,
          total: amount,
          tax_rate: 0,
          tax_amount: 0,
          created_by: employeeId,
          station_id: stationId,
          notes: `فاتورة آلية ناتجة عن صفقة رقم: ${dealId}`
        })
        .select('id')
        .single()

      if (!invErr && newInvoice?.id) {
        // إضافة بند الفاتورة
        const { data: prod } = await supabase
          .from('products')
          .select('product_name')
          .eq('id', productId)
          .maybeSingle()

        const description = prod?.product_name
          ? `${prod.product_name}${payload.unit ? ' (' + payload.unit + ')' : ''}`
          : 'منتج'

        await supabase.from('invoice_items').insert({
          invoice_id: newInvoice.id,
          description,
          quantity: qty || 1,
          unit_price: qty > 0 ? amount / qty : amount,
          total: amount
        })
      }
    }
  }

  async function save() {
    if (!form.client_id) return toast.error('اختار العميل')
    
    if (form.status === 'contracted' && (!form.product_id || !form.quantity || Number(form.quantity) <= 0)) {
      return toast.error('يجب تحديد المنتج المباع والكمية لإتمام التعاقد ولخصم المخزون بشكل سليم')
    }

    setSaving(true)

    const payload = {
      ...form,
      client_id: Number(form.client_id),
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      product_id: form.product_id ? Number(form.product_id) : null,
      quantity: Number(form.quantity) || 0,
      total_amount: Number(form.total_amount) || 0,
      commission_rate: Number(form.commission_rate) || 0,
      station_id: form.station_id ? Number(form.station_id) : null,
      expected_close_date: form.expected_close_date || null,
    }

    // حفظ الحالة القديمة قبل التعديل
    const oldDeal = editing ? rows.find(r => r.id === editing) : null
    const oldStatus = oldDeal?.status || null

    let savedId = editing
    let saveError = null

    if (editing) {
      const { error } = await supabase.from('deals').update(payload).eq('id', editing)
      saveError = error
    } else {
      const { data, error } = await supabase.from('deals').insert(payload).select('id').single()
      saveError = error
      if (data) savedId = data.id
    }

    if (saveError) {
      toast.error(saveError.message)
    } else {
      // تشغيل الأتمتة عند إتمام الصفقة
      if (savedId) {
        await runDealAutomation(savedId, payload, oldStatus)
      }

      toast.success('تم الحفظ')
      const clientName = clients.find(c => c.id === payload.client_id)?.client_name || 'عميل'
      logActivity(
        employee,
        editing ? 'تعديل' : 'إضافة',
        'الصفقات',
        savedId || 'جديد',
        `صفقة للعميل: ${clientName} بمبلغ ${payload.total_amount} - الحالة: ${payload.status}`
      )
      setModal(false)
      load()
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('تأكيد الحذف؟')) return
    const deal = rows.find(r => r.id === id)
    await supabase.from('deals').delete().eq('id', id)
    toast.success('تم الحذف')
    logActivity(employee, 'حذف', 'الصفقات', id, `صفقة للعميل: ${deal?.clients?.client_name}`)
    load()
  }

  const handleAIAnalysis = async () => {
    if (!editing) return
    setAnalyzing(true)
    try {
      const deal = rows.find(r => r.id === editing)
      const prompt = `
        Analyze this deal:
        Client: ${deal.clients?.client_name}
        Amount: ${deal.total_amount}
        Status: ${deal.status}
        Notes: ${deal.notes}
        
        Task:
        1. Suggest a professional follow-up message in Arabic to send to this client.
        2. Give a brief advice on how to close this deal successfully.
      `
      const response = await askAI(prompt)
      setForm(f => ({ ...f, notes: (f.notes ? f.notes + '\n\n' : '') + '--- اقتراح الذكاء الاصطناعي ---\n' + response }))
      toast.success('تم إنشاء الاقتراح وإضافته للملاحظات!')
    } catch (error) {
      toast.error('فشل في تحليل الصفقة.')
    } finally {
      setAnalyzing(false)
    }
  }

  const statusMap = Object.fromEntries(STATUSES.map(s => [s.v, s]))

  const filtered = rows.filter(r => {
    const statusMatch = !statusFilter || 
      r.status?.toLowerCase() === statusFilter.toLowerCase() ||
      (statusFilter === 'contact' && r.status === 'تواصل') ||
      (statusFilter === 'negotiation' && r.status === 'تفاوض') ||
      (statusFilter === 'contracted' && r.status === 'تم التعاقد') ||
      (statusFilter === 'won' && r.status === 'مكتملة') ||
      (statusFilter === 'cancelled' && r.status === 'ملغاة')

    const stationMatch = !stationFilter || r.station_id === Number(stationFilter)
    const searchMatch = !search || 
      r.clients?.client_name?.toLowerCase().includes(search.toLowerCase()) || 
      r.employees?.name?.toLowerCase().includes(search.toLowerCase())

    return statusMatch && stationMatch && searchMatch
  })

  const totalActive = rows.filter(r => ['contact', 'negotiation'].includes(r.status))
    .reduce((s, r) => s + Number(r.total_amount), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">الصفقات</h1>
          <p className="text-xs text-gray-400 mt-0.5">إجمالي الصفقات النشطة: <span className="text-emerald-600 font-medium">{totalActive.toLocaleString()} ج</span></p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> صفقة جديدة
        </button>
      </div>

      {/* Pipeline Status Bar */}
      <div className="grid grid-cols-4 gap-2">
        {STATUSES.map(s => {
          const count = rows.filter(r => r.status === s.v).length
          return (
            <button key={s.v} onClick={() => setStatusFilter(statusFilter === s.v ? '' : s.v)}
              className={`rounded-xl p-3 text-center transition-all border-2 ${statusFilter === s.v ? 'border-gray-400 dark:border-gray-500' : 'border-transparent'} ${s.color.replace('text-', 'bg-').split(' ')[0]} dark:bg-white/5`}>
              <p className="text-xl font-bold dark:text-white">{count}</p>
              <p className="text-xs mt-0.5 dark:text-gray-400">{s.l}</p>
            </button>
          )
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالعميل أو الموظف..."
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل المحطات</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">العميل</th>
                  <th className="text-right px-4 py-3 font-medium">موظف السيلز</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                  <th className="text-right px-4 py-3 font-medium">القيمة</th>
                  <th className="text-right px-4 py-3 font-medium">العمولة</th>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-10">لا توجد صفقات</td></tr>
                ) : filtered.map(r => {
                  const s = statusMap[r.status]
                  return (
                   <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-800 dark:text-gray-200 block">{r.clients?.client_name ?? '—'}</span>
                      <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                        {stations.find(s => s.id === r.station_id)?.name || '—'}
                      </span>
                    </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.employees?.name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${s?.color}`}>{s?.l}</span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{Number(r.total_amount).toLocaleString()} ج</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{Number(r.commission_value).toLocaleString()} ج</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{r.created_date}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل صفقة' : 'صفقة جديدة'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة *</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المحطة --</option>
              {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">العميل *</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">موظف السيلز</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الحالة</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {STATUSES.map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">إجمالي القيمة (ج)</label>
            <input type="number" min="0" value={form.total_amount} onChange={e => setForm(f => ({ ...f, total_amount: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نسبة العمولة %</label>
            <input type="number" min="0" max="100" step="0.5" value={form.commission_rate} onChange={e => setForm(f => ({ ...f, commission_rate: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">تاريخ الإغلاق المتوقع</label>
            <input type="date" value={form.expected_close_date} onChange={e => setForm(f => ({ ...f, expected_close_date: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المنتج المباع</label>
            <select value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المنتج --</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.product_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الكمية</label>
              <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوحدة</label>
              <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                <option value="kg">كيلو</option>
                <option value="ton">طن</option>
                <option value="carton">كرتونة</option>
                <option value="bin">بنز</option>
                <option value="container">حاوية</option>
              </select>
            </div>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          {editing && (
            <button onClick={handleAIAnalysis} disabled={analyzing}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-purple-200 text-purple-700 bg-purple-50 rounded-lg text-sm font-medium hover:bg-purple-100 transition-colors disabled:opacity-50">
              {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              تحليل بالذكاء الاصطناعي
            </button>
          )}
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">إلغاء</button>
        </div>
      </Modal>
    </div>
  )
}
