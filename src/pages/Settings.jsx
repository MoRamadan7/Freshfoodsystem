import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { initAI } from '../lib/ai'
import toast from 'react-hot-toast'
import {
  Building2, Upload, FileText, CreditCard, Bell, Users, Save, Image, Shield, Calculator, Cpu, MapPin, Trash2, Plus, X, Check, ListPlus
} from 'lucide-react'

const CURRENCIES = [
  { code: 'EGP', symbol: 'ج.م', name: 'جنيه مصري' },
  { code: 'SAR', symbol: 'ر.س', name: 'ريال سعودي' },
  { code: 'AED', symbol: 'د.إ', name: 'درهم إماراتي' },
  { code: 'USD', symbol: '$', name: 'دولار أمريكي' },
  { code: 'EUR', symbol: '€', name: 'يورو' },
]

const ROLES = ['admin', 'manager', 'accountant', 'sales', 'hr', 'employee']

const Input = ({ label, name, value, onChange, type = 'text', ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
    <input type={type} name={name} value={value || ''} onChange={onChange}
      className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white dark:bg-white/5 text-gray-800 dark:text-gray-100" {...props} />
  </div>
)

const Toggle = ({ label, name, checked, onChange }) => (
  <label className="flex items-center justify-between cursor-pointer p-3 bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-100 dark:border-white/10">
    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</span>
    <div className="relative">
      <input type="checkbox" name={name} checked={!!checked} onChange={onChange} className="sr-only peer" />
      <div className="w-11 h-6 bg-gray-200 dark:bg-white/10 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
    </div>
  </label>
)

export default function Settings() {
  const { settings, updateSettings, uploadLogo } = useSettings()
  const { t, lang, setLang, isRTL } = useLang()
  const { employee, isAdmin, normalizedRole } = useAuth()
  const isManagerOrAdmin = isAdmin || normalizedRole === 'manager'
  
  const [activeTab, setActiveTab] = useState('company')
  const [stations, setStations] = useState([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({})
  const [users, setUsers] = useState([])
  const [isAddingStation, setIsAddingStation] = useState(false)
  const [newStationName, setNewStationName] = useState('')
  const fileInputRef = useRef(null)
  const sidebarFileInputRef = useRef(null)
  const stampFileInputRef = useRef(null)
  const watermarkFileInputRef = useRef(null)

  useEffect(() => { loadStations() }, [])

  async function loadStations() {
    const { data } = await supabase.from('stations').select('*').order('name')
    setStations(data ?? [])
  }

  async function addStation() {
    if (!newStationName.trim()) return
    const { error } = await supabase.from('stations').insert({ name: newStationName.trim() })
    if (error) toast.error(error.message)
    else { 
      toast.success('تمت الإضافة')
      logActivity(employee, 'إضافة', 'المحطات', null, `محطة: ${newStationName}`)
      setNewStationName('')
      setIsAddingStation(false)
      loadStations() 
    }
  }

  async function deleteStation(id) {
    if (!confirm('تأكيد حذف المحطة؟')) return
    const { error } = await supabase.from('stations').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { 
      toast.success('تم الحذف')
      logActivity(employee, 'حذف', 'المحطات', id, `محطة رقم: ${id}`)
      loadStations() 
    }
  }

  const TABS = [
    { id: 'company', icon: Building2, label: t('companyInfo') },
    { id: 'stations', icon: MapPin, label: 'المحطات' },
    { id: 'invoices', icon: FileText, label: t('invoiceSettings') },
    { id: 'payroll', icon: Calculator, label: t('payrollSettings') },
    { id: 'templates', icon: FileText, label: isRTL ? 'تنسيق التقارير' : 'Report Templates' },
    { id: 'notifications', icon: Bell, label: t('notificationSettings') },
    ...(isAdmin ? [
      { id: 'custom_fields', icon: ListPlus, label: 'الحقول الإضافية' },
      { id: 'users', icon: Users, label: t('userManagement') }
    ] : [])
  ]

  useEffect(() => {
    if (settings) {
      setForm(settings)
      if (settings.gemini_api_key) {
        initAI(settings.gemini_api_key)
      }
    }
  }, [settings])

  useEffect(() => {
    if (activeTab === 'users' && isManagerOrAdmin) {
      supabase.from('employees').select('id, name, email, role, is_active').order('name')
        .then(({ data }) => setUsers(data || []))
    }
  }, [activeTab, isManagerOrAdmin])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  const handleSave = async () => {
    setSaving(true)
    const { success, error } = await updateSettings(form)
    if (success) {
      if (form.language !== lang) setLang(form.language)
      toast.success(t('saved'))
      logActivity(employee, 'تعديل', 'الإعدادات', null, 'تحديث إعدادات النظام العام')
    } else {
      toast.error(error || t('errorSaving'))
    }
    setSaving(false)
  }

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error(t('fileTooLarge'))
    
    const toastId = toast.loading(t('saving'))
    const { success, url, error } = await uploadLogo(file)
    if (success) {
      setForm(prev => ({ ...prev, logo_url: url }))
      await updateSettings({ logo_url: url })
      toast.success(t('saved'), { id: toastId })
    } else {
      toast.error(error || t('errorUploading'), { id: toastId })
    }
  }

  const handleSidebarLogoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error(t('fileTooLarge'))
    
    const toastId = toast.loading(t('saving'))
    const { success, url, error } = await uploadLogo(file)
    if (success) {
      setForm(prev => ({ ...prev, sidebar_logo_url: url }))
      await updateSettings({ sidebar_logo_url: url })
      toast.success(t('saved'), { id: toastId })
    } else {
      toast.error(error || t('errorUploading'), { id: toastId })
    }
  }

  const handleGenericUpload = async (e, field) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error(t('fileTooLarge'))
    
    const toastId = toast.loading(t('saving'))
    const { success, url, error } = await uploadLogo(file)
    if (success) {
      setForm(prev => ({ ...prev, [field]: url }))
      await updateSettings({ [field]: url })
      toast.success(t('saved'), { id: toastId })
    } else {
      toast.error(error || t('errorUploading'), { id: toastId })
    }
  }

  const updateUserRole = async (userId, newRole) => {
    const targetUser = users.find(u => u.id === userId)
    if (!isAdmin && (targetUser?.role === 'admin' || newRole === 'admin')) {
      return toast.error('ليس لديك صلاحية لتعديل أو تعيين مدير نظام (Admin).')
    }
    const { error } = await supabase.from('employees').update({ role: newRole }).eq('id', userId)
    if (error) toast.error(error.message)
    else {
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
      toast.success(t('roleUpdated'))
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{t('settingsTitle')}</h1>
        <p className="text-sm text-gray-500 mt-1">{t('settingsSubtitle')}</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Tabs */}
        <div className="w-full md:w-64 space-y-1 flex-shrink-0">
          {TABS.map(tab => {
            const Icon = tab.icon
            const active = activeTab === tab.id
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all
                  ${active 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 dark:border-emerald-500/30 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                <Icon size={18} className={active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'} />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-white/5 p-6 shadow-sm min-h-[500px]">
          
          {/* Custom Fields Settings */}
          {activeTab === 'custom_fields' && isManagerOrAdmin && (
            <div className="space-y-6 animate-fade-in">
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">الحقول الإضافية (Custom Fields)</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">إضافة حقول بيانات جديدة للعملاء، الموردين، أو الموظفين بدون تعديل برمجي.</p>
              </div>

              {['clients', 'suppliers', 'employees'].map(entity => {
                const entityLabels = { clients: 'العملاء', suppliers: 'الموردين', employees: 'الموظفين' }
                const schema = form.custom_fields_schema || {}
                const fields = schema[entity] || []

                const addField = () => {
                  const newName = window.prompt('أدخل المعرف البرمجي للحقل بالإنجليزية (مثال: tax_number):')
                  if (!newName) return
                  if (!/^[a-zA-Z0-9_]+$/.test(newName)) return toast.error('يجب أن يحتوي المعرف على حروف إنجليزية وأرقام فقط')
                  const newLabel = window.prompt('أدخل اسم الحقل ليظهر للمستخدمين (مثال: الرقم الضريبي):')
                  if (!newLabel) return
                  const newSchema = { ...schema, [entity]: [...fields, { name: newName, label: newLabel, type: 'text' }] }
                  setForm(prev => ({ ...prev, custom_fields_schema: newSchema }))
                }

                const removeField = (nameToRemove) => {
                  if (!confirm('هل أنت متأكد من حذف هذا الحقل؟ سيؤدي هذا لإخفائه من النظام.')) return
                  const newSchema = { ...schema, [entity]: fields.filter(f => f.name !== nameToRemove) }
                  setForm(prev => ({ ...prev, custom_fields_schema: newSchema }))
                }

                return (
                  <div key={entity} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-gray-700 dark:text-gray-200">حقول {entityLabels[entity]}</h4>
                      <button onClick={addField} className="text-xs bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 px-3 py-1.5 rounded-lg hover:bg-emerald-200 transition-colors flex items-center gap-1">
                        <Plus size={14} /> إضافة حقل
                      </button>
                    </div>
                    {fields.length === 0 ? (
                      <p className="text-sm text-gray-400">لا توجد حقول إضافية.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {fields.map(f => (
                          <div key={f.name} className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 px-3 py-2 rounded-lg">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.label}</span>
                              <span className="text-[10px] text-gray-400">{f.name}</span>
                            </div>
                            <button onClick={() => removeField(f.name)} className="text-gray-400 hover:text-red-500">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* 1.5 Stations Settings */}
          {activeTab === 'stations' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">إدارة المحطات</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">أضف أو احذف محطات العمل الخاصة بالشركة</p>
                </div>
                <button onClick={() => setIsAddingStation(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm">
                  <Plus size={16} />
                  إضافة محطة
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {isAddingStation && (
                  <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2 animate-scale-in">
                    <input 
                      autoFocus
                      placeholder="اسم المحطة..."
                      value={newStationName}
                      onChange={e => setNewStationName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addStation()}
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm text-emerald-900 dark:text-emerald-100 placeholder:text-emerald-400"
                    />
                    <button onClick={addStation} className="p-1.5 text-emerald-600 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 rounded-lg">
                      <Check size={16} />
                    </button>
                    <button onClick={() => { setIsAddingStation(false); setNewStationName('') }} className="p-1.5 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg">
                      <X size={16} />
                    </button>
                  </div>
                )}
                {stations.length === 0 ? (
                  <div className="col-span-full py-12 text-center bg-gray-50 dark:bg-white/5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10">
                    <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500">لا توجد محطات مضافة حالياً</p>
                  </div>
                ) : (
                  stations.map(st => (
                    <div key={st.id} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/10 flex items-center justify-between group transition-all hover:shadow-md">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <MapPin size={18} />
                        </div>
                        <span className="font-bold text-gray-800 dark:text-gray-200">{st.name}</span>
                      </div>
                      <button onClick={() => deleteStation(st.id)} className="p-2 text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 1. Company Settings */}
          {activeTab === 'company' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-6 border-b border-gray-100 pb-6">
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                    {form.logo_url ? (
                      <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Image size={24} className="text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                      <Upload size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">{t('companyLogo')}</h3>
                    <p className="text-[10px] text-gray-500 mb-2">{t('logoHint')}</p>
                    <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                      {t('uploadLogo')}
                    </button>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleLogoUpload} />
                  </div>
                </div>

                <div className="flex items-start gap-4 border-s border-gray-100 ps-6">
                  <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                    {form.sidebar_logo_url ? (
                      <img src={form.sidebar_logo_url} alt="Sidebar Logo" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Image size={24} className="text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => sidebarFileInputRef.current?.click()}>
                      <Upload size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">{isRTL ? 'أيقونة القائمة الجانبية' : 'Sidebar Icon'}</h3>
                    <p className="text-[10px] text-gray-500 mb-2">{t('logoHint')}</p>
                    <button onClick={() => sidebarFileInputRef.current?.click()} className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                      {t('uploadLogo')}
                    </button>
                    <input type="file" ref={sidebarFileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleSidebarLogoUpload} />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-6 border-b border-gray-100 pb-6">
                {/* Stamp Upload */}
                <div className="flex items-start gap-4">
                  <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                    {form.stamp_url ? (
                      <img src={form.stamp_url} alt="Stamp" className="w-full h-full object-contain p-2" />
                    ) : (
                      <Image size={24} className="text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => stampFileInputRef.current?.click()}>
                      <Upload size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">{isRTL ? 'ختم الشركة' : 'Company Stamp'}</h3>
                    <p className="text-[10px] text-gray-500 mb-2">{isRTL ? 'يظهر في الفواتير (شفاف PNG يفضل)' : 'Appears on invoices (Transparent PNG preferred)'}</p>
                    <button onClick={() => stampFileInputRef.current?.click()} className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                      {isRTL ? 'رفع الختم' : 'Upload Stamp'}
                    </button>
                    <input type="file" ref={stampFileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={e => handleGenericUpload(e, 'stamp_url')} />
                  </div>
                </div>

                {/* Watermark Upload */}
                <div className="flex items-start gap-4 border-s border-gray-100 ps-6">
                  <div className="w-24 h-24 rounded-2xl bg-gray-50 border-2 border-dashed border-gray-200 flex items-center justify-center overflow-hidden relative group">
                    {form.watermark_url ? (
                      <img src={form.watermark_url} alt="Watermark" className="w-full h-full object-contain p-2 opacity-50" />
                    ) : (
                      <Image size={24} className="text-gray-400" />
                    )}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={() => watermarkFileInputRef.current?.click()}>
                      <Upload size={20} className="text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold text-gray-800 mb-1">{isRTL ? 'العلامة المائية للفاتورة' : 'Invoice Watermark'}</h3>
                    <p className="text-[10px] text-gray-500 mb-2">{isRTL ? 'تظهر خلف بيانات الفاتورة بشكل خفيف' : 'Appears faintly behind invoice data'}</p>
                    <button onClick={() => watermarkFileInputRef.current?.click()} className="px-3 py-1.5 border border-gray-200 text-xs font-medium text-gray-700 rounded-lg hover:bg-gray-50">
                      {isRTL ? 'رفع العلامة المائية' : 'Upload Watermark'}
                    </button>
                    <input type="file" ref={watermarkFileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={e => handleGenericUpload(e, 'watermark_url')} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('companyName')} name="company_name" value={form.company_name} onChange={handleChange} />
                <Input label={isRTL ? "السجل التجاري" : "Commercial Register"} name="commercial_register" value={form.commercial_register} onChange={handleChange} />
                <Input label={isRTL ? "السجل التصديري" : "Export Register"} name="export_register" value={form.export_register} onChange={handleChange} />
                <Input label={isRTL ? "البطاقة الضريبية" : "Tax Card"} name="tax_card" value={form.tax_card} onChange={handleChange} />
                <Input label={t('companyEmail')} name="email" type="email" value={form.email} onChange={handleChange} />
                <Input label={t('companyPhone')} name="phone" value={form.phone} onChange={handleChange} />
                <div className="md:col-span-2">
                  <Input label={t('companyAddress')} name="address" value={form.address} onChange={handleChange} />
                </div>
                <div className="md:col-span-2 space-y-4 pt-4 border-t border-gray-100">
                  <h4 className="text-sm font-bold text-gray-700">{isRTL ? 'تخصيص الشريط العلوي' : 'Header Customization'}</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{isRTL ? 'نص الإعلان (لأكثر من جملة افصل بـ | )' : 'Announcement Text (use | for multiple)'}</label>
                      <input name="announcement_text" value={form.announcement_text || ''} onChange={handleChange} 
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{isRTL ? 'تنسيق الشريط العلوي' : 'Header Layout'}</label>
                      <select name="header_layout" value={form.header_layout || 'standard'} onChange={handleChange}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        <option value="standard">{isRTL ? 'افتراضي (جانبي)' : 'Standard (Side)'}</option>
                        <option value="centered">{isRTL ? 'مركزي (اللوجو في المنتصف)' : 'Centered Logo'}</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('currency')}</label>
                  <select name="currency" value={form.currency || 'EGP'} onChange={(e) => {
                    const c = CURRENCIES.find(x => x.code === e.target.value)
                    setForm(p => ({ ...p, currency: c.code, currency_symbol: c.symbol }))
                  }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('languageLabel')}</label>
                  <select name="language" value={form.language || 'ar'} onChange={handleChange}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="ar">العربية (RTL)</option>
                    <option value="en">English (LTR)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* 2. Invoices Settings */}
          {activeTab === 'invoices' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input label={t('invoicePrefix')} name="invoice_prefix" value={form.invoice_prefix} onChange={handleChange} />
                <Input label={t('invoiceTaxRate')} name="invoice_tax_rate" type="number" step="0.1" value={form.invoice_tax_rate} onChange={handleChange} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceColor')}</label>
                  <div className="flex gap-3">
                    <input type="color" name="invoice_color" value={form.invoice_color || '#10b981'} onChange={handleChange}
                      className="h-10 w-14 rounded border border-gray-200 p-0.5 cursor-pointer" />
                    <input type="text" value={form.invoice_color || '#10b981'} readOnly className="flex-1 border border-gray-200 rounded-lg px-3 text-sm bg-gray-50" />
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <Toggle label={t('invoiceShowLogo')} name="invoice_show_logo" checked={form.invoice_show_logo} onChange={handleChange} />
                <Toggle label={t('invoiceShowTax')} name="invoice_show_tax" checked={form.invoice_show_tax} onChange={handleChange} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceNotes')}</label>
                <textarea name="invoice_notes" value={form.invoice_notes || ''} onChange={handleChange} rows={3} placeholder={t('invoiceNotesPlaceholder')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('invoiceFooter')}</label>
                <textarea name="invoice_footer" value={form.invoice_footer || ''} onChange={handleChange} rows={2} placeholder={t('invoiceFooterPlaceholder')}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
          )}

          {/* 3. Payroll Settings */}
          {activeTab === 'payroll' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input label={t('payrollDay')} name="payroll_day" type="number" min="1" max="31" value={form.payroll_day} onChange={handleChange} />
              <Input label={t('workingHours')} name="working_hours" type="number" step="0.5" value={form.working_hours} onChange={handleChange} />
              <Input label={t('latePenaltyPerHour')} name="late_penalty_per_hour" type="number" value={form.late_penalty_per_hour} onChange={handleChange} />
              <Input label="سعر الساعة الإضافية (للشهري)" name="monthly_overtime_rate" type="number" value={form.monthly_overtime_rate} onChange={handleChange} />
              <Input label="سعر الساعة الإضافية (لليومية)" name="daily_overtime_rate" type="number" value={form.daily_overtime_rate} onChange={handleChange} />
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6 animate-fade-in">
              <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400 mb-2">{isRTL ? 'تخصيص مظهر الفواتير والتقارير' : 'Invoice & Report Customization'}</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-500">هذه الإعدادات تؤثر على شكل الملفات عند طباعتها أو تصديرها كـ PDF.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'لون السمة الرئيسي' : 'Primary Theme Color'}</label>
                  <input type="color" name="invoice_color" value={form.invoice_color || '#10b981'} onChange={handleChange}
                    className="w-full h-10 rounded-lg cursor-pointer border border-gray-200 dark:border-white/10 p-1" />
                </div>
                <Input label={isRTL ? 'بادئة رقم الفاتورة' : 'Invoice Prefix'} name="invoice_prefix" value={form.invoice_prefix} onChange={handleChange} />
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'ملاحظات افتراضية للفاتورة' : 'Default Invoice Notes'}</label>
                  <textarea name="invoice_notes" value={form.invoice_notes || ''} onChange={handleChange} rows={2}
                    className="w-full border border-gray-200 dark:border-white/10 dark:bg-white/5 rounded-lg px-3 py-2 text-sm" />
                </div>
                
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">{isRTL ? 'تذييل التقارير (Footer Text)' : 'Report Footer Text'}</label>
                  <input name="invoice_footer" value={form.invoice_footer || ''} onChange={handleChange}
                    className="w-full border border-gray-200 dark:border-white/10 dark:bg-white/5 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </div>
          )}

          {/* 4. Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                <Toggle label={t('notifyLowStock')} name="notify_low_stock" checked={form.notify_low_stock} onChange={handleChange} />
                <Input label={t('notifyLowStockDays')} name="notify_low_stock_days" type="number" value={form.notify_low_stock_days} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center bg-gray-50 p-4 rounded-xl border border-gray-100">
                <Toggle label={t('notifyDealsClosing')} name="notify_deals_closing" checked={form.notify_deals_closing} onChange={handleChange} />
                <Input label={t('notifyDealsClosingDays')} name="notify_deals_closing_days" type="number" value={form.notify_deals_closing_days} onChange={handleChange} />
              </div>
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                <Toggle label={t('notifyOverdueInvoices')} name="notify_overdue_invoices" checked={form.notify_overdue_invoices} onChange={handleChange} />
                <Toggle label={t('notifyPayroll')} name="notify_payroll" checked={form.notify_payroll} onChange={handleChange} />
              </div>
            </div>
          )}

          {activeTab === 'ai' && (
            <div className="space-y-6">
              <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
                <div className="flex items-center gap-2 text-orange-700 font-bold mb-2">
                  <Cpu size={18} />
                  <h3>إعدادات Groq AI</h3>
                </div>
                <p className="text-sm text-orange-600">
                  يرجى إدخال مفتاح API الخاص بـ <strong>Groq Cloud</strong> لتفعيل ميزات الذكاء الاصطناعي الفائقة. النظام الآن يستخدم محرك <strong>Llama 3</strong>.
                </p>
              </div>

              <div className="space-y-4">
                <Input 
                  label="Groq API Key" 
                  name="gemini_api_key" 
                  type="password"
                  value={form.gemini_api_key || ''} 
                  onChange={handleChange}
                  placeholder="gsk_..."
                />
                <p className="text-xs text-gray-400">
                  يمكنك الحصول على مفتاح API مجاني من <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-orange-600 underline">Groq Cloud Console</a>.
                </p>
              </div>
            </div>
          )}

          {/* 5. User Management */}
          {activeTab === 'users' && isManagerOrAdmin && (
            <div>
              <p className="text-sm text-gray-500 mb-4">{t('userManagementSubtitle')}</p>
              <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm text-start">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      <th className="px-4 py-3">{t('name')}</th>
                      <th className="px-4 py-3">{t('email')}</th>
                      <th className="px-4 py-3">{t('role')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium text-gray-800">{u.name}</td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          {u.id === employee?.id ? (
                            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">{t(u.role?.toLowerCase() || 'employee')} (You)</span>
                          ) : (
                            <select value={u.role?.toLowerCase() || 'employee'} onChange={(e) => updateUserRole(u.id, e.target.value)}
                              className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white">
                              {ROLES.map(r => <option key={r} value={r}>{t(r)}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Save Button (Not in Users Tab) */}
          {activeTab !== 'users' && (
            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-end">
              <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-70">
                {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={16} />}
                {t('save')}
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
