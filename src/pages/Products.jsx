import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Search, Pencil, Trash2, AlertTriangle, Scan, Loader2, Sparkles, ImagePlus, X, Download } from 'lucide-react'
import { analyzeInvoiceImage, askAI } from '../lib/ai'
import { exportToExcel } from '../lib/exportHelpers'

const UNITS = [
  { v: 'kg', l: 'كيلو جرام (kg)' },
  { v: 'ton', l: 'طن متري (Ton)' },
  { v: 'carton', l: 'كرتونة (Box)' },
  { v: 'bin', l: 'بنز / Bin (600kg)' },
  { v: 'container', l: 'حاوية / Container (25t)' },
  { v: 'other', l: 'أخرى' }
]
const CATS = ['vegetables', 'fruits', 'legumes', 'other']
const empty = {
  product_name: '', supplier_id: '', category: 'vegetables',
  stock_quantity: '', unit: 'kg', cost_price: '',
  reorder_level: '', expiry_date: '', barcode: '',
  station_id: '', image_url: ''
}

export default function Products() {
  const { employee } = useAuth()
  const { t, isRTL } = useLang()
  const [rows, setRows] = useState([])
  const [stations, setStations] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [stationFilter, setStationFilter] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [uploadingImg, setUploadingImg] = useState(false)
  const [imagePreview, setImagePreview] = useState(null)

  useEffect(() => { load(); loadSuppliers(); loadStations() }, [])

  async function loadStations() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }
  async function load() {
    setLoading(true)
    const { data } = await supabase.from('products').select('*, suppliers(supplier_name)').order('product_name')
    setRows(data ?? [])
    setLoading(false)
  }
  async function loadSuppliers() {
    const { data } = await supabase.from('suppliers').select('id,supplier_name').order('supplier_name')
    setSuppliers(data ?? [])
  }

  function openNew() { setForm(empty); setEditing(null); setImagePreview(null); setModal(true) }
  function openEdit(r) {
    setForm({ ...r, supplier_id: r.supplier_id ?? '', station_id: r.station_id ?? '', expiry_date: r.expiry_date ?? '', barcode: r.barcode ?? '', image_url: r.image_url ?? '' })
    setEditing(r.id)
    setImagePreview(r.image_url || null)
    setModal(true)
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return toast.error('الصورة أكبر من 5MB')
    setUploadingImg(true)
    const ext = file.name.split('.').pop()
    const path = `products/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('product-images').upload(path, file, { upsert: true })
    if (error) { toast.error('فشل رفع الصورة'); setUploadingImg(false); return }
    const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: urlData.publicUrl }))
    setImagePreview(urlData.publicUrl)
    setUploadingImg(false)
    toast.success('تم رفع الصورة')
  }

  function clearImage() {
    setForm(f => ({ ...f, image_url: '' }))
    setImagePreview(null)
  }

  async function save() {
    if (!form.product_name) return toast.error('اسم المنتج مطلوب')
    setSaving(true)
    const payload = {
      product_name: form.product_name, category: form.category, unit: form.unit,
      stock_quantity: Number(form.stock_quantity) || 0,
      cost_price: Number(form.cost_price) || 0,
      reorder_level: Number(form.reorder_level) || 0,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      station_id: form.station_id ? Number(form.station_id) : null,
      expiry_date: form.expiry_date || null,
      barcode: form.barcode || null,
      image_url: form.image_url || null,
    }
    const { error } = editing
      ? await supabase.from('products').update(payload).eq('id', editing)
      : await supabase.from('products').insert(payload)
    if (error) toast.error(error.message)
    else {
      toast.success('تم الحفظ')
      logActivity(employee, editing ? 'تعديل' : 'إضافة', 'المخزون', editing || 'جديد', `المنتج: ${form.product_name}`)
      setModal(false); load()
    }
    setSaving(false)
  }

  async function remove(id) {
    if (!confirm('تأكيد الحذف؟')) return
    const productName = rows.find(r => r.id === id)?.product_name
    const { error } = await supabase.from('products').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('تم الحذف'); logActivity(employee, 'حذف', 'المخزون', id, `المنتج: ${productName}`); load() }
  }

  const handleOCR = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    try {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = async () => {
        try {
          const base64 = reader.result.split(',')[1]
          const data = await analyzeInvoiceImage(base64, file.type)
          if (data?.items?.length > 0) {
            const item = data.items[0]
            setForm({ ...empty, product_name: item.product_name || '', stock_quantity: item.quantity || 1, cost_price: item.unit_price || 0, unit: 'kg' })
            setEditing(null); setModal(true)
            toast.success('تم استخراج البيانات بنجاح!')
          } else toast.error('لم يتم العثور على منتجات واضحة في الفاتورة')
        } catch { toast.error('حدث خطأ أثناء معالجة الصورة') }
      }
    } catch { toast.error('فشل في قراءة الفاتورة. تأكد من إعداد AI Key.') }
    finally { setScanning(false) }
  }

  const handleInventoryAnalysis = async () => {
    setScanning(true)
    try {
      const inventoryData = rows.map(r => `${r.product_name}: ${r.stock_quantity} ${unitLabel[r.unit]}, Reorder Level: ${r.reorder_level}`).join('\n')
      const prompt = `Current Inventory:\n${inventoryData}\n\nAnalyze: critical stock, demand forecast for May, replenishment suggestions. Arabic response with emojis.`
      const response = await askAI(prompt)
      alert('--- تحليلات المخزون ---\n\n' + response)
    } catch { toast.error('فشل في تحليل المخزون.') }
    finally { setScanning(false) }
  }

  const filtered = rows.filter(r => {
    const catMatch = !catFilter || r.category?.toLowerCase() === catFilter.toLowerCase() ||
      (catFilter === 'vegetables' && r.category === 'خضروات') ||
      (catFilter === 'fruits' && r.category === 'فاكهة') ||
      (catFilter === 'legumes' && r.category === 'بقوليات')
    const stationMatch = !stationFilter || r.station_id === Number(stationFilter)
    const searchMatch = !search || r.product_name?.toLowerCase().includes(search.toLowerCase()) || r.category?.toLowerCase().includes(search.toLowerCase())
    return catMatch && stationMatch && searchMatch
  })
  const unitLabel = Object.fromEntries(UNITS.map(u => [u.v, u.l]))

  const getCategoryIcon = (cat) => {
    if (!cat) return '📦'
    const c = cat.toLowerCase()
    if (c === 'خضروات' || c === 'vegetables') return '🥦'
    if (c === 'فاكهة' || c === 'fruits') return '🍎'
    if (c === 'بقوليات' || c === 'legumes') return '🌾'
    return '📦'
  }

  const handleExport = () => {
    const data = filtered.map(r => ({
      'اسم الصنف': r.product_name,
      'الفئة': r.category,
      'الكمية': r.stock_quantity,
      'الوحدة': unitLabel[r.unit] || r.unit,
      'سعر الشراء': r.cost_price,
      'حد التنبيه': r.reorder_level,
      'المورد': r.suppliers?.supplier_name || '—',
      'المحطة': stations.find(s => s.id === r.station_id)?.name || 'بدون محطة',
      'الصلاحية': r.expiry_date
    }))
    exportToExcel(data, `inventory_${new Date().toLocaleDateString()}`, 'المخزون')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">المخزون</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExport}
            className="flex items-center gap-2 border border-emerald-200 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors">
            <Download size={16} /> إكسيل
          </button>
          <label className={`flex items-center gap-2 border border-emerald-600 text-emerald-600 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer hover:bg-emerald-50 ${scanning ? 'opacity-50 pointer-events-none' : ''}`}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Scan size={16} />}
            ماسح الفواتير (AI)
            <input type="file" className="hidden" accept="image/*" onChange={handleOCR} />
          </label>
          <button onClick={handleInventoryAnalysis} disabled={scanning}
            className="flex items-center gap-2 border border-purple-600 text-purple-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-purple-50 disabled:opacity-50">
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            تحليل المخزون
          </button>
          <button onClick={openNew} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus size={16} /> إضافة صنف
          </button>
        </div>
      </div>

      {/* Top Product Cards with images */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-2">
          {[...rows].sort((a, b) => b.stock_quantity - a.stock_quantity).slice(0, 4).map(p => {
            const icon = getCategoryIcon(p.category)
            return (
              <div key={p.id} className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-3 relative overflow-hidden group">
                <div className="absolute -right-4 -top-4 text-6xl opacity-5 group-hover:scale-110 transition-transform">{icon}</div>
                <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 z-10 bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center">
                  {p.image_url
                    ? <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                    : <span className="text-2xl">{icon}</span>}
                </div>
                <div className="z-10 min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-gray-100 truncate">{p.product_name}</p>
                  <p className="text-lg font-black text-emerald-600">{p.stock_quantity} <span className="text-[10px] text-gray-500 font-normal">{unitLabel[p.unit] || p.unit}</span></p>
                  {p.expiry_date && <p className="text-[10px] text-gray-400 mt-0.5 truncate">صلاحية: {p.expiry_date}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث باسم الصنف..."
            className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg pr-9 pl-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل المحطات</option>
          {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">كل الفئات</option>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">الصنف</th>
                  <th className="text-right px-4 py-3 font-medium">الكمية</th>
                  <th className="text-right px-4 py-3 font-medium">سعر الشراء</th>
                  <th className="text-right px-4 py-3 font-medium">المورد</th>
                  <th className="text-right px-4 py-3 font-medium">الصلاحية</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtered.length === 0 ? (
                  <tr><td colSpan={6} className="text-center text-gray-400 py-10">لا توجد أصناف</td></tr>
                ) : filtered.map(r => {
                  const lowStock = Number(r.stock_quantity) <= Number(r.reorder_level)
                  return (
                    <tr key={r.id} className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${lowStock ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                            {r.image_url
                              ? <img src={r.image_url} alt={r.product_name} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none' }} />
                              : <span className="text-lg">{getCategoryIcon(r.category)}</span>}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              {lowStock && <AlertTriangle size={13} className="text-red-500 flex-shrink-0" />}
                              <span className="font-medium text-gray-800 dark:text-gray-200">{r.product_name}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] bg-gray-100 dark:bg-white/5 text-gray-500 px-1.5 py-0.5 rounded">{r.category}</span>
                              <span className="text-[10px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                                {stations.find(s => s.id === r.station_id)?.name || 'بدون محطة'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-medium ${lowStock ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                          {r.stock_quantity} {unitLabel[r.unit] ?? r.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{Number(r.cost_price).toLocaleString()} ج</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.suppliers?.supplier_name ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{r.expiry_date ?? '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => openEdit(r)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-blue-600 transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => remove(r.id)} className="p-1.5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
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

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'تعديل صنف' : 'إضافة صنف جديد'}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

          {/* Image Upload */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">صورة / لوجو المنتج</label>
            {imagePreview ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 group">
                <img src={imagePreview} alt="preview" className="w-full h-full object-cover" />
                <button onClick={clearImage}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow">
                  <X size={13} />
                </button>
              </div>
            ) : (
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl cursor-pointer hover:border-emerald-400 transition-colors ${uploadingImg ? 'opacity-50 pointer-events-none' : ''}`}>
                {uploadingImg
                  ? <Loader2 size={24} className="animate-spin text-emerald-500 mb-1" />
                  : <ImagePlus size={24} className="text-gray-400 mb-1" />}
                <span className="text-xs text-gray-400">{uploadingImg ? 'جاري الرفع...' : 'اضغط لرفع صورة للمنتج'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المحطة</label>
            <select value={form.station_id} onChange={e => setForm(f => ({ ...f, station_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار المحطة --</option>
              {stations.map(st => <option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">اسم الصنف *</label>
            <input value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الفئة</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {CATS.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوحدة</label>
            <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              {UNITS.map(u => <option key={u.v} value={u.v}>{u.l}</option>)}
            </select>
          </div>

          {[{ label: 'الكمية المتاحة', key: 'stock_quantity' }, { label: 'سعر الشراء (ج)', key: 'cost_price' }, { label: 'حد التنبيه (الحد الأدنى)', key: 'reorder_level' }].map(({ label, key }) => (
            <div key={key}>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{label}</label>
              <input type="number" min="0" step="0.01" value={form[key] ?? ''} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
            </div>
          ))}

          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">المورد</label>
            <select value={form.supplier_id} onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
              <option value="">-- اختار مورد --</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.supplier_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">تاريخ الصلاحية</label>
            <input type="date" value={form.expiry_date ?? ''} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الباركود</label>
            <input value={form.barcode ?? ''} onChange={e => setForm(f => ({ ...f, barcode: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
        </div>

        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button onClick={save} disabled={saving || uploadingImg}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </button>
          <button onClick={() => setModal(false)} className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">إلغاء</button>
        </div>
      </Modal>
    </div>
  )
}
