import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, Phone, MessageCircle, Eye, Upload, Image as ImageIcon } from 'lucide-react'

const empty = { supplier_name: '', phone: '', current_balance: '', station_id: '', notes: '', logo_url: '', custom_data: {} }

export default function Suppliers() {
  const { employee } = useAuth()
  const { settings, uploadLogo } = useSettings()
  const { t, isRTL } = useLang()
  const customFieldsSchema = settings?.custom_fields_schema?.suppliers || []

  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [search, setSearch] = useState('')
  const [debtFilter, setDebtFilter] = useState('all')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [viewModal, setViewModal] = useState(false)
  const [viewSupplier, setViewSupplier] = useState(null)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load(); loadStations() }, [])

  async function loadStations() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('suppliers').select('*').order('supplier_name')
    setRows(data ?? [])
    setLoading(false)
  }

  function openNew() { setForm(empty); setEditing(null); setModal(true) }
  function openEdit(r) { setForm({ ...r, custom_data: r.custom_data || {} }); setEditing(r.id); setModal(true) }

  function openView(supplier) {
    setViewSupplier(supplier)
    setViewModal(true)
  }

  async function save() {
    if (!form.supplier_name) return toast.error('اسم المورد مطلوب')
    setSaving(true)
    const payload = { 
      ...form, 
      current_balance: Number(form.current_balance) || 0,
      station_id: form.station_id ? Number(form.station_id) : null
    }
    const { error } = editing
      ? await supabase.from('suppliers').update(payload).eq('id', editing)
      : await supabase.from('suppliers').insert(payload)
    if (error) toast.error(error.message)
    else { 
      toast.success('تم الحفظ')
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'الموردين', editing || 'جديد', `المورد: ${form.supplier_name}`)
      setModal(false)
      load() 
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('تأكيد الحذف؟')) return
    const supplierName = rows.find(r => r.id === id)?.supplier_name
    const { error } = await supabase.from('suppliers').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { 
      toast.success('تم الحذف')
      logActivity(employee, 'حذف', 'الموردين', id, `المورد: ${supplierName}`)
      load() 
    }
  }

  const filtered = rows.filter(r =>
    (debtFilter === 'all' || (debtFilter === 'indebted' && Number(r.current_balance) > 0)) &&
    (!stationFilter || r.station_id === Number(stationFilter)) &&
    (r.supplier_name?.includes(search) || r.phone?.includes(search))
  )
  const totalDebt = rows.reduce((s, r) => s + Number(r.current_balance), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800">الموردين</h1>
          <p className="text-xs text-gray-400 mt-0.5">إجمالي المديونية: <span className="text-red-600 font-medium">{totalDebt.toLocaleString()} ج</span></p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus size={16} /> إضافة مورد
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم المورد..."
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل المحطات</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={debtFilter} onChange={e => setDebtFilter(e.target.value)} className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="all">كل الموردين</option>
          <option value="indebted">الموردين المدينين</option>
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
                  <th className="text-right px-4 py-3 font-medium">اسم المورد</th>
                  <th className="text-right px-4 py-3 font-medium">الهاتف</th>
                  <th className="text-right px-4 py-3 font-medium">المديونية الحالية</th>
                  <th className="text-right px-4 py-3 font-medium">ملاحظات</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-gray-400 py-10">لا يوجد موردين</td></tr>
                ) : filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {r.logo_url ? (
                          <img src={r.logo_url} alt="" className="w-8 h-8 rounded-full object-cover border border-gray-200" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">{r.supplier_name[0]}</div>
                        )}
                        <div>
                          <span className="font-medium text-gray-800 dark:text-gray-200 block">{r.supplier_name}</span>
                          <span className="text-[10px] text-emerald-600 font-medium">
                            {stations.find(s => s.id === r.station_id)?.name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {r.phone ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-700 dark:text-gray-300">{r.phone}</span>
                          <a href={`https://wa.me/${r.phone.replace(/\s/g, '')}`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:scale-110 transition-transform"><MessageCircle size={14} /></a>
                          <a href={`tel:${r.phone}`} className="text-blue-500 hover:scale-110 transition-transform"><Phone size={14} /></a>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${Number(r.current_balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {Number(r.current_balance).toLocaleString()} ج
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.notes ?? '—'}</td>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل مورد' : 'إضافة مورد جديد'}>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة *</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المحطة --</option>
              {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم المورد *</label>
            <input value={form.supplier_name} onChange={e => setForm(f => ({ ...f, supplier_name: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">الهاتف</label>
            <input type="tel" value={form.phone ?? ''} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">المديونية الحالية (ج)</label>
            <input type="number" min="0" value={form.current_balance ?? ''} onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
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

      <Modal open={viewModal} onClose={() => setViewModal(false)} title={`تفاصيل المورد: ${viewSupplier?.supplier_name}`}>
        {viewSupplier && (
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden relative group">
                {viewSupplier.logo_url ? <img src={viewSupplier.logo_url} alt="" className="w-full h-full object-cover" /> : <ImageIcon size={24} className="text-gray-400" />}
                <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                  <Upload size={16} className="text-white" />
                  <input type="file" className="hidden" accept="image/*" onChange={async e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    toast.loading('جاري رفع اللوجو...', { id: 'upload' })
                    const { success, url } = await uploadLogo(file)
                    if (success) {
                      await supabase.from('suppliers').update({ logo_url: url }).eq('id', viewSupplier.id)
                      setViewSupplier(prev => ({ ...prev, logo_url: url }))
                      setRows(rows.map(r => r.id === viewSupplier.id ? { ...r, logo_url: url } : r))
                      toast.success('تم رفع اللوجو', { id: 'upload' })
                    } else toast.error('خطأ في الرفع', { id: 'upload' })
                  }} />
                </label>
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 mb-1">الهاتف: <span className="font-medium text-gray-800">{viewSupplier.phone || '—'}</span></p>
                <p className="text-sm text-gray-500 mb-1">المديونية: <span className={`font-bold ${Number(viewSupplier.current_balance) > 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Number(viewSupplier.current_balance).toLocaleString()} ج</span></p>
                <p className="text-sm text-gray-500 mb-2">ملاحظات: <span className="font-medium text-gray-800">{viewSupplier.notes || '—'}</span></p>
                {customFieldsSchema.map(f => (
                  <p key={f.name} className="text-sm text-gray-500 mb-1">{f.label}: <span className="font-medium text-gray-800">{viewSupplier.custom_data?.[f.name] || '—'}</span></p>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
