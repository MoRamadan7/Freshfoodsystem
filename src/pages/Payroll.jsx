import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { logActivity } from '../lib/logger'
import { useSettings } from '../contexts/SettingsContext'
import { useLang } from '../contexts/LangContext'
import { useAuth } from '../contexts/AuthContext'
import { exportToExcel } from '../lib/exportHelpers'
import { generatePayrollHTML } from '../lib/payrollTemplate'
import toast from 'react-hot-toast'
import { Calculator, FileDown, Printer, CheckCircle, ChevronDown, RefreshCw } from 'lucide-react'

const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
const MONTHS_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']

export default function Payroll() {
  const { settings, formatCurrency } = useSettings()
  const { t, lang, isRTL } = useLang()
  const { employee, isAdmin, normalizedRole } = useAuth()

  const [fromDate, setFromDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0])
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0])
  const [statusFilter, setStatusFilter] = useState('')
  const [records, setRecords] = useState([])
  const [stations, setStations] = useState([])
  const [stationFilter, setStationFilter] = useState('')
  const [loading, setLoading]   = useState(false)
  const [processing, setProcessing] = useState(false)

  const months = lang === 'ar' ? MONTHS_AR : MONTHS_EN

  const loadPayroll = useCallback(async () => {
    if (!employee) return
    setLoading(true)
    const month = new Date(fromDate).getMonth() + 1
    const year = new Date(fromDate).getFullYear()
    
    let query = supabase
      .from('payroll_records')
      .select('*, employees(name, email, station_id)')
      .eq('month', month)
      .eq('year', year)
      
    if (!isAdmin && normalizedRole !== 'manager' && normalizedRole !== 'hr') {
      query = query.eq('employee_id', employee.id)
    }

    const { data: existing } = await query

    if (existing && existing.length > 0) {
      const mapped = existing.map(r => ({ ...r, employee_name: r.employees?.name }))
      mapped.sort((a,b) => (a.employee_name||'').localeCompare(b.employee_name||''))
      setRecords(mapped)
    } else {
      setRecords([])
    }
    setLoading(false)
  }, [fromDate, employee, isAdmin, normalizedRole])

  useEffect(() => { loadPayroll() }, [loadPayroll])

  useEffect(() => {
    supabase.from('stations').select('*').order('name').then(({ data }) => setStations(data ?? []))
  }, [])

  const filteredRecords = records.filter(r => 
    (!statusFilter || r.status === statusFilter) &&
    (!stationFilter || r.employees?.station_id === Number(stationFilter))
  )

  const calculatePayroll = async () => {
    setProcessing(true)
    try {
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, employee_type, basic_salary, daily_rate, hourly_rate, overtime_rate')
        .eq('is_active', true)
        .order('name')

      if (!employees?.length) { toast.error(t('noActiveEmployees')); return }

      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id, status, daily_overtime')
        .gte('date', fromDate)
        .lte('date', toDate)

      const { data: advances } = await supabase
        .from('transactions')
        .select('employee_id, amount, type')
        .gte('date', fromDate)
        .lte('date', toDate)
        .in('type', ['advance', 'deduction'])

      const currentMonth = new Date(fromDate).getMonth() + 1
      const currentYear = new Date(fromDate).getFullYear()

      const newRecords = employees.map(emp => {
        const empAtt = attendance?.filter(a => a.employee_id === emp.id) || []
        const presentDays = empAtt.filter(a => a.status === 'present').length
        const absentDays  = empAtt.filter(a => a.status === 'absent').length
        const overtimeHrs = empAtt.reduce((s, a) => s + Number(a.daily_overtime || 0), 0)

        const isDaily   = emp.employee_type === 'daily'
        const basic     = isDaily ? 0 : Number(emp.basic_salary || 0)
        const dailyAmt  = isDaily ? presentDays * Number(emp.daily_rate || 0) : 0
        
        let otRate = Number(emp.overtime_rate || 0)
        if (otRate === 0) {
          otRate = isDaily ? Number(settings?.daily_overtime_rate || 0) : Number(settings?.monthly_overtime_rate || 0)
        }
        
        const otAmount  = overtimeHrs * otRate
        const absDeduction = !isDaily && absentDays > 0 ? (basic / 30) * absentDays : 0
        const empAdv   = (advances || []).filter(a => a.employee_id === emp.id)
        const advTotal = empAdv.filter(a => a.type === 'advance').reduce((s, a) => s + Number(a.amount), 0)
        const dedTotal = empAdv.filter(a => a.type === 'deduction').reduce((s, a) => s + Number(a.amount), 0)

        const grossPay = isDaily ? dailyAmt : basic
        const net      = grossPay - absDeduction + otAmount - dedTotal - advTotal

        return {
          employee_id: emp.id,
          employee_name: emp.name,
          month: currentMonth, 
          year: currentYear,
          basic_salary: grossPay,
          attendance_days: presentDays,
          absence_days: absentDays,
          overtime_hours: overtimeHrs,
          overtime_amount: otAmount,
          bonuses: 0,
          deductions: dedTotal,
          advances: advTotal,
          net_salary: Math.max(0, net),
          status: 'draft',
        }
      })

      for (const rec of newRecords) {
        const { employee_name, ...payload } = rec
        await supabase.from('payroll_records')
          .upsert(payload, { onConflict: 'employee_id,month,year' })
      }

      toast.success(lang === 'ar' ? 'تم حساب الرواتب' : 'Payroll calculated')
      logActivity(employee, 'إضافة/تحديث', 'الرواتب', null, `حساب الرواتب للفترة من ${fromDate} إلى ${toDate}`)
      await loadPayroll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const updateRecord = (id, field, value) => {
    setRecords(prev => prev.map(r => {
      if (r.id !== id) return r
      const updated = { ...r, [field]: Number(value) }
      updated.net_salary = Math.max(0,
        updated.basic_salary
        - ((updated.absence_days / 30) * updated.basic_salary)
        + updated.overtime_amount
        + updated.bonuses
        - updated.deductions
        - updated.advances
      )
      return updated
    }))
  }

  const saveRecord = async (rec) => {
    const { employee_name, employees, ...payload } = rec
    const { error } = await supabase.from('payroll_records').update(payload).eq('id', rec.id)
    if (error) toast.error(error.message)
    else toast.success(lang === 'ar' ? 'تم الحفظ' : 'Saved')
  }

  const payAll = async () => {
    const unpaid = records.filter(r => r.status !== 'paid')
    if (!unpaid.length) { toast(lang === 'ar' ? 'كل الرواتب مصروفة' : 'All salaries already paid'); return }
    if (!confirm(t('payrollConfirm'))) return
    setProcessing(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const periodLabel = isRTL ? `من ${fromDate} إلى ${toDate}` : `From ${fromDate} To ${toDate}`
      for (const rec of unpaid) {
        await supabase.from('payroll_records')
          .update({ status: 'paid', paid_at: new Date().toISOString() })
          .eq('id', rec.id)
        await supabase.from('transactions').insert({
          date: today, type: 'salary',
          amount: rec.net_salary,
          employee_id: rec.employee_id,
          payment_method: 'cash',
          notes: `${lang === 'ar' ? 'راتب' : 'Salary'} (${periodLabel}) — ${rec.employee_name}`,
        })
      }
      toast.success(t('payrollSuccess'))
      await loadPayroll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const paySingle = async (rec) => {
    if (rec.status === 'paid') { toast(lang === 'ar' ? 'مصروف بالفعل' : 'Already paid'); return }
    if (!confirm(t('payrollConfirm'))) return
    setProcessing(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const periodLabel = isRTL ? `من ${fromDate} إلى ${toDate}` : `From ${fromDate} To ${toDate}`
      await supabase.from('payroll_records')
        .update({ status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', rec.id)
      await supabase.from('transactions').insert({
        date: today, type: 'salary',
        amount: rec.net_salary,
        employee_id: rec.employee_id,
        payment_method: 'cash',
        notes: `${lang === 'ar' ? 'راتب' : 'Salary'} (${periodLabel}) — ${rec.employee_name}`,
      })
      toast.success(t('payrollSuccess'))
      await loadPayroll()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleExcel = () => {
    const data = records.map(r => ({
      [lang === 'ar' ? 'الموظف' : 'Employee']: r.employee_name,
      [lang === 'ar' ? 'الأساسي' : 'Basic']: r.basic_salary,
      [lang === 'ar' ? 'الحضور' : 'Present']: r.attendance_days,
      [lang === 'ar' ? 'الغياب' : 'Absent']: r.absence_days,
      [lang === 'ar' ? 'إضافي' : 'Overtime']: r.overtime_amount,
      [lang === 'ar' ? 'مكافآت' : 'Bonuses']: r.bonuses,
      [lang === 'ar' ? 'خصومات' : 'Deductions']: r.deductions,
      [lang === 'ar' ? 'سلف' : 'Advances']: r.advances,
      [lang === 'ar' ? 'الصافي' : 'Net']: r.net_salary,
      [lang === 'ar' ? 'الحالة' : 'Status']: r.status,
    }))
    exportToExcel(data, `payroll-${fromDate}-to-${toDate}`, lang === 'ar' ? 'الرواتب' : 'Payroll')
  }

  const handlePrint = () => {
    const period = isRTL ? `من ${fromDate} إلى ${toDate}` : `From ${fromDate} To ${toDate}`
    const html = generatePayrollHTML(filteredRecords, period, settings)
    const win = window.open('', '_blank')
    if (win) {
      win.document.write(html)
      win.document.close()
    } else {
      toast.error(isRTL ? 'يرجى السماح بالنوافذ المنبثقة' : 'Please allow pop-ups')
    }
  }

  const totalNet = records.reduce((s, r) => s + Number(r.net_salary || 0), 0)
  const paidCount = records.filter(r => r.status === 'paid').length

  const InputCell = ({ rec, field, step = '1' }) => (
    <input
      type="number" min="0" step={step}
      value={rec[field]}
      onChange={e => updateRecord(rec.id, field, e.target.value)}
      onBlur={() => saveRecord(rec)}
      disabled={rec.status === 'paid'}
      className="w-20 border border-gray-200 rounded px-2 py-1 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-400 disabled:bg-gray-50 disabled:text-gray-400"
    />
  )

  return (
    <div className="space-y-4" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">{t('payrollTitle')}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{t('payrollSubtitle')}</p>
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
          
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-800 dark:text-white">
            <option value="">{t('allRoles')}</option>
            <option value="draft">{t('payrollDraft')}</option>
            <option value="paid">{t('payrollPaid')}</option>
          </select>
          <select value={stationFilter} onChange={e => setStationFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white dark:bg-gray-800 dark:text-white">
            <option value="">{t('allStations')}</option>
            {stations.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {(isAdmin || normalizedRole === 'manager' || normalizedRole === 'hr') && (
            <button onClick={calculatePayroll} disabled={processing}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-all disabled:opacity-60 shadow-lg shadow-emerald-600/10">
              {processing ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
              {t('calculatePayroll')}
            </button>
          )}
          <button onClick={handleExcel}
            className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-all">
            <FileDown size={14} /> {t('exportPayroll')}
          </button>
          <button onClick={handlePrint}
            className="flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors">
            <Printer size={14} /> {t('exportPDF')}
          </button>
          {(isAdmin || normalizedRole === 'manager' || normalizedRole === 'hr') && records.length > 0 && records.some(r => r.status !== 'paid') && (
            <button onClick={payAll} disabled={processing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60">
              <CheckCircle size={15} /> {t('payAll')}
            </button>
          )}
        </div>
      </div>

      {records.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{lang === 'ar' ? 'إجمالي الرواتب' : 'Total Payroll'}</p>
            <p className="text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">{formatCurrency(totalNet)}</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs text-gray-500">{lang === 'ar' ? 'مصروف' : 'Paid'}</p>
            <p className="text-xl font-bold text-blue-700 mt-1">{paidCount} / {records.length}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-4">
            <p className="text-xs text-gray-500">{lang === 'ar' ? 'متبقي' : 'Remaining'}</p>
            <p className="text-xl font-bold text-amber-700 mt-1">
              {formatCurrency(records.filter(r => r.status !== 'paid').reduce((s, r) => s + Number(r.net_salary || 0), 0))}
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>
      ) : records.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-12 text-center">
          <Calculator size={40} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">{t('noPayroll')}</p>
          <p className="text-gray-300 dark:text-gray-600 text-xs mt-1">{lang === 'ar' ? 'اضغط "إنشاء كشف الرواتب" لحساب رواتب الفترة المحددة' : 'Click "Generate Payroll" to calculate salaries for the selected period'}</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 text-gray-500 dark:text-gray-400 text-xs">
                <tr>
                  <th className="text-start px-4 py-3 font-medium">{lang === 'ar' ? 'الموظف' : 'Employee'}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('basicSalary')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('attendanceDays')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('overtimeAmount')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('bonuses')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('deductions')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('advances')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('netSalary')}</th>
                  <th className="text-center px-3 py-3 font-medium">{t('status')}</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredRecords.map(rec => (
                  <tr key={rec.id} className={`hover:bg-gray-50 transition-colors ${rec.status === 'paid' ? 'opacity-75' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {rec.employee_name?.[0]}
                        </div>
                        <span className="font-medium text-gray-800 text-sm">{rec.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center text-xs text-gray-700">{formatCurrency(rec.basic_salary)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rec.absence_days > 0 ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {rec.attendance_days} / {rec.attendance_days + rec.absence_days}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <InputCell rec={rec} field="overtime_amount" step="0.5" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <InputCell rec={rec} field="bonuses" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <InputCell rec={rec} field="deductions" />
                    </td>
                    <td className="px-3 py-3 text-center">
                      <InputCell rec={rec} field="advances" />
                    </td>
                    <td className="px-3 py-3 text-center font-bold text-emerald-700">{formatCurrency(rec.net_salary)}</td>
                    <td className="px-3 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        rec.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {rec.status === 'paid' ? t('payrollPaid') : t('payrollDraft')}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {rec.status !== 'paid' && (
                        <button onClick={() => paySingle(rec)} disabled={processing}
                          className="text-xs px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors disabled:opacity-60">
                          {t('paySingle')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
