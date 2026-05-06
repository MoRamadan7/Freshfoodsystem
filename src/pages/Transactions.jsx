import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, TrendingUp, TrendingDown, Wallet } from 'lucide-react'

const TYPES = [
  { v: 'revenue', l: 'إيراد', color: 'bg-emerald-100 text-emerald-700' },
  { v: 'expense', l: 'مصروف', color: 'bg-red-100 text-red-700' },
  { v: 'salary', l: 'راتب', color: 'bg-blue-100 text-blue-700' },
  { v: 'advance', l: 'سلفة', color: 'bg-amber-100 text-amber-700' },
  { v: 'deduction', l: 'خصم', color: 'bg-orange-100 text-orange-700' },
  { v: 'commission', l: 'عمولة', color: 'bg-purple-100 text-purple-700' },
  { v: 'waste', l: 'هالك', color: 'bg-gray-100 text-gray-600' },
  { v: 'purchase_payment', l: 'دفعة شراء', color: 'bg-indigo-100 text-indigo-700' },
]
const METHODS = [{ v: 'cash', l: 'cash' }, { v: 'transfer', l: 'transfer' }, { v: 'check', l: 'check' }]
const empty = { 
  date: new Date().toISOString().split('T')[0], 
  type: 'revenue', amount: '', payment_method: 'cash', 
  client_id: '', supplier_id: '', employee_id: '', 
  station_id: '', notes: '' 
}

