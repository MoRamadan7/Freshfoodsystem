import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useSettings } from '../contexts/SettingsContext'
import toast from 'react-hot-toast'
import { Send, Paperclip, Download, User, Users, Search, X, Circle, Hash, MoreVertical } from 'lucide-react'

// Custom Chat Pop Sound
function playChatSound(soundUrl) {
  try {
    const audio = new Audio(soundUrl || '/sounds/notification.mp3')
    audio.play().catch(() => {
      // Fallback to oscillator if audio fails or blocked
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.connect(g)
      g.connect(ctx.destination)
      o.type = 'sine'
      o.frequency.setValueAtTime(600, ctx.currentTime)
      o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
      g.gain.setValueAtTime(0, ctx.currentTime)
      g.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05)
      g.linearRampToValueAtTime(0, ctx.currentTime + 0.15)
      o.start(ctx.currentTime)
      o.stop(ctx.currentTime + 0.15)
    })
  } catch {}
}

export default function Chat() {
  const { employee } = useAuth()
  const { settings } = useSettings()
  const [employees, setEmployees] = useState([])
  const [messages, setMessages] = useState([])
  const [activeTab, setActiveTab] = useState(null) // null = General
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [search, setSearch] = useState('')
  const messagesEndRef = useRef(null)
  const prevMsgCount = useRef(0)

  useEffect(() => {
    loadEmployees()
    
    const sub = supabase
      .channel('chat-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'internal_messages' }, (payload) => {
        const msg = payload.new
        if (msg.sender_id !== employee?.id) {
          if (
            (activeTab === null && msg.receiver_id === null) || 
            (activeTab && (msg.sender_id === activeTab || msg.receiver_id === activeTab))
          ) {
            playChatSound(settings.notification_sound_url)
          } else if (msg.receiver_id === employee?.id || msg.receiver_id === null) {
            playChatSound(settings.notification_sound_url)
          }
        }
        loadMessages(activeTab, true)
      })
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [activeTab, employee?.id])

  useEffect(() => {
    loadMessages(activeTab)
  }, [activeTab])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('id, name, role, avatar_url, is_active').order('name')
    setEmployees(data?.filter(e => e.id !== employee?.id) || [])
  }

  async function loadMessages(targetId = null, silent = false) {
    let q = supabase.from('internal_messages')
      .select('*, sender:sender_id(name, avatar_url)')
      .order('created_at', { ascending: true })

    if (targetId === null) {
      q = q.is('receiver_id', null) 
    } else {
      q = q.or(`and(sender_id.eq.${employee?.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${employee?.id})`)
    }

    const { data } = await q
    setMessages(data || [])
    if (!silent) prevMsgCount.current = data?.length || 0

    if (targetId !== null && data?.length > 0) {
      const unread = data.filter(m => m.receiver_id === employee?.id && m.sender_id === targetId && !m.is_read)
      if (unread.length > 0) {
        supabase.from('internal_messages')
          .update({ is_read: true })
          .in('id', unread.map(u => u.id))
          .then()
      }
    }
  }

  const [onlineUsers, setOnlineUsers] = useState({})
  useEffect(() => {
    if (!employee?.id) return
    const channel = supabase.channel('online-users', {
      config: { presence: { key: employee.id.toString() } },
    })

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState()
      const online = {}
      for (const key in state) online[key] = true
      setOnlineUsers(online)
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() })
    })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [employee?.id])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  async function uploadFile(file) {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('chat-attachments').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('chat-attachments').getPublicUrl(path)
    return data.publicUrl
  }

  async function sendMessage() {
    if (!text.trim() && !file) return
    setUploading(true)
    try {
      let attachment_url = null
      if (file) attachment_url = await uploadFile(file)
      const payload = {
        sender_id: employee?.id,
        receiver_id: activeTab,
        message: text.trim() || `📎 مرفق: ${file.name}`,
        attachment_url
      }
      const { error } = await supabase.from('internal_messages').insert(payload)
      if (error) throw error
      setText('')
      setFile(null)
    } catch (e) {
      toast.error('فشل الإرسال: ' + e.message)
    } finally {
      setUploading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const filteredEmployees = employees.filter(e => e.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="h-[calc(100vh-100px)] flex bg-white dark:bg-gray-950 rounded-[2.5rem] border border-gray-100 dark:border-white/5 overflow-hidden shadow-2xl transition-all duration-500">
      
      {/* Sidebar */}
      <div className="w-80 border-e border-gray-100 dark:border-white/5 flex flex-col bg-gray-50/30 dark:bg-black/20">
        <div className="p-6">
          <h2 className="text-xl font-black text-gray-800 dark:text-emerald-400 mb-4 flex items-center gap-2">
            <Users size={24} /> التواصل
          </h2>
          <div className="relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن زميل..."
              className="w-full bg-white dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl pr-10 pl-3 py-3 text-xs focus:ring-2 focus:ring-emerald-500 transition-all dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 space-y-1 custom-scrollbar">
          <div 
            onClick={() => setActiveTab(null)}
            className={`group flex items-center gap-4 p-4 rounded-3xl cursor-pointer transition-all ${activeTab === null ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'hover:bg-white dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${activeTab === null ? 'bg-white/20' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'}`}>
              <Hash size={20} />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm">الغرفة العامة</p>
              <p className={`text-[10px] ${activeTab === null ? 'text-white/70' : 'text-gray-400'}`}>الجميع هنا</p>
            </div>
          </div>

          <div className="py-2 px-4"><span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">الزملاء</span></div>

          {filteredEmployees.map(emp => (
            <div 
              key={emp.id}
              onClick={() => setActiveTab(emp.id)}
              className={`group flex items-center gap-4 p-3 rounded-3xl cursor-pointer transition-all ${activeTab === emp.id ? 'bg-white dark:bg-white/10 shadow-xl border border-gray-100 dark:border-white/10' : 'hover:bg-white/50 dark:hover:bg-white/5 text-gray-600 dark:text-gray-400'}`}
            >
              <div className="relative">
                {emp.avatar_url ? (
                  <img src={emp.avatar_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-transparent group-hover:ring-emerald-500/30 transition-all" />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-black">
                    {emp.name[0]}
                  </div>
                )}
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-white dark:border-gray-900 ${onlineUsers[emp.id] ? 'bg-green-500' : 'bg-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-black text-sm truncate ${activeTab === emp.id ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-800 dark:text-gray-200'}`}>{emp.name}</p>
                <p className="text-[10px] opacity-60 truncate font-bold uppercase">{emp.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 relative">
        {/* Header */}
        <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-gray-950/50 backdrop-blur-md">
          <div className="flex items-center gap-4">
            {activeTab === null ? (
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600"><Hash size={24} /></div>
            ) : (
              <div className="relative">
                <img src={employees.find(e => e.id === activeTab)?.avatar_url || '/default-avatar.png'} className="w-12 h-12 rounded-2xl object-cover" />
                {onlineUsers[activeTab] && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-white dark:border-gray-950" />}
              </div>
            )}
            <div>
              <h3 className="font-black text-gray-800 dark:text-gray-100">{activeTab === null ? 'الغرفة العامة' : employees.find(e => e.id === activeTab)?.name}</h3>
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                {activeTab === null ? 'مساحة تعاون الفريق' : (onlineUsers[activeTab] ? 'نشط الآن' : 'غير متصل')}
              </p>
            </div>
          </div>
          <button className="p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-2xl transition-all text-gray-400"><MoreVertical size={20}/></button>
        </div>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center opacity-20 dark:opacity-10 grayscale">
              <Users size={80} className="mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">ابدأ رحلة التواصل الآن</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === employee?.id
              const showName = activeTab === null && !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id)
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2`}>
                  {showName && <span className="text-[10px] font-black text-gray-400 mb-2 px-2 uppercase tracking-wider">{msg.sender?.name}</span>}
                  <div className={`relative max-w-[70%] px-5 py-4 rounded-[2rem] shadow-xl transition-all hover:scale-[1.01] ${
                    isMe 
                      ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-tr-none' 
                      : 'bg-gray-100 dark:bg-white/5 text-gray-800 dark:text-gray-100 rounded-tl-none border border-white/5'
                  }`}>
                    <p className="text-sm leading-relaxed font-medium">{msg.message}</p>
                    {msg.attachment_url && (
                      <a href={msg.attachment_url} target="_blank" rel="noreferrer"
                        className={`mt-4 flex items-center gap-3 text-[10px] font-black p-3 rounded-2xl transition-all ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'}`}>
                        <Download size={16} /> تحميل الملف المرفق
                      </a>
                    )}
                    <div className={`flex items-center gap-2 mt-3 text-[9px] font-bold ${isMe ? 'text-white/70' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      {isMe && activeTab !== null && (
                        <span className={`text-[12px] ${msg.is_read ? 'text-blue-300' : 'text-white/30'}`}>
                          {msg.is_read ? '✔️✔️' : '✔️'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Improved Input Area */}
        <div className="p-6 bg-white dark:bg-gray-950 border-t border-gray-100 dark:border-white/5">
          {file && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-2xl mb-4 animate-in slide-in-from-bottom-2">
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 flex items-center gap-2"><Paperclip size={14}/> {file.name}</span>
              <button onClick={() => setFile(null)} className="p-2 hover:bg-red-50 dark:hover:bg-red-900/30 text-red-500 rounded-xl transition-all"><X size={16}/></button>
            </div>
          )}
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-white/5 p-2 rounded-[2.5rem] border border-gray-100 dark:border-white/5 shadow-inner">
            <label className="flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-white/10 text-gray-400 hover:text-emerald-500 cursor-pointer transition-all shadow-sm">
              <Paperclip size={20} />
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0])} />
            </label>
            <textarea 
              value={text} onChange={e => setText(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="اكتب رسالتك هنا..."
              className="flex-1 max-h-32 min-h-[48px] bg-transparent border-none px-2 py-3 text-sm focus:ring-0 dark:text-white placeholder:text-gray-400 font-medium resize-none"
              rows={1}
            />
            <button 
              onClick={sendMessage} disabled={uploading || (!text.trim() && !file)}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-40 transition-all shadow-lg shadow-emerald-600/20 active:scale-90"
            >
              {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Send size={20} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
