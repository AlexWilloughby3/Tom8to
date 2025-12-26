import { useEffect, useState, FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { focusGoalService, categoryService } from '../api/services';
import type { FocusGoal, Category } from '../types';
import { secondsToHours } from '../utils/formatters';
import './Goals.css';

export default function Goals() {
  const { user } = useAuth();
  const { reloadCategories: reloadPomodoroCategories } = usePomodoro();
  const [goals, setGoals] = useState<FocusGoal[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [category, setCategory] = useState('');
  const [goalHours, setGoalHours] = useState('');
  const [goalMinutes, setGoalMinutes] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [categoryMessage, setCategoryMessage] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGoals();
    loadCategories();
  }, []);

  const loadGoals = async () => {
    if (!user) return;

    try {
      const data = await focusGoalService.getGoals(user.email);
      setGoals(data);
    } catch (error) {
      console.error('Failed to load goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    if (!user) return;

    try {
      const data = await categoryService.getCategories(user.email);
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');

    if (!user) return;

    const hours = parseInt(goalHours) || 0;
    const minutes = parseInt(goalMinutes) || 0;

    if (hours < 0 || hours > 168) {
      setError('Hours must be between 0 and 168');
      return;
    }

    if (minutes < 0 || minutes > 59) {
      setError('Minutes must be between 0 and 59');
      return;
    }

    if (hours === 0 && minutes === 0) {
      setError('Please enter a goal greater than 0');
      return;
    }

    const totalSeconds = hours * 3600 + minutes * 60;

    if (totalSeconds > 604800) {
      setError('Goal cannot exceed 168 hours per week');
      return;
    }

    try {
      await focusGoalService.createGoal(user.email, {
        category,
        goal_time_per_week_seconds: totalSeconds,
      });

      const displayHours = hours > 0 ? `${hours}h` : '';
      const displayMinutes = minutes > 0 ? `${minutes}m` : '';
      const displayTime = [displayHours, displayMinutes].filter(Boolean).join(' ');

      setMessage(`Goal set for ${category}: ${displayTime} per week`);
      setCategory('');
      setGoalHours('');
      setGoalMinutes('');
      loadGoals();
    } catch (err) {
      setError('Failed to set goal. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteGoal = async (goal: FocusGoal) => {
    if (!user) return;
    if (!confirm(`Delete goal for ${goal.category}?`)) return;

    try {
      await focusGoalService.deleteGoal(user.email, goal.category);
      setGoals((prev) => prev.filter((g) => g.category !== goal.category));
      setMessage(`Goal for ${goal.category} deleted`);
    } catch (error) {
      setError('Failed to delete goal');
      console.error(error);
    }
  };

  const handleCategorySubmit = async (e: FormEvent) => {
    e.preventDefault();
    setCategoryMessage('');
    setCategoryError('');

    if (!user) return;

    if (!newCategory.trim()) {
      setCategoryError('Please enter a category name');
      return;
    }

    try {
      await categoryService.createCategory(user.email, {
        category: newCategory.trim(),
      });

      setCategoryMessage(`Category "${newCategory}" created`);
      setNewCategory('');
      loadCategories();
      reloadPomodoroCategories();
    } catch (err) {
      setCategoryError('Failed to create category. It may already exist.');
      console.error(err);
    }
  };

  const handleDeleteCategory = async (cat: Category) => {
    if (!user) return;
    if (!confirm(`Delete category "${cat.category}"?`)) return;

    try {
      await categoryService.deleteCategory(user.email, cat.category);
      setCategories((prev) => prev.filter((c) => c.category !== cat.category));
      setCategoryMessage(`Category "${cat.category}" deleted`);
      reloadPomodoroCategories();
    } catch (error) {
      setCategoryError('Failed to delete category');
      console.error(error);
    }
  };

  if (loading) {
    return <div className="loading">Loading goals...</div>;
  }

  return (
    <div className="goals-page">
      <h1>Focus Goals</h1>

      {/* Category Management */}
      <div className="goals-grid">
        <div className="card">
          <h2>New Category</h2>
          <form onSubmit={handleCategorySubmit}>
            <div className="form-group">
              <label htmlFor="newCategory">Category Name</label>
              <input
                id="newCategory"
                type="text"
                className="input"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                placeholder="e.g., Programming, Art"
                maxLength={50}
                required
              />
            </div>

            {categoryMessage && <div className="success">{categoryMessage}</div>}
            {categoryError && <div className="error">{categoryError}</div>}

            <button type="submit" className="btn btn-primary btn-full">
              Create Category
            </button>
          </form>
        </div>

        <div className="card">
          <h2>Your Categories</h2>
          {categories.length === 0 ? (
            <p className="empty-state">No categories yet. Create your first category!</p>
          ) : (
            <div className="goals-list">
              {categories.map((cat) => (
                <div key={cat.category} className="goal-item">
                  <div className="goal-info">
                    <span className="goal-category">{cat.category}</span>
                  </div>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteCategory(cat)}
                    title="Delete category"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Goal Management */}
      <div className="goals-grid" style={{ marginTop: '2rem' }}>
        <div className="card">
          <h2>Set New Goal</h2>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                className="input"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
              >
                <option value="">Select a category</option>
                {categories.map((cat) => (
                  <option key={cat.category} value={cat.category}>
                    {cat.category}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Goal per Week</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input
                    id="goalHours"
                    type="number"
                    min="0"
                    max="168"
                    className="input"
                    value={goalHours}
                    onChange={(e) => setGoalHours(e.target.value)}
                    placeholder="Hours (0-168)"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <input
                    id="goalMinutes"
                    type="number"
                    min="0"
                    max="59"
                    className="input"
                    value={goalMinutes}
                    onChange={(e) => setGoalMinutes(e.target.value)}
                    placeholder="Minutes (0-59)"
                  />
                </div>
              </div>
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
                    onClick={() => handleDeleteGoal(goal)}
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

    </div>
  );
}
