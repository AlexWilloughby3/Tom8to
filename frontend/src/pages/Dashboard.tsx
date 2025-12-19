import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { focusSessionService, statsService } from '../api/services';
import type { FocusSession, UserStats } from '../types';
import { formatDuration, formatDate } from '../utils/formatters';
import './Dashboard.css';

export default function Dashboard() {
  const { user } = useAuth();
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    if (!user) return;

    try {
      const [sessions, stats] = await Promise.all([
        focusSessionService.getSessions(user.userid, { limit: 5 }),
        statsService.getWeeklyStats(user.userid),
      ]);

      setRecentSessions(sessions);
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
        <Link to="/stats" className="btn btn-secondary btn-large">
          View Detailed Stats
        </Link>
      </div>

      {/* Recent Sessions */}
      <div className="card">
        <h2>Recent Sessions</h2>
        {recentSessions.length === 0 ? (
          <p className="empty-state">No focus sessions yet. Start your first session!</p>
        ) : (
          <div className="sessions-list">
            {recentSessions.map((session) => (
              <div key={session.time} className="session-item">
                <div className="session-info">
                  <span className="session-category">{session.category}</span>
                  <span className="session-date">{formatDate(session.time)}</span>
                </div>
                <div className="session-duration">
                  {formatDuration(session.focus_time_seconds)}
                </div>
              </div>
            ))}
          </div>
        )}
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
        </div>
      )}
    </div>
  );
}
