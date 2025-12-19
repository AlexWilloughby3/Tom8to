import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { statsService, focusSessionService } from '../api/services';
import type { UserStats, FocusSession } from '../types';
import { formatDuration, formatDate } from '../utils/formatters';
import './Stats.css';

export default function Stats() {
  const { user } = useAuth();
  const [allTimeStats, setAllTimeStats] = useState<UserStats | null>(null);
  const [weeklyStats, setWeeklyStats] = useState<UserStats | null>(null);
  const [recentSessions, setRecentSessions] = useState<FocusSession[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    if (!user) return;

    try {
      const [allStats, weekStats, sessions] = await Promise.all([
        statsService.getUserStats(user.userid),
        statsService.getWeeklyStats(user.userid),
        focusSessionService.getSessions(user.userid, { limit: 20 }),
      ]);

      setAllTimeStats(allStats);
      setWeeklyStats(weekStats);
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (session: FocusSession) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this session?')) return;

    try {
      await focusSessionService.deleteSession(user.userid, session.time);
      setRecentSessions((prev) => prev.filter((s) => s.time !== session.time));
      loadStats(); // Reload stats
    } catch (error) {
      console.error('Failed to delete session:', error);
      alert('Failed to delete session');
    }
  };

  const filteredSessions =
    selectedCategory === 'all'
      ? recentSessions
      : recentSessions.filter((s) => s.category === selectedCategory);

  const allCategories = Array.from(new Set(recentSessions.map((s) => s.category)));

  if (loading) {
    return <div className="loading">Loading stats...</div>;
  }

  return (
    <div className="stats-page">
      <h1>Statistics</h1>

      {/* Summary Cards */}
      <div className="stats-summary">
        <div className="summary-section">
          <h2>This Week</h2>
          <div className="stats-grid">
            <div className="stat-card card">
              <div className="stat-value">{formatDuration(weeklyStats?.total_focus_time_seconds || 0)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value">{weeklyStats?.total_sessions || 0}</div>
              <div className="stat-label">Sessions</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value">{weeklyStats?.categories.length || 0}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        </div>

        <div className="summary-section">
          <h2>All Time</h2>
          <div className="stats-grid">
            <div className="stat-card card">
              <div className="stat-value">{formatDuration(allTimeStats?.total_focus_time_seconds || 0)}</div>
              <div className="stat-label">Total Time</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value">{allTimeStats?.total_sessions || 0}</div>
              <div className="stat-label">Sessions</div>
            </div>
            <div className="stat-card card">
              <div className="stat-value">{allTimeStats?.categories.length || 0}</div>
              <div className="stat-label">Categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Category Breakdown */}
      {allTimeStats && allTimeStats.categories.length > 0 && (
        <div className="card">
          <h2>Time by Category</h2>
          <div className="category-stats">
            {allTimeStats.categories.map((cat) => (
              <div key={cat.category} className="category-stat-item">
                <div className="category-header">
                  <span className="category-name">{cat.category}</span>
                  <span className="category-time">{formatDuration(cat.total_time_seconds)}</span>
                </div>
                <div className="category-details">
                  <span>{cat.session_count} sessions</span>
                  <span>Avg: {formatDuration(Math.round(cat.average_time_seconds))}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div className="card">
        <div className="sessions-header">
          <h2>Recent Sessions</h2>
          <select
            className="category-filter"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {allCategories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {filteredSessions.length === 0 ? (
          <p className="empty-state">No sessions found</p>
        ) : (
          <div className="sessions-table">
            {filteredSessions.map((session) => (
              <div key={session.time} className="session-row">
                <div className="session-details">
                  <span className="session-category">{session.category}</span>
                  <span className="session-date">{formatDate(session.time)}</span>
                </div>
                <div className="session-actions">
                  <span className="session-duration">{formatDuration(session.focus_time_seconds)}</span>
                  <button
                    className="btn-delete"
                    onClick={() => handleDeleteSession(session)}
                    title="Delete session"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
