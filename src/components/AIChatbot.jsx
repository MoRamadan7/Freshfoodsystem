import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send, X, Minimize2, Maximize2, Mic, MicOff, Volume2, Sparkles, MessageSquare, Info } from 'lucide-react'
import { askAI } from '../lib/ai'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function AIChatbot() {
  const navigate = useNavigate()
  const { employee, canAccess } = useAuth()
  const { settings } = useSettings()
  const { lang, isRTL } = useLang()
  
  const welcomeMsg = lang === 'ar'
    ? 'أهلاً بيك يا ريس! معاك "حمادة" شريكك في البيزنس. أؤمرني، تحب نفتح صفحة معينة؟ ولا محتاجني أحللك شوية بيانات؟ أنا معاك في أي حاجة حتى لو عايز تدردش!'
    : 'Welcome boss! I am Hamada, your business partner. Need me to open a page, analyze data, or just have a chat? I am here for you!'

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: welcomeMsg, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const scrollRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  const getSystemContext = async () => {
    const { count: clientsCount } = await supabase.from('clients').select('*', { count: 'exact', head: true })
    const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
    const { count: dealsCount } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    
    return `
      Company Name: ${settings.company_name}
      Current User: ${employee?.name} (Role: ${employee?.role})
      Current Stats:
      - Total Clients: ${clientsCount || 0}
      - Total Products: ${productsCount || 0}
      - Total Deals: ${dealsCount || 0}
      
      AVAILABLE PAGES & PATHS:
      - Dashboard (الرئيسية): /
      - Employees (الموظفين/المناديب): /employees
      - Attendance (الحضور والانصراف): /attendance
      - Clients (العملاء): /clients
      - Products (المنتجات/المخزن): /products
      - Deals (الصفقات/المبيعات): /deals
      - Invoices (الفواتير): /invoices
      - Transactions (الخزنة/الحسابات): /transactions
      - Payroll (المرتبات): /payroll
      - Suppliers (الموردين): /suppliers
      - Settings (الاعدادات): /settings
      - Profile (الملف الشخصي): /profile
      - Activity Logs (النشاطات): /activity
      - Tasks (المهام): /tasks
      - Chat (التواصل/الشات): /chat
    `;
  }

  // Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition()
      recognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US'
      recognition.onresult = (e) => {
        const t = e.results[0][0].transcript
        handleSend(t)
      }
      recognition.onend = () => setIsListening(false)
      recognitionRef.current = recognition
    }
  }, [lang])

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop()
    } else {
      setIsListening(true)
      recognitionRef.current?.start()
    }
  }
  
  const speak = (text) => {
    if (isMuted) return
    const synth = window.speechSynthesis
    if (synth) {
      synth.cancel()
      const ut = new SpeechSynthesisUtterance(text)
      ut.lang = lang === 'ar' ? 'ar-EG' : 'en-US'
      ut.rate = 1.1 // Slightly faster for natural feel
      synth.speak(ut)
    }
  }

  const handleSend = async (customInput = null) => {
    const userMsg = (customInput || input).trim()
    if (!userMsg || loading) return
    
    setInput('')
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    setMessages(prev => [...prev, { role: 'user', text: userMsg, time }])
    setLoading(true)

    try {
      const context = await getSystemContext()
      const result = await askAI(userMsg, context)
      
      const aiTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setMessages(prev => [...prev, { role: 'ai', text: result.text, time: aiTime }])
      speak(result.text)

      if (result.type === 'action') {
        const { command, path, search } = result.action || {}
        if (command === 'navigate' || command === 'search') {
          const targetPath = search ? `${path || '/clients'}?search=${encodeURIComponent(search)}` : path
          const page = path?.replace('/', '') || 'dashboard'
          
          if (canAccess(page) || path === '/' || path === '/profile' || command === 'search') {
            toast.success(lang === 'ar' ? 'من عينيا يا باشا...' : 'Executing...')
            setTimeout(() => navigate(targetPath), 800)
          } else {
            toast.error(lang === 'ar' ? 'للأسف ملكش صلاحية هنا' : 'Access Denied')
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: error.message || 'فيه مشكلة في الكلام دلوقتي.', time: '' }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-500 text-white rounded-full shadow-[0_8px_30px_rgb(16,185,129,0.4)] flex items-center justify-center hover:scale-110 active:scale-95 transition-all z-50 group border-4 border-white dark:border-gray-900"
      >
        <div className="relative">
          <Bot size={32} />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
        </div>
        <div className="absolute -top-12 right-0 bg-white dark:bg-gray-800 text-gray-800 dark:text-white px-3 py-1.5 rounded-xl shadow-xl text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none border border-gray-100 dark:border-gray-700">
          تحت أمرك يا هندسة! 👋
        </div>
      </button>
    )
  }

  return (
    <div className={`fixed right-6 bottom-6 w-[360px] sm:w-[400px] bg-white/90 dark:bg-gray-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white/20 flex flex-col z-50 transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) overflow-hidden ${isMinimized ? 'h-16' : 'h-[600px]'}`}>
      
      {/* Header with Glassmorphism */}
      <div className="p-4 bg-gradient-to-r from-emerald-600/90 to-teal-500/90 backdrop-blur-md text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30 shadow-inner">
              <Bot size={22} className="animate-bounce" />
            </div>
            <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-emerald-600 rounded-full" />
          </div>
          <div className="flex flex-col">
            <span className="font-black text-sm tracking-wide">الخبير "حمادة"</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${isListening ? 'bg-red-400 animate-ping' : 'bg-emerald-300'}`} />
              <span className="text-[10px] font-bold opacity-80 uppercase tracking-tighter">
                {isListening ? (isRTL ? 'بيسمعك...' : 'Listening...') : (isRTL ? 'جاهز لخدمتك' : 'AI Partner Online')}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsMuted(!isMuted)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            {isMuted ? <Volume2 size={16} className="opacity-40" /> : <Volume2 size={16} />}
          </button>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            {isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Chat Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 space-y-6 bg-gradient-to-b from-gray-50/30 to-white/30 dark:from-gray-800/20 dark:to-gray-900/20 scrollbar-hide">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`relative max-w-[85%] p-4 rounded-[2rem] text-sm shadow-xl transition-all hover:scale-[1.01] ${
                  m.role === 'user' 
                    ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-tr-none shadow-emerald-500/20' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-none border border-gray-100 dark:border-white/10 shadow-gray-200/50 dark:shadow-none'
                }`}>
                  {m.role === 'ai' && (
                    <div className="absolute -top-2 -left-2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-lg border-2 border-white dark:border-gray-900">
                      <Sparkles size={10} />
                    </div>
                  )}
                  <p className="leading-relaxed whitespace-pre-wrap font-medium">{m.text}</p>
                  {m.role === 'ai' && i === 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 grid grid-cols-2 gap-2">
                      <button onClick={() => handleSend('افتح الخزنة')} className="text-[10px] bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-1.5 rounded-lg hover:bg-emerald-100 transition-colors font-bold">💰 الخزنة</button>
                      <button onClick={() => handleSend('مين غايب؟')} className="text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 p-1.5 rounded-lg hover:bg-blue-100 transition-colors font-bold">📋 الحضور</button>
                    </div>
                  )}
                </div>
                <span className="text-[9px] text-gray-400 mt-1.5 font-medium px-2">{m.time}</span>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-pulse">
                <div className="bg-white dark:bg-gray-800 p-4 rounded-3xl rounded-tl-none shadow-sm border border-gray-100 dark:border-gray-700 flex gap-2 items-center">
                  <Sparkles size={14} className="text-emerald-500 animate-spin" />
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{isRTL ? 'حمادة بيفكر...' : 'Thinking...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Voice Wave (Visible when listening) */}
          {isListening && (
            <div className="h-12 bg-emerald-50/50 dark:bg-emerald-900/20 flex items-center justify-center gap-1 px-4">
              {[...Array(12)].map((_, i) => (
                <div 
                  key={i} 
                  className="w-1 bg-emerald-500 rounded-full animate-bounce" 
                  style={{ height: `${Math.random() * 80 + 20}%`, animationDelay: `${i * 0.1}s` }}
                />
              ))}
            </div>
          )}

          {/* Footer Input */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-md">
            <div className="flex gap-2 items-center bg-gray-100 dark:bg-gray-800 p-1.5 rounded-[2rem] border border-gray-200/50 dark:border-white/5 shadow-inner">
              <button 
                onClick={toggleListening}
                className={`p-3 rounded-full transition-all duration-300 ${isListening ? 'bg-red-500 text-white shadow-lg shadow-red-200 animate-pulse' : 'bg-white dark:bg-gray-700 text-gray-400 hover:text-emerald-600 shadow-sm'}`}
              >
                {isListening ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder={isRTL ? "أؤمرني يا هندسة..." : "Command me boss..."}
                className="flex-1 bg-transparent border-none px-2 py-2 text-sm focus:outline-none focus:ring-0 dark:text-white placeholder:text-gray-400 font-medium"
              />
              
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-emerald-600 text-white p-3 rounded-full hover:bg-emerald-700 transition-all disabled:opacity-40 shadow-lg shadow-emerald-500/20 active:scale-90"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
