import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { focusSessionService } from '../api/services';
import { formatTime } from '../utils/formatters';
import './Timer.css';

export default function Timer() {
  const { user } = useAuth();
  const [isRunning, setIsRunning] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [category, setCategory] = useState('Work');
  const [customCategory, setCustomCategory] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const intervalRef = useRef<number | null>(null);

  const commonCategories = ['Work', 'Study', 'Reading', 'Exercise', 'Meditation', 'Custom'];

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = window.setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning]);

  const handleStart = () => {
    setIsRunning(true);
    setMessage('');
    setError('');
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleStop = async () => {
    setIsRunning(false);

    if (seconds === 0) {
      setError('Timer must run for at least 1 second');
      return;
    }

    if (!user) return;

    const selectedCategory = showCustom ? customCategory : category;

    if (!selectedCategory) {
      setError('Please select or enter a category');
      return;
    }

    try {
      await focusSessionService.createSession(user.userid, {
        category: selectedCategory,
        focus_time_seconds: seconds,
      });

      setMessage(`Focus session saved! ${formatTime(seconds)} in ${selectedCategory}`);
      setSeconds(0);
      setError('');
    } catch (err) {
      setError('Failed to save focus session. Please try again.');
      console.error(err);
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setSeconds(0);
    setMessage('');
    setError('');
  };

  const handleCategoryChange = (value: string) => {
    if (value === 'Custom') {
      setShowCustom(true);
      setCategory('Work');
    } else {
      setShowCustom(false);
      setCategory(value);
    }
  };

  return (
    <div className="timer-page">
      <h1>Focus Timer</h1>

      <div className="timer-card card">
        <div className="timer-display">{formatTime(seconds)}</div>

        <div className="timer-status">
          {isRunning ? (
            <span className="status-running">● Recording...</span>
          ) : seconds > 0 ? (
            <span className="status-paused">⏸ Paused</span>
          ) : (
            <span className="status-ready">Ready to start</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            className="input"
            value={showCustom ? 'Custom' : category}
            onChange={(e) => handleCategoryChange(e.target.value)}
            disabled={isRunning}
          >
            {commonCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {showCustom && (
          <div className="form-group">
            <label htmlFor="customCategory">Custom Category Name</label>
            <input
              id="customCategory"
              type="text"
              className="input"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              placeholder="Enter category name"
              disabled={isRunning}
            />
          </div>
        )}

        {message && <div className="success">{message}</div>}
        {error && <div className="error">{error}</div>}

        <div className="timer-controls">
          {!isRunning ? (
            <>
              <button onClick={handleStart} className="btn btn-primary btn-large">
                {seconds === 0 ? 'Start' : 'Resume'}
              </button>
              {seconds > 0 && (
                <>
                  <button onClick={handleStop} className="btn btn-secondary btn-large">
                    Save Session
                  </button>
                  <button onClick={handleReset} className="btn btn-danger">
                    Reset
                  </button>
                </>
              )}
            </>
          ) : (
            <button onClick={handlePause} className="btn btn-danger btn-large">
              Pause
            </button>
          )}
        </div>
      </div>

      <div className="timer-tips card">
        <h3>Tips for Effective Focus Sessions</h3>
        <ul>
          <li>🎯 Set a clear goal before starting your session</li>
          <li>🔕 Turn off notifications and distractions</li>
          <li>⏱️ Use the Pomodoro technique: 25 min focus, 5 min break</li>
          <li>💪 Take regular breaks to maintain productivity</li>
          <li>📊 Review your stats to track improvement</li>
        </ul>
      </div>
    </div>
  );
}
