import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { verificationService } from '../api/services';
import './Auth.css';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      const res = await verificationService.requestCode(email);
      setMessage(res.message || 'If email is registered, a code has been sent');
      // Auto-navigate to login with code after successful send
      setTimeout(() => {
        navigate('/login-with-code');
      }, 1500);
    } catch (err) {
      setError('Failed to request verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card card">
        <button
          onClick={() => navigate('/login')}
          className="back-arrow"
          type="button"
          aria-label="Back to login"
        >
          ← Back
        </button>
        <h1>Forgot Password</h1>
        <p className="auth-subtitle">Enter your email to receive a verification code</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          {error && <div className="error">{error}</div>}
          {message && <div className="message">{message}</div>}

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Sending...' : 'Send verification code'}
          </button>
        </form>

        <p className="auth-footer">Check your email for the code, then use "Login with code" to sign in.</p>
      </div>
    </div>
  );
}
