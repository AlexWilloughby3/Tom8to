import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PomodoroProvider } from './contexts/PomodoroContext'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import LoginWithCode from './pages/LoginWithCode'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Timer from './pages/Timer'
import Goals from './pages/Goals'
import Settings from './pages/Settings'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  useEffect(() => {
    // Initialize dark mode from localStorage on app load
    const savedDarkMode = localStorage.getItem('darkMode');
    if (savedDarkMode === 'true') {
      document.body.classList.add('dark-mode');
    }
  }, []);

  return (
    <AuthProvider>
      <PomodoroProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/login-with-code" element={<LoginWithCode />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="timer" element={<Timer />} />
              <Route path="goals" element={<Goals />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </Router>
      </PomodoroProvider>
    </AuthProvider>
  )
}

export default App
