import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { formatTime } from '../utils/formatters';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const {
    pomodoroRunning,
    pomodoroSeconds,
    currentCycle,
    isBreak,
    getCycles,
    stopwatchRunning,
    stopwatchSeconds
  } = usePomodoro();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Floating Pomodoro timer display */}
      {pomodoroRunning && pomodoroSeconds > 0 && (
        <div className={`floating-timer ${isBreak ? 'break-mode' : ''}`}>
          <div className="floating-timer-content">
            <div className="floating-timer-label">
              {isBreak ? '☕ Break' : '🍅 Focus'}
            </div>
            <div className="floating-timer-time">
              {formatTime(pomodoroSeconds)}
            </div>
            <div className="floating-timer-cycle">
              Cycle {currentCycle}/{getCycles()}
            </div>
          </div>
        </div>
      )}

      {/* Floating Stopwatch timer display */}
      {stopwatchRunning && stopwatchSeconds > 0 && (
        <div className="floating-timer" style={{ bottom: pomodoroRunning && pomodoroSeconds > 0 ? '170px' : '20px' }}>
          <div className="floating-timer-content">
            <div className="floating-timer-label">
              ⏱️ Stopwatch
            </div>
            <div className="floating-timer-time">
              {formatTime(stopwatchSeconds)}
            </div>
          </div>
        </div>
      )}

      <nav className="navbar">
        <div className="container">
          <div className="nav-content">
            <div className="nav-brand">
              <h2>Tomato</h2>
              <span className="user-id">@{user?.email}</span>
            </div>
            <div className="nav-links">
              <Link to="/" className="nav-link">Dashboard</Link>
              <Link to="/timer" className="nav-link">Timer</Link>
              <Link to="/goals" className="nav-link">Goals</Link>
              <Link to="/settings" className="nav-link">Settings</Link>
              <button onClick={handleLogout} className="btn btn-secondary">Logout</button>
            </div>
          </div>
        </div>
      </nav>
      <main className="main-content">
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
