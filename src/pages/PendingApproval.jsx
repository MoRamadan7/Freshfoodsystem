import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { LogOut, Clock, ShieldCheck, Mail } from 'lucide-react'

export default function PendingApproval() {
  const { user, employee, signOut, isAdmin } = useAuth()
  const { t, isRTL } = useLang()
  const navigate = useNavigate()

  useEffect(() => {
    if (employee?.is_active || isAdmin) {
      navigate('/', { replace: true })
    }
  }, [employee?.is_active, isAdmin, navigate])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="max-w-md w-full bg-white dark:bg-gray-900 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 p-8 text-center space-y-6 animate-fade-in">
        <div className="relative mx-auto w-20 h-20">
          <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping" />
          <div className="relative bg-emerald-500 rounded-full w-20 h-20 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Clock size={40} className="text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
            {isRTL ? 'قيد المراجعة' : 'Pending Approval'}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">
            {isRTL 
              ? `أهلاً بك يا ${user?.user_metadata?.full_name || 'موظفنا الجديد'}. حسابك قيد المراجعة حالياً من قبل الإدارة. سيتم تفعيل حسابك بمجرد الموافقة عليه.` 
              : `Hello ${user?.user_metadata?.full_name || 'New Employee'}. Your account is currently under review by the administration. You will be granted access once approved.`}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 py-4">
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
            <ShieldCheck className="text-emerald-500" size={20} />
            <div className="text-start">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{isRTL ? 'الأمان' : 'Security'}</p>
              <p className="text-[10px] text-gray-500">{isRTL ? 'بياناتك محمية ومشفرة' : 'Your data is protected and encrypted'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/10">
            <Mail className="text-blue-500" size={20} />
            <div className="text-start">
              <p className="text-xs font-bold text-gray-700 dark:text-gray-200">{isRTL ? 'التواصل' : 'Contact'}</p>
              <p className="text-[10px] text-gray-500">{isRTL ? 'سيصلك بريد عند التفعيل' : 'You will receive an email upon activation'}</p>
            </div>
          </div>
        </div>

        <button 
          onClick={signOut}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-white/5 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 rounded-xl font-bold transition-all"
        >
          <LogOut size={18} />
          {isRTL ? 'تسجيل الخروج' : 'Logout'}
        </button>
      </div>
    </div>
  )
}
