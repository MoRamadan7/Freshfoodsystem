import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, UserCheck, UserX, Phone, MessageCircle, Eye, Facebook, Linkedin, Instagram, Printer, UserMinus, ShieldAlert, Download, Clock } from 'lucide-react'
import { generateEmployeeListHTML } from '../lib/employeeTemplate'
import { exportToExcel } from '../lib/exportHelpers'

const ROLES = ['Admin', 'Manager', 'Accountant', 'Sales', 'HR', 'Labor']
const empty = { 
  name: '', email: '', phone: '', role: 'Labor', 
  employee_type: 'monthly', basic_salary: '', 
  overtime_rate: '', hourly_rate: '', daily_rate: '',
  gender: 'male', hire_date: '', is_active: true,
  station_id: '', custom_data: {},
  employment_status: 'active'
}

const STATUS_CONFIG = {
  active:     { label: 'نشط',     color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: UserCheck },
  pending:    { label: 'طلب جديد', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',   icon: Clock },
  resigned:   { label: 'استقال', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',   icon: UserMinus },
  terminated: { label: 'فُصل',   color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',           icon: ShieldAlert },
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
  const [statusFilter, setStatusFilter] = useState('active')
  const [endServiceModal, setEndServiceModal] = useState(false)
  const [endServiceEmployee, setEndServiceEmployee] = useState(null)
  const [endServiceForm, setEndServiceForm] = useState({ type: 'resigned', date: '', reason: '' })

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
  function openEdit(r) { setForm({ ...r, custom_data: r.custom_data || {} }); setEditing(r.id); setModal(true) }
  function closeModal() { setModal(false); setEditing(null) }

  function openView(r) {
    setViewEmployee(r)
    setViewModal(true)
  }

  async function save() {
    if (!form.name) return toast.error(t('nameRequired') || 'اسم الموظف مطلوب')
    
    // Custom Fields Validation
    for (const f of customFieldsSchema) {
      if (f.required && !form.custom_data?.[f.id]) {
        return toast.error(`${isRTL ? 'حقل' : 'Field'} ${isRTL ? f.label_ar : f.label_en} ${isRTL ? 'مطلوب' : 'is required'}`)
      }
    }

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

  function openEndService(r) {
    setEndServiceEmployee(r)
    setEndServiceForm({ type: 'resigned', date: new Date().toISOString().split('T')[0], reason: '' })
    setEndServiceModal(true)
  }

  async function saveEndService() {
    if (!endServiceForm.date) return toast.error('حدد تاريخ إنهاء الخدمة')
    const payload = {
      employment_status: endServiceForm.type,
      is_active: false,
      end_of_service_reason: endServiceForm.reason || null,
      ...(endServiceForm.type === 'resigned'
        ? { resignation_date: endServiceForm.date }
        : { termination_date: endServiceForm.date })
    }
    const { error } = await supabase.from('employees').update(payload).eq('id', endServiceEmployee.id)
    if (error) return toast.error(error.message)
    toast.success('تم تسجيل إنهاء الخدمة')
    logActivity(employee, 'إنهاء خدمة', 'الموظفين', endServiceEmployee.id, `${endServiceEmployee.name} - ${endServiceForm.type === 'resigned' ? 'استقالة' : 'فصل'}`)
    setEndServiceModal(false)
    load()
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
    const empStatusMatch = !statusFilter || (r.employment_status || 'active') === statusFilter

    return roleMatch && stationMatch && dateMatch && searchMatch && empStatusMatch
  })

  const roleColor = { Admin: 'bg-purple-100 text-purple-700', HR: 'bg-blue-100 text-blue-700', Sales: 'bg-emerald-100 text-emerald-700', Accountant: 'bg-amber-100 text-amber-700', Warehouse: 'bg-gray-100 text-gray-700' }

  const handleExport = () => {
    const data = filtered.map(r => ({
      'الاسم': r.name,
      'الإيميل': r.email,
      'رقم الهاتف': r.phone,
      'الوظيفة': r.role,
      'المحطة': stations.find(s => s.id === r.station_id)?.name || 'بدون محطة',
      'الحالة': r.employment_status || (r.is_active ? 'active' : 'resigned')
    }))
    exportToExcel(data, `employees-${new Date().toLocaleDateString()}`, 'الموظفين')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{t('employees')}</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors">
            <Download size={15} /> إكسيل
          </button>
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
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 p-1 rounded-lg shadow-sm">
          {[['', 'الكل'], ['pending', 'طلبات جديدة'], ['active', 'نشط'], ['resigned', 'استقال'], ['terminated', 'فُصل']].map(([val, label]) => (
            <button key={val} onClick={() => setStatusFilter(val)}
              className={`px-3 py-1 rounded text-xs font-bold transition-colors ${
                statusFilter === val ? 'bg-emerald-600 text-white shadow' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}>{label}</button>
          ))}
        </div>
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
                      {(() => {
                        const st = r.employment_status || (r.is_active ? 'active' : 'resigned')
                        const cfg = STATUS_CONFIG[st] || STATUS_CONFIG.active
                        const Icon = cfg.icon
                        return (
                          <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold ${cfg.color}`}>
                            <Icon size={11} />{cfg.label}
                          </span>
                        )
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openView(r)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-emerald-600 transition-colors" title="عرض التفاصيل"><Eye size={14} /></button>
                        <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={14} /></button>
                        {(r.employment_status || 'active') === 'active' && (
                          <button onClick={() => openEndService(r)} className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg text-gray-500 hover:text-amber-600 transition-colors" title="إنهاء الخدمة"><UserMinus size={14} /></button>
                        )}
                        <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-red-500 transition-colors" title="حذف"><Trash2 size={14} /></button>
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
              {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">حالة العمل</label>
            <select 
              value={form.employment_status || 'active'} 
              onChange={e => {
                const status = e.target.value
                setForm(f => ({ 
                  ...f, 
                  employment_status: status,
                  is_active: status === 'active' // Auto-activate if status is active
                }))
              }}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="active">نشط</option>
              <option value="pending">قيد المراجعة</option>
              <option value="resigned">استقال</option>
              <option value="terminated">فُصل</option>
            </select>
          </div>
          <div className="flex items-center gap-2 mt-1 sm:col-span-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
              className="w-4 h-4 accent-emerald-600 rounded" />
            <label htmlFor="active" className="text-sm text-gray-700 dark:text-gray-300">الحساب مفعل (يستطيع دخول النظام)</label>
          </div>
          {customFieldsSchema.map(f => (
            <div key={f.id} className={f.type === 'checkbox' ? 'flex items-center gap-2 pt-6' : ''}>
              {f.type !== 'checkbox' && (
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {isRTL ? f.label_ar : f.label_en} {f.required && <span className="text-red-500">*</span>}
                </label>
              )}
              
              {f.type === 'select' ? (
                <select 
                  value={form.custom_data?.[f.id] || ''} 
                  onChange={e => setForm(prev => ({ ...prev, custom_data: { ...prev.custom_data, [f.id]: e.target.value } }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="">{isRTL ? 'اختار...' : 'Select...'}</option>
                  {f.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : f.type === 'checkbox' ? (
                <>
                  <input 
                    type="checkbox" 
                    id={`field_${f.id}`}
                    checked={!!form.custom_data?.[f.id]} 
                    onChange={e => setForm(prev => ({ ...prev, custom_data: { ...prev.custom_data, [f.id]: e.target.checked } }))}
                    className="w-4 h-4 accent-emerald-600 rounded" 
                  />
                  <label htmlFor={`field_${f.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                    {isRTL ? f.label_ar : f.label_en}
                  </label>
                </>
              ) : (
                <input 
                  type={f.type || 'text'} 
                  value={form.custom_data?.[f.id] || ''} 
                  onChange={e => setForm(prev => ({ ...prev, custom_data: { ...prev.custom_data, [f.id]: e.target.value } }))}
                  placeholder={isRTL ? f.label_ar : f.label_en}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" 
                />
              )}
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
                  <p key={f.name} className="text-sm text-gray-500">{f.label}: <span className="font-medium text-gray-800">{viewEmployee.custom_data?.[f.name] || '—'}</span></p>
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

      {/* End of Service Modal */}
      <Modal open={endServiceModal} onClose={() => setEndServiceModal(false)} title={`إنهاء خدمة: ${endServiceEmployee?.name}`}>
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">⚠️ سيتم تغيير حالة الموظف ولن يتمكن من الوصول للنظام. يمكنك إعادة تفعيله لاحقاً من التعديل.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">نوع إنهاء الخدمة</label>
            <div className="grid grid-cols-2 gap-2">
              {[['resigned', 'استقالة طوعية', 'text-amber-600'], ['terminated', 'فصل من العمل', 'text-red-600']].map(([val, label, color]) => (
                <button key={val} onClick={() => setEndServiceForm(f => ({ ...f, type: val }))}
                  className={`p-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    endServiceForm.type === val
                      ? `border-current ${color} bg-gray-50 dark:bg-gray-800`
                      : 'border-gray-200 dark:border-gray-700 text-gray-500'
                  }`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">تاريخ إنهاء الخدمة *</label>
            <input type="date" value={endServiceForm.date} onChange={e => setEndServiceForm(f => ({ ...f, date: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">سبب إنهاء الخدمة</label>
            <textarea value={endServiceForm.reason} onChange={e => setEndServiceForm(f => ({ ...f, reason: e.target.value }))} rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              placeholder="اذكر سبب إنهاء الخدمة..." />
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={saveEndService}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded-lg text-sm font-bold transition-colors">تأكيد إنهاء الخدمة</button>
            <button onClick={() => setEndServiceModal(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">إلغاء</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
