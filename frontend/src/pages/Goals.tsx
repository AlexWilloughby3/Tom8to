import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { focusGoalService } from '../api/services';
import type { FocusGoal } from '../types';
import { hoursToSeconds, secondsToHours } from '../utils/formatters';
import './Goals.css';

export default function Goals() {
  const { user } = useAuth();
  const [goals, setGoals] = useState<FocusGoal[]>([]);
  const [category, setCategory] = useState('');
  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
  }, []);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const data = await focusGoalService.getGoals(user.userid);
      setGoals(data);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user) return;

    const hours = parseFloat(hoursPerWeek);
    if (isNaN(hours) || hours <= 0) {
      setError('Please enter a valid number of hours');
      return;
    }

    try {
      await focusGoalService.createGoal(user.userid, {
        category,
        goal_time_per_week_seconds: hoursToSeconds(hours),
      });

      setMessage(`Goal set for ${category}: ${hours} hours per week`);
      setCategory('');
      setHoursPerWeek('');
      loadGoals();
    } catch (err) {
      setError('Failed to set goal. Please try again.');
      console.error(err);
    }
  };

  const handleDelete = async (goal: FocusGoal) => {
    if (!user) return;
    if (!confirm(`Delete goal for ${goal.category}?`)) return;

    try {
      await focusGoalService.deleteGoal(user.userid, goal.category);
      setGoals((prev) => prev.filter((g) => g.category !== goal.category));
      setMessage(`Goal for ${goal.category} deleted`);
    } catch (error) {
      setError('Failed to delete goal');
      console.error(error);
    }
  };

  if (loading) {
    return <div className="loading">Loading goals...</div>;
  }

  return (
    <div className="goals-page">
      <h1>Focus Goals</h1>

      <div className="goals-grid">
        <div className="card">
          <h2>Set New Goal</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <input
                id="category"
                type="text"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g., Work, Study, Reading"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="hours">Hours per Week</label>
              <input
                id="hours"
                type="number"
                step="0.5"
                min="0.5"
                className="input"
                value={hoursPerWeek}
                onChange={(e) => setHoursPerWeek(e.target.value)}
                placeholder="e.g., 10"
                required
              />
            </div>

            {message && <div className="success">{message}</div>}
            {error && <div className="error">{error}</div>}

            <button type="submit" className="btn btn-primary btn-full">
              Set Goal
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Your Goals</h2>
          {goals.length === 0 ? (
            <p className="empty-state">No goals set yet. Create your first goal!</p>
          ) : (
            <div className="goals-list">
              {goals.map((goal) => (
                <div key={goal.category} className="goal-item">
                  <div className="goal-info">
                    <span className="goal-category">{goal.category}</span>
                    <span className="goal-target">
                      {secondsToHours(goal.goal_time_per_week_seconds).toFixed(1)} hrs/week
                    </span>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDelete(goal)}
                    title="Delete goal"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card goals-tips">
        <h3>Tips for Setting Effective Goals</h3>
        <ul>
          <li>📌 Start with realistic, achievable targets</li>
          <li>📈 Gradually increase your goals as you improve</li>
          <li>🎯 Set goals for your most important categories</li>
          <li>⚖️ Balance multiple goals to avoid burnout</li>
          <li>📊 Review your progress weekly to stay on track</li>
        </ul>
      </div>
    </div>
  );
}
