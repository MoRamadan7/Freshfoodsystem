import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import toast from 'react-hot-toast'
import { 
  User, Mail, Phone, Calendar, Clock, DollarSign, Image as ImageIcon, 
  Upload, Save, Award, Briefcase, Linkedin, Facebook, Instagram 
} from 'lucide-react'

export default function Profile() {
  const { employee, user } = useAuth()
  const { settings, formatCurrency, uploadLogo } = useSettings() // We can reuse uploadLogo since it uploads to company-assets
  const { t, isRTL } = useLang()

  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState({ 
    present: 0, absent: 0, overtime: 0, 
    dealsTotal: 0, dealsCount: 0, 
    totalCommission: 0, latestDeals: [] 
  })
  const [form, setForm] = useState({})
  const [financials, setFinancials] = useState([])
  const [payrollHistory, setPayrollHistory] = useState([])
  const [attHistory, setAttHistory] = useState([])
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (employee) {
      loadProfile()
      loadStats()
    }
  }, [employee])

  async function loadProfile() {
    const { data } = await supabase.from('employees').select('*').eq('id', employee.id).single()
    if (data) {
      setProfile(data)
      setForm({
        alt_phone: data.alt_phone || '',
        facebook_url: data.facebook_url || '',
        linkedin_url: data.linkedin_url || '',
        instagram_url: data.instagram_url || '',
        avatar_url: data.avatar_url || ''
      })
    }
  }

  async function loadStats() {
    // Attendance Stats for the current month
    const today = new Date()
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const startDate = `${monthStr}-01`
    const endDate = `${monthStr}-31`
    
    const { data: att } = await supabase.from('attendance')
      .select('status, daily_overtime')
      .eq('employee_id', employee.id)
      .gte('date', startDate)
      .lte('date', endDate)

    let present = 0, absent = 0, overtime = 0
    att?.forEach(a => {
      if (a.status === 'present') present++
      else if (a.status === 'absent') absent++
      overtime += Number(a.daily_overtime || 0)
    })

    let dealsCount = 0, dealsTotal = 0, totalCommission = 0
    let latestDeals = []
    
    if (employee?.role?.toLowerCase() === 'sales' || employee?.role === 'مبيعات') {
      const { data: deals } = await supabase.from('deals')
        .select('*, products(product_name)')
        .eq('employee_id', employee.id)
        .order('created_at', { ascending: false })
      
      latestDeals = deals || []
      const wonDeals = latestDeals.filter(d => d.status === 'won')
      dealsCount = wonDeals.length
      dealsTotal = wonDeals.reduce((s, d) => s + Number(d.total_amount), 0)
      totalCommission = wonDeals.reduce((s, d) => s + (Number(d.total_amount) * (Number(d.commission_rate || 0) / 100)), 0)
    }

    setStats({ present, absent, overtime, dealsCount, dealsTotal, totalCommission, latestDeals })

    // Financial History (Advances/Deductions)
    const { data: tx } = await supabase.from('transactions')
      .select('*')
      .eq('employee_id', employee.id)
      .in('type', ['advance', 'deduction', 'salary'])
      .order('date', { ascending: false })
      .limit(10)
    setFinancials(tx || [])

    // Payroll Records
    const { data: pay } = await supabase.from('payroll_records')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'paid')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(6)
    setPayrollHistory(pay || [])

    // Detailed Attendance
    const { data: attDetail } = await supabase.from('attendance')
      .select('*')
      .eq('employee_id', employee.id)
      .order('date', { ascending: false })
      .limit(15)
    setAttHistory(attDetail || [])
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 10 * 1024 * 1024) return toast.error(isRTL ? 'الصورة كبيرة جداً' : 'Image is too large')
    
    const toastId = toast.loading(isRTL ? 'جاري الرفع...' : 'Uploading...')
    const { success, url, error } = await uploadLogo(file) // Reuse upload function
    
    if (success) {
      const { error: dbError } = await supabase.from('employees').update({ avatar_url: url }).eq('id', employee.id)
      if (dbError) {
        toast.error(dbError.message, { id: toastId })
      } else {
        setForm(prev => ({ ...prev, avatar_url: url }))
        setProfile(prev => ({ ...prev, avatar_url: url }))
        toast.success(isRTL ? 'تم تحديث الصورة' : 'Avatar updated', { id: toastId })
      }
    } else {
      toast.error(error || (isRTL ? 'فشل الرفع' : 'Upload failed'), { id: toastId })
    }
  }

  async function saveLinks() {
    setSaving(true)
    const { error } = await supabase.from('employees').update({
      alt_phone: form.alt_phone,
      facebook_url: form.facebook_url,
      linkedin_url: form.linkedin_url,
      instagram_url: form.instagram_url,
    }).eq('id', employee.id)

    if (error) toast.error(error.message)
    else toast.success(isRTL ? 'تم حفظ بيانات التواصل' : 'Contact info saved')
    setSaving(false)
  }

  if (!profile) return null

  return (
    <div className="max-w-5xl mx-auto space-y-6" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Header Profile Card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 md:p-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative group">
            <div className="w-28 h-28 rounded-2xl bg-gray-100 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 flex items-center justify-center overflow-hidden">
              {form.avatar_url ? (
                <img src={form.avatar_url} alt={profile.name} className="w-full h-full object-cover" />
              ) : (
                <User size={40} className="text-gray-400" />
              )}
            </div>
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <Upload size={24} className="text-white" />
            </div>
            <input type="file" ref={fileInputRef} className="hidden" accept="image/png, image/jpeg" onChange={handleAvatarUpload} />
          </div>

          <div className="flex-1 text-center md:text-start space-y-2">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{profile.name}</h1>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 text-sm text-gray-500 dark:text-gray-400">
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 px-2 py-1 rounded-md font-medium">
                <Briefcase size={14} /> {t(profile.role?.toLowerCase() || 'employee')}
              </span>
              <span className="flex items-center gap-1"><Mail size={14} /> {profile.email}</span>
              {profile.phone && <span className="flex items-center gap-1"><Phone size={14} /> {profile.phone}</span>}
              {profile.hire_date && <span className="flex items-center gap-1"><Calendar size={14} /> {isRTL ? 'تعيين:' : 'Hired:'} {profile.hire_date}</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Col: Read-Only Work Stats */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{isRTL ? 'ملخص الشهر الحالي' : 'Current Month Summary'}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{isRTL ? 'أيام الحضور' : 'Present Days'}</p>
                <p className="text-xl font-bold text-emerald-600">{stats.present}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{isRTL ? 'أيام الغياب' : 'Absent Days'}</p>
                <p className="text-xl font-bold text-red-500">{stats.absent}</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                <p className="text-xs text-gray-500 mb-1">{isRTL ? 'ساعات الإضافي' : 'Overtime Hrs'}</p>
                <p className="text-xl font-bold text-blue-600">{stats.overtime}</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-100 dark:border-gray-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600">
                  <DollarSign size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">{isRTL ? 'الراتب الأساسي' : 'Basic Salary'}</p>
                  <p className="font-bold text-gray-800 dark:text-gray-200">
                    {profile.employee_type === 'daily' 
                      ? `${formatCurrency(profile.daily_rate)} / ${isRTL ? 'يوم' : 'day'}`
                      : formatCurrency(profile.basic_salary)}
                  </p>
                </div>
              </div>

              {(profile.role === 'Sales' || profile.role === 'sales') && (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600">
                    <Award size={20} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{isRTL ? 'مبيعات محققة' : 'Won Deals Total'}</p>
                    <p className="font-bold text-gray-800 dark:text-gray-200">{formatCurrency(stats.dealsTotal)} ({stats.dealsCount})</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Financial History Table */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{isRTL ? 'السلف والخصومات' : 'Advances & Deductions'}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 text-xs">
                  <tr>
                    <th className="text-start p-3">{t('date')}</th>
                    <th className="text-start p-3">{t('type')}</th>
                    <th className="text-start p-3">{t('amount')}</th>
                    <th className="text-start p-3">{t('notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {financials.filter(f => f.type !== 'salary').map((f, i) => (
                    <tr key={i}>
                      <td className="p-3 text-gray-600 dark:text-gray-400">{f.date}</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          f.type === 'advance' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {t(f.type)}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-gray-800 dark:text-gray-200">{formatCurrency(f.amount)}</td>
                      <td className="p-3 text-gray-500 truncate max-w-[150px]">{f.notes || '—'}</td>
                    </tr>
                  ))}
                  {financials.filter(f => f.type !== 'salary').length === 0 && (
                    <tr><td colSpan="4" className="p-4 text-center text-gray-400 italic">{t('noData')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Payroll History */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{isRTL ? 'سجل الرواتب المصروفة' : 'Paid Payslips History'}</h2>
            <div className="space-y-3">
              {payrollHistory.map((p, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                  <div>
                    <p className="text-sm font-bold text-gray-800 dark:text-gray-200">{p.month} / {p.year}</p>
                    <p className="text-[10px] text-gray-500">{isRTL ? 'تاريخ الصرف:' : 'Paid on:'} {new Date(p.paid_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-end">
                    <p className="text-sm font-black text-emerald-600">{formatCurrency(p.net_salary)}</p>
                    <p className="text-[10px] text-gray-400">{isRTL ? 'صافي الراتب' : 'Net Salary'}</p>
                  </div>
                </div>
              ))}
              {payrollHistory.length === 0 && (
                <p className="p-4 text-center text-gray-400 italic">{t('noData')}</p>
              )}
            </div>
          </div>

          {/* Attendance History */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{isRTL ? 'سجل الحضور الأخير' : 'Recent Attendance Logs'}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 text-xs">
                  <tr>
                    <th className="px-4 py-3 font-medium text-start">{t('date')}</th>
                    <th className="px-4 py-3 font-medium text-start">{t('status')}</th>
                    <th className="px-4 py-3 font-medium text-start">{isRTL ? 'ساعات العمل' : 'Work Hours'}</th>
                    <th className="px-4 py-3 font-medium text-start">{t('overtime')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                  {attHistory.map((a, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{a.date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                          a.status === 'present' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {t(a.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {a.check_in && a.check_out ? (
                          (() => {
                            const start = new Date(`2000-01-01T${a.check_in}`)
                            const end = new Date(`2000-01-01T${a.check_out}`)
                            const diff = (end - start) / (1000 * 60 * 60)
                            return diff > 0 ? diff.toFixed(1) + ' ' + (isRTL ? 'س' : 'h') : '—'
                          })()
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200 font-bold">{a.daily_overtime || 0} {isRTL ? 'س' : 'h'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales Dashboard (Only for Sales Role) */}
          {(employee?.role?.toLowerCase() === 'sales' || employee?.role === 'مبيعات') && (
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 space-y-6">
              <h2 className="text-lg font-bold text-gray-800 dark:text-white flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 pb-2">
                <Award className="text-emerald-500" size={20} /> لوحة إنجازات المبيعات
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-emerald-600 p-4 rounded-xl text-white shadow-lg shadow-emerald-200 dark:shadow-none">
                  <p className="text-[10px] opacity-80 mb-1">إجمالي المبيعات المحققة</p>
                  <p className="text-xl font-black">{stats.dealsTotal.toLocaleString()} ج</p>
                  <div className="mt-2 text-[9px] bg-white/20 inline-block px-2 py-0.5 rounded-full">{stats.dealsCount} صفقة ناجحة</div>
                </div>
                
                <div className="bg-blue-600 p-4 rounded-xl text-white shadow-lg shadow-blue-200 dark:shadow-none">
                  <p className="text-[10px] opacity-80 mb-1">إجمالي العمولات المستحقة</p>
                  <p className="text-xl font-black">{stats.totalCommission.toLocaleString()} ج</p>
                  <p className="text-[9px] opacity-70 mt-1">تضاف تلقائياً لراتبك في كشف الشهر</p>
                </div>
              </div>

              <div className="border border-gray-50 dark:border-gray-800 rounded-xl overflow-hidden">
                <div className="p-3 bg-gray-50 dark:bg-white/5 border-b border-gray-50 dark:border-gray-800 flex justify-between items-center">
                  <h3 className="font-bold text-gray-700 dark:text-gray-200 text-xs">آخر العمليات التي قمت بها</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-500">
                      <tr>
                        <th className="text-right px-4 py-2">المنتج والكمية</th>
                        <th className="text-right px-4 py-2">القيمة</th>
                        <th className="text-right px-4 py-2">العمولة</th>
                        <th className="text-right px-4 py-2">الحالة</th>
                        <th className="text-right px-4 py-2">التاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                      {stats.latestDeals?.map(d => (
                        <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                          <td className="px-4 py-2">
                            <p className="font-bold text-gray-800 dark:text-gray-100">{d.products?.product_name || '—'}</p>
                            <p className="text-gray-400 text-[9px]">{d.quantity} {d.unit}</p>
                          </td>
                          <td className="px-4 py-2 font-bold text-gray-700 dark:text-gray-300">{Number(d.total_amount).toLocaleString()} ج</td>
                          <td className="px-4 py-2 text-emerald-600 font-bold">{(Number(d.total_amount) * (Number(d.commission_rate || 0) / 100)).toLocaleString()} ج</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              d.status === 'won' ? 'bg-emerald-100 text-emerald-700' : 
                              d.status === 'contracted' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                            }`}>{d.status}</span>
                          </td>
                          <td className="px-4 py-2 text-gray-400">{d.created_date}</td>
                        </tr>
                      ))}
                      {stats.latestDeals?.length === 0 && (
                        <tr><td colSpan={5} className="text-center py-6 text-gray-400 italic">لا توجد صفقات مسجلة بعد.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Col: Editable Contact Info */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">{isRTL ? 'تحديث بيانات التواصل' : 'Update Contact Info'}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">{isRTL ? 'رقم هاتف إضافي' : 'Alt Phone'}</label>
                <div className="relative">
                  <Phone size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.alt_phone} onChange={e => setForm({ ...form, alt_phone: e.target.value })}
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Facebook</label>
                <div className="relative">
                  <Facebook size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.facebook_url} onChange={e => setForm({ ...form, facebook_url: e.target.value })} placeholder="https://facebook.com/..."
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">LinkedIn</label>
                <div className="relative">
                  <Linkedin size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..."
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Instagram</label>
                <div className="relative">
                  <Instagram size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={form.instagram_url} onChange={e => setForm({ ...form, instagram_url: e.target.value })} placeholder="https://instagram.com/..."
                    className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-lg ps-9 pe-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 focus:outline-none" />
                </div>
              </div>
            </div>

            <button onClick={saveLinks} disabled={saving}
              className="w-full mt-6 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
              <Save size={16} /> {isRTL ? 'حفظ التعديلات' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
