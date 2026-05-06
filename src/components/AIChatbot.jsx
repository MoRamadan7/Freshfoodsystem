import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bot, Send, X, Minimize2, Maximize2, Mic, MicOff, Volume2 } from 'lucide-react'
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
    ? 'أهلاً بك! أنا مساعدك الذكي في Fresh Food. يمكنني مساعدتك في تحليل البيانات أو حتى فتح الصفحات بدلاً منك بالصوت! كيف يمكنني مساعدتك؟'
    : 'Hello! I am your AI assistant for Fresh Food. I can help with data or navigate the app via voice! How can I help?'

  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: welcomeMsg }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const scrollRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
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
      - Total Products in Stock: ${productsCount || 0}
      - Total Deals: ${dealsCount || 0}
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
      synth.speak(ut)
    }
  }

  const handleSend = async (customInput = null) => {
    const userMsg = (customInput || input).trim()
    if (!userMsg || loading) return
    
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const context = await getSystemContext()
      const result = await askAI(userMsg, context)
      
      setMessages(prev => [...prev, { role: 'ai', text: result.text }])
      speak(result.text)

      if (result.type === 'action') {
        const { command, path, search } = result.action || {}
        if (command === 'navigate' || command === 'search') {
          const targetPath = search ? `${path || '/clients'}?search=${encodeURIComponent(search)}` : path
          const page = path?.replace('/', '') || 'dashboard'
          
          if (canAccess(page) || path === '/dashboard' || path === '/profile' || command === 'search') {
            toast.success(lang === 'ar' ? 'جاري التنفيذ...' : 'Executing...')
            setTimeout(() => navigate(targetPath), 800)
          } else {
            toast.error(lang === 'ar' ? 'ليس لديك صلاحية' : 'Access Denied')
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: error.message || 'Error communicating with AI.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-all z-50 hover:scale-110 group"
        title={lang === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
      >
        <Bot size={28} />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse" />
      </button>
    )
  }

  return (
    <div className={`fixed left-6 bottom-6 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col z-50 transition-all duration-300 transform ${isMinimized ? 'h-14' : 'h-[550px] translate-y-0'}`}>
      {/* Header */}
      <div className="p-3 bg-emerald-600 text-white rounded-t-2xl flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
            <Bot size={18} />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-xs leading-none">Fresh Food AI</span>
            <span className="text-[10px] opacity-80">{isListening ? (isRTL ? 'جاري الاستماع...' : 'Listening...') : (isRTL ? 'متصل' : 'Online')}</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMuted(!isMuted)} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors" title={isRTL ? 'كتم الصوت' : 'Mute'}>
            {isMuted ? <Volume2 size={14} className="opacity-50" /> : <Volume2 size={14} />}
          </button>
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors">
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-emerald-700 rounded-lg transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50 dark:bg-gray-800/30">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm transition-all animate-in fade-in slide-in-from-bottom-2 ${
                  m.role === 'user' 
                    ? 'bg-emerald-600 text-white rounded-bl-none' 
                    : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-br-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 p-3 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex gap-1 items-center">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                  <span className="text-[10px] text-gray-400 ms-2">{isRTL ? 'يفكر...' : 'Thinking...'}</span>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-2">
            {isListening && (
              <div className="flex items-center justify-center gap-2 py-1 text-emerald-600 animate-pulse">
                <div className="w-2 h-2 bg-emerald-600 rounded-full" />
                <span className="text-xs font-bold">{isRTL ? 'أنا أسمعك الآن...' : 'I am listening...'}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button 
                onClick={toggleListening}
                className={`p-2 rounded-xl transition-all ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-emerald-600'}`}
                title={isRTL ? 'تحدث' : 'Speak'}
              >
                {isListening ? <Mic size={20} /> : <MicOff size={20} />}
              </button>
              
              <input 
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleSend()}
                placeholder={isRTL ? "اسألني أي شيء أو قل أمر صوتي..." : "Ask me anything or say a command..."}
                className="flex-1 bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:text-white"
              />
              
              <button 
                onClick={() => handleSend()}
                disabled={loading || !input.trim()}
                className="bg-emerald-600 text-white p-2.5 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-md active:scale-90"
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
