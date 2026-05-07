import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { initAI, generateSQL } from '../lib/ai'
import toast from 'react-hot-toast'
import {
  Building2, Upload, FileText, CreditCard, Bell, Users, Save, Image, Shield, Calculator, Cpu, MapPin, Trash2, Plus, X, Check, ListPlus, Terminal, Play, AlertCircle, Database, Lock, Unlock, Key, Sparkles, Volume2
} from 'lucide-react'
import Modal from '../components/Modal'

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

const SoundUploader = ({ title, subtitle, icon, colorClass, url, inputRef, onUpload, uploadLogo, isRTL }) => (
  <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-white/10 rounded-2xl p-6 shadow-sm">
    <div className="flex items-center gap-3 mb-6">
      <div className={`p-3 ${colorClass} rounded-xl`}>
        {icon}
      </div>
      <div>
        <h3 className="font-bold text-gray-800 dark:text-gray-100">{title}</h3>
        <p className="text-xs text-gray-500">{subtitle}</p>
      </div>
    </div>

    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="flex flex-col items-center gap-2">
        <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 group relative overflow-hidden">
          <Volume2 size={32} />
          <button 
            onClick={() => inputRef.current?.click()}
            className="absolute inset-0 bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Upload size={18} />
          </button>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'نغمة مخصصة' : 'Custom Tone'}</span>
      </div>

      <div className="flex-1 w-full space-y-4">
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          accept="audio/*"
          onChange={async (e) => {
            const file = e.target.files?.[0]
            if (!file) return
            toast.loading(isRTL ? 'جاري رفع الملف الصوتي...' : 'Uploading sound...', { id: 'sound-up' })
            const { success, url, error } = await uploadLogo(file)
            if (success) {
              onUpload(url)
              toast.success(isRTL ? 'تم رفع النغمة بنجاح' : 'Sound uploaded', { id: 'sound-up' })
            } else {
              toast.error(error, { id: 'sound-up' })
            }
          }}
        />
        
        <div className="flex items-center gap-3">
          <audio controls src={url} className="h-8 flex-1" key={url} />
          <button 
            onClick={() => inputRef.current?.click()}
            className="bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 transition-all"
          >
            {isRTL ? 'تغيير الملف' : 'Change File'}
          </button>
        </div>
      </div>
    </div>
  </div>
)

