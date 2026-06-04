import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import { ThemeProvider } from '@/context/ThemeContext'
import Layout from '@/components/layout/Layout'
import ProtectedRoute from '@/components/ProtectedRoute'

import Login from '@/pages/Login'
import Register from '@/pages/Register'
import VerifyEmail from '@/pages/VerifyEmail'
import ForgotPassword from '@/pages/ForgotPassword'
import ResetPassword from '@/pages/ResetPassword'
import Dashboard from '@/pages/Dashboard'
import Profile from '@/pages/Profile'
import Accounts from '@/pages/Accounts'
import Transactions from '@/pages/Transactions'
import TransactionRules from '@/pages/TransactionRules'
import Reports from '@/pages/Reports'

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public */}
            <Route path="/login"            element={<Login />} />
            <Route path="/register"         element={<Register />} />
            <Route path="/verify-email"     element={<VerifyEmail />} />
            <Route path="/forgot-password"  element={<ForgotPassword />} />
            <Route path="/reset-password"   element={<ResetPassword />} />

            {/* Protected — share the Layout shell */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/"                   element={<Dashboard />} />
              <Route path="/profile"            element={<Profile />} />
              <Route path="/accounts"           element={<Accounts />} />
              <Route path="/transactions"       element={<Transactions />} />
              <Route path="/transaction-rules"  element={<TransactionRules />} />
              <Route path="/reports"            element={<Reports />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
