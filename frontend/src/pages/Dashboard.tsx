import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { statsService, checkboxService } from '../api/services';
import type { UserStats } from '../types';
import { formatDuration } from '../utils/formatters';
import FocusTimeGraph from '../components/FocusTimeGraph';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [weeklyStats, setWeeklyStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const stats = await statsService.getWeeklyStats(user.email);
      setWeeklyStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDailyCheckbox = async (category: string) => {
    if (!user) return;

    try {
      await checkboxService.toggleCompletion(user.email, {
        category,
        goal_type: 'DAILY_CHECKBOX',
      });
      loadDashboardData();
    } catch (error) {
      console.error('Failed to toggle daily checkbox:', error);
    }
  };

  const handleToggleWeeklyCheckbox = async (category: string) => {
    if (!user) return;

    try {
      await checkboxService.toggleCompletion(user.email, {
        category,
        goal_type: 'WEEKLY_CHECKBOX',
      });
      loadDashboardData();
    } catch (error) {
      console.error('Failed to toggle weekly checkbox:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      {/* Weekly Summary */}
      <div className="stats-grid">
        <div className="stat-card card">
          <h3>This Week</h3>
          <div className="stat-value">
            {formatDuration(weeklyStats?.total_focus_time_seconds || 0)}
          </div>
          <div className="stat-label">Total Focus Time</div>
        </div>

        <div className="stat-card card">
          <h3>Sessions</h3>
          <div className="stat-value">{weeklyStats?.total_sessions || 0}</div>
          <div className="stat-label">Focus Sessions</div>
        </div>

        <div className="stat-card card">
          <h3>Categories</h3>
          <div className="stat-value">{weeklyStats?.categories.length || 0}</div>
          <div className="stat-label">Active Categories</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <Link to="/timer" className="btn btn-primary btn-large">
          Start Focus Session
        </Link>
      </div>

      {/* Category Progress */}
      {weeklyStats && weeklyStats.categories.length > 0 && (
        <div className="card">
          <h2>Weekly Progress by Category</h2>
          <div className="category-progress">
            {weeklyStats.categories.map((cat) => (
              <div key={cat.category} className="progress-item">
                <div className="progress-header">
                  <span className="progress-category">{cat.category}</span>
                  <span className="progress-time">
                    {formatDuration(cat.total_time_seconds)}
                    {cat.goal_time_per_week_seconds && (
                      <span className="progress-goal">
                        {' '}/ {formatDuration(cat.goal_time_per_week_seconds)}
                      </span>
                    )}
                  </span>
                </div>
                {cat.progress_percentage !== undefined && (
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${Math.min(cat.progress_percentage, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Focus Time Graph */}
          <FocusTimeGraph />
        </div>
      )}

      {/* Daily Checkbox Goals */}
      {weeklyStats && weeklyStats.categories.some(cat =>
        cat.daily_checkbox_goals && cat.daily_checkbox_goals.length > 0
      ) && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>Daily Goals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {weeklyStats.categories.map((cat) =>
              cat.daily_checkbox_goals?.map((goal, idx) => {
                // Get today's date for checking if today's completion exists
                const today = new Date().toISOString().split('T')[0];

                return (
                  <div key={`${cat.category}-daily-${idx}`} style={{
                    padding: '1rem',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    backgroundColor: '#fff'
                  }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#c23838' }}>
                      {cat.category}
                    </h3>
                    <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
                      {goal.description}
                    </p>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, dayIdx) => {
                        // Calculate the date for this day of the week
                        const now = new Date();
                        const currentDay = now.getDay(); // 0 = Sunday
                        const diff = dayIdx - currentDay;
                        const targetDate = new Date(now);
                        targetDate.setDate(now.getDate() + diff);
                        const dateStr = targetDate.toISOString().split('T')[0];

                        const completion = goal.completions?.find(c => c.date === dateStr);
                        const isToday = dateStr === today;

                        return (
                          <div key={day} style={{ flex: '0 0 auto', textAlign: 'center' }}>
                            <label style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              gap: '0.25rem',
                              cursor: isToday ? 'pointer' : 'default',
                              opacity: isToday ? 1 : 0.6
                            }}>
                              <input
                                type="checkbox"
                                checked={completion?.completed || false}
                                onChange={() => isToday && handleToggleDailyCheckbox(cat.category)}
                                disabled={!isToday}
                                style={{
                                  width: '20px',
                                  height: '20px',
                                  cursor: isToday ? 'pointer' : 'not-allowed'
                                }}
                              />
                              <span style={{ fontSize: '0.75rem', color: '#666' }}>{day}</span>
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Weekly Checkbox Goals */}
      {weeklyStats && weeklyStats.categories.some(cat =>
        cat.weekly_checkbox_goals && cat.weekly_checkbox_goals.length > 0
      ) && (
        <div className="card" style={{ marginTop: '2rem' }}>
          <h2>Weekly Goals</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
            {weeklyStats.categories.map((cat) =>
              cat.weekly_checkbox_goals?.map((goal, idx) => (
                <div key={`${cat.category}-weekly-${idx}`} style={{
                  padding: '1rem',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: '#fff'
                }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#c23838' }}>
                    {cat.category}
                  </h3>
                  <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666' }}>
                    {goal.description}
                  </p>

                  <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    cursor: 'pointer',
                    fontSize: '1rem'
                  }}>
                    <input
                      type="checkbox"
                      checked={goal.completed}
                      onChange={() => handleToggleWeeklyCheckbox(cat.category)}
                      style={{
                        width: '24px',
                        height: '24px',
                        cursor: 'pointer'
                      }}
                    />
                    <span>Complete this week</span>
                  </label>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