export default function Settings() {
  const { settings, updateSettings, uploadLogo } = useSettings()
  const { t, lang, setLang, isRTL } = useLang()
  const { employee, isAdmin, normalizedRole } = useAuth()
  const isManagerOrAdmin = isAdmin || normalizedRole === 'manager'
  
  const [activeTab, setActiveTab] = useState('company')
  const [stations, setStations] = useState([])
  const [saving, setSaving] = useState(false)
  
  // SQL Terminal State
  const [sqlQuery, setSqlQuery] = useState('')
  const [sqlResult, setSqlResult] = useState(null)
  const [executingSql, setExecutingSql] = useState(false)
  const [form, setForm] = useState({})
  const [users, setUsers] = useState([])
  const [isAddingStation, setIsAddingStation] = useState(false)
  const [newStationName, setNewStationName] = useState('')
  const fileInputRef = useRef(null)
  const sidebarFileInputRef = useRef(null)
  const stampFileInputRef = useRef(null)
  const watermarkFileInputRef = useRef(null)
  const soundFileInputRef = useRef(null)
  const chatSoundInputRef = useRef(null)
  const taskSoundInputRef = useRef(null)

  // AI SQL Gen State
  const [naturalSqlPrompt, setNaturalSqlPrompt] = useState('')
  const [generatingSql, setGeneratingSql] = useState(false)

  // Advanced Fields State
  const [fieldModal, setFieldModal] = useState(false)
  const [fieldTargetEntity, setFieldTargetEntity] = useState('clients')
  const [fieldForm, setFieldForm] = useState({ id: '', label_ar: '', label_en: '', type: 'text', required: false, options: '' })
  const [editingFieldIndex, setEditingFieldIndex] = useState(null)

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
    ...(isAdmin || normalizedRole === 'manager' ? [
      { id: 'custom_fields', icon: ListPlus, label: 'الحقول الإضافية' },
      { id: 'users', icon: Users, label: t('userManagement') },
    ] : []),
    ...(isAdmin ? [
      { id: 'roles', icon: Shield, label: 'الصلاحيات المخصصة' },
      { id: 'terminal', icon: Terminal, label: isRTL ? 'منفذ الأوامر SQL' : 'SQL Terminal' }
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
                <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">الحقول الإضافية المتقدمة</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">إضافة حقول بيانات احترافية (نصوص، أرقام، تواريخ) مع دعم اللغتين والتحقق من البيانات.</p>
              </div>

              {['clients', 'suppliers', 'employees'].map(entity => {
                const entityLabels = { clients: 'العملاء', suppliers: 'الموردين', employees: 'الموظفين' }
                const schema = form.custom_fields_schema || {}
                const fields = schema[entity] || []

                const openFieldModal = (f = null, index = null) => {
                  setFieldTargetEntity(entity)
                  if (f) {
                    setFieldForm({ ...f, options: f.options?.join(', ') || '' })
                    setEditingFieldIndex(index)
                  } else {
                    setFieldForm({ id: '', label_ar: '', label_en: '', type: 'text', required: false, options: '' })
                    setEditingFieldIndex(null)
                  }
                  setFieldModal(true)
                }

                const removeField = (index) => {
                  if (!confirm('هل أنت متأكد من حذف هذا الحقل؟ سيؤدي هذا لإخفائه من النظام.')) return
                  const newFields = [...fields]
                  newFields.splice(index, 1)
                  const newSchema = { ...schema, [entity]: newFields }
                  setForm(prev => ({ ...prev, custom_fields_schema: newSchema }))
                }

                return (
                  <div key={entity} className="bg-gray-50 dark:bg-white/5 p-4 rounded-2xl border border-gray-200 dark:border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600">
                          <ListPlus size={16} />
                        </div>
                        <h4 className="font-bold text-gray-700 dark:text-gray-200">حقول {entityLabels[entity]}</h4>
                      </div>
                      <button onClick={() => openFieldModal()} className="text-xs bg-emerald-600 text-white px-4 py-2 rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-1 shadow-sm shadow-emerald-500/10">
                        <Plus size={14} /> إضافة حقل
                      </button>
                    </div>
                    {fields.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-xl">
                        <p className="text-xs text-gray-400">لا توجد حقول مخصصة لهذا القسم.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {fields.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 px-4 py-3 rounded-xl hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all group">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-gray-50 dark:bg-white/5 rounded-lg text-gray-400">
                                {f.type === 'number' ? <Calculator size={14} /> : f.type === 'date' ? <MapPin size={14} /> : <FileText size={14} />}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{isRTL ? f.label_ar : f.label_en}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-gray-400 font-mono">{f.id}</span>
                                  <span className="text-[10px] bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded text-gray-500">{f.type}</span>
                                  {f.required && <span className="text-[10px] text-red-500 font-bold">مطلوب</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openFieldModal(f, idx)} className="p-1.5 text-gray-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg">
                                <Pencil size={14} />
                              </button>
                              <button onClick={() => removeField(idx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}

              <Modal open={fieldModal} onClose={() => setFieldModal(false)} title={editingFieldIndex !== null ? 'تعديل حقل' : 'إضافة حقل جديد'}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                      <label className="block text-xs font-bold text-gray-500 mb-1">المعرف البرمجي (ID) - إنجليزي فقط</label>
                      <input 
                        disabled={editingFieldIndex !== null}
                        value={fieldForm.id} 
                        onChange={e => setFieldForm(p => ({ ...p, id: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                        placeholder="e.g. passport_number"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">الاسم بالعربي</label>
                      <input 
                        value={fieldForm.label_ar} 
                        onChange={e => setFieldForm(p => ({ ...p, label_ar: e.target.value }))}
                        placeholder="مثلاً: رقم الجواز"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">الاسم بالإنجليزي</label>
                      <input 
                        value={fieldForm.label_en} 
                        onChange={e => setFieldForm(p => ({ ...p, label_en: e.target.value }))}
                        placeholder="e.g. Passport Number"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1">نوع الحقل</label>
                      <select 
                        value={fieldForm.type} 
                        onChange={e => setFieldForm(p => ({ ...p, type: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                      >
                        <option value="text">نص (Text)</option>
                        <option value="number">رقم (Number)</option>
                        <option value="date">تاريخ (Date)</option>
                        <option value="select">قائمة اختيارات (Select)</option>
                        <option value="checkbox">خانة اختيار (Checkbox)</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input 
                        type="checkbox" 
                        id="field_required"
                        checked={fieldForm.required} 
                        onChange={e => setFieldForm(p => ({ ...p, required: e.target.checked }))}
                        className="w-4 h-4 accent-emerald-500"
                      />
                      <label htmlFor="field_required" className="text-sm font-medium text-gray-700 dark:text-gray-300">حقل مطلوب</label>
                    </div>
                  </div>

                  {fieldForm.type === 'select' && (
                    <div className="animate-fade-in">
                      <label className="block text-xs font-bold text-gray-500 mb-1">الخيارات (افصل بينها بفاصلة)</label>
                      <textarea 
                        value={fieldForm.options} 
                        onChange={e => setFieldForm(p => ({ ...p, options: e.target.value }))}
                        placeholder="خيار 1, خيار 2, خيار 3"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all h-20"
                      />
                    </div>
                  )}

                  <div className="flex gap-2 pt-4">
                    <button 
                      onClick={() => {
                        if (!fieldForm.id || !fieldForm.label_ar) return toast.error('المعرف والاسم العربي مطلوبين')
                        const schema = form.custom_fields_schema || {}
                        const fields = schema[fieldTargetEntity] || []
                        const finalField = {
                          ...fieldForm,
                          options: fieldForm.type === 'select' ? fieldForm.options.split(',').map(s => s.trim()).filter(Boolean) : null
                        }
                        
                        let newFields
                        if (editingFieldIndex !== null) {
                          newFields = [...fields]
                          newFields[editingFieldIndex] = finalField
                        } else {
                          if (fields.some(f => f.id === fieldForm.id)) return toast.error('هذا المعرف مستخدم بالفعل')
                          newFields = [...fields, finalField]
                        }
                        
                        setForm(p => ({ ...p, custom_fields_schema: { ...schema, [fieldTargetEntity]: newFields } }))
                        setFieldModal(false)
                      }}
                      className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all"
                    >
                      حفظ الحقل
                    </button>
                    <button onClick={() => setFieldModal(false)} className="px-6 py-3 border border-gray-200 dark:border-white/10 rounded-xl text-gray-500 hover:bg-gray-50 dark:hover:bg-white/5 font-bold transition-all">إلغاء</button>
                  </div>
                </div>
              </Modal>
            </div>
          )}

          {/* Roles & Permissions Settings */}
          {activeTab === 'roles' && isAdmin && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">الصلاحيات المخصصة (RBAC)</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">أنشئ مسميات وظيفية جديدة وحدد الصفحات المسموح لكل وظيفة برؤيتها.</p>
                </div>
                <button onClick={() => {
                  const roleName = window.prompt('أدخل المسمى الوظيفي الجديد (مثال: مراقب جودة):')
                  if (!roleName) return
                  const currentRoles = form.dynamic_roles || {}
                  if (currentRoles[roleName]) return toast.error('هذا المسمى موجود بالفعل')
                  setForm(prev => ({ ...prev, dynamic_roles: { ...currentRoles, [roleName]: ['profile', 'tasks', 'chat'] } }))
                }} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2">
                  <Plus size={16} /> إضافة وظيفة
                </button>
              </div>

              {Object.keys(form.dynamic_roles || {}).length === 0 ? (
                <div className="text-center py-12 text-gray-400">لا توجد وظائف مخصصة حالياً. اضغط على إضافة وظيفة للبدء.</div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(form.dynamic_roles || {}).map(([roleName, permissions]) => {
                    const togglePermission = (page) => {
                      const currentRoles = form.dynamic_roles || {}
                      const currentPerms = currentRoles[roleName] || []
                      const newPerms = currentPerms.includes(page) ? currentPerms.filter(p => p !== page) : [...currentPerms, page]
                      setForm(prev => ({ ...prev, dynamic_roles: { ...currentRoles, [roleName]: newPerms } }))
                    }

                    const removeRole = () => {
                      if (!confirm(`تأكيد حذف وظيفة ${roleName}؟ (تأكد من عدم وجود موظفين يحملون هذه الوظيفة)`)) return
                      const currentRoles = { ...form.dynamic_roles }
                      delete currentRoles[roleName]
                      setForm(prev => ({ ...prev, dynamic_roles: currentRoles }))
                    }

                    const AVAILABLE_PAGES = [
                      { id: 'dashboard', label: 'لوحة التحكم' },
                      { id: 'employees', label: 'الموظفين' },
                      { id: 'attendance', label: 'الحضور' },
                      { id: 'clients', label: 'العملاء' },
                      { id: 'suppliers', label: 'الموردين' },
                      { id: 'products', label: 'المخزون' },
                      { id: 'deals', label: 'الصفقات' },
                      { id: 'invoices', label: 'الفواتير' },
                      { id: 'transactions', label: 'الخزينة' },
                      { id: 'payroll', label: 'الرواتب' },
                      { id: 'tasks', label: 'المهام' },
                      { id: 'chat', label: 'الدردشة' }
                    ]

                    return (
                      <div key={roleName} className="bg-gray-50 dark:bg-white/5 p-4 rounded-xl border border-gray-200 dark:border-white/10">
                        <div className="flex items-center justify-between mb-3 border-b border-gray-200 dark:border-white/10 pb-2">
                          <h4 className="font-bold text-gray-800 dark:text-emerald-400 text-lg">{roleName}</h4>
                          <button onClick={removeRole} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg"><Trash2 size={16} /></button>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                          {AVAILABLE_PAGES.map(page => (
                            <label key={page.id} className="flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" checked={(permissions || []).includes(page.id)} onChange={() => togglePermission(page.id)}
                                className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                              <span className="text-sm text-gray-700 dark:text-gray-300">{page.label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
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
            <div className="space-y-6 animate-fade-in">
              {/* Toggle Alerts Section */}
              <div className="bg-white dark:bg-gray-950 border border-gray-100 dark:border-white/10 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-3 bg-blue-100 dark:bg-blue-500/20 text-blue-600 rounded-xl">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 dark:text-gray-100">{isRTL ? 'تنبيهات النظام' : 'System Alerts'}</h3>
                    <p className="text-xs text-gray-500">{isRTL ? 'تحكم في الإشعارات التلقائية التي تظهر للمديرين' : 'Manage automatic alerts'}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Toggle label={isRTL ? 'تنبيه نقص المخزون' : 'Low Stock Alert'} name="notify_low_stock" checked={form.notify_low_stock} onChange={handleChange} />
                  <Toggle label={isRTL ? 'تنبيه قرب انتهاء الصفقات' : 'Deals Closing Alert'} name="notify_deals_closing" checked={form.notify_deals_closing} onChange={handleChange} />
                  <Toggle label={isRTL ? 'تنبيه الفواتير المتأخرة' : 'Overdue Invoices Alert'} name="notify_overdue_invoices" checked={form.notify_overdue_invoices} onChange={handleChange} />
                  <Toggle label={isRTL ? 'تنبيه أعياد الميلاد' : 'Birthday Alerts'} name="notify_birthdays" checked={form.notify_birthdays} onChange={handleChange} />
                </div>
              </div>

              {/* Sound Customization Section */}
              <div className="grid grid-cols-1 gap-6">
                
                {/* 1. System Alerts Sound */}
                <SoundUploader 
                  title={isRTL ? 'نغمة إشعارات النظام' : 'System Alerts Sound'}
                  subtitle={isRTL ? 'نقص المخزون، الفواتير، المواليد...' : 'Stock, Invoices, Birthdays...'}
                  icon={<Bell size={20} />}
                  colorClass="bg-blue-100 text-blue-600"
                  url={form.notification_sound_url}
                  inputRef={soundFileInputRef}
                  onUpload={async (url) => setForm(f => ({ ...f, notification_sound_url: url }))}
                  uploadLogo={uploadLogo}
                  isRTL={isRTL}
                />

                {/* 2. Chat/Messages Sound */}
                <SoundUploader 
                  title={isRTL ? 'نغمة الشات والرسائل' : 'Chat & Messages Sound'}
                  subtitle={isRTL ? 'عند وصول رسالة جديدة في المحادثة' : 'When receiving new chat messages'}
                  icon={<MessageSquare size={20} />}
                  colorClass="bg-emerald-100 text-emerald-600"
                  url={form.chat_sound_url}
                  inputRef={chatSoundInputRef}
                  onUpload={async (url) => setForm(f => ({ ...f, chat_sound_url: url }))}
                  uploadLogo={uploadLogo}
                  isRTL={isRTL}
                />

                {/* 3. Tasks Sound */}
                <SoundUploader 
                  title={isRTL ? 'نغمة المهام الجديدة' : 'New Tasks Sound'}
                  subtitle={isRTL ? 'عند تعيين مهمة جديدة لأي موظف' : 'When a new task is assigned'}
                  icon={<Check size={20} />}
                  colorClass="bg-purple-100 text-purple-600"
                  url={form.task_sound_url}
                  inputRef={taskSoundInputRef}
                  onUpload={async (url) => setForm(f => ({ ...f, task_sound_url: url }))}
                  uploadLogo={uploadLogo}
                  isRTL={isRTL}
                />

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
                      <tr key={u.id} className="hover:bg-gray-50 group">
                        <td className="px-4 py-3 font-medium text-gray-800">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                            {u.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-500">{u.email}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {u.id === employee?.id ? (
                              <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded-md text-xs">{t(u.role?.toLowerCase() || 'employee')} (You)</span>
                            ) : (
                              <>
                                <select value={u.role || 'employee'} onChange={(e) => updateUserRole(u.id, e.target.value)}
                                  className="border border-gray-200 dark:border-white/10 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100">
                                  <optgroup label={isRTL ? "الوظائف الأساسية" : "Standard Roles"}>
                                    {ROLES.map(r => <option key={r} value={r}>{t(r)}</option>)}
                                    <option value="pending">Pending</option>
                                  </optgroup>
                                  {Object.keys(form.dynamic_roles || {}).length > 0 && (
                                    <optgroup label={isRTL ? "الوظائف المخصصة" : "Custom Roles"}>
                                      {Object.keys(form.dynamic_roles || {}).map(r => <option key={r} value={r}>{r}</option>)}
                                    </optgroup>
                                  )}
                                </select>
                                <button 
                                  onClick={async () => {
                                    if (!confirm(isRTL ? 'هل أنت متأكد من حذف هذا الموظف؟' : 'Are you sure you want to delete this employee?')) return
                                    const { error } = await supabase.from('employees').delete().eq('id', u.id)
                                    if (error) toast.error(error.message)
                                    else {
                                      toast.success(isRTL ? 'تم الحذف' : 'Deleted')
                                      setUsers(users.filter(x => x.id !== u.id))
                                    }
                                  }}
                                  className="p-1.5 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all"
                                  title={t('delete')}
                                >
                                  <Trash2 size={14} />
                                </button>
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

          {/* 6. SQL Terminal (Super Admin Only) */}
          {activeTab === 'terminal' && isAdmin && (
            <div className="space-y-6">
              <div className="bg-gray-900 rounded-2xl p-5 shadow-2xl border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <Terminal size={20} />
                    <h3>SQL Console (Super Admin)</h3>
                  </div>
                  
                  {/* AI SQL Assistant (NEW) */}
                  <div className="flex items-center gap-2 flex-1 mx-8">
                    <input 
                      value={naturalSqlPrompt}
                      onChange={e => setNaturalSqlPrompt(e.target.value)}
                      placeholder="أوصف اللي عايز تعمله بالعربي (مثلاً: هات آخر 5 موظفين)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-300 focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <button 
                      onClick={async () => {
                        if (!naturalSqlPrompt.trim()) return
                        setGeneratingSql(true)
                        try {
                          const schema = "Tables: employees(id, name, email, role, is_active), clients(id, name, email, phone), suppliers(id, name), products(id, name, stock_quantity), transactions(id, type, amount, date), deals(id, status, total_amount), attendance(id, date, status)"
                          const sql = await generateSQL(naturalSqlPrompt, schema)
                          setSqlQuery(sql)
                          toast.success('تم توليد الكود بنجاح')
                        } catch (e) {
                          toast.error('فشل توليد الكود')
                        } finally {
                          setGeneratingSql(false)
                        }
                      }}
                      disabled={generatingSql}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-[10px] font-bold flex items-center gap-2 disabled:opacity-50"
                    >
                      {generatingSql ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Sparkles size={12} />}
                      AI SQL
                    </button>
                  </div>

                  <button 
                    onClick={async () => {
                      if (!sqlQuery.trim()) return
                      setExecutingSql(true)
                      try {
                        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sqlQuery })
                        if (error) throw error
                        setSqlResult(data)
                        toast.success('Command executed')
                      } catch (e) {
                        setSqlResult({ error: e.message })
                        toast.error('Execution failed')
                      } finally {
                        setExecutingSql(false)
                      }
                    }}
                    disabled={executingSql}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {executingSql ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Play size={14} />}
                    Run Query
                  </button>
                </div>
                
                <textarea 
                  value={sqlQuery}
                  onChange={e => setSqlQuery(e.target.value)}
                  placeholder="SELECT * FROM employees LIMIT 5; ..."
                  className="w-full h-40 bg-gray-950 text-emerald-400 font-mono text-sm p-4 rounded-xl border border-gray-800 focus:outline-none focus:ring-1 focus:ring-emerald-500 mb-4"
                />

                {sqlResult && (
                  <div className="bg-gray-950/50 rounded-xl border border-gray-800 p-4 overflow-x-auto">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">Query Result</span>
                      <button onClick={() => setSqlResult(null)} className="text-gray-500 hover:text-gray-300"><X size={14} /></button>
                    </div>
                    <pre className="text-xs text-gray-300 font-mono">
                      {JSON.stringify(sqlResult, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-xl border border-emerald-100 dark:border-emerald-800/50">
                  <h4 className="flex items-center gap-2 text-emerald-800 dark:text-emerald-400 font-bold mb-2 text-sm">
                    <Database size={16} />
                    Database Health
                  </h4>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-500/70 leading-relaxed">
                    This terminal allows running raw SQL directly against the database. Use with extreme caution. All actions are final and cannot be undone.
                  </p>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-100 dark:border-amber-800/50">
                  <h4 className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-bold mb-2 text-sm">
                    <AlertCircle size={16} />
                    Security Notice
                  </h4>
                  <p className="text-[10px] text-amber-600/70 dark:text-amber-500/70 leading-relaxed">
                    Only Super Admins can see this tab. If you share your account, you give full database access to the other person.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Save Button (Not in Users/Terminal Tab) */}
          {activeTab !== 'users' && activeTab !== 'terminal' && (
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