export default function Transactions() {
  const { employee, isAdmin, normalizedRole } = useAuth()
  const { t, isRTL } = useLang()
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [clients, setClients] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load(); loadLookups() }, [fromDate, toDate])

  async function load() {
    if (!employee) return
    setLoading(true)
    let query = supabase.from('transactions')
      .select('*, stations(name), clients(client_name), suppliers(supplier_name), employees!transactions_employee_id_fkey(name)')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })

    if (!isAdmin && normalizedRole !== 'manager' && normalizedRole !== 'hr') {
      query = query.eq('employee_id', employee.id)
    }
    const { data } = await query
    setRows(data ?? [])
    setLoading(false)
  }

  async function loadLookups() {
    const [c, s, e, st] = await Promise.all([
      supabase.from('clients').select('id,client_name').order('client_name'),
      supabase.from('suppliers').select('id,supplier_name').order('supplier_name'),
      supabase.from('employees').select('id,name').eq('is_active', true).order('name'),
      supabase.from('stations').select('id,name').order('name'),
    ])
    setClients(c.data ?? []); setSuppliers(s.data ?? []); setEmployees(e.data ?? []); setStations(st.data ?? [])
  }

  async function save() {
    if (!form.amount || Number(form.amount) <= 0) return toast.error(t('invalidAmount') || 'أدخل مبلغ صحيح')
    setSaving(true)
    const payload = {
      ...form,
      amount: Number(form.amount),
      client_id: form.client_id ? Number(form.client_id) : null,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      employee_id: form.employee_id ? Number(form.employee_id) : null,
      station_id: form.station_id ? Number(form.station_id) : null,
    }
    const { error } = await supabase.from('transactions').insert(payload)
    if (error) toast.error(error.message)
    else { 
      toast.success(t('addSuccess'))
      const typeLabel = t(payload.type)
      logActivity(employee, 'إضافة', 'الخزنة', null, `${t('transaction')}: ${typeLabel} (${payload.amount})`)
      setModal(false)
      setForm(empty)
      load() 
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm(t('deleteConfirm'))) return
    const transaction = rows.find(r => r.id === id)
    await supabase.from('transactions').delete().eq('id', id)
    toast.success(t('deleteSuccess'))
    const tLabel = t(transaction?.type)
    logActivity(employee, 'حذف', 'الخزنة', id, `${t('transaction')}: ${tLabel} (${transaction?.amount})`)
    load()
  }

  const typeMap = Object.fromEntries(TYPES.map(t => [t.v, t]))
  const methodMap = Object.fromEntries(METHODS.map(m => [m.v, m.l]))

  const incomeTypes = ['revenue']
  const totalIn = rows.filter(r => incomeTypes.includes(r.type)).reduce((s, r) => s + Number(r.amount), 0)
  const totalOut = rows.filter(r => !incomeTypes.includes(r.type)).reduce((s, r) => s + Number(r.amount), 0)
  const balance = totalIn - totalOut

  const filtered = rows.filter(r =>
    (!typeFilter || r.type === typeFilter) &&
    (!stationFilter || r.station_id === Number(stationFilter)) &&
    (r.notes?.includes(search) || r.clients?.client_name?.includes(search) || r.suppliers?.supplier_name?.includes(search) || r.employees?.name?.includes(search))
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">الخزنة</h1>
        <button onClick={() => { setForm(empty); setModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> تسجيل معاملة
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-emerald-100 text-emerald-700 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"><TrendingUp size={18} /></div>
          <div><p className="text-xs text-gray-500">إجمالي الإيرادات</p><p className="font-bold text-emerald-700">{totalIn.toLocaleString()} ج</p></div>
        </div>
        <div className="bg-red-50 rounded-xl p-4 flex items-center gap-3">
          <div className="bg-red-100 text-red-700 w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"><TrendingDown size={18} /></div>
          <div><p className="text-xs text-gray-500">إجمالي المصروفات</p><p className="font-bold text-red-700">{totalOut.toLocaleString()} ج</p></div>
        </div>
        <div className={`rounded-xl p-4 flex items-center gap-3 ${balance >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${balance >= 0 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}><Wallet size={18} /></div>
          <div><p className="text-xs text-gray-500">الرصيد</p><p className={`font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{balance.toLocaleString()} ج</p></div>
        </div>
      </div>

      {/* Type filters */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setTypeFilter('')}
          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${!typeFilter ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
          الكل
        </button>
        {TYPES.map(t => (
          <button key={t.v} onClick={() => setTypeFilter(typeFilter === t.v ? '' : t.v)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${typeFilter === t.v ? t.color + ' border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {t.l}
          </button>
        ))}
      </div>

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
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث في الملاحظات..."
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
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">التاريخ</th>
                  <th className="text-right px-4 py-3 font-medium">النوع</th>
                  <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                  <th className="text-right px-4 py-3 font-medium">طريقة الدفع</th>
                  <th className="text-right px-4 py-3 font-medium">مرتبط بـ</th>
                  <th className="text-right px-4 py-3 font-medium">ملاحظات</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-10">لا توجد معاملات</td></tr>
                ) : filtered.map(r => {
                  const t = typeMap[r.type]
                  const related = r.clients?.client_name || r.suppliers?.supplier_name || r.employees?.name
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-gray-500 dark:text-gray-400 text-xs block">{r.date}</span>
                      <span className="text-[10px] text-emerald-600 font-medium">{r.stations?.name}</span>
                    </td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-1 rounded-full font-medium ${t?.color}`}>{t?.l}</span></td>
                      <td className="px-4 py-3 font-medium text-gray-800">{Number(r.amount).toLocaleString()} ج</td>
                       <td className="px-4 py-3 text-gray-500">{methodMap[r.payment_method] ?? r.payment_method}</td>
                      <td className="px-4 py-3 text-gray-500">{related ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs max-w-xs truncate">{r.notes ?? '—'}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-red-500 transition-colors text-xs">حذف</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="تسجيل معاملة جديدة">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة *</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المحطة --</option>
              {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">النوع *</label>
            <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">المبلغ (ج) *</label>
            <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">التاريخ</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">طريقة الدفع</label>
            <select value={form.payment_method} onChange={e => setForm(f => ({ ...f, payment_method: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {METHODS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">عميل (اختياري)</label>
            <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.client_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مورد (اختياري)</label>
            <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">موظف (اختياري)</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
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
