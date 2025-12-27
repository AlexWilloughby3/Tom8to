import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { formatTime } from '../utils/formatters';
import { focusSessionService } from '../api/services';
import { useState, FormEvent, useEffect } from 'react';
import './Timer.css';

export default function Timer() {
  const { user } = useAuth();

  // Pomodoro and Stopwatch from context
  const {
    categories,
    pomodoroRunning,
    pomodoroSeconds,
    workDuration,
    breakDuration,
    cycles,
    currentCycle,
    isBreak,
    totalWorkTime,
    pomodoroCategory,
    pomodoroCustomCategory,
    showPomodoroCustom,
    pomodoroMessage,
    pomodoroError,
    stopwatchRunning,
    stopwatchSeconds,
    stopwatchCategory,
    stopwatchCustomCategory,
    showStopwatchCustom,
    stopwatchMessage,
    stopwatchError,
    setWorkDuration,
    setBreakDuration,
    setCycles,
    setPomodoroCustomCategory,
    setStopwatchCustomCategory,
    handlePomodoroStart,
    handlePomodoroPause,
    handlePomodoroResume,
    handlePomodoroReset,
    handlePomodoroSave,
    handlePomodoroCategoryChange,
    handleStopwatchCategoryChange,
    handleStopwatchStart,
    handleStopwatchPause,
    handleStopwatchReset,
    handleStopwatchSave,
    getWorkDuration,
    getCycles,
  } = usePomodoro();

  // Manual entry state
  const [manualHours, setManualHours] = useState('');
  const [manualMinutes, setManualMinutes] = useState('');
  const [manualCategory, setManualCategory] = useState('');
  const [manualCustomCategory, setManualCustomCategory] = useState('');
  const [showManualCustom, setShowManualCustom] = useState(false);
  const [manualMessage, setManualMessage] = useState('');
  const [manualError, setManualError] = useState('');

  const handleManualCategoryChange = (value: string) => {
    if (value === 'Custom') {
      setShowManualCustom(true);
      setManualCategory('');
    } else {
      setShowManualCustom(false);
      setManualCategory(value);
      setManualCustomCategory('');
    }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setManualMessage('');
    setManualError('');

    if (!user) return;

    const hours = parseInt(manualHours) || 0;
    const minutes = parseInt(manualMinutes) || 0;

    if (hours === 0 && minutes === 0) {
      setManualError('Please enter a time greater than 0');
      return;
    }

    if (hours < 0 || minutes < 0) {
      setManualError('Please enter positive values');
      return;
    }

    const totalSeconds = hours * 3600 + minutes * 60;
    const categoryToUse = showManualCustom ? manualCustomCategory : manualCategory;

    if (!categoryToUse.trim()) {
      setManualError('Please select or enter a category');
      return;
    }

    try {
      await focusSessionService.createSession(user.email, {
        category: categoryToUse,
        focus_time_seconds: totalSeconds,
      });

      const displayHours = hours > 0 ? `${hours}h` : '';
      const displayMinutes = minutes > 0 ? `${minutes}m` : '';
      const displayTime = [displayHours, displayMinutes].filter(Boolean).join(' ');

      setManualMessage(`Logged ${displayTime} for ${categoryToUse}`);
      setManualHours('');
      setManualMinutes('');
      setManualCategory('');
      setManualCustomCategory('');
      setShowManualCustom(false);
    } catch (err) {
      setManualError('Failed to log time. Please try again.');
      console.error(err);
    }
  };

  // Update tab title when timers are running
  useEffect(() => {
    const originalTitle = 'Focus Timer';

    if (pomodoroRunning) {
      const timeStr = formatTime(pomodoroSeconds);
      const status = isBreak ? '☕ Break' : '● Focus';
      document.title = `${timeStr} - ${status}`;
    } else if (stopwatchRunning) {
      const timeStr = formatTime(stopwatchSeconds);
      document.title = `${timeStr} - ● Recording`;
    } else if (pomodoroSeconds > 0) {
      const timeStr = formatTime(pomodoroSeconds);
      document.title = `${timeStr} - ⏸ Paused`;
    } else if (stopwatchSeconds > 0) {
      const timeStr = formatTime(stopwatchSeconds);
      document.title = `${timeStr} - ⏸ Paused`;
    } else {
      document.title = originalTitle;
    }

    // Cleanup: reset title when component unmounts
    return () => {
      document.title = originalTitle;
    };
  }, [pomodoroRunning, pomodoroSeconds, stopwatchRunning, stopwatchSeconds, isBreak]);

  return (
    <div className="timer-page">
      <h1>Focus Timer</h1>

      <h2>Pomodoro Timer</h2>
      <div className="timer-card card">
        <div className={`timer-display ${isBreak ? 'timer-break' : ''}`}>
          {pomodoroSeconds > 0 ? formatTime(pomodoroSeconds) : '00:00:00'}
        </div>

        <div className="timer-status">
          {pomodoroRunning ? (
            isBreak ? (
              <span className="status-break">☕ Break Time - Cycle {currentCycle}/{getCycles()}</span>
            ) : (
              <span className="status-running">● Working - Cycle {currentCycle}/{getCycles()}</span>
            )
          ) : pomodoroSeconds > 0 ? (
            <span className="status-paused">⏸ Paused</span>
          ) : (
            <span className="status-ready">Ready to start</span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="pomodoroCategory">Category</label>
          <select
            id="pomodoroCategory"
            className="input"
            value={showPomodoroCustom ? 'Custom' : pomodoroCategory}
            onChange={(e) => handlePomodoroCategoryChange(e.target.value)}
            disabled={pomodoroRunning || pomodoroSeconds > 0}
          >
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
            <option value="Custom">Custom</option>
          </select>
        </div>

        {showPomodoroCustom && (
          <div className="form-group">
            <label htmlFor="pomodoroCustomCategory">Custom Category Name</label>
            <input
              id="pomodoroCustomCategory"
              type="text"
              className="input"
              value={pomodoroCustomCategory}
              onChange={(e) => setPomodoroCustomCategory(e.target.value)}
              placeholder="Enter category name"
              disabled={pomodoroRunning || pomodoroSeconds > 0}
            />
          </div>
        )}

        <div className="pomodoro-settings">
          <div className="form-group">
            <label htmlFor="workDuration">Work Duration (minutes)</label>
            <input
              id="workDuration"
              type="number"
              className="input number-input"
              value={workDuration}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value);
                if (val === '' || (typeof val === 'number' && val > 0)) {
                  setWorkDuration(val);
                }
              }}
              placeholder="25"
              disabled={pomodoroRunning || pomodoroSeconds > 0}
            />
          </div>

          <div className="form-group">
            <label htmlFor="breakDuration">Break Duration (minutes)</label>
            <input
              id="breakDuration"
              type="number"
              className="input number-input"
              value={breakDuration}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value);
                if (val === '' || (typeof val === 'number' && val > 0)) {
                  setBreakDuration(val);
                }
              }}
              placeholder="5"
              disabled={pomodoroRunning || pomodoroSeconds > 0}
            />
          </div>

          <div className="form-group">
            <label htmlFor="cycles">Number of Cycles</label>
            <input
              id="cycles"
              type="number"
              className="input number-input"
              value={cycles}
              onChange={(e) => {
                const val = e.target.value === '' ? '' : parseInt(e.target.value);
                if (val === '' || (typeof val === 'number' && val > 0)) {
                  setCycles(val);
                }
              }}
              placeholder="4"
              disabled={pomodoroRunning || pomodoroSeconds > 0}
            />
          </div>
        </div>

        {pomodoroMessage && <div className="success">{pomodoroMessage}</div>}
        {pomodoroError && <div className="error">{pomodoroError}</div>}

        <div className="timer-controls">
          {pomodoroSeconds === 0 ? (
            <button
              onClick={handlePomodoroStart}
              className="btn btn-primary btn-large"
              disabled={stopwatchRunning || stopwatchSeconds > 0}
            >
              Start Pomodoro
            </button>
          ) : (
            <>
              {!pomodoroRunning ? (
                <button onClick={handlePomodoroResume} className="btn btn-primary btn-large">
                  Resume
                </button>
              ) : (
                <button onClick={handlePomodoroPause} className="btn btn-danger btn-large">
                  Pause
                </button>
              )}
              <button onClick={handlePomodoroSave} className="btn btn-secondary btn-large">
                Save & Quit
              </button>
              <button onClick={handlePomodoroReset} className="btn btn-danger">
                Reset
              </button>
            </>
          )}
        </div>

        <div className="timer-info-box">
          <strong>Total work time this session: </strong>
          {formatTime(totalWorkTime + (isBreak || pomodoroSeconds === 0 ? 0 : (getWorkDuration() * 60 - pomodoroSeconds)))}
        </div>
      </div>

      <h2 style={{ marginTop: '3rem' }}>Stopwatch</h2>
      <div className="timer-card card">
        <div className="timer-display">{formatTime(stopwatchSeconds)}</div>

        <div className="timer-status">
          {stopwatchRunning ? (
            <span className="status-running">● Recording...</span>
          ) : stopwatchSeconds > 0 ? (
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
            value={showStopwatchCustom ? 'Custom' : stopwatchCategory}
            onChange={(e) => handleStopwatchCategoryChange(e.target.value)}
            disabled={stopwatchRunning}
          >
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
            <option value="Custom">Custom</option>
          </select>
        </div>

        {showStopwatchCustom && (
          <div className="form-group">
            <label htmlFor="customCategory">Custom Category Name</label>
            <input
              id="customCategory"
              type="text"
              className="input"
              value={stopwatchCustomCategory}
              onChange={(e) => setStopwatchCustomCategory(e.target.value)}
              placeholder="Enter category name"
              disabled={stopwatchRunning}
            />
          </div>
        )}

        {stopwatchMessage && <div className="success">{stopwatchMessage}</div>}
        {stopwatchError && <div className="error">{stopwatchError}</div>}

        <div className="timer-info-box">
          <strong>Elapsed time: </strong>
          {formatTime(stopwatchSeconds)}
        </div>

        <div className="timer-controls">
          {!stopwatchRunning ? (
            <>
              <button
                onClick={handleStopwatchStart}
                className="btn btn-primary btn-large"
                disabled={pomodoroRunning || pomodoroSeconds > 0}
              >
                {stopwatchSeconds === 0 ? 'Start' : 'Resume'}
              </button>
              {stopwatchSeconds > 0 && (
                <>
                  <button onClick={handleStopwatchSave} className="btn btn-secondary btn-large">
                    Save Session
                  </button>
                  <button onClick={handleStopwatchReset} className="btn btn-danger">
                    Reset
                  </button>
                </>
              )}
            </>
          ) : (
            <button onClick={handleStopwatchPause} className="btn btn-danger btn-large">
              Pause
            </button>
          )}
        </div>
      </div>

      <h2 style={{ marginTop: '3rem' }}>Manual Time Entry</h2>
      <div className="timer-card card">
        <p className="manual-entry-description">
          Log time you worked outside of the timer (e.g., offline work, forgot to start timer)
        </p>

        <form onSubmit={handleManualSubmit}>
          <div className="form-group">
            <label htmlFor="manualCategory">Category</label>
            <select
              id="manualCategory"
              className="input"
              value={showManualCustom ? 'Custom' : manualCategory}
              onChange={(e) => handleManualCategoryChange(e.target.value)}
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.category} value={cat.category}>
                  {cat.category}
                </option>
              ))}
              <option value="Custom">Custom</option>
            </select>
          </div>

          {showManualCustom && (
            <div className="form-group">
              <label htmlFor="manualCustomCategory">Custom Category Name</label>
              <input
                id="manualCustomCategory"
                type="text"
                className="input"
                value={manualCustomCategory}
                onChange={(e) => setManualCustomCategory(e.target.value)}
                placeholder="Enter category name"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Time Worked</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <input
                  id="manualHours"
                  type="number"
                  min="0"
                  className="input number-input"
                  value={manualHours}
                  onChange={(e) => setManualHours(e.target.value)}
                  placeholder="Hours"
                />
              </div>
              <div style={{ flex: 1 }}>
                <input
                  id="manualMinutes"
                  type="number"
                  min="0"
                  max="59"
                  className="input number-input"
                  value={manualMinutes}
                  onChange={(e) => setManualMinutes(e.target.value)}
                  placeholder="Minutes (0-59)"
                />
              </div>
            </div>
          </div>

          {manualMessage && <div className="success">{manualMessage}</div>}
          {manualError && <div className="error">{manualError}</div>}

          <button type="submit" className="btn btn-primary btn-full">
            Log Time
          </button>
        </form>
      </div>
    </div>
  );
}
