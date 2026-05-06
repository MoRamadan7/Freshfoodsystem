import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, Phone, MessageCircle, Eye, Facebook, Linkedin, Instagram, Printer } from 'lucide-react'
import { generateEmployeeListHTML } from '../lib/employeeTemplate'

const ROLES = ['Admin', 'Manager', 'Accountant', 'Sales', 'HR', 'Labor']
const empty = { 
  name: '', email: '', phone: '', role: 'Labor', 
  employee_type: 'monthly', basic_salary: '', 
  overtime_rate: '', hourly_rate: '', daily_rate: '',
  gender: 'male', hire_date: '', is_active: true,
  station_id: '', custom_fields: {} 
}

export default function Employees() {
  const { employee, isAdmin, normalizedRole } = useAuth()
  const { settings } = useSettings()
  const { t, isRTL } = useLang()
  const customFieldsSchema = settings?.custom_fields_schema?.employees || []
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewEmployee, setViewEmployee] = useState(null)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load(); loadLookups() }, [])

  async function loadLookups() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }

  async function load() {
    if (!employee) return
    setLoading(true)
    let query = supabase.from('employees').select('*').order('name')
    if (!isAdmin && normalizedRole !== 'manager' && normalizedRole !== 'hr') {
      query = query.eq('id', employee.id)
    }
    const { data } = await query
    setRows(data ?? [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r) { setForm({ ...r, custom_fields: r.custom_fields || {} }); setEditing(r.id); setModal(true) }
  function closeModal() { setModal(false); setEditing(null) }

  function openView(r) {
    setViewEmployee(r)
    setViewModal(true)
  }

  async function save() {
    if (!form.name) return toast.error(t('nameRequired') || 'اسم الموظف مطلوب')
    setSaving(true)
    const payload = { 
      ...form, 
      basic_salary: Number(form.basic_salary) || 0, 
      overtime_rate: Number(form.overtime_rate) || 0,
      hourly_rate: Number(form.hourly_rate) || 0,
      daily_rate: Number(form.daily_rate) || 0,
      hire_date: form.hire_date || null,
      station_id: form.station_id ? Number(form.station_id) : null
    }
    const { error } = editing
      ? await supabase.from('employees').update(payload).eq('id', editing)
      : await supabase.from('employees').insert(payload)
    if (error) toast.error(error.message)
    else { 
      toast.success(editing ? t('updateSuccess') : t('addSuccess'))
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'الموظفين', editing || 'جديد', `${t('employee')}: ${form.name}`)
      closeModal()
      load() 
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm(t('deleteConfirm'))) return
    const empName = rows.find(r => r.id === id)?.name
    const { error } = await supabase.from('employees').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { 
      toast.success(t('deleteSuccess'))
      logActivity(employee, 'حذف', 'الموظفين', id, `${t('employee')}: ${empName}`)
      load() 
    }
  }

  function handlePrint() {
    const enrichedData = filtered.map(r => ({
      ...r,
      stations: stations.find(s => s.id === r.station_id)
    }))
    const period = (fromDate || toDate) 
      ? (isRTL ? `تعيين من ${fromDate || '—'} إلى ${toDate || '—'}` : `Hired from ${fromDate || '—'} to ${toDate || '—'}`)
      : ''
    const html = generateEmployeeListHTML(enrichedData, settings, period)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    } else {
      toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups')
    }
  }

  const filtered = rows.filter(r => {
    const roleMatch = !roleFilter || 
      r.role?.toLowerCase() === roleFilter.toLowerCase() ||
      (roleFilter === 'admin' && (r.role === 'مدير' || r.role === 'مدير النظام')) ||
      (roleFilter === 'manager' && (r.role === 'مشرف' || r.role === 'مدير عام')) ||
      (roleFilter === 'hr' && r.role === 'موارد بشرية') ||
      (roleFilter === 'accountant' && r.role === 'محاسب') ||
      (roleFilter === 'sales' && r.role === 'مبيعات') ||
      (roleFilter === 'employee' && r.role === 'موظف')

    const stationMatch = !stationFilter || r.station_id === Number(stationFilter)
    const dateMatch = (!fromDate || r.hire_date >= fromDate) && (!toDate || r.hire_date <= toDate)
    const searchMatch = !search || 
      r.name?.toLowerCase().includes(search.toLowerCase()) || 
      r.email?.toLowerCase().includes(search.toLowerCase())

    return roleMatch && stationMatch && dateMatch && searchMatch
  })

  const roleColor = { Admin: 'bg-purple-100 text-purple-700', HR: 'bg-blue-100 text-blue-700', Sales: 'bg-emerald-100 text-emerald-700', Accountant: 'bg-amber-100 text-amber-700', Warehouse: 'bg-gray-100 text-gray-700' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{t('employees')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <Printer size={15} /> {isRTL ? 'طباعة القائمة' : 'Print List'}
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all hover:scale-[1.02]">
            <Plus size={18} /> {t('addEmployee')}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-lg shadow-sm">
          <span className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'تعيين من' : 'Hired From'}</span>
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
            className="text-sm bg-transparent border-none p-0 focus:ring-0 dark:text-gray-100 w-24" />
          <span className="text-[10px] font-bold text-gray-400 uppercase ms-2">{isRTL ? 'إلى' : 'To'}</span>
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
            className="text-sm bg-transparent border-none p-0 focus:ring-0 dark:text-gray-100 w-24" />
        </div>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('search') + '...'}
            className={`w-full border border-gray-200 rounded-lg ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:bg-gray-800 dark:border-white/10 dark:text-white`} />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">{t('allRoles')}</option>
          {ROLES.map(r => <option key={r} value={r}>{t(r.toLowerCase())}</option>)}
        </select>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)} className="border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-800 dark:text-white">
          <option value="">{t('allStations')}</option>
          {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
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
                  <th className="text-right px-4 py-3 font-medium">الاسم</th>
                  <th className="text-right px-4 py-3 font-medium">الإيميل</th>
                  <th className="text-right px-4 py-3 font-medium">الوظيفة</th>
                  <th className="text-right px-4 py-3 font-medium">المرتب</th>
                  <th className="text-right px-4 py-3 font-medium">الحالة</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center text-gray-400 py-10">لا يوجد موظفين</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.avatar_url ? (
                          <img src={r.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs flex-shrink-0">
                            {r.name?.[0]}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-gray-800 dark:text-gray-200 block">{r.name}</span>
                            {r.phone && (
                              <div className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                <a href={`https://wa.me/${r.phone.replace(/\s/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-500" title="WhatsApp">
                                  <MessageCircle size={14} />
                                </a>
                                <a href={`tel:${r.phone}`} className="text-blue-500" title="اتصال">
                                  <Phone size={14} />
                                </a>
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-gray-400">
                             {stations.find(s => s.id === r.station_id)?.name || 'بدون محطة'}
                           </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.email}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${roleColor[r.role] ?? 'bg-gray-100 text-gray-700'}`}>{r.role}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.employee_type === 'daily' ? (
                        <div className="text-xs">
                          <p>يومية: {Number(r.daily_rate).toLocaleString()} ج</p>
                          <p className="text-[10px]">ساعة: {Number(r.hourly_rate).toLocaleString()} ج</p>
                        </div>
                      ) : (
                        <p>{Number(r.basic_salary).toLocaleString()} ج</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_active
                        ? <span className="flex items-center gap-1 text-xs text-emerald-600"><UserCheck size={13} /> نشط</span>
                        : <span className="flex items-center gap-1 text-xs text-gray-400"><UserX size={13} /> غير نشط</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openView(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-emerald-600 transition-colors" title="عرض التفاصيل"><Eye size={14} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={14} /></button>
                        <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors" title="حذف"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={closeModal} title={editing ? 'تعديل موظف' : 'إضافة موظف جديد'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الاسم بالكامل *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">البريد الإلكتروني *</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">رقم الهاتف</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">اختار المحطة</option>
              {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع الموظف</label>
            <select value={form.employee_type} onChange={e => setForm(f => ({ ...f, employee_type: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="monthly">مرتب شهري</option>
              <option value="daily">عمالة يومية</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">النوع</label>
            <select value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="male">ذكر</option>
              <option value="female">أنثى</option>
            </select>
          </div>
          {form.employee_type === 'daily' ? (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">سعر اليومية</label>
                <input type="number" value={form.daily_rate} onChange={e => setForm(f => ({ ...f, daily_rate: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">سعر الساعة</label>
                <input type="number" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المرتب الأساسي</label>
                <input type="number" value={form.basic_salary} onChange={e => setForm(f => ({ ...f, basic_salary: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">سعر ساعة الإضافي</label>
                <input type="number" value={form.overtime_rate} onChange={e => setForm(f => ({ ...f, overtime_rate: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
              </div>
            </>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوظيفة</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:col-span-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600 rounded" />
            <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">موظف نشط</label>
          </div>
          {customFieldsSchema.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={form.custom_fields?.[f.name] || ''} onChange={e => setForm(prev => ({ ...prev, custom_fields: { ...prev.custom_fields, [f.name]: e.target.value } }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={closeModal} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">إلغاء</button>
        </div>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`تفاصيل الموظف: ${viewEmployee?.name}`}>
        {viewEmployee && (
          <div className="space-y-6">
            <div className="flex items-start gap-4 border-b border-gray-100 pb-4">
              <div className="w-24 h-24 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden flex-shrink-0">
                {viewEmployee.avatar_url ? (
                  <img src={viewEmployee.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <UserCheck size={30} className="text-gray-400" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm text-gray-500">الوظيفة: <span className="font-medium text-gray-800">{viewEmployee.role}</span></p>
                <p className="text-sm text-gray-500">الإيميل: <span className="font-medium text-gray-800">{viewEmployee.email || '—'}</span></p>
                <p className="text-sm text-gray-500">نوع الموظف: <span className="font-medium text-gray-800">{viewEmployee.employee_type === 'daily' ? 'يومية' : 'شهري'}</span></p>
                {viewEmployee.hire_date && <p className="text-sm text-gray-500">تاريخ التعيين: <span className="font-medium text-gray-800">{viewEmployee.hire_date}</span></p>}
                {customFieldsSchema.map(f => (
                  <p key={f.name} className="text-sm text-gray-500">{f.label}: <span className="font-medium text-gray-800">{viewEmployee.custom_fields?.[f.name] || '—'}</span></p>
                ))}
              </div>
            </div>

            <div>
              <h4 className="font-bold text-gray-800 mb-3">طرق التواصل</h4>
              <div className="flex flex-wrap gap-2">
                {viewEmployee.phone && (
                  <>
                    <a href={`tel:${viewEmployee.phone}`} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                      <Phone size={16} /> اتصال
                    </a>
                    <a href={`https://wa.me/${viewEmployee.phone.replace(/\s/g, '')}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors text-sm font-medium">
                      <MessageCircle size={16} /> واتساب
                    </a>
                  </>
                )}
                {viewEmployee.alt_phone && (
                  <a href={`tel:${viewEmployee.alt_phone}`} className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                    <Phone size={16} /> هاتف بديل
                  </a>
                )}
                {viewEmployee.facebook_url && (
                  <a href={viewEmployee.facebook_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                    <Facebook size={16} /> Facebook
                  </a>
                )}
                {viewEmployee.linkedin_url && (
                  <a href={viewEmployee.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium">
                    <Linkedin size={16} /> LinkedIn
                  </a>
                )}
                {viewEmployee.instagram_url && (
                  <a href={viewEmployee.instagram_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-3 py-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors text-sm font-medium">
                    <Instagram size={16} /> Instagram
                  </a>
                )}
                {!viewEmployee.phone && !viewEmployee.alt_phone && !viewEmployee.facebook_url && !viewEmployee.linkedin_url && !viewEmployee.instagram_url && (
                  <p className="text-sm text-gray-400">لا توجد طرق تواصل مسجلة.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
