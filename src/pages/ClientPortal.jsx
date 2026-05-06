import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { FileText, Download, User, Calendar, CheckCircle, Clock } from 'lucide-react'
import { generateInvoicePDF, printInvoiceHTML } from '../lib/invoiceHelpers'
import { useSettings } from '../contexts/SettingsContext'

export default function ClientPortal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const token = searchParams.get('token')
  const { settings } = useSettings()

  const [inputToken, setInputToken] = useState('')
  const [client, setClient] = useState(null)
  const [deals, setDeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (token) {
      loadClientData(token)
    }
  }, [token])

  async function loadClientData(authToken) {
    setLoading(true)
    setError('')
    try {
      // 1. Find client by token
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('portal_token', authToken)
        .single()

      if (clientError || !clientData) throw new Error('رمز الدخول غير صحيح أو غير صالح.')
      setClient(clientData)

      // 2. Load deals for this client
      const { data: dealsData } = await supabase
        .from('deals')
        .select('*, items:deal_items(*, product:products(name)), employee:employees(name)')
        .eq('client_id', clientData.id)
        .order('created_date', { ascending: false })

      setDeals(dealsData || [])
    } catch (err) {
      setError(err.message)
      setClient(null)
    }
    setLoading(false)
  }

  const handleLogin = (e) => {
    e.preventDefault()
    if (!inputToken.trim()) return
    setSearchParams({ token: inputToken.trim() })
  }

  const statusColor = { contact: 'bg-blue-100 text-blue-700', negotiation: 'bg-amber-100 text-amber-700', contracted: 'bg-emerald-100 text-emerald-700', cancelled: 'bg-red-100 text-red-700' }
  const statusLabel = { contact: 'تواصل', negotiation: 'تفاوض', contracted: 'تعاقد', cancelled: 'ملغى' }

  if (!client) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 w-full max-w-md text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <User size={32} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">بوابة العملاء</h1>
          <p className="text-gray-500 text-sm mb-6">أدخل رمز الدخول السري (Portal Token) لمتابعة حسابك ومعاملاتك.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              value={inputToken}
              onChange={e => setInputToken(e.target.value)}
              placeholder="مثال: abc-123-xyz"
              className="w-full text-center border-2 border-gray-200 rounded-xl px-4 py-3 text-lg font-mono focus:border-emerald-500 focus:ring-0 outline-none transition-colors tracking-widest"
              required
            />
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-70 text-white font-bold py-3 rounded-xl transition-all shadow-sm"
            >
              {loading ? 'جاري التحقق...' : 'تسجيل الدخول'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-center md:text-right">
            {client.logo_url ? (
              <img src={client.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center font-bold text-2xl shadow-sm">
                {client.client_name[0]}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{client.client_name}</h1>
              <p className="text-gray-500 text-sm">{client.phone} | {client.country_city}</p>
            </div>
          </div>
          <button 
            onClick={() => setSearchParams({})}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition-colors font-medium"
          >
            تسجيل خروج
          </button>
        </div>

        {/* Dashboard Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs font-bold mb-1">إجمالي التعاقدات</p>
            <p className="text-xl font-black text-gray-800">{deals.filter(d => d.status === 'contracted').length}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-gray-500 text-xs font-bold mb-1">المديونية (حد ائتماني)</p>
            <p className="text-xl font-black text-red-600">{Number(client.credit_limit || 0).toLocaleString()} ج</p>
          </div>
        </div>

        {/* Deals History */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-lg text-gray-800">سجل الصفقات والفواتير</h2>
          </div>
          
          {deals.length === 0 ? (
            <div className="p-10 text-center text-gray-400">
              <FileText size={48} className="mx-auto mb-3 opacity-30" />
              <p>لا توجد صفقات أو فواتير مسجلة حالياً.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {deals.map(deal => (
                <div key={deal.id} className="p-5 hover:bg-gray-50 transition-colors flex flex-col md:flex-row gap-4 items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-gray-800 text-lg">{Number(deal.total_amount).toLocaleString()} ج</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor[deal.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabel[deal.status] || deal.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
                      <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(deal.created_date).toLocaleDateString('ar-EG')}</span>
                      <span className="flex items-center gap-1"><User size={12}/> المندوب: {deal.employee?.name}</span>
                    </div>
                  </div>
                  
                  {deal.status === 'contracted' && (
                    <div className="flex gap-2">
                      <button 
                        onClick={() => printInvoiceHTML(deal, settings)}
                        className="flex items-center gap-1.5 px-3 py-2 border-2 border-emerald-100 text-emerald-700 hover:bg-emerald-50 rounded-xl text-sm font-bold transition-colors"
                      >
                        <FileText size={16} /> عرض الفاتورة
                      </button>
                      <button 
                        onClick={() => generateInvoicePDF(deal, settings)}
                        className="flex items-center justify-center w-10 h-10 border-2 border-gray-100 text-gray-600 hover:bg-gray-50 rounded-xl transition-colors"
                        title="تحميل كملف PDF"
                      >
                        <Download size={16} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
