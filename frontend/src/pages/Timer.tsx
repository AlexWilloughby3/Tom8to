import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { formatTime } from '../utils/formatters';
import './Timer.css';

export default function Timer() {
  useAuth();

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
    </div>
  );
}
