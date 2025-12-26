import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { statsService } from '../api/services';
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
      const stats = await statsService.getWeeklyStats(user.userid);
      setWeeklyStats(stats);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
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
    </div>
  );
}
