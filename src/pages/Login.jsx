import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'

export default function Login() {
  const { signIn, signInWithGoogle, signUp, user } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (user) navigate('/')
  }, [user, navigate])

  const [mode, setMode] = useState('login') // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    
    if (mode === 'login') {
      const { error } = await signIn(email, password)
      if (error) toast.error('بيانات الدخول غير صحيحة')
      else navigate('/')
    } else {
      if (!name) {
        setLoading(false)
        return toast.error('يرجى إدخال الاسم بالكامل')
      }
      
      try {
        const { error, data } = await signUp(email, password, name)
        if (error) throw error

        // Attempt to insert into employees table
        if (data?.user) {
          await supabase.from('employees').insert({
             name: name,
             email: email,
             role: 'Pending',
             is_active: false
          })
        }
        
        toast.success('تم التسجيل! بانتظار موافقة الإدارة.')
        setMode('login')
      } catch (err) {
        toast.error(err.message)
      }
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-emerald-950 to-gray-900 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 sm:p-10 border border-white/20 dark:border-white/5 animate-fade-in">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="relative p-5 bg-gradient-to-tr from-emerald-100 to-white dark:from-emerald-900/40 dark:to-emerald-800/20 rounded-[2rem] shadow-xl ring-1 ring-emerald-100 dark:ring-white/10 group">
              <img src="/logo.png" alt="Logo" className="w-24 h-24 sm:w-28 sm:h-28 object-contain animate-float" />
            </div>
          </div>
          <h1 className="text-2xl font-black text-gray-800 dark:text-emerald-400 tracking-tight mb-1">FRESH FOOD</h1>
          <p className="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-widest">
            {mode === 'login' ? 'سجّل دخولك للمتابعة' : 'إنشاء حساب موظف جديد'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="animate-slide-down">
              <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] ms-1">الاسم بالكامل</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
                placeholder="أدخل اسمك الثلاثي" />
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] ms-1">البريد الإلكتروني</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
              placeholder="example@company.com" />
          </div>

          <div>
            <label className="block text-[10px] font-black text-gray-400 dark:text-gray-500 mb-1.5 uppercase tracking-[0.2em] ms-1">كلمة المرور</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              className="w-full bg-gray-50/50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
              placeholder="••••••••" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-black py-4 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all transform active:scale-95 text-sm mt-2">
            {loading ? 'جاري المعالجة...' : (mode === 'login' ? 'دخول النظام' : 'تأكيد التسجيل')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <Link 
            to="/register"
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            ليس لديك حساب؟ سجل الآن كموظف
          </Link>
        </div>

        {mode === 'login' && (
          <div className="mt-8">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100 dark:border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px]"><span className="px-3 bg-white dark:bg-gray-900 text-gray-400 font-bold uppercase tracking-widest">أو عبر</span></div>
            </div>

            <button onClick={(e) => { e.preventDefault(); signInWithGoogle(); }} disabled={loading}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-white dark:bg-white/5 hover:bg-gray-50 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 rounded-2xl py-3.5 transition-all text-xs font-bold text-gray-600 dark:text-gray-300"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google Account
            </button>
          </div>
        )}

        <p className="text-center text-[9px] font-bold text-gray-400 dark:text-gray-600 mt-10 uppercase tracking-[0.2em] leading-relaxed">
          The Global Egyptian Leader in <br/> Fresh Fruits & Vegetables Export
        </p>
      </div>
    </div>
  )
}
