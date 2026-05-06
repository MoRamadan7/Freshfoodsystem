import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Clock, CheckCircle, XCircle, Calendar, Printer } from 'lucide-react'
import { generateAttendanceHTML } from '../lib/attendanceTemplate'
import { useSettings } from '../contexts/SettingsContext'

const STATUSES = ['present', 'absent', 'leave', 'holiday']
const statusColor = { present: 'bg-emerald-100 text-emerald-700', absent: 'bg-red-100 text-red-700', leave: 'bg-blue-100 text-blue-700', holiday: 'bg-gray-100 text-gray-600' }
const empty = { employee_id: '', date: new Date().toISOString().split('T')[0], check_in: '', check_out: '', status: 'present', daily_overtime: '', notes: '' }

export default function Attendance() {
  const { employee, isAdmin, normalizedRole } = useAuth()
  const { t, lang, isRTL } = useLang()
  const { settings } = useSettings()
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [employees, setEmployees] = useState([])
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [stationFilter, setStationFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadEmployees(); loadStations() }, [])

  async function loadStations() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }
  useEffect(() => { load() }, [fromDate, toDate])

  async function loadEmployees() {
    if (!employee) return
    let query = supabase.from('employees').select('id,name').eq('is_active', true).order('name')
    if (!isAdmin && normalizedRole !== 'manager' && normalizedRole !== 'hr') {
      query = query.eq('id', employee.id)
    }
    const { data } = await query
    setEmployees(data ?? [])
  }

  async function load() {
    if (!employee) return
    setLoading(true)
    let query = supabase.from('attendance')
      .select('*, employees(name, station_id)')
      .gte('date', fromDate)
      .lte('date', toDate)
      .order('date', { ascending: false })
      
    if (!isAdmin && normalizedRole !== 'manager' && normalizedRole !== 'hr') {
      query = query.eq('employee_id', employee.id)
    }
    const { data } = await query
    setRows(data ?? [])
    setLoading(false)
  }

  function openNew() {
    setForm({ ...empty, date: toDate })
    setEditing(null)
    setModal(true)
  }

  function openEdit(r) {
    setForm({ employee_id: r.employee_id, date: r.date, check_in: r.check_in ?? '', check_out: r.check_out ?? '', status: r.status, daily_overtime: r.daily_overtime ?? '', notes: r.notes ?? '' })
    setEditing(r.id)
    setModal(true)
  }

  async function save() {
    if (!form.employee_id || !form.date) return toast.error('اختار الموظف والتاريخ')
    setSaving(true)
    const payload = { ...form, employee_id: Number(form.employee_id), daily_overtime: Number(form.daily_overtime) || 0 }
    const { error } = editing
      ? await supabase.from('attendance').update(payload).eq('id', editing)
      : await supabase.from('attendance').insert(payload)
    if (error) toast.error(error.message)
    else { 
      toast.success('تم الحفظ')
      const empName = employees.find(e => e.id === Number(form.employee_id))?.name
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'الحضور', editing || 'جديد', `حضور للموظف: ${empName} بتاريخ ${form.date}`)
      setModal(false); 
      load() 
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('تأكيد الحذف؟')) return
    const row = rows.find(r => r.id === id)
    await supabase.from('attendance').delete().eq('id', id)
    toast.success('تم الحذف')
    logActivity(employee, 'حذف', 'الحضور', id, `حضور للموظف: ${row?.employees?.name} بتاريخ ${row?.date}`)
    load()
  }

  function handlePrint() {
    const period = isRTL 
      ? `من ${fromDate} إلى ${toDate}` 
      : `From ${fromDate} To ${toDate}`
    const html = generateAttendanceHTML(filtered, settings, period)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    } else {
      toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups')
    }
  }

  const filtered = rows.filter(r =>
    (!statusFilter || r.status === statusFilter) &&
    (!stationFilter || r.employees?.station_id === Number(stationFilter)) &&
    (r.employees?.name?.includes(search))
  )

  const summary = { present: 0, absent: 0, leave: 0, holiday: 0 }
  rows.forEach(r => { if (summary[r.status] !== undefined) summary[r.status]++ })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">الحضور والانصراف</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Printer size={15} /> {isRTL ? 'طباعة الكشف' : 'Print Report'}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> {t('addAttendance')}
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2">
        {Object.entries(summary).map(([s, c]) => (
          <div key={s} className={`rounded-xl p-3 text-center ${statusColor[s]}`}>
            <p className="text-2xl font-bold">{c}</p>
            <p className="text-xs mt-0.5">{t(s)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap items-center">
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

        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم الموظف..."
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">{t('allStations')}</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">{t('all') || 'كل الحالات'}</option>
          {STATUSES.map(s => <option key={s} value={s}>{t(s)}</option>)}
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
                  <th className="text-right px-4 py-3 font-medium">{t('employee')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('status')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('attendance')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('signOut')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('overtimeHours')}</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-10">لا توجد سجلات</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{r.employees?.name}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusColor[r.status]}`}>{t(r.status)}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.check_in ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.check_out ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.daily_overtime ?? 0} ساعة</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-blue-600 transition-colors text-xs">تعديل</button>
                        <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg text-gray-500 hover:text-red-500 transition-colors text-xs">حذف</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? t('edit') : t('add')}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('employee')} *</label>
            <select value={form.employee_id} onChange={e => setForm(f => ({ ...f, employee_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- {t('selectStation')} --</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('date')} *</label>
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{t('status')}</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {STATUSES.map(s => <option key={s} value={s}>{t(s)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">وقت الحضور</label>
            <input type="time" value={form.check_in} onChange={e => setForm(f => ({ ...f, check_in: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">وقت الانصراف</label>
            <input type="time" value={form.check_out} onChange={e => setForm(f => ({ ...f, check_out: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ساعات الإضافي</label>
            <input type="number" min="0" step="0.5" value={form.daily_overtime} onChange={e => setForm(f => ({ ...f, daily_overtime: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? t('saving') : t('save')}
          </button>
          <button onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">{t('cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
