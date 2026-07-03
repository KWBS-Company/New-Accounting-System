import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { ThemeProvider } from '@/context/ThemeContext'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'
import { isSuperAdmin } from '@/lib/roles'
import type { ReactNode } from 'react'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import VerifyEmail from '@/pages/VerifyEmail'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import GoogleSSO from '@/pages/GoogleSSO'
import InviteUser from '@/pages/InviteUser'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import Accounts from '@/pages/Accounts'
import Transactions from '@/pages/Transactions'
import TransactionRules from '@/pages/TransactionRules'
import Reports from '@/pages/Reports'
import Users from '@/pages/Users'
import Customers from '@/pages/Customers'
import LoanInterestCalculator from './pages/LoanInterest'
import Chat from './pages/Chat'

/**
 * Hide every accounting-system route from super_admin. They can only see
 * Users, Customers, and their own Profile. A direct URL hit redirects to
 * /users (the super_admin landing page).
 */
function NotForSuperAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  if (isSuperAdmin(user)) {
    return <Navigate to="/users" replace />
  }
  return <>{children}</>
}

/**
 * Decide the index landing page based on role:
 *   super_admin   → /users
 *   everyone else → Dashboard (the "Ledger" page)
 */
function IndexLanding() {
  const { user } = useAuth()
  if (isSuperAdmin(user)) {
    return <Navigate to="/users" replace />
  }
  return <Dashboard />
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/google-sso" element={<GoogleSSO />} />
            <Route path="/invite-user" element={<InviteUser />} />

            {/* Protected — share the Layout shell */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<IndexLanding />} />
              <Route path="/profile" element={<Profile />} />
              <Route
                path="/accounts"
                element={
                  <NotForSuperAdmin>
                    <Accounts />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/chat"
                element={
                  <NotForSuperAdmin>
                    <Chat />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/chat/:chatId"
                element={
                  <NotForSuperAdmin>
                    <Chat />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/loan-interest-calculator"
                element={
                  <NotForSuperAdmin>
                    <LoanInterestCalculator />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/transactions"
                element={
                  <NotForSuperAdmin>
                    <Transactions />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/transaction-rules"
                element={
                  <NotForSuperAdmin>
                    <TransactionRules />
                  </NotForSuperAdmin>
                }
              />
              <Route
                path="/reports"
                element={
                  <NotForSuperAdmin>
                    <Reports />
                  </NotForSuperAdmin>
                }
              />
              <Route path="/users" element={<Users />} />
              <Route path="/customers" element={<Customers />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
