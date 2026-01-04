import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { formatTime } from '../utils/formatters';
import './Layout.css';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    const saved = localStorage.getItem('sidebarOpen');
    return saved === null ? true : saved === 'true';
  });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const {
    pomodoroRunning,
    pomodoroSeconds,
    currentCycle,
    isBreak,
    getCycles,
    stopwatchRunning,
    stopwatchSeconds
  } = usePomodoro();

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/timer', label: 'Timer' },
    { path: '/goals', label: 'Goals' },
    { path: '/leaderboard', label: 'Leaderboard' },
    { path: '/settings', label: 'Settings' },
  ];

  // Update selected index based on current location
  useEffect(() => {
    const index = navItems.findIndex(item => item.path === location.pathname);
    if (index !== -1) {
      setSelectedIndex(index);
    }
  }, [location.pathname]);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarOpen', sidebarOpen.toString());
  }, [sidebarOpen]);

  // Vim-style navigation with j/k: move and immediately navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input, textarea, or select
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'j') {
        e.preventDefault();
        const newIndex = (selectedIndex + 1) % navItems.length;
        setSelectedIndex(newIndex);
        navigate(navItems[newIndex].path);
      } else if (e.key === 'k') {
        e.preventDefault();
        const newIndex = (selectedIndex - 1 + navItems.length) % navItems.length;
        setSelectedIndex(newIndex);
        navigate(navItems[newIndex].path);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
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

      {/* Sidebar toggle button */}
      <button
        className="sidebar-toggle"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? '←' : '→'}
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <div className="sidebar-header">
          <h2 className="sidebar-brand">Tomato</h2>
          <span className="sidebar-user">@{user?.email}</span>
          <button onClick={handleLogout} className="sidebar-logout-btn header-logout">
            Logout
          </button>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <Link
              key={item.path}
              to={item.path}
              className={`sidebar-link ${location.pathname === item.path ? 'active' : ''} ${selectedIndex === index ? 'selected' : ''}`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer" />
      </aside>

      {/* Main content */}
      <main className={`main-content ${sidebarOpen ? 'with-sidebar' : 'without-sidebar'}`}>
        <div className="container">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
