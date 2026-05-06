import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import toast from 'react-hot-toast'
import { Send, Paperclip, Download, User, Users, Search, X } from 'lucide-react'

// Custom Chat Pop Sound
function playChatSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(600, ctx.currentTime)
    o.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1)
    g.gain.setValueAtTime(0, ctx.currentTime)
    g.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05)
    g.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.15)
  } catch {}
}

export default function Chat() {
  const { employee } = useAuth()
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
        // Only play sound if it's not our own message and it belongs to the current tab
        if (msg.sender_id !== employee?.id) {
          if (
            (activeTab === null && msg.receiver_id === null) || 
            (activeTab && (msg.sender_id === activeTab || msg.receiver_id === activeTab))
          ) {
            playChatSound()
          } else if (msg.receiver_id === employee?.id || msg.receiver_id === null) {
            playChatSound() // Play sound even if not in the active tab but it's meant for us
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
      q = q.is('receiver_id', null) // General Chat
    } else {
      q = q.or(`and(sender_id.eq.${employee?.id},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${employee?.id})`)
    }

    const { data } = await q
    setMessages(data || [])
    if (!silent) prevMsgCount.current = data?.length || 0

    // Mark as read if it's a private chat
    if (targetId !== null && data?.length > 0) {
      const unread = data.filter(m => m.receiver_id === employee?.id && m.sender_id === targetId && !m.is_read)
      if (unread.length > 0) {
        supabase.from('internal_messages')
          .update({ is_read: true })
          .in('id', unread.map(u => u.id))
          .then() // Fire and forget
      }
    }
  }

  // Realtime Presence for Online Status
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
        receiver_id: activeTab, // null for general
        message: text.trim() || `📎 مرفق: ${file.name}`,
        attachment_url
      }

      const { error } = await supabase.from('internal_messages').insert(payload)
      if (error) throw error

      setText('')
      setFile(null)
    } catch (e) {
      toast.error('فشل إرسال الرسالة: ' + e.message)
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
    <div className="h-[calc(100vh-80px)] flex flex-col md:flex-row gap-4">
      {/* Sidebar - Contacts */}
      <div className="w-full md:w-80 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden flex-shrink-0 shadow-sm">
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-bold text-gray-800 dark:text-gray-100 mb-3">التواصل الداخلي</h2>
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="ابحث عن موظف..."
              className="w-full bg-gray-50 dark:bg-gray-800 border-none rounded-xl pr-9 pl-3 py-2 text-sm focus:ring-2 focus:ring-emerald-400 dark:text-white"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {/* General Chat */}
          <div 
            onClick={() => setActiveTab(null)}
            className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-50 dark:border-white/5 ${activeTab === null ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-l-transparent'}`}
          >
            <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
              <Users size={18} />
            </div>
            <div className="flex-1">
              <p className="font-bold text-sm text-gray-800 dark:text-gray-100">دردشة عامة</p>
              <p className="text-xs text-gray-500">رسائل مرئية للجميع</p>
            </div>
          </div>

          {/* Employees List */}
          {filteredEmployees.map(emp => (
            <div 
              key={emp.id}
              onClick={() => setActiveTab(emp.id)}
              className={`flex items-center gap-3 p-4 cursor-pointer transition-colors border-b border-gray-50 dark:border-white/5 ${activeTab === emp.id ? 'bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-l-emerald-500' : 'hover:bg-gray-50 dark:hover:bg-gray-800 border-l-4 border-l-transparent'}`}
            >
              <div className="relative">
                {emp.avatar_url ? (
                  <img src={emp.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold">
                    {emp.name[0]}
                  </div>
                )}
                <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-gray-900 ${onlineUsers[emp.id] ? 'bg-emerald-500' : 'bg-gray-400'}`} title={onlineUsers[emp.id] ? 'متصل' : 'غير متصل'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 dark:text-gray-100 truncate">{emp.name}</p>
                <p className="text-xs text-gray-500 truncate">{emp.role}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 flex flex-col overflow-hidden shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-3 bg-gray-50/50 dark:bg-white/5">
          {activeTab === null ? (
            <>
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600">
                <Users size={18} />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100">دردشة عامة</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">متاحة لجميع الموظفين</p>
              </div>
            </>
          ) : (
            <>
              {employees.find(e => e.id === activeTab)?.avatar_url ? (
                <img src={employees.find(e => e.id === activeTab)?.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500">
                  <User size={18} />
                </div>
              )}
              <div>
                <h3 className="font-bold text-gray-800 dark:text-gray-100">{employees.find(e => e.id === activeTab)?.name}</h3>
                <p className="text-xs text-gray-500">{employees.find(e => e.id === activeTab)?.role}</p>
              </div>
            </>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-none">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
              <Users size={48} className="mb-3" />
              <p>لا توجد رسائل سابقة. ابدأ المحادثة الآن!</p>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isMe = msg.sender_id === employee?.id
              const showName = activeTab === null && !isMe && (idx === 0 || messages[idx - 1].sender_id !== msg.sender_id)
              
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  {showName && <span className="text-[10px] text-gray-500 ms-2 mb-1">{msg.sender?.name}</span>}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
                    isMe 
                      ? 'bg-emerald-600 text-white rounded-tr-sm' 
                      : 'bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 text-gray-800 dark:text-gray-200 rounded-tl-sm'
                  }`}>
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    {msg.attachment_url && (
                      <a 
                        href={msg.attachment_url} target="_blank" rel="noreferrer"
                        className={`mt-2 flex items-center gap-1 text-xs font-bold w-max p-2 rounded-lg ${isMe ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-emerald-600 dark:text-emerald-400'} transition-colors`}
                      >
                        <Download size={12} /> تحميل المرفق
                      </a>
                    )}
                    <span className={`text-[9px] flex items-center justify-${isMe ? 'start' : 'end'} gap-1 mt-1 ${isMe ? 'text-emerald-100' : 'text-gray-400'}`}>
                      {new Date(msg.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                      {isMe && activeTab !== null && (
                        <span className={msg.is_read ? 'text-blue-200 font-bold' : 'text-emerald-200'}>
                          {msg.is_read ? '✔️✔️' : '✔️'}
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
          {file && (
            <div className="flex items-center justify-between bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded-lg mb-2">
              <span className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Paperclip size={12}/> {file.name}</span>
              <button onClick={() => setFile(null)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 p-1 rounded"><X size={12}/></button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <label className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 cursor-pointer transition-colors flex-shrink-0">
              <Paperclip size={18} />
              <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0])} />
            </label>
            <textarea 
              value={text} 
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اكتب رسالة..."
              className="flex-1 max-h-32 min-h-[40px] bg-gray-50 dark:bg-gray-800 border-none rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-emerald-400 resize-none custom-scrollbar dark:text-white"
              rows={1}
            />
            <button 
              onClick={sendMessage}
              disabled={uploading || (!text.trim() && !file)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors flex-shrink-0 shadow-sm"
            >
              {uploading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
