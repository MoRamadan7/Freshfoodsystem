import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { initAI } from '../lib/ai'
import toast from 'react-hot-toast'

const SettingsContext = createContext({})
export const useSettings = () => useContext(SettingsContext)

const DEFAULT_SETTINGS = {
  company_name: 'FRESH FOOD',
  logo_url: '/logo.png',
  sidebar_logo_url: '/logo.png',
  address: '',
  phone: '',
  email: '',
  tax_number: '',
  currency: 'EGP',
  currency_symbol: 'ج.م',
  language: 'ar',
  // Invoice settings
  invoice_notes: '',
  invoice_footer: 'شكراً لتعاملكم معنا',
  invoice_color: '#059669',
  invoice_prefix: 'FF-',
  invoice_tax_rate: 0,
  invoice_show_logo: true,
  invoice_show_tax: true,
  // Payroll settings
  payroll_day: 1,
  working_hours: 8,
  late_penalty_per_hour: 0,
  // Notification settings
  notify_low_stock: true,
  notify_low_stock_days: 5,
  notify_deals_closing: true,
  notify_deals_closing_days: 7,
  notify_overdue_invoices: true,
  notify_birthdays: true,
  notify_payroll: true,
  gemini_api_key: '',
  announcement_text: '',
  header_layout: 'standard', // 'standard' or 'centered'
  notification_sound_url: '/sounds/notification.mp3', // Default sound
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [settingsId, setSettingsId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .limit(1)
        .single()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error)
        return
      }

      if (data) {
        setSettings({ ...DEFAULT_SETTINGS, ...data })
        setSettingsId(data.id)
        if (data.gemini_api_key) initAI(data.gemini_api_key)
      }
    } catch (err) {
      console.error('Settings fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  const updateSettings = async (newSettings) => {
    setSaving(true)
    try {
      let result
      if (settingsId) {
        result = await supabase
          .from('company_settings')
          .update(newSettings)
          .eq('id', settingsId)
          .select()
          .single()
      } else {
        result = await supabase
          .from('company_settings')
          .insert(newSettings)
          .select()
          .single()
      }

      if (result.error) throw result.error

      setSettings(prev => ({ ...prev, ...result.data }))
      setSettingsId(result.data.id)
      if (result.data.gemini_api_key) initAI(result.data.gemini_api_key)
      return { success: true }
    } catch (err) {
      console.error('Settings update error:', err)
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }

  const uploadLogo = async (file) => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `logo-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName)

      return { success: true, url: urlData.publicUrl }
    } catch (err) {
      console.error('Logo upload error:', err)
      return { success: false, error: err.message }
    }
  }

  // Helper: format currency using settings
  const formatCurrency = useCallback((amount) => {
    const sym = settings.currency_symbol || settings.currency || 'ج.م'
    return `${Number(amount || 0).toLocaleString()} ${sym}`
  }, [settings.currency_symbol, settings.currency])

  return (
    <SettingsContext.Provider value={{
      settings,
      loading,
      saving,
      updateSettings,
      uploadLogo,
      refetchSettings: fetchSettings,
      formatCurrency,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}
