import { useState, useRef, useEffect } from 'react'
import { Bot, Send, X, Minimize2, Maximize2 } from 'lucide-react'
import { askAI } from '../lib/ai'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { supabase } from '../lib/supabase'

export default function AIChatbot() {
  const { settings } = useSettings()
  const { lang, isRTL } = useLang()
  const welcomeMsg = lang === 'ar'
    ? 'أهلاً بك! أنا مساعدك الذكي في Fresh Food. كيف يمكنني مساعدتك اليوم؟'
    : 'Hello! I am your AI assistant for Fresh Food. How can I help you today?'
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState([
    { role: 'ai', text: welcomeMsg }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const getSystemContext = async () => {
    // Fetch some basic stats to give the AI context
    const { count: clientsCount } = await supabase.from('clients').select('*', { count: 'exact', head: true })
    const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true })
    const { count: dealsCount } = await supabase.from('deals').select('*', { count: 'exact', head: true })
    
    return `
      Company Name: ${settings.company_name}
      Current Stats:
      - Total Clients: ${clientsCount || 0}
      - Total Products in Stock: ${productsCount || 0}
      - Total Deals: ${dealsCount || 0}
    `;
  }

  const handleSend = async () => {
    if (!input.trim() || loading) return
    
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setLoading(true)

    try {
      const context = await getSystemContext()
      const response = await askAI(userMsg, context)
      setMessages(prev => [...prev, { role: 'ai', text: response }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: error.message || 'عذراً، حدث خطأ أثناء الاتصال بالذكاء الاصطناعي. تأكد من إعداد مفتاح API بشكل صحيح.' }])
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-emerald-700 transition-all z-50 hover:scale-110"
        title={lang === 'ar' ? 'المساعد الذكي' : 'AI Assistant'}
      >
        <Bot size={28} />
      </button>
    )
  }

  return (
    <div className={`fixed left-6 bottom-6 w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col z-50 transition-all ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      {/* Header */}
      <div className="p-3 bg-emerald-600 text-white rounded-t-2xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <span className="font-bold text-sm">
            {lang === 'ar' ? 'مساعد Fresh Food الذكي' : 'Fresh Food AI Assistant'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-emerald-700 rounded">
            {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={14} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-emerald-700 rounded">
            <X size={14} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  m.role === 'user' 
                    ? 'bg-emerald-600 text-white rounded-bl-none' 
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-br-none'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-gray-100 flex gap-1">
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-gray-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder="اسألني أي شيء..."
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button 
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="bg-emerald-600 text-white p-2 rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Send size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
