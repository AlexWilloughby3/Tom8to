import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { PomodoroProvider } from './contexts/PomodoroContext'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Timer from './pages/Timer'
import Goals from './pages/Goals'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  return user ? <>{children}</> : <Navigate to="/login" />
}

function App() {
  return (
    <AuthProvider>
      <PomodoroProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/" element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="timer" element={<Timer />} />
              <Route path="goals" element={<Goals />} />
            </Route>
          </Routes>
        </Router>
      </PomodoroProvider>
    </AuthProvider>
  )
}

export default App
