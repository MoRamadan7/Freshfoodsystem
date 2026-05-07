import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { Bell, Package, Handshake, FileText, Cake, CreditCard, X, CheckCheck, ClipboardList } from 'lucide-react'

export default function NotificationBell() {
  const { settings } = useSettings()
  const { t, isRTL } = useLang()
  const { employee, normalizedRole } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [readIds, setReadIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('read_notifications') || '[]') } catch { return [] }
  })

  const buildNotifications = useCallback(async () => {
    const items = []

    // 1. System/Admin Notifications from DB
    const { data: systemNotifs } = await supabase
      .from('system_notifications')
      .select('*')
      .eq('is_read', false)
      .contains('target_roles', [normalizedRole])
      .order('created_at', { ascending: false })
      .limit(20)
    
    systemNotifs?.forEach(n => items.push({
      id: n.id,
      db_id: n.id,
      type: n.type,
      icon: Bell,
      color: 'text-emerald-600 bg-emerald-50',
      title: n.title,
      body: n.body,
      time: new Date(n.created_at),
    }))

    // Management-only alerts
    const isManagement = ['admin', 'manager', 'hr', 'accountant'].includes(normalizedRole)

    // 2. Low Stock
    if (isManagement && settings.notify_low_stock) {
      const { data: allProducts } = await supabase
        .from('products')
        .select('id, product_name, stock_quantity, reorder_level')
        .limit(200)
      const lowStock = (allProducts ?? []).filter(
        p => Number(p.stock_quantity) <= Number(p.reorder_level)
      ).slice(0, 10)
      lowStock.forEach(p => items.push({
        id: `stock-${p.id}`,
        type: 'stock',
        icon: Package,
        color: 'text-amber-600 bg-amber-50',
        title: t('lowStockAlert'),
        body: `${p.product_name} — ${p.stock_quantity} متبقي`,
        time: new Date(),
      }))
    }

    // 3. Deals closing soon
    if (isManagement && settings.notify_deals_closing) {
      const days = settings.notify_deals_closing_days || 7
      const future = new Date(); future.setDate(future.getDate() + days)
      const { data: deals } = await supabase
        .from('deals')
        .select('id, clients(client_name), expected_close_date')
        .in('status', ['contact', 'negotiation'])
        .lte('expected_close_date', future.toISOString().split('T')[0])
        .not('expected_close_date', 'is', null)
        .limit(10)
      deals?.forEach(d => items.push({
        id: `deal-${d.id}`,
        type: 'deal',
        icon: Handshake,
        color: 'text-blue-600 bg-blue-50',
        title: t('dealClosingAlert'),
        body: `${d.clients?.client_name} — ${d.expected_close_date}`,
        time: new Date(),
      }))
    }

    // 4. Overdue Invoices
    if (isManagement && settings.notify_overdue_invoices) {
      const today = new Date().toISOString().split('T')[0]
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, clients(client_name), due_date')
        .not('status', 'eq', 'paid')
        .not('status', 'eq', 'cancelled')
        .lt('due_date', today)
        .not('due_date', 'is', null)
        .limit(10)
      invoices?.forEach(inv => items.push({
        id: `inv-${inv.id}`,
        type: 'invoice',
        icon: FileText,
        color: 'text-red-600 bg-red-50',
        title: t('overdueInvoiceAlert'),
        body: `${inv.invoice_number} — ${inv.clients?.client_name}`,
        time: new Date(),
      }))
    }

    // 5. Tasks - للموظف: مهام جديدة معلقة
    if (employee?.id) {
      const { data: myTasks } = await supabase
        .from('tasks')
        .select('id, title, priority, due_date')
        .eq('assigned_to', employee.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5)
      myTasks?.forEach(task => items.push({
        id: `task-${task.id}`,
        type: 'task',
        icon: ClipboardList,
        color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20',
        title: 'مهمة جديدة',
        body: task.title,
        time: new Date(),
      }))
    }

    // Tasks for managers: employees who acknowledged
    if (isManagement) {
      const { data: ackTasks } = await supabase
        .from('tasks')
        .select('id, title, assignee:assigned_to(name)')
        .eq('assigned_by', employee?.id)
        .eq('status', 'acknowledged')
        .limit(5)
      ackTasks?.forEach(task => items.push({
        id: `task-ack-${task.id}`,
        type: 'task',
        icon: ClipboardList,
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20',
        title: 'تم استلام مهمة',
        body: `${task.assignee?.name} استلم: ${task.title}`,
        time: new Date(),
      }))
    }

    setNotifications(items)
  }, [settings, t, normalizedRole])

  const [prevCount, setPrevCount] = useState(0)

  useEffect(() => {
    buildNotifications()
    const interval = setInterval(buildNotifications, 30000) 
    return () => clearInterval(interval)
  }, [buildNotifications])

  // Play sound when new notifications arrive
  useEffect(() => {
    const unread = notifications.filter(n => !readIds.includes(n.id))
    if (unread.length > prevCount) {
      // Find the newest unread notification to determine sound type
      const newest = unread[unread.length - 1]
      const soundUrl = newest.type === 'task' ? settings.task_sound_url : settings.notification_sound_url
      
      if (soundUrl) {
        const audio = new Audio(soundUrl)
        const playPromise = audio.play()
        if (playPromise !== undefined) {
          playPromise.catch(e => console.log('Audio play interrupted or blocked'))
        }
      }
    }
    setPrevCount(unread.length)
  }, [notifications, readIds, settings.notification_sound_url, settings.task_sound_url])

  const unreadCount = notifications.filter(n => !readIds.includes(n.id)).length

  const markRead = async (n) => {
    if (readIds.includes(n.id)) return
    
    // 1. Local Mark
    const newReadIds = [...readIds, n.id]
    setReadIds(newReadIds)
    localStorage.setItem('read_notifications', JSON.stringify(newReadIds))
    
    // 2. DB Mark if it exists
    if (n.db_id) {
      await supabase.from('system_notifications').update({ is_read: true }).eq('id', n.db_id)
      setNotifications(prev => prev.filter(item => item.id !== n.id))
    }
  }

  const markAllRead = async () => {
    const allIds = notifications.map(n => n.id)
    setReadIds(allIds)
    localStorage.setItem('read_notifications', JSON.stringify(allIds))
    
    // Mark all DB notifications as read
    const dbIds = notifications.filter(n => n.db_id).map(n => n.db_id)
    if (dbIds.length > 0) {
      await supabase.from('system_notifications').update({ is_read: true }).in('id', dbIds)
      setNotifications(prev => prev.filter(n => !n.db_id))
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative flex items-center justify-center w-9 h-9 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 text-gray-400 hover:text-emerald-500"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 border-2 border-white dark:border-gray-900 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute z-40 top-12 w-80 bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-fade-in-up
              ${isRTL ? 'left-0' : 'right-0'}`}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50/50 dark:bg-white/5 border-b border-gray-100 dark:border-white/5">
              <h3 className="font-bold text-xs text-gray-800 dark:text-gray-200 uppercase tracking-wider">{t('notifications')}</h3>
              <div className="flex items-center gap-2">
                {notifications.length > 0 && (
                  <button onClick={markAllRead} className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1">
                    <CheckCheck size={12} />{t('markAllRead')}
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-white/5">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell size={32} className="text-gray-100 dark:text-white/5 mx-auto mb-3" />
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{t('noNotifications')}</p>
                </div>
              ) : notifications.map(n => {
                const Icon = n.icon
                const isRead = readIds.includes(n.id)
                return (
                  <div
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={`flex items-start gap-3 px-4 py-4 cursor-pointer transition-all hover:bg-gray-50 dark:hover:bg-white/5 group ${isRead ? 'opacity-50' : ''}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${n.color}`}>
                      <Icon size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-black text-gray-800 dark:text-gray-200">{n.title}</p>
                        <span className="text-[9px] font-bold text-gray-400">{new Date(n.time).toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{n.body}</p>
                    </div>
                    {!isRead && (
                      <div className="mt-1">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
