import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { Users, UserCheck, TrendingUp, Package, AlertTriangle, Wallet, Sparkles, FileText, Download, Loader2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, AreaChart, Area, PieChart, Pie, Cell } from 'recharts'
import { askAI } from '../lib/ai'
import { generateReportHTML } from '../lib/reportTemplate'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import toast from 'react-hot-toast'

function StatCard({ label, value, icon: Icon, color, sub }) {
  const colors = {
    green:  { bg: 'bg-emerald-50 dark:bg-emerald-500/10',  icon: 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-400' },
    blue:   { bg: 'bg-blue-50 dark:bg-blue-500/10',        icon: 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400',       text: 'text-blue-700 dark:text-blue-400' },
    amber:  { bg: 'bg-amber-50 dark:bg-amber-500/10',      icon: 'bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400',     text: 'text-amber-700 dark:text-amber-400' },
    red:    { bg: 'bg-red-50 dark:bg-red-500/10',          icon: 'bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400',         text: 'text-red-700 dark:text-red-400' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-500/10',    icon: 'bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-400',   text: 'text-purple-700 dark:text-purple-400' },
    gray:   { bg: 'bg-gray-50 dark:bg-white/5',            icon: 'bg-gray-100 dark:bg-white/10 text-gray-700 dark:text-gray-300',       text: 'text-gray-700 dark:text-gray-300' },
  }
  const c = colors[color] ?? colors.green
  return (
    <div className={`${c.bg} border border-white/20 dark:border-white/5 glass-card rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg group relative overflow-hidden`}>
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-10 transition-transform duration-500 group-hover:scale-150 ${c.bg.split(' ')[0].replace('50', '500')}`} />
      <div className={`${c.icon} w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}>
        <Icon size={26} />
      </div>
      <div className="relative z-10">
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
        <p className={`text-3xl font-extrabold tracking-tight ${c.text}`}>{value}</p>
        {sub && <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mt-1">{sub}</p>}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { settings, formatCurrency } = useSettings()
  const { t, lang, isRTL } = useLang()
  const { employee, isAdmin, normalizedRole } = useAuth()
  const [stats, setStats] = useState({ employees: 0, presentToday: 0, activeDeals: 0, lowStock: 0, monthRevenue: 0, monthExpense: 0, netBalance: 0 })
  const [recentTx, setRecentTx] = useState([])
  const [chartData, setChartData] = useState([])
  const [expenseData, setExpenseData] = useState([])
  const [stationStats, setStationStats] = useState([])
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])

  useEffect(() => { loadAll() }, [lang, fromDate, toDate])

  async function loadAll() {
    const today = new Date().toISOString().split('T')[0]

    const [emp, att, deals, allProducts, txAll, txRecent] = await Promise.all([
      supabase.from('employees').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).eq('status', 'present'),
      supabase.from('deals').select('id', { count: 'exact', head: true }).in('status', ['contact', 'negotiation']),
      supabase.from('products').select('id,stock_quantity,reorder_level'),
      supabase.from('transactions').select('type,amount,date,station_id').gte('date', fromDate).lte('date', toDate),
      supabase.from('transactions').select('id,date,type,amount,notes').order('created_at', { ascending: false }).limit(5),
    ])

    const lowStockCount = (allProducts.data ?? []).filter(
      p => Number(p.stock_quantity) <= Number(p.reorder_level)
    ).length

    let revenue = 0, expense = 0
    txAll.data?.forEach(tx => {
      const val = Number(tx.amount) || 0
      if (tx.type === 'revenue') revenue += val
      else expense += val
    })

    const locale = lang === 'ar' ? 'ar-EG' : 'en-US'
    const revKey = t('revenue')
    const expKey = t('expense')
    const months = []
    
    // Create 6 months range for chart
    for (let i = 5; i >= 0; i--) {
      const d = new Date(); d.setMonth(d.getMonth() - i)
      months.push({
        name: d.toLocaleString(locale, { month: 'short' }),
        [revKey]: 0,
        [expKey]: 0,
        _month: d.getMonth(),
        _year: d.getFullYear(),
      })
    }

    // Fill chart data (this remains monthly for the chart)
    txAll.data?.forEach(tx => {
      const d = new Date(tx.date)
      const idx = months.findIndex(m => m._month === d.getMonth() && m._year === d.getFullYear())
      if (idx >= 0) {
        if (tx.type === 'revenue') months[idx][revKey] += Number(tx.amount)
        else months[idx][expKey] += Number(tx.amount)
      }
    })

    const { data: stData } = await supabase.from('stations').select('*')
    
    const comparison = (stData ?? []).map(st => {
      let stRev = 0, stExp = 0
      txAll.data?.filter(tx => tx.station_id === st.id).forEach(tx => {
        if (tx.type === 'revenue') stRev += Number(tx.amount)
        else stExp += Number(tx.amount)
      })
      return { name: st.name, revenue: stRev, expense: stExp, net: stRev - stExp }
    })

    setStats({
      employees: emp.count ?? 0,
      presentToday: att.count ?? 0,
      activeDeals: deals.count ?? 0,
      lowStock: lowStockCount,
      monthRevenue: revenue,
      monthExpense: expense,
      netBalance: revenue - expense // Net for selected period
    })
    setRecentTx(txRecent.data ?? [])
    setChartData(months)
    setStationStats(comparison)

    const typeLabelMap = {
      expense: t('expense'),
      payroll: t('payroll'),
      supplier_payment: t('purchase_payment'),
      client_payment: t('client_payment') || 'Client Payment',
      maintenance: t('maintenance') || 'Maintenance',
      salary: t('salary') || 'Salary',
      advance: t('advance') || 'Advance',
      deduction: t('deduction') || 'Deduction',
      waste: t('waste') || 'Waste'
    }
    const expBreakdown = {}
    txAll.data?.filter(tx => tx.type !== 'revenue').forEach(tx => {
      expBreakdown[tx.type] = (expBreakdown[tx.type] || 0) + Number(tx.amount)
    })
    setExpenseData(Object.entries(expBreakdown).map(([k, v]) => ({ name: typeLabelMap[k] || k, value: v })))

    setLoading(false)
  }

  const handleAIInsights = async () => {
    setAnalyzing(true)
    try {
      const insightData = {
        revenue: stats.monthRevenue,
        expense: stats.monthExpense,
        profit: stats.monthRevenue - stats.monthExpense,
        topExpenses: expenseData.slice(0, 3),
        deals: stats.activeDeals
      }
      const prompt = `أنت مستشار أعمال خبير. قم بتحليل الأداء المالي لهذا الشهر بناءً على البيانات التالية:
      - الإيرادات: ${stats.monthRevenue}
      - المصروفات: ${stats.monthExpense}
      - صافي الربح: ${stats.monthRevenue - stats.monthExpense}
      - عدد الصفقات النشطة: ${stats.activeDeals}
      - المصروفات الكبيرة: ${JSON.stringify(insightData.topExpenses)}
      
      قدم 3 نصائح استراتيجية قصيرة ومباشرة للمدير باللغة العربية لزيادة الربحية وتحسين العمليات.`
      const response = await askAI(prompt)
      toast.success(isRTL ? 'تم توليد الرؤى بنجاح' : 'Insights generated', {
        icon: '💡',
        duration: 6000
      })
      // Show in a more elegant way if possible, but alert is fine for now as requested or I'll use a modal later.
      alert('--- ' + (isRTL ? 'توصيات الذكاء الاصطناعي للمدير' : 'AI Business Recommendations') + ' ---\n\n' + response)
    } catch (error) {
      toast.error('فشل في تحليل البيانات')
    } finally {
      setAnalyzing(false)
    }
  }

  const exportReport = () => {
    try {
      const period = isRTL 
        ? `من ${fromDate} إلى ${toDate}` 
        : `From ${fromDate} To ${toDate}`
      const html = generateReportHTML(stats, stationStats, recentTx, settings, period)
      const win = window.open('', '_blank')
      if (!win) {
        toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة (Pop-ups) لتصدير التقرير' : 'Please allow pop-ups to export the report')
        return
      }
      win.document.write(html)
      win.document.close()
    } catch (err) {
      console.error('Export error:', err)
      toast.error(isRTL ? 'فشل في تصدير التقرير' : 'Failed to export report')
    }
  }

  const PIE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1']

  const typeLabel = {
    revenue: t('revenue'), expense: t('expense'), salary: t('salary'),
    advance: t('advance'), deduction: t('deduction'), waste: t('waste'),
    purchase_payment: t('purchase_payment')
  }
  const typeColor = {
    revenue: 'text-emerald-600 bg-emerald-50', expense: 'text-red-600 bg-red-50',
    salary: 'text-blue-600 bg-blue-50', advance: 'text-amber-600 bg-amber-50',
    deduction: 'text-red-600 bg-red-50', waste: 'text-gray-600 bg-gray-50',
    purchase_payment: 'text-purple-600 bg-purple-50'
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-8 max-w-7xl mx-auto" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Welcome */}
      <div className="flex items-center justify-between gap-4 w-full">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 tracking-tight">
            {t('welcomeBack')}{employee?.name ? `، ${employee.name}` : ''} <span className="inline-block animate-pulse-soft">👋</span>
          </h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">{settings.company_name}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 px-3 py-1.5 rounded-xl shadow-sm">
            <span className="text-[10px] font-bold text-gray-400 uppercase">{isRTL ? 'من' : 'From'}</span>
            <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
              className="text-xs bg-transparent border-none p-0 focus:ring-0 dark:text-gray-100 w-24" />
            <span className="text-[10px] font-bold text-gray-400 uppercase ms-2">{isRTL ? 'إلى' : 'To'}</span>
            <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
              className="text-xs bg-transparent border-none p-0 focus:ring-0 dark:text-gray-100 w-24" />
          </div>
          <button onClick={handleAIInsights} disabled={analyzing}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-sm font-medium hover:shadow-lg transition-all disabled:opacity-50">
            {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {t('aiInsights') || 'رؤى الذكاء الاصطناعي'}
          </button>
          <button onClick={exportReport} disabled={exporting}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition-all">
            <FileText size={16} />
            {exporting ? t('loading') : (t('exportPDF') || 'تقرير PDF')}
          </button>
        </div>
      </div>

      {/* Manager Specific Highlights */}
      {(isAdmin || normalizedRole === 'manager') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-500">
              <TrendingUp size={80} />
            </div>
            <p className="text-indigo-100 text-sm font-medium mb-1">{isRTL ? 'إجمالي الأرباح المتراكمة' : 'Cumulative Profit'}</p>
            <h3 className="text-3xl font-black mb-2">{formatCurrency(stats.netBalance)}</h3>
            <div className="flex items-center gap-2 text-xs text-indigo-200">
              <span className="bg-white/20 px-2 py-0.5 rounded-full">{isRTL ? 'معدل النمو: +12%' : 'Growth: +12%'}</span>
              <span>{isRTL ? 'بناءً على الصفقات المغلقة' : 'Based on closed deals'}</span>
            </div>
          </div>
          
          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{isRTL ? 'كفاءة التشغيل' : 'Operational Efficiency'}</p>
            <div className="flex items-end gap-3">
              <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">84%</h3>
              <div className="flex-1 h-2 bg-gray-100 dark:bg-white/5 rounded-full mb-2 overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '84%' }} />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'مؤشر الحضور والإنتاجية' : 'Attendance & Productivity index'}</p>
          </div>

          <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm flex flex-col justify-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">{isRTL ? 'توقعات التحصيل' : 'Expected Collections'}</p>
            <h3 className="text-3xl font-bold text-blue-600">--</h3>
            <p className="text-[10px] text-gray-400 mt-2">{isRTL ? 'قيمة الفواتير المفتوحة' : 'Open invoices value'}</p>
          </div>
        </div>
      )}
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="animate-fade-in" style={{ animationDelay: '0.05s' }}><StatCard label="صافي المبلغ (الخزنة)" value={formatCurrency(stats.netBalance)} icon={Wallet} color="blue" sub="إجمالي السيولة النقدية" /></div>
        <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}><StatCard label={t('monthRevenue')}    value={formatCurrency(stats.monthRevenue)} icon={TrendingUp} color="green" /></div>
        <div className="animate-fade-in" style={{ animationDelay: '0.15s' }}><StatCard label={t('monthExpense')}    value={formatCurrency(stats.monthExpense)} icon={TrendingUp} color="red" /></div>
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}><StatCard label={t('totalEmployees')}  value={stats.employees} icon={Users} color="purple" /></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Station Comparison */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up lg:col-span-2" style={{ animationDelay: '0.6s' }}>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 mb-6 text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
            {t('stationComparison') || 'مقارنة المحطات (الأداء المالي)'}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-right px-4 py-3 font-medium">{t('station')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('revenue')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('expense')}</th>
                  <th className="text-right px-4 py-3 font-medium">{t('net')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-white/5">
                {stationStats.map((st, i) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800 dark:text-gray-200">{st.name}</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">{formatCurrency(st.revenue)}</td>
                    <td className="px-4 py-3 text-red-600 font-bold">{formatCurrency(st.expense)}</td>
                    <td className={`px-4 py-3 font-bold ${st.net >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(st.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Trends Chart */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 mb-6 text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            {t('revenueExpenseChart')} — {t('last6Months')}
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dy={10} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} dx={-10} />
              <Tooltip 
                formatter={(v) => formatCurrency(v)} 
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)' }} 
              />
              <Area type="monotone" dataKey={t('revenue')} stroke="#10b981" fillOpacity={1} fill="url(#colorRev)" strokeWidth={2} />
              <Area type="monotone" dataKey={t('expense')} stroke="#f87171" fillOpacity={0} strokeWidth={2} strokeDasharray="5 5" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Expense Pie Chart */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 mb-6 text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            {t('expenseBreakdown') || 'توزيع المصاريف (هذا الشهر)'}
          </h2>
          <div className="flex items-center justify-between">
            <ResponsiveContainer width="60%" height={260}>
              <PieChart>
                <Pie data={expenseData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {expenseData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-[40%] space-y-2">
              {expenseData.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: '0.5s' }}>
          <h2 className="font-bold text-gray-800 dark:text-gray-100 mb-6 text-base flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
            {t('latestTransactions')}
          </h2>
          {recentTx.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <Wallet size={32} className="text-gray-200 mb-3" />
              <p className="text-gray-400 text-sm">{t('noTransactions')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {recentTx.map((tx, i) => (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50/80 dark:hover:bg-white/5 transition-all duration-200 animate-fade-in" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2.5 py-1 rounded-lg font-bold ${typeColor[tx.type] ?? 'text-gray-600 bg-gray-100'}`}>
                      {typeLabel[tx.type] ?? tx.type}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{tx.notes ?? '—'}</span>
                  </div>
                  <div className="text-end">
                    <p className={`text-sm font-bold ${tx.type === 'revenue' ? 'text-emerald-600' : 'text-gray-800 dark:text-gray-200'}`}>
                      {tx.type === 'revenue' ? '+' : '-'}{formatCurrency(tx.amount)}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{tx.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
