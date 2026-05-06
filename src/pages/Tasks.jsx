import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/Modal'
import toast from 'react-hot-toast'
import { Plus, Paperclip, Send, CheckCircle, Clock, AlertTriangle, XCircle, ChevronDown, ChevronUp, Download, Bell } from 'lucide-react'

const PRIORITY = {
  low:    { label: 'منخفضة', color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300' },
  medium: { label: 'متوسطة', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  high:   { label: 'عالية',  color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  urgent: { label: 'عاجلة', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
}
const STATUS = {
  pending:      { label: 'قيد الانتظار', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  acknowledged: { label: 'تم الاستلام',  color: 'bg-blue-100 text-blue-700',    icon: CheckCircle },
  in_progress:  { label: 'جاري التنفيذ', color: 'bg-purple-100 text-purple-700', icon: Bell },
  completed:    { label: 'مكتملة',       color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  rejected:     { label: 'مرفوضة',       color: 'bg-red-100 text-red-700',       icon: XCircle },
}

const emptyTask = { title: '', description: '', assigned_to: [], due_date: '', priority: 'medium', notes: '' }

function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    
    // First tone
    const o1 = ctx.createOscillator()
    const g1 = ctx.createGain()
    o1.connect(g1); g1.connect(ctx.destination)
    o1.type = 'square'
    o1.frequency.setValueAtTime(800, ctx.currentTime)
    g1.gain.setValueAtTime(0.3, ctx.currentTime)
    g1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15)
    o1.start(ctx.currentTime)
    o1.stop(ctx.currentTime + 0.15)

    // Second tone (slightly higher and delayed)
    const o2 = ctx.createOscillator()
    const g2 = ctx.createGain()
    o2.connect(g2); g2.connect(ctx.destination)
    o2.type = 'square'
    o2.frequency.setValueAtTime(1200, ctx.currentTime + 0.2)
    g2.gain.setValueAtTime(0, ctx.currentTime)
    g2.gain.setValueAtTime(0.3, ctx.currentTime + 0.2)
    g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4)
    o2.start(ctx.currentTime + 0.2)
    o2.stop(ctx.currentTime + 0.4)
  } catch {}
}

export default function Tasks() {
  const { employee, normalizedRole } = useAuth()
  const isManager = ['admin', 'manager'].includes(normalizedRole)

  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(emptyTask)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(null)
  const [replies, setReplies] = useState({})
  const [replyText, setReplyText] = useState('')
  const [replyFile, setReplyFile] = useState(null)
  const [uploadingAttach, setUploadingAttach] = useState(false)
  const [taskAttach, setTaskAttach] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [viewMode, setViewMode] = useState('list') // 'list' | 'kanban'
  const prevCount = useRef(0)

  useEffect(() => {
    load()
    if (isManager) loadEmployees()
    const sub = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        load(true)
      })
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function load(silent = false) {
    if (!silent) setLoading(true)
    let q = supabase.from('tasks').select(`
      *, 
      assigner:assigned_by(name),
      assignee:assigned_to(name)
    `).order('created_at', { ascending: false })

    if (!isManager) q = q.eq('assigned_to', employee?.id)

    const { data } = await q
    const list = data ?? []
    if (list.length > prevCount.current && prevCount.current > 0) playSound()
    prevCount.current = list.length
    setTasks(list)
    if (!silent) setLoading(false)
  }

  async function loadEmployees() {
    const { data } = await supabase.from('employees').select('id,name,role').eq('is_active', true).order('name')
    setEmployees(data ?? [])
  }

  async function loadReplies(taskId) {
    const { data } = await supabase.from('task_replies').select('*, emp:employee_id(name)').eq('task_id', taskId).order('created_at')
    setReplies(r => ({ ...r, [taskId]: data ?? [] }))
  }

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null) } else { setExpanded(id); loadReplies(id) }
  }

  async function uploadFile(file, bucket) {
    const ext = file.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from(bucket).upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from(bucket).getPublicUrl(path)
    return { url: data.publicUrl, name: file.name }
  }

  async function createTask() {
    if (!form.title) return toast.error('عنوان المهمة مطلوب')
    if (!form.assigned_to || form.assigned_to.length === 0) return toast.error('حدد الموظف المسؤول')
    setSaving(true)
    try {
      let attachment_url = null, attachment_name = null
      if (taskAttach) {
        const r = await uploadFile(taskAttach, 'task-attachments')
        attachment_url = r.url; attachment_name = r.name
      }
      
      const assignees = Array.isArray(form.assigned_to) ? form.assigned_to : [form.assigned_to]
      
      const payload = assignees.map(empId => ({
        title: form.title, description: form.description,
        assigned_by: employee?.id, assigned_to: Number(empId),
        due_date: form.due_date || null, priority: form.priority,
        notes: form.notes, attachment_url, attachment_name
      }))

      const { error } = await supabase.from('tasks').insert(payload)
      if (error) throw error
      
      toast.success('تم إرسال المهمة بنجاح')
      setModal(false); setForm({ ...emptyTask, assigned_to: [] }); setTaskAttach(null); load()
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  async function updateStatus(taskId, status) {
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId)
    if (error) return toast.error(error.message)
    toast.success('تم تحديث الحالة')
    load(true)
  }

  async function sendReply(taskId) {
    if (!replyText.trim() && !replyFile) return
    setUploadingAttach(true)
    try {
      let attachment_url = null, attachment_name = null
      if (replyFile) {
        const r = await uploadFile(replyFile, 'task-attachments')
        attachment_url = r.url; attachment_name = r.name
      }
      const { error } = await supabase.from('task_replies').insert({
        task_id: taskId, employee_id: employee?.id,
        message: replyText.trim() || `📎 ${attachment_name}`,
        attachment_url, attachment_name
      })
      if (error) throw error
      setReplyText(''); setReplyFile(null)
      loadReplies(taskId)
    } catch (e) { toast.error(e.message) }
    setUploadingAttach(false)
  }

  const filtered = tasks.filter(t => !filterStatus || t.status === filterStatus)

  const myPending = tasks.filter(t => t.assigned_to === employee?.id && t.status === 'pending').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">المهام</h1>
          {myPending > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs font-bold rounded-full animate-pulse">
              {myPending} مهمة جديدة
            </span>
          )}
        </div>
        {isManager && (
          <button onClick={() => { setForm(emptyTask); setTaskAttach(null); setModal(true) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-sm transition-all hover:scale-[1.02]">
            <Plus size={16} /> إضافة مهمة
          </button>
        )}
      </div>

      {/* Status filter and View Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {[['', 'الكل'], ...Object.entries(STATUS).map(([k, v]) => [k, v.label])].map(([val, label]) => (
            <button key={val} onClick={() => setFilterStatus(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border ${
                filterStatus === val
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:border-emerald-400'
              }`}>{label}</button>
          ))}
        </div>
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
          <button onClick={() => setViewMode('list')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500'}`}>قائمة</button>
          <button onClick={() => setViewMode('kanban')} className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${viewMode === 'kanban' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-white shadow-sm' : 'text-gray-500'}`}>لوحة Kanban</button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800">
          <CheckCircle size={40} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">لا توجد مهام</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {filtered.map(task => {
            const pr = PRIORITY[task.priority] || PRIORITY.medium
            const st = STATUS[task.status] || STATUS.pending
            const StIcon = st.icon
            const isOpen = expanded === task.id
            const isMyTask = task.assigned_to === employee?.id

            return (
              <div key={task.id}
                className={`bg-white dark:bg-gray-900 rounded-2xl border shadow-sm transition-all ${
                  task.status === 'pending' && isMyTask
                    ? 'border-amber-300 dark:border-amber-700/60'
                    : 'border-gray-100 dark:border-gray-800'
                }`}>
                <div className="p-4 cursor-pointer" onClick={() => toggleExpand(task.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span>
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${st.color}`}>
                          <StIcon size={10} />{st.label}
                        </span>
                      </div>
                      <p className="font-bold text-gray-800 dark:text-gray-100 truncate">{task.title}</p>
                      {task.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{task.description}</p>}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                        <span>من: <b className="text-gray-600 dark:text-gray-300">{task.assigner?.name || '—'}</b></span>
                        <span>إلى: <b className="text-gray-600 dark:text-gray-300">{task.assignee?.name || '—'}</b></span>
                        {task.due_date && <span className="flex items-center gap-1"><Clock size={10} />{new Date(task.due_date).toLocaleDateString('ar-EG')}</span>}
                        {task.attachment_url && <span className="flex items-center gap-1 text-emerald-600"><Paperclip size={10} />مرفق</span>}
                      </div>
                    </div>
                    {isOpen ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0 mt-1" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0 mt-1" />}
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t border-gray-100 dark:border-gray-800 p-4 space-y-4">
                    {task.notes && <p className="text-sm text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg p-3">{task.notes}</p>}
                    {task.attachment_url && (
                      <a href={task.attachment_url} target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                        <Download size={14} /> {task.attachment_name || 'تحميل المرفق'}
                      </a>
                    )}

                    {/* Status actions for assignee */}
                    {isMyTask && task.status === 'pending' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(task.id, 'acknowledged')}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg text-sm font-bold transition-colors">
                          ✅ تأكيد الاستلام
                        </button>
                        <button onClick={() => updateStatus(task.id, 'rejected')}
                          className="px-4 py-2 bg-red-100 hover:bg-red-200 dark:bg-red-900/30 text-red-600 rounded-lg text-sm font-bold transition-colors">
                          رفض
                        </button>
                      </div>
                    )}
                    {isMyTask && task.status === 'acknowledged' && (
                      <div className="flex gap-2">
                        <button onClick={() => updateStatus(task.id, 'in_progress')}
                          className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg text-sm font-bold">
                          🔄 بدء التنفيذ
                        </button>
                        <button onClick={() => updateStatus(task.id, 'completed')}
                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-bold">
                          ✅ إتمام المهمة
                        </button>
                      </div>
                    )}
                    {isMyTask && task.status === 'in_progress' && (
                      <button onClick={() => updateStatus(task.id, 'completed')}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-bold">
                        ✅ إتمام المهمة
                      </button>
                    )}

                    {/* Replies */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase">الردود</p>
                      {(replies[task.id] || []).length === 0
                        ? <p className="text-xs text-gray-400">لا توجد ردود بعد</p>
                        : (replies[task.id] || []).map(r => (
                          <div key={r.id} className="flex gap-2">
                            <div className="w-7 h-7 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 flex-shrink-0">
                              {r.emp?.name?.[0] || '?'}
                            </div>
                            <div className="flex-1 bg-gray-50 dark:bg-gray-800 rounded-xl px-3 py-2">
                              <p className="text-[11px] font-bold text-gray-700 dark:text-gray-300">{r.emp?.name}</p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">{r.message}</p>
                              {r.attachment_url && (
                                <a href={r.attachment_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-600 mt-1">
                                  <Paperclip size={10} />{r.attachment_name || 'مرفق'}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}

                      {/* Reply input */}
                      {task.status !== 'completed' && task.status !== 'rejected' && (
                        <div className="flex gap-2 mt-2">
                          <div className="flex-1 flex items-center gap-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3">
                            <input value={replyText} onChange={e => setReplyText(e.target.value)}
                              placeholder="اكتب رد أو ملاحظة..."
                              className="flex-1 bg-transparent text-sm py-2 focus:outline-none dark:text-gray-200"
                              onKeyDown={e => e.key === 'Enter' && sendReply(task.id)} />
                            <label className="cursor-pointer text-gray-400 hover:text-emerald-600 transition-colors" title="إرفاق ملف">
                              <Paperclip size={15} />
                              <input type="file" className="hidden" onChange={e => setReplyFile(e.target.files?.[0] || null)} />
                            </label>
                          </div>
                          <button onClick={() => sendReply(task.id)} disabled={uploadingAttach}
                            className="w-9 h-9 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center disabled:opacity-50 transition-colors flex-shrink-0">
                            <Send size={14} />
                          </button>
                        </div>
                      )}
                      {replyFile && (
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-1">
                          <Paperclip size={10} />{replyFile.name}
                          <button onClick={() => setReplyFile(null)} className="text-red-500 mr-1">✕</button>
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
          {Object.entries(STATUS).map(([statusKey, statusConfig]) => {
            const columnTasks = filtered.filter(t => t.status === statusKey)
            const Icon = statusConfig.icon
            return (
              <div key={statusKey} className="min-w-[280px] w-[280px] max-w-[280px] flex-shrink-0 snap-start bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-3 border border-gray-100 dark:border-gray-800">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <Icon size={16} className={statusConfig.color.split(' ')[1]} />
                    <h3 className="font-bold text-gray-700 dark:text-gray-200">{statusConfig.label}</h3>
                  </div>
                  <span className="bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">{columnTasks.length}</span>
                </div>
                
                <div className="space-y-3">
                  {columnTasks.map(task => {
                    const pr = PRIORITY[task.priority] || PRIORITY.medium
                    const isMyTask = task.assigned_to === employee?.id
                    
                    return (
                      <div key={task.id} className="bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm cursor-pointer hover:border-emerald-400 transition-colors" onClick={() => toggleExpand(task.id)}>
                        <div className="flex justify-between items-start mb-2">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pr.color}`}>{pr.label}</span>
                          {task.due_date && <span className="text-[10px] text-gray-400 flex items-center gap-1"><Clock size={10} />{new Date(task.due_date).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' })}</span>}
                        </div>
                        <h4 className="font-bold text-sm text-gray-800 dark:text-gray-100 mb-1">{task.title}</h4>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                          <div className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[9px] font-bold" title={task.assignee?.name}>
                              {task.assignee?.name?.[0]}
                            </div>
                            <span className="text-[10px] text-gray-500">إلى {task.assignee?.name?.split(' ')[0]}</span>
                          </div>
                          {task.attachment_url && <Paperclip size={12} className="text-emerald-500" />}
                        </div>
                        
                        {/* Inline Actions if my task and in certain status */}
                        {isMyTask && (
                          <div className="mt-3 grid grid-cols-1 gap-1">
                            {task.status === 'pending' && (
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(task.id, 'acknowledged') }} className="bg-blue-50 text-blue-600 hover:bg-blue-100 py-1.5 rounded-lg text-xs font-bold transition-colors">تأكيد الاستلام</button>
                            )}
                            {task.status === 'acknowledged' && (
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(task.id, 'in_progress') }} className="bg-purple-50 text-purple-600 hover:bg-purple-100 py-1.5 rounded-lg text-xs font-bold transition-colors">بدء التنفيذ</button>
                            )}
                            {(task.status === 'in_progress' || task.status === 'acknowledged') && (
                              <button onClick={(e) => { e.stopPropagation(); updateStatus(task.id, 'completed') }} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 py-1.5 rounded-lg text-xs font-bold transition-colors">إتمام المهمة</button>
                            )}
                          </div>
                        )}
                        
                        {expanded === task.id && (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-600 dark:text-gray-400">
                            {task.description && <p className="mb-2 line-clamp-3">{task.description}</p>}
                            <button className="text-emerald-600 font-medium">عرض التفاصيل الكاملة بالضغط...</button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  {columnTasks.length === 0 && (
                    <div className="text-center py-6 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                      <p className="text-xs font-medium text-gray-400">فارغ</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Task Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title="إضافة مهمة جديدة">
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">عنوان المهمة *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الوصف</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الموظف المسؤول (أو القسم) *</label>
              <div className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg p-2 max-h-40 overflow-y-auto space-y-1">
                {/* Department/Role Quick Select */}
                <div className="flex flex-wrap gap-1 mb-2 pb-2 border-b border-gray-100 dark:border-gray-700">
                  {Array.from(new Set(employees.map(e => e.role))).filter(Boolean).map(role => {
                    const roleEmps = employees.filter(e => e.role === role).map(e => e.id)
                    const isAllSelected = roleEmps.length > 0 && roleEmps.every(id => form.assigned_to.includes(id))
                    return (
                      <button key={role} type="button"
                        onClick={() => {
                          if (isAllSelected) {
                            setForm(f => ({ ...f, assigned_to: f.assigned_to.filter(id => !roleEmps.includes(id)) }))
                          } else {
                            const newAssigned = new Set([...form.assigned_to, ...roleEmps])
                            setForm(f => ({ ...f, assigned_to: Array.from(newAssigned) }))
                          }
                        }}
                        className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${
                          isAllSelected 
                            ? 'bg-emerald-100 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-400' 
                            : 'bg-gray-50 border-gray-200 text-gray-600 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100'
                        }`}>
                        قسم {role}
                      </button>
                    )
                  })}
                </div>
                {/* Individual Employees */}
                {employees.map(e => (
                  <label key={e.id} className="flex items-center gap-2 p-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 rounded cursor-pointer">
                    <input type="checkbox" checked={form.assigned_to.includes(e.id)}
                      onChange={(ev) => {
                        const checked = ev.target.checked
                        setForm(f => ({
                          ...f,
                          assigned_to: checked ? [...f.assigned_to, e.id] : f.assigned_to.filter(id => id !== e.id)
                        }))
                      }}
                      className="w-4 h-4 text-emerald-600 rounded border-gray-300 focus:ring-emerald-500" />
                    <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{e.name}</span>
                    <span className="text-[10px] text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 rounded">{e.role}</span>
                  </label>
                ))}
              </div>
              {form.assigned_to.length > 0 && (
                <p className="text-xs text-emerald-600 mt-1 font-medium">تم تحديد {form.assigned_to.length} موظف</p>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">الأولوية</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400">
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">آخر موعد للتسليم</label>
            <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">ملاحظات</label>
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">مرفق (اختياري)</label>
            <label className="flex items-center gap-2 cursor-pointer w-full border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-3 hover:border-emerald-400 transition-colors">
              <Paperclip size={16} className="text-gray-400" />
              <span className="text-sm text-gray-500">{taskAttach ? taskAttach.name : 'اضغط لإرفاق ملف'}</span>
              <input type="file" className="hidden" onChange={e => setTaskAttach(e.target.files?.[0] || null)} />
              {taskAttach && <button type="button" onClick={e => { e.preventDefault(); setTaskAttach(null) }} className="mr-auto text-red-400 text-xs">إزالة</button>}
            </label>
          </div>
          <div className="flex gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
            <button onClick={createTask} disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-bold transition-colors">
              {saving ? 'جاري الإرسال...' : 'إرسال المهمة'}
            </button>
            <button onClick={() => setModal(false)}
              className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300">
              إلغاء
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
