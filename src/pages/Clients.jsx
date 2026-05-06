import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useSearchParams } from 'react-router-dom'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, Phone, MessageCircle, Eye, Upload, Image as ImageIcon } from 'lucide-react'

const SOURCES = ['facebook', 'referral', 'instagram', 'google', 'direct', 'other']
const TYPES = [{ v: 'retail', l: 'تجزئة' }, { v: 'wholesale', l: 'جملة' }, { v: 'other', l: 'أخرى' }]
const empty = { 
  client_name: '', phone: '', country_city: '', 
  client_source: '', client_type: 'retail', 
  credit_limit: '', station_id: '', assigned_sales_id: '', notes: '',
  logo_url: '', custom_data: {}
}

export default function Clients() {
  const [searchParams] = useSearchParams()
  const { employee } = useAuth()
  const { settings } = useSettings()
  const { t } = useLang()
  const customFieldsSchema = settings?.custom_fields_schema?.clients || []
  
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [salesEmployees, setSalesEmployees] = useState([])
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const [typeFilter, setTypeFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewClient, setViewClient] = useState(null)
  const [clientDeals, setClientDeals] = useState([])
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load(); loadStations() }, [])

  async function loadStations() {
    const [st, em] = await Promise.all([
      supabase.from('stations').select('*').order('name'),
      supabase.from('employees').select('id, name, role').eq('is_active', true).order('name')
    ])
    setStations(st.data ?? [])
    // Filter only sales employees for the assignment field
    setSalesEmployees(em.data?.filter(e => {
      const role = e.role?.toLowerCase() || ''
      return role.includes('sales') || role.includes('مبيعات')
    }) ?? [])
  }

  async function load() {
    setLoading(true)
    // Load all employees (not just sales) to resolve names for existing assignments
    const [{ data: clientData }, { data: empData }] = await Promise.all([
      supabase.from('clients').select('*').order('client_name'),
      supabase.from('employees').select('id, name, role').order('name')
    ])
    // Build employee lookup map
    const empMap = {}
    ;(empData || []).forEach(e => { empMap[e.id] = e })
    // Attach assigned_sales name to each client row
    const enriched = (clientData || []).map(c => ({
      ...c,
      assigned_sales: c.assigned_sales_id ? { name: empMap[c.assigned_sales_id]?.name || null } : null
    }))
    setRows(enriched)
    setLoading(false)
  }

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r) {
    // Strip virtual computed field before populating form
    const { assigned_sales, ...editData } = r
    setForm({ ...editData, custom_data: editData.custom_data || {} })
    setEditing(r.id)
    setModal(true)
  }

  async function openView(client) {
    setViewClient(client)
    setViewModal(true)
    const { data } = await supabase.from('deals')
      .select('*, employees(name)')
      .eq('client_id', client.id)
      .order('created_at', { ascending: false })
    setClientDeals(data ?? [])
  }

  async function save() {
    if (!form.client_name) return toast.error('اسم العميل مطلوب')
    setSaving(true)
    // Strip virtual fields before saving (assigned_sales is computed, not a real column)
    const { assigned_sales, ...formData } = form
    const payload = { 
      ...formData, 
      credit_limit: Number(formData.credit_limit) || 0,
      station_id: formData.station_id ? Number(formData.station_id) : null,
      assigned_sales_id: formData.assigned_sales_id ? Number(formData.assigned_sales_id) : null
    }
    const { error } = editing
      ? await supabase.from('clients').update(payload).eq('id', editing)
      : await supabase.from('clients').insert(payload)
    if (error) toast.error(error.message)
    else { 
      toast.success(editing ? 'تم التعديل' : 'تمت الإضافة')
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'العملاء', editing || 'جديد', `العميل: ${formData.client_name}`)
      setModal(false)
      load() 
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('تأكيد الحذف؟')) return
    const clientName = rows.find(r => r.id === id)?.client_name
    const { error } = await supabase.from('clients').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { 
      toast.success('تم الحذف')
      logActivity(employee, 'حذف', 'العملاء', id, `العميل: ${clientName}`)
      load() 
    }
  }

  const { isAdmin, normalizedRole } = useAuth()
  const isManagerOrAdmin = isAdmin || normalizedRole === 'manager'
  const isSales = normalizedRole === 'sales'

  const filtered = rows.filter(r => {
    // Role-based filtering: Sales see only their assigned clients
    if (isSales && r.assigned_sales_id !== employee?.id) return false
    
    return (!typeFilter || r.client_type === typeFilter) &&
           (!stationFilter || r.station_id === Number(stationFilter)) &&
           (r.client_name?.includes(search) || r.phone?.includes(search) || r.country_city?.includes(search))
  })

  const typeColor = { retail: 'bg-blue-100 text-blue-700', wholesale: 'bg-purple-100 text-purple-700', other: 'bg-gray-100 text-gray-600' }
  const typeLabel = { retail: 'تجزئة', wholesale: 'جملة', other: 'أخرى' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800">العملاء</h1>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> إضافة عميل
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الهاتف..."
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل المحطات</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل الأنواع</option>
          {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
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
                  <th className="text-right px-4 py-3 font-medium">اسم العميل</th>
                  <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                  <th className="text-right px-4 py-3 font-medium">الموظف المسؤول</th>
                  <th className="text-right px-4 py-3 font-medium">المدينة</th>
                  <th className="text-right px-4 py-3 font-medium">النوع</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-10">لا يوجد عملاء</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.logo_url ? (
                          <img src={r.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{r.client_name[0]}</div>
                        )}
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200 block">{r.client_name}</span>
                          <span className="text-[10px] text-emerald-600 font-medium">
                            {stations.find(s => s.id === r.station_id)?.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {(isManagerOrAdmin || isSales || r.assigned_sales_id === employee?.id) ? (
                        r.phone && (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-700 dark:text-gray-300">{r.phone}</span>
                            <a href={`https://wa.me/${r.phone.replace(/\s/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:scale-110 transition-transform"><MessageCircle size={14} /></a>
                            <a href={`tel:${r.phone}`} className="text-blue-500 hover:scale-110 transition-transform"><Phone size={14} /></a>
                          </div>
                        )
                      ) : (
                        <span className="text-gray-400 italic text-xs">مخفي للخصوصية</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-600 dark:text-gray-400 font-medium">{r.assigned_sales?.name || 'غير معين'}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {(isManagerOrAdmin || isSales) ? (r.country_city ?? '—') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeColor[r.client_type]}`}>{typeLabel[r.client_type]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => openView(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-emerald-600 transition-colors" title="عرض التفاصيل"><Eye size={14} /></button>
                        {(isManagerOrAdmin || isSales) && (
                          <>
                            <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600 transition-colors" title="تعديل"><Pencil size={14} /></button>
                            <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-red-500 transition-colors" title="حذف"><Trash2 size={14} /></button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل عميل' : 'إضافة عميل جديد'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة *</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المحطة --</option>
              {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم العميل *</label>
            <input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          {[
            { label: 'الهاتف', key: 'phone', type: 'tel' },
            { label: 'الدولة/المدينة', key: 'country_city', type: 'text' },
            { label: 'حد الائتمان', key: 'credit_limit', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
              <input type={type} value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          ))}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">مصدر العميل</label>
            <select value={form.client_source} onChange={e => setForm(f => ({ ...f, client_source: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار --</option>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">نوع العميل</label>
            <select value={form.client_type} onChange={e => setForm(f => ({ ...f, client_type: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">موظف السيلز المسؤول</label>
            <select value={form.assigned_sales_id} onChange={e => setForm(f => ({ ...f, assigned_sales_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار الموظف --</option>
              {salesEmployees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">ملاحظات</label>
            <textarea value={form.notes ?? ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none" />
          </div>
          {customFieldsSchema.map(f => (
            <div key={f.name}>
              <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
              <input type={f.type || 'text'} value={form.custom_data?.[f.name] || ''} onChange={e => setForm(prev => ({ ...prev, custom_data: { ...prev.custom_data, [f.name]: e.target.value } }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button onClick={save} disabled={saving}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">إلغاء</button>
        </div>
      </Modal>

      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`تفاصيل العميل: ${viewClient?.client_name}`}>
        {viewClient && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                {viewClient.logo_url ? <img src={viewClient.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-400" />}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Upload size={16} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    toast.loading('جاري رفع اللوجو...', { id: 'upload' })
                    const { success, url } = await uploadLogo(file)
                    if (success) {
                      await supabase.from('clients').update({ logo_url: url }).eq('id', viewClient.id)
                      setViewClient(prev => ({ ...prev, logo_url: url }))
                      setRows(rows.map(r => r.id === viewClient.id ? { ...r, logo_url: url } : r))
                      toast.success('تم رفع اللوجو', { id: 'upload' })
                    } else toast.error('خطأ في الرفع', { id: 'upload' })
                  }} />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500">الهاتف: <span className="font-medium text-gray-800">{viewClient.phone || '—'}</span></p>
                <p className="text-sm text-gray-500">النوع: <span className="font-medium text-gray-800">{typeLabel[viewClient.client_type]}</span></p>
                <p className="text-sm text-gray-500">المدينة: <span className="font-medium text-gray-800">{viewClient.country_city || '—'}</span></p>
                {customFieldsSchema.map(f => (
                  <p key={f.name} className="text-sm text-gray-500">{f.label}: <span className="font-medium text-gray-800">{viewClient.custom_data?.[f.name] || '—'}</span></p>
                ))}
              </div>
            </div>

            {/* Portal Link Access */}
            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800">
              <h4 className="font-bold text-emerald-800 dark:text-emerald-400 mb-2">بوابة العميل (Client Portal)</h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-500 mb-3">يمكن للعميل الدخول لرؤية فواتيره ومدفوعاته عبر هذا الرابط الفريد.</p>
              {viewClient.portal_token ? (
                <div className="flex items-center gap-2">
                  <input readOnly value={`${window.location.origin}/portal?token=${viewClient.portal_token}`} className="flex-1 text-xs px-3 py-2 bg-white dark:bg-gray-800 border border-emerald-200 dark:border-emerald-700 rounded-lg outline-none" />
                  <button onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/portal?token=${viewClient.portal_token}`)
                    toast.success('تم نسخ الرابط')
                  }} className="px-3 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">نسخ</button>
                  <button onClick={async () => {
                    if (!confirm('هل تريد تغيير الرابط؟ الرابط القديم سيتوقف عن العمل.')) return
                    const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                    await supabase.from('clients').update({ portal_token: newToken }).eq('id', viewClient.id)
                    setViewClient({ ...viewClient, portal_token: newToken })
                    setRows(rows.map(r => r.id === viewClient.id ? { ...r, portal_token: newToken } : r))
                    toast.success('تم تجديد الرابط')
                  }} className="px-3 py-2 bg-white border border-emerald-200 text-emerald-600 text-xs font-bold rounded-lg hover:bg-emerald-50">تجديد</button>
                </div>
              ) : (
                <button onClick={async () => {
                  const newToken = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                  await supabase.from('clients').update({ portal_token: newToken }).eq('id', viewClient.id)
                  setViewClient({ ...viewClient, portal_token: newToken })
                  setRows(rows.map(r => r.id === viewClient.id ? { ...r, portal_token: newToken } : r))
                  toast.success('تم إنشاء رابط البوابة')
                }} className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
                  إنشاء رابط دخول
                </button>
              )}
            </div>
            
            <div>
              <h4 className="font-bold text-gray-800 mb-3 border-b pb-2">سجل الصفقات</h4>
              {clientDeals.length === 0 ? (
                <p className="text-sm text-gray-400">لا توجد صفقات مسجلة لهذا العميل.</p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {clientDeals.map(d => {
                    const statusColor = { contact: 'bg-blue-100 text-blue-700', negotiation: 'bg-amber-100 text-amber-700', contracted: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700' }[d.status] || 'bg-gray-100 text-gray-700'
                    const statusLabel = { contact: 'تواصل', negotiation: 'تفاوض', contracted: 'تعاقد', cancelled: 'ملغى' }[d.status] || d.status
                    return (
                      <div key={d.id} className="bg-gray-50 p-3 rounded-lg flex justify-between items-center text-sm border border-gray-100">
                        <div>
                          <p className="font-bold text-gray-700">{Number(d.total_amount).toLocaleString()} ج</p>
                          <p className="text-[10px] text-gray-500">بواسطة: {d.employees?.name || 'غير محدد'} | {d.created_date}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-md text-[10px] font-bold ${statusColor}`}>{statusLabel}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
