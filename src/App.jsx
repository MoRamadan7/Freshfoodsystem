import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { SettingsProvider } from './contexts/SettingsContext'
import { LangProvider, useLang } from './contexts/LangContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import Attendance from './pages/Attendance'
import Clients from './pages/Clients'
import Products from './pages/Products'
import Deals from './pages/Deals'
import Transactions from './pages/Transactions'
import Suppliers from './pages/Suppliers'
import Settings from './pages/Settings'
import Invoices from './pages/Invoices'
import Payroll from './pages/Payroll'
import Profile from './pages/Profile'
import ActivityLogs from './pages/ActivityLogs'
import Tasks from './pages/Tasks'
import Chat from './pages/Chat'
import AIChatbot from './components/AIChatbot'
import ClientPortal from './pages/ClientPortal'
import PendingApproval from './pages/PendingApproval'

function PrivateRoute({ children, page }) {
  const { user, loading, canAccess, employee, isAdmin } = useAuth()
  const { t, isRTL } = useLang()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50" dir={isRTL ? 'rtl' : 'ltr'}>
      <div className="text-center">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-500 text-sm">{t('loading')}</p>
      </div>
    </div>
  )
  
  if (!user) return <Navigate to="/login" />
  
  // Strict active check: If not active and not super admin, go to pending
  if (!employee?.is_active && !isAdmin) {
    if (window.location.pathname !== '/pending') return <Navigate to="/pending" replace />
  }

  if (page && !canAccess(page)) return <Navigate to="/profile" replace />
  
  return children
}

function AppContent() {
  const { isRTL } = useLang()
  const { normalizedRole, employee, isAdmin } = useAuth()

  // Helper to redirect roles
  const RoleRedirect = ({ roles, children }) => {
    if (!employee?.is_active && !isAdmin) return <Navigate to="/pending" replace />
    return roles.includes(normalizedRole) ? children : <Navigate to="/profile" replace />
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            fontFamily: 'inherit',
            direction: isRTL ? 'rtl' : 'ltr',
            borderRadius: '12px',
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#10b981', secondary: '#fff' } },
        }}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/portal" element={<ClientPortal />} />
        <Route path="/pending" element={<PendingApproval />} />
        
        <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
          <Route index element={
            <RoleRedirect roles={['admin', 'manager']}>
              <Dashboard />
            </RoleRedirect>
          } />
          <Route path="employees" element={<PrivateRoute page="employees"><Employees /></PrivateRoute>} />
          <Route path="attendance" element={<PrivateRoute page="attendance"><Attendance /></PrivateRoute>} />
          <Route path="clients" element={<PrivateRoute page="clients"><Clients /></PrivateRoute>} />
          <Route path="products" element={<PrivateRoute page="products"><Products /></PrivateRoute>} />
          <Route path="deals" element={<PrivateRoute page="deals"><Deals /></PrivateRoute>} />
          <Route path="invoices" element={<PrivateRoute page="invoices"><Invoices /></PrivateRoute>} />
          <Route path="transactions" element={<PrivateRoute page="transactions"><Transactions /></PrivateRoute>} />
          <Route path="payroll" element={<PrivateRoute page="payroll"><Payroll /></PrivateRoute>} />
          <Route path="suppliers" element={<PrivateRoute page="suppliers"><Suppliers /></PrivateRoute>} />
          <Route path="settings" element={<PrivateRoute page="settings"><Settings /></PrivateRoute>} />
          <Route path="profile" element={<PrivateRoute page="profile"><Profile /></PrivateRoute>} />
          <Route path="activity" element={<PrivateRoute page="activity"><ActivityLogs /></PrivateRoute>} />
          <Route path="tasks" element={<PrivateRoute page="tasks"><Tasks /></PrivateRoute>} />
          <Route path="chat" element={<PrivateRoute page="chat"><Chat /></PrivateRoute>} />
        </Route>
      </Routes>
      <AIChatbot />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <LangProvider>
          <AppContent />
        </LangProvider>
      </SettingsProvider>
    </AuthProvider>
  )
}
