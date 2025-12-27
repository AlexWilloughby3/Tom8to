import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { accountService, authService } from '../api/services';
import './Settings.css';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved === 'true';
  });

  const [soundNotifications, setSoundNotifications] = useState(() => {
    const saved = localStorage.getItem('soundNotifications');
    return saved === 'true';
  });

  const [browserNotifications, setBrowserNotifications] = useState(() => {
    const saved = localStorage.getItem('browserNotifications');
    return saved === 'true';
  });

  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('darkMode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('soundNotifications', soundNotifications.toString());
  }, [soundNotifications]);

  useEffect(() => {
    localStorage.setItem('browserNotifications', browserNotifications.toString());
  }, [browserNotifications]);

  const handleToggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const handleToggleSoundNotifications = () => {
    setSoundNotifications(!soundNotifications);
  };

  const handleToggleBrowserNotifications = async () => {
    if (!browserNotifications) {
      // Request permission when enabling
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          setBrowserNotifications(true);
        } else {
          setError('Browser notification permission denied');
        }
      } else {
        setError('Browser notifications not supported');
      }
    } else {
      setBrowserNotifications(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    setError(null);
    setMessage(null);
    setLoading(true);
    if (!user) return;
    try {
      const res = await accountService.requestPasswordReset(user.email);
      setMessage(res.message || 'Password reset email sent! Check your inbox.');
    } catch (err: any) {
      setError(err?.message || 'Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!confirm('Are you sure you want to permanently delete your account?')) return;
    try {
      await authService.deleteUser(user.email);
      logout();
      navigate('/register');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete account');
    }
  };

  return (
    <div className="settings-page">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Dark Mode</h3>
            <p>Toggle dark mode for a comfortable viewing experience</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={handleToggleDarkMode}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Notifications</h2>
        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Sound Notifications</h3>
            <p>Play a sound when pomodoro timer transitions between work and break</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={soundNotifications}
              onChange={handleToggleSoundNotifications}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>

        <div className="settings-option">
          <div className="settings-option-info">
            <h3>Browser Notifications</h3>
            <p>Show desktop notifications when pomodoro timer completes or transitions</p>
          </div>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={browserNotifications}
              onChange={handleToggleBrowserNotifications}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>Reset Password</h2>
        <p>We'll send you an email with a link to reset your password.</p>
        <button
          onClick={handleRequestPasswordReset}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Password Reset Email'}
        </button>
      </section>

      <section className="settings-section">
        <h2>Account</h2>
        <p>Delete your account permanently. This will remove all your data.</p>
        <button onClick={handleDeleteAccount} className="btn btn-primary">Delete Account</button>
      </section>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
