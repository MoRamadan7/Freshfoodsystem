import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import NotificationBell from './NotificationBell'
import toast from 'react-hot-toast'
import {
  LayoutDashboard, Users, Clock, UserCheck, Package,
  Handshake, Wallet, Truck, Menu, X, LogOut, Settings,
  Globe, Building2, FileText, CreditCard, Mic, MicOff, Sun, Moon, User, Activity, ClipboardList, MessageSquare
} from 'lucide-react'

function NavItem({ to, icon: Icon, label, end, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 group ${
          isActive
            ? 'bg-emerald-500/20 text-emerald-300 font-medium'
            : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} className={`flex-shrink-0 transition-transform duration-200 group-hover:scale-110 ${isActive ? 'text-emerald-400' : ''}`} />
          <span className="truncate">{label}</span>
          {isActive && <div className="ms-auto w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />}
        </>
      )}
    </NavLink>
  )
}

function LangToggle({ compact = false }) {
  const { lang, setLang } = useLang()
  return (
    <button
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      title={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      className={`flex items-center gap-1.5 text-xs font-medium transition-all duration-200
        border rounded-lg px-2.5 py-1.5
        ${compact
          ? 'text-gray-400 border-gray-700 hover:border-emerald-500 hover:text-emerald-400 bg-transparent'
          : 'text-gray-500 border-gray-200 hover:border-emerald-400 hover:text-emerald-600 bg-gray-50 hover:bg-emerald-50 dark:bg-white/5 dark:border-white/10 dark:text-gray-400'
        }`}
    >
      <Globe size={13} />
      <span>{lang === 'ar' ? 'EN' : 'عر'}</span>
    </button>
  )
}

const SidebarContent = ({ mobile = false, settings, employee, t, isRTL, navItems, isAdmin, normalizedRole, setOpen, handleSignOut }) => {
  const isManagerOrAdmin = isAdmin || normalizedRole === 'manager'
  return (
  <aside className={`flex flex-col h-full bg-gray-900/95 backdrop-blur-xl border-e border-white/10 text-white shadow-2xl transition-all duration-300 ${mobile ? 'w-64' : 'w-64 hidden lg:flex'}`}>
    {/* Brand */}
    <div className="p-4 border-b border-white/10 flex-shrink-0">
      <div className="flex items-center gap-3">
        {settings.sidebar_logo_url ? (
          <div className="w-12 h-12 rounded-2xl overflow-hidden flex-shrink-0 bg-white/10 flex items-center justify-center border border-white/5">
            <img src={settings.sidebar_logo_url} alt="logo" className="w-full h-full object-contain p-1"
              onError={(e) => { e.target.style.display = 'none' }} />
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <Building2 size={18} className="text-emerald-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm text-white leading-tight truncate">
            {settings.company_name || t('dashboard')}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{t(employee?.role?.toLowerCase()) || t('employee')}</p>
        </div>
      </div>
    </div>

    {/* Navigation */}
    <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto custom-scrollbar">
      {navItems.map(({ to, icon, label, end }) => (
        <NavItem key={to} to={to} icon={icon} label={label} end={end} onClick={() => setOpen(false)} />
      ))}
      <div className="my-2 border-t border-white/5" />
      <NavItem to="/profile" icon={User} label={t('myProfile')} onClick={() => setOpen(false)} />
      {isManagerOrAdmin && (
        <NavItem to="/activity" icon={Activity} label={t('activityLogs')} onClick={() => setOpen(false)} />
      )}
      {isAdmin && (
        <NavItem to="/settings" icon={Settings} label={t('settings')} onClick={() => setOpen(false)} />
      )}
    </nav>

    {/* Footer */}
    <div className="p-3 border-t border-white/10 flex-shrink-0 space-y-2">
      <LangToggle compact />
      <div className="flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors">
        <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-sm font-bold text-emerald-400 flex-shrink-0">
          {employee?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-200 truncate">{employee?.name ?? t('user')}</p>
          <p className="text-xs text-gray-500 truncate">{employee?.email ?? ''}</p>
        </div>
      </div>
      <button
        onClick={handleSignOut}
        className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-200"
      >
        <LogOut size={15} />
        {t('signOut')}
      </button>
    </div>
  </aside>
  )
}

export default function Layout() {
  const { employee, signOut, isAdmin, normalizedRole, canAccess } = useAuth()
  const { settings } = useSettings()
  const { t, isRTL } = useLang()
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(new Date())
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme')
      if (saved) return saved === 'dark'
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

  const navigate = useNavigate()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    localStorage.setItem('theme', isDark ? 'dark' : 'light')
  }, [isDark])

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const [announcementIdx, setAnnouncementIdx] = useState(0)
  const announcements = settings?.announcement_text?.split('|').filter(t => t.trim()) || []

  useEffect(() => {
    if (announcements.length > 1) {
      const interval = setInterval(() => {
        setAnnouncementIdx(prev => (prev + 1) % announcements.length)
      }, 5000)
      return () => clearInterval(interval)
    }
  }, [announcements.length])

  const toggleDarkMode = () => setIsDark(!isDark)

  const formatDate = () => {
    return now.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { 
      weekday: 'short', day: 'numeric', month: 'short' 
    })
  }

  const formatTime = () => {
    return now.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { 
      hour: '2-digit', minute: '2-digit'
    })
  }

  const ALL_NAV_ITEMS = [
    { to: '/',             icon: LayoutDashboard, label: t('dashboard'),     page: 'dashboard',    end: true },
    { to: '/employees',    icon: Users,            label: t('employees'),     page: 'employees' },
    { to: '/attendance',   icon: Clock,            label: t('attendance'),    page: 'attendance' },
    { to: '/clients',      icon: UserCheck,        label: t('clients'),       page: 'clients' },
    { to: '/deals',        icon: Handshake,        label: t('deals'),         page: 'deals' },
    { to: '/invoices',     icon: FileText,         label: t('invoices'),      page: 'invoices' },
    { to: '/products',     icon: Package,          label: t('products'),      page: 'products' },
    { to: '/suppliers',    icon: Truck,            label: t('suppliers'),     page: 'suppliers' },
    { to: '/transactions', icon: Wallet,           label: t('transactions'),  page: 'transactions' },
    { to: '/payroll',      icon: CreditCard,       label: t('payroll'),       page: 'payroll' },
    { to: '/tasks',        icon: ClipboardList,    label: isRTL ? 'المهام' : 'Tasks', page: 'tasks' },
    { to: '/chat',         icon: MessageSquare,    label: isRTL ? 'التواصل' : 'Chat', page: 'chat' },
  ].filter(item => normalizedRole !== 'employee' && normalizedRole !== 'labor'
    ? canAccess(item.page)
    : item.page === 'tasks' || item.page === 'chat'
  )

  const navItems = ALL_NAV_ITEMS

  const [isListening, setIsListening] = useState(false)

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) return alert('Your browser does not support voice commands.')

    const recognition = new SpeechRecognition()
    recognition.lang = isRTL ? 'ar-EG' : 'en-US'
    recognition.start()
    setIsListening(true)

    recognition.onresult = (event) => {
      const command = event.results[0][0].transcript.toLowerCase()
      setIsListening(false)
      
      toast.success(isRTL ? `سمعت: "${command}"` : `Heard: "${command}"`, { icon: '🎙️', duration: 4000 })
      
      // Extended Voice Navigation Logic
      if (command.includes('اذهب') || command.includes('وديني') || command.includes('افتح') || command.includes('هات') || command.includes('go to') || command.includes('open')) {
        if (command.includes('موظفين') || command.includes('employees')) navigate('/employees')
        else if (command.includes('مخزن') || command.includes('منتجات') || command.includes('بضاعة') || command.includes('products')) navigate('/products')
        else if (command.includes('فواتير') || command.includes('invoices')) navigate('/invoices')
        else if (command.includes('رئيسية') || command.includes('لوحة التحكم') || command.includes('dashboard')) navigate('/')
        else if (command.includes('إعدادات') || command.includes('settings')) navigate('/settings')
        else if (command.includes('حضور') || command.includes('انصراف') || command.includes('attendance')) navigate('/attendance')
        else if (command.includes('عملاء') || command.includes('clients')) navigate('/clients')
        else if (command.includes('صفقات') || command.includes('deals')) navigate('/deals')
        else if (command.includes('موردين') || command.includes('suppliers')) navigate('/suppliers')
        else if (command.includes('خزنة') || command.includes('معاملات') || command.includes('transactions')) navigate('/transactions')
        else if (command.includes('رواتب') || command.includes('مرتبات') || command.includes('payroll')) navigate('/payroll')
      }
    }
    recognition.onerror = () => setIsListening(false)
    recognition.onend = () => setIsListening(false)
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden" dir={isRTL ? 'rtl' : 'ltr'}>
      <SidebarContent 
        settings={settings} employee={employee} t={t} isRTL={isRTL}
        navItems={navItems} isAdmin={isAdmin} normalizedRole={normalizedRole}
        setOpen={setOpen} handleSignOut={handleSignOut} 
      />

      {/* Mobile Overlay */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setOpen(false)} />
          <div className={`absolute top-0 h-full z-50 transition-transform duration-300 transform ${isRTL ? 'right-0 animate-slide-in-right' : 'left-0 animate-slide-in-left'}`}>
            <SidebarContent 
              mobile settings={settings} employee={employee} t={t} isRTL={isRTL}
              navItems={navItems} isAdmin={isAdmin} normalizedRole={normalizedRole}
              setOpen={setOpen} handleSignOut={handleSignOut} 
            />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50/50 dark:bg-gray-950/50">
        <header className="glass-panel sticky top-0 z-20 px-4 py-3 flex items-center gap-3 flex-shrink-0 transition-all duration-500">
          <button onClick={() => setOpen(true)} className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-colors text-gray-500 hover:scale-105 active:scale-95">
            <Menu size={18} />
          </button>

          {/* Logo Section */}
          <div className={`flex items-center gap-3 transition-all duration-500 ${settings.header_layout === 'centered' ? 'absolute left-1/2 -translate-x-1/2 hidden lg:flex' : 'flex-1 min-w-0'}`}>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt="logo" className="h-10 w-auto object-contain transition-transform hover:scale-110" />
            ) : (
              <Building2 size={24} className="text-emerald-600 lg:hidden" />
            )}
          </div>

          {/* Announcement Text (Animated) */}
          {announcements.length > 0 && (
            <div className={`flex-1 flex justify-center px-4 transition-all duration-500 ${settings.header_layout === 'centered' ? 'hidden sm:flex' : ''}`}>
              <p key={announcementIdx} className="text-sm font-bold bg-gradient-to-r from-emerald-600 to-indigo-600 bg-clip-text text-transparent animate-fade-in-up whitespace-nowrap overflow-hidden">
                ✨ {announcements[announcementIdx]}
              </p>
            </div>
          )}

          <div className={`flex items-center gap-3 ${isRTL ? 'me-auto' : 'ms-auto'} transition-all`}>
            <button onClick={toggleDarkMode} title={isDark ? 'Light Mode' : 'Dark Mode'}
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/50 dark:bg-white/5 text-gray-500 dark:text-gray-400 hover:text-emerald-600 transition-all">
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="hidden md:flex flex-col items-end me-2 text-[11px] font-medium text-gray-500 dark:text-gray-400 leading-tight">
              <span>{formatDate()}</span>
              <span className="text-emerald-600 font-bold">{formatTime()}</span>
            </div>
            <button onClick={startListening} title="Voice Commands"
              className={`flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 ${
                isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-white/50 hover:bg-gray-100 text-gray-500 hover:text-emerald-600'
              }`}>
              {isListening ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
            <div className="hidden lg:block animate-fade-in"><LangToggle /></div>
            <NotificationBell />
            {isAdmin && (
              <NavLink to="/settings"
                className={({ isActive }) =>
                  `hidden lg:flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 hover:rotate-90 ${
                    isActive ? 'bg-emerald-100 text-emerald-600 shadow-sm' : 'bg-white/50 hover:bg-gray-100 text-gray-500 hover:text-emerald-600 hover:shadow-md'
                  }`
                }
              >
                <Settings size={18} />
              </NavLink>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in-up">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
