import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})
export const useAuth = () => useContext(AuthContext)

// Role-based page permissions
export const ROLE_PERMISSIONS = {
  admin:      ['dashboard','employees','attendance','clients','deals','products','suppliers','transactions','invoices','payroll','settings','activity','profile','tasks','chat'],
  manager:    ['dashboard','employees','attendance','clients','deals','products','suppliers','transactions','invoices','payroll','activity','profile','tasks','chat'],
  accountant: ['clients','deals','transactions','invoices','payroll','profile','tasks','chat'],
  sales:      ['clients','deals','products','invoices','profile','tasks','chat'],
  hr:         ['employees','attendance','payroll','profile','tasks','chat'],
  labor:      ['profile','tasks','chat'],
  employee:   ['profile','tasks','chat'],
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [employee, setEmployee] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.email)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchEmployee(session.user.email)
      else { setEmployee(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const [dynamicRoles, setDynamicRoles] = useState({})

  async function fetchEmployee(email) {
    const { data: empData } = await supabase.from('employees').select('*').eq('email', email).single()
    const { data: setts } = await supabase.from('settings').select('*').single()
    
    setEmployee(empData)
    if (setts?.dynamic_roles) {
      setDynamicRoles(setts.dynamic_roles)
    }
    setLoading(false)
  }

  // Normalize role to lowercase english key or keep dynamic
  const getNormalizedRole = (emp) => {
    if (!emp?.role) return 'employee'
    const roleMap = {
      'admin': 'admin', 'مدير': 'admin', 'مدير النظام (admin)': 'admin', 'مدير النظام (Admin)': 'admin',
      'manager': 'manager', 'مشرف': 'manager', 'مدير عام (manager)': 'manager', 'مدير عام (Manager)': 'manager',
      'accountant': 'accountant', 'محاسب': 'accountant', 'محاسب مالي (accountant)': 'accountant', 'محاسب مالي (Accountant)': 'accountant',
      'sales': 'sales', 'مبيعات': 'sales', 'مسؤول مبيعات (sales)': 'sales', 'مسؤول مبيعات (Sales)': 'sales',
      'hr': 'hr', 'موارد بشرية': 'hr', 'موارد بشرية (hr)': 'hr', 'موارد بشرية (HR)': 'hr',
      'labor': 'labor', 'عامل': 'labor', 'فني / عامل (labor)': 'labor', 'فني / عامل (Labor)': 'labor',
      'employee': 'employee', 'موظف': 'employee', 'موظف (employee)': 'employee', 'موظف (Employee)': 'employee',
      'pending': 'pending'
    }
    const raw = emp.role
    const lower = raw.toLowerCase()
    
    if (dynamicRoles[raw]) return raw // It's a custom dynamic role
    
    return roleMap[lower] || 'employee'
  }

  const normalizedRole = getNormalizedRole(employee)
  const isAdmin = normalizedRole === 'admin'
  const permissions = dynamicRoles[normalizedRole] ?? ROLE_PERMISSIONS[normalizedRole] ?? ROLE_PERMISSIONS.employee

  const canAccess = (page) => {
    if (isAdmin) return true // Admin can access everything
    return permissions.includes(page)
  }

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password })
  const signInWithGoogle = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
  const signOut = () => supabase.auth.signOut()

  const signUp = async (email, password, name) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })

    return { data, error }
  }

  return (
    <AuthContext.Provider value={{
      user, employee, loading,
      signIn, signInWithGoogle, signOut, signUp,
      isAdmin,
      normalizedRole,
      permissions,
      canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
