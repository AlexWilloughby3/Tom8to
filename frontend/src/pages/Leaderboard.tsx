import { useEffect, useState } from "react";
import { leaderboardService } from "../api/services";
import type { LeaderboardEntry } from "../types";
import "./Leaderboard.css";

export default function Leaderboard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const data = await leaderboardService.getLeaderboard();
      setLeaderboard(data);
    } catch (error) {
      console.error("Failed to load leaderboard:", error);
      setError("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading leaderboard...</div>;
  }

  if (error) {
    return <div className="error">{error}</div>;
  }

  return (
    <div className="leaderboard-page">
      <h1>Leaderboard</h1>

      {leaderboard.length === 0 ? (
        <div className="card">
          <p className="empty-state">No users on the leaderboard yet.</p>
        </div>
      ) : (
        <div className="card">
          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="rank-col">Rank</th>
                  <th className="email-col">User</th>
                  <th className="stat-col">Hours This Week</th>
                  <th className="stat-col">Total Hours</th>
                  <th className="stat-col">Time Goals (Week)</th>
                  <th className="stat-col">Daily Goals (Week)</th>
                  <th className="stat-col">Weekly Goals</th>
                  <th className="stat-col">Goals (All Time)</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr
                    key={entry.email}
                    className={index < 3 ? `rank-${index + 1}` : ""}
                  >
                    <td className="rank-col">
                      <span className="rank-badge">
                        {index === 0 && "🥇"}
                        {index === 1 && "🥈"}
                        {index === 2 && "🥉"}
                        {index > 2 && `#${index + 1}`}
                      </span>
                    </td>
                    <td className="email-col">{entry.display_name}</td>
                    <td className="stat-col">
                      {entry.focus_hours_this_week.toFixed(1)}h
                    </td>
                    <td className="stat-col">
                      {entry.focus_hours_all_time.toFixed(1)}h
                    </td>
                    <td className="stat-col">
                      {entry.goals_completed_this_week}/
                      {entry.total_goals_this_week}
                    </td>
                    <td className="stat-col">
                      {entry.daily_goals_completed_this_week}/
                      {entry.total_daily_goals_this_week}
                    </td>
                    <td className="stat-col">
                      {entry.weekly_goals_completed_this_week}/
                      {entry.total_weekly_goals_this_week}
                    </td>
                    <td className="stat-col">
                      {entry.goals_completed_all_time}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
