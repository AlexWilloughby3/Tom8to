import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { accountService, authService } from '../api/services';

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    <div style={{ lineHeight: '2' }}>
      <h1>Settings</h1>

      <section>
        <h2>Reset Password</h2>
        <p style={{ marginBottom: '0.5rem' }}>We'll send you an email with a link to reset your password.</p>
        <button
          onClick={handleRequestPasswordReset}
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send Password Reset Email'}
        </button>
      </section>

      <section style={{ marginTop: '2rem' }}>
        <h2>Account</h2>
        <p style={{ marginBottom: '0.5rem' }}>Delete your account permanently. This will remove all your data.</p>
        <button onClick={handleDeleteAccount} className="btn btn-danger">Delete Account</button>
      </section>

      {message && <div className="alert alert-success">{message}</div>}
      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
