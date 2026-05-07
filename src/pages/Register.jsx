import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Link, useNavigate } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'
import toast from 'react-hot-toast'
import { UserPlus, Mail, Lock, User, Phone, ArrowRight, Building2, Loader2 } from 'lucide-react'

export default function Register() {
  const { settings } = useSettings()
  const navigate = useNavigate()
  
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' })
  const [loading, setLoading] = useState(false)

  async function handleRegister(e) {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Sign up user via Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      })
      if (signUpError) throw signUpError

      // 2. Add or Update employee record with Pending role
      if (data.user) {
        // Check if employee already exists (e.g. pre-added by Admin)
        const { data: existing } = await supabase.from('employees').select('id').eq('email', form.email).maybeSingle()
        
        if (existing) {
          // Update existing record
          const { error: dbError } = await supabase.from('employees').update({
            name: form.name,
            phone: form.phone,
            role: 'Pending',
            is_active: false,
            employee_type: 'monthly',
            basic_salary: 0,
            hire_date: new Date().toISOString().split('T')[0]
          }).eq('id', existing.id)
          if (dbError) throw dbError
        } else {
          // Insert new record
          const { error: dbError } = await supabase.from('employees').insert({
            name: form.name,
            email: form.email,
            phone: form.phone,
            role: 'Pending', 
            is_active: false,
            employee_type: 'monthly',
            basic_salary: 0,
            hire_date: new Date().toISOString().split('T')[0]
          })
          if (dbError) throw dbError
        }
      }

      toast.success('تم التسجيل بنجاح! بانتظار موافقة الإدارة.')
      navigate('/login')
    } catch (error) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-emerald-500/10 blur-[100px] rounded-full" />
      <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-indigo-500/10 blur-[100px] rounded-full" />
      
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-8 relative z-10 animate-fade-in-up">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          {settings?.logo_url ? (
            <img src={settings.logo_url} alt="Logo" className="h-16 w-auto object-contain mb-4 drop-shadow-sm" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mb-4">
              <Building2 size={32} />
            </div>
          )}
          <h1 className="text-2xl font-black text-gray-800">إنشاء حساب جديد</h1>
          <p className="text-sm text-gray-500 mt-2 text-center">أدخل بياناتك للانضمام إلى النظام</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 ms-1">الاسم الكامل</label>
            <div className="relative">
              <User size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-10 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                placeholder="الاسم الثلاثي" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 ms-1">رقم الهاتف</label>
            <div className="relative">
              <Phone size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="tel" required value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-10 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
                placeholder="01xxxxxxxxx" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 ms-1">البريد الإلكتروني</label>
            <div className="relative">
              <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-10 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                placeholder="employee@company.com" dir="ltr" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-600 mb-1.5 ms-1">كلمة المرور</label>
            <div className="relative">
              <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} minLength={6}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-10 py-3 text-sm focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-left"
                placeholder="••••••••" dir="ltr" />
            </div>
          </div>

          <button disabled={loading} type="submit"
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-3 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-70 mt-2 shadow-lg shadow-emerald-500/20">
            {loading ? <Loader2 size={18} className="animate-spin" /> : (
              <>
                إنشاء حساب <ArrowRight size={18} className="rotate-180" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-gray-500 border-t border-gray-100 pt-6">
          لديك حساب بالفعل؟{' '}
          <Link to="/login" className="text-emerald-600 font-bold hover:underline">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  )
}
