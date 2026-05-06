import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useLang } from '../contexts/LangContext'
import { Activity, Search, Calendar, User, FileText, Filter } from 'lucide-react'

export default function ActivityLogs() {
  const { isAdmin, normalizedRole } = useAuth()
  const { t, isRTL } = useLang()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    loadLogs()
  }, [])

  async function loadLogs() {
    setLoading(true)
    const { data } = await supabase
      .from('activity_logs')
      .select('*, employees(name, role)')
      .order('created_at', { ascending: false })
      .limit(200) // Load last 200 logs for performance
    setLogs(data ?? [])
    setLoading(false)
  }

  // Security: If not admin or manager, they shouldn't be here, but we guard it just in case
  if (!isAdmin && normalizedRole !== 'manager') {
    return (
      <div className="flex flex-col items-center justify-center h-96 text-gray-500">
        <Activity size={48} className="mb-4 text-gray-300" />
        <h2 className="text-xl font-bold">{t('accessDeniedTitle')}</h2>
        <p>{t('accessDeniedBody')}</p>
      </div>
    )
  }

  const filteredLogs = logs.filter(log => {
    const matchSearch = log.details?.includes(search) || log.entity_name?.includes(search) || log.employees?.name?.includes(search)
    const matchAction = !actionFilter || log.action_type === actionFilter
    return matchSearch && matchAction
  })

  const actionColors = {
    'إضافة': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'تعديل': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'حذف': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Activity className="text-blue-600" />
            تحديثات بيانات العمل
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            سجل كامل بجميع الحركات والتعديلات التي يقوم بها الموظفون في النظام.
          </p>
        </div>
        <button onClick={loadLogs} className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
          تحديث السجل
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input 
            type="text" 
            placeholder="ابحث باسم الموظف أو التفاصيل..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
          />
        </div>
        <div className="relative w-full sm:w-48">
          <Filter size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select 
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 rounded-xl pr-10 pl-4 py-2.5 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800 dark:text-gray-200"
          >
            <option value="">كل العمليات</option>
            <option value="إضافة">إضافة</option>
            <option value="تعديل">تعديل</option>
            <option value="حذف">حذف</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-12 text-center border border-gray-100 dark:border-white/5">
          <Activity size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 mb-1">لا توجد سجلات</h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">لم يقم الموظفون بأي حركات مطابقة للبحث.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-right px-4 py-3 font-medium"><div className="flex items-center gap-1"><Calendar size={14}/> التاريخ والوقت</div></th>
                  <th className="text-right px-4 py-3 font-medium"><div className="flex items-center gap-1"><User size={14}/> الموظف</div></th>
                  <th className="text-right px-4 py-3 font-medium">نوع العملية</th>
                  <th className="text-right px-4 py-3 font-medium">القسم</th>
                  <th className="text-right px-4 py-3 font-medium"><div className="flex items-center gap-1"><FileText size={14}/> التفاصيل</div></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {filteredLogs.map((log) => {
                  const date = new Date(log.created_at)
                  return (
                    <tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-gray-800 dark:text-gray-200 block font-medium">{date.toLocaleDateString('ar-EG')}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{date.toLocaleTimeString('ar-EG')}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-gray-800 dark:text-gray-200 block font-bold">{log.employees?.name || 'مجهول'}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{log.employees?.role || '---'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${actionColors[log.action_type] || 'bg-gray-100 text-gray-700'}`}>
                          {log.action_type}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700 dark:text-gray-300">{log.entity_name}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400 max-w-xs truncate" title={log.details}>
                        {log.details || '---'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
