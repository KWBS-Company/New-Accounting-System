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
            <Route path="/google-sso"       element={<GoogleSSO />} />
            <Route path="/invite-user"      element={<InviteUser />} />

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
              <Route path="/users"              element={<Users />} />
              <Route path="/customers"          element={<Customers />} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  )
}
