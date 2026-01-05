import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { statsService, checkboxService } from "../api/services";
import type { UserStats } from "../types";
import { formatDuration } from "../utils/formatters";
import FocusTimeGraph from "../components/FocusTimeGraph";
import "./Dashboard.css";

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
      console.error("Failed to load dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDailyCheckbox = async (category: string) => {
    if (!user) return;

    try {
      await checkboxService.toggleCompletion(user.email, {
        category,
        goal_type: "DAILY_CHECKBOX",
      });
      await loadDashboardData();
    } catch (error) {
      console.error("Failed to toggle daily checkbox:", error);
    }
  };

  const handleToggleWeeklyCheckbox = async (category: string) => {
    if (!user) return;

    try {
      await checkboxService.toggleCompletion(user.email, {
        category,
        goal_type: "WEEKLY_CHECKBOX",
      });
      loadDashboardData();
    } catch (error) {
      console.error("Failed to toggle weekly checkbox:", error);
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
          <div className="stat-value">
            {weeklyStats?.categories.length || 0}
          </div>
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
            {weeklyStats.categories.map((cat) => {
              // Calculate checkbox completion for progress bar
              const dailyCompleted =
                cat.daily_checkbox_goals?.reduce(
                  (sum, goal) =>
                    sum +
                    (goal.completions?.filter((c) => c.completed).length || 0),
                  0,
                ) || 0;
              const dailyTotal = (cat.daily_checkbox_goals?.length || 0) * 7;

              const weeklyCompleted =
                cat.weekly_checkbox_goals?.filter((g) => g.completed).length ||
                0;
              const weeklyTotal = cat.weekly_checkbox_goals?.length || 0;

              const hasTimeGoal =
                cat.goal_time_per_week_seconds !== undefined &&
                cat.goal_time_per_week_seconds !== null;
              const hasDailyGoals = dailyTotal > 0;
              const hasWeeklyGoals = weeklyTotal > 0;

              return (
                <div key={cat.category} className="progress-item">
                  <div className="progress-header">
                    <span className="progress-category">{cat.category}</span>
                  </div>

                  {/* Time-based goal progress */}
                  {hasTimeGoal && (
                    <div
                      style={{
                        marginBottom:
                          hasDailyGoals || hasWeeklyGoals ? "0.5rem" : "0",
                      }}
                    >
                      <div
                        className="progress-header"
                        style={{ marginBottom: "0.25rem" }}
                      >
                        <span
                          className="progress-time"
                          style={{ fontSize: "0.9rem" }}
                        >
                          Time Goal: {formatDuration(cat.total_time_seconds)}
                          <span className="progress-goal">
                            {" / "}
                            {formatDuration(cat.goal_time_per_week_seconds!)}
                          </span>
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(cat.progress_percentage || 0, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Daily checkbox goal progress */}
                  {hasDailyGoals && (
                    <div
                      style={{ marginBottom: hasWeeklyGoals ? "0.5rem" : "0" }}
                    >
                      <div
                        className="progress-header"
                        style={{ marginBottom: "0.25rem" }}
                      >
                        <span
                          className="progress-time"
                          style={{ fontSize: "0.9rem" }}
                        >
                          Daily Goals: {dailyCompleted}/{dailyTotal} completed
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min((dailyCompleted / dailyTotal) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Weekly checkbox goal progress */}
                  {hasWeeklyGoals && (
                    <div>
                      <div
                        className="progress-header"
                        style={{ marginBottom: "0.25rem" }}
                      >
                        <span
                          className="progress-time"
                          style={{ fontSize: "0.9rem" }}
                        >
                          Weekly Goals: {weeklyCompleted}/{weeklyTotal}{" "}
                          completed
                        </span>
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min((weeklyCompleted / weeklyTotal) * 100, 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Fallback if no goals */}
                  {!hasTimeGoal && !hasDailyGoals && !hasWeeklyGoals && (
                    <div className="progress-header">
                      <span className="progress-time">
                        {formatDuration(cat.total_time_seconds)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Focus Time Graph */}
          <FocusTimeGraph />
        </div>
      )}

      {/* Daily Checkbox Goals */}
      {weeklyStats &&
        weeklyStats.categories.some(
          (cat) =>
            cat.daily_checkbox_goals && cat.daily_checkbox_goals.length > 0,
        ) && (
          <div className="card" style={{ marginTop: "2rem" }}>
            <h2>Daily Goals</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              {weeklyStats.categories.map((cat) =>
                cat.daily_checkbox_goals?.map((goal, idx) => {
                  // Get today's date in Eastern Time using proper timezone conversion
                  const now = new Date();
                  const formatter = new Intl.DateTimeFormat("en-CA", {
                    timeZone: "America/New_York",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                  });
                  const today = formatter.format(now); // Returns YYYY-MM-DD format

                  // Get current day of week in ET (0 = Sunday)
                  const etDayOfWeek = new Date(
                    now.toLocaleString("en-US", {
                      timeZone: "America/New_York",
                    }),
                  ).getDay();

                  return (
                    <div
                      key={`${cat.category}-daily-${idx}`}
                      style={{
                        padding: "1rem",
                        border: "1px solid #ddd",
                        borderRadius: "8px",
                        backgroundColor: "#fff",
                      }}
                    >
                      <h3
                        style={{
                          margin: "0 0 0.5rem 0",
                          fontSize: "1rem",
                          color: "#c23838",
                        }}
                      >
                        {cat.category}
                      </h3>
                      <p
                        style={{
                          margin: "0 0 1rem 0",
                          fontSize: "0.9rem",
                          color: "#666",
                        }}
                      >
                        {goal.description}
                      </p>

                      {/* Weekly Progress Bar */}
                      {(() => {
                        const completedCount =
                          goal.completions?.filter((c) => c.completed).length ||
                          0;
                        const progressPercent = (completedCount / 7) * 100;
                        return (
                          <div style={{ marginBottom: "1rem" }}>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                marginBottom: "0.25rem",
                                fontSize: "0.875rem",
                                color: "#666",
                              }}
                            >
                              <span>Weekly Progress</span>
                              <span>{completedCount}/7 days</span>
                            </div>
                            <div
                              style={{
                                width: "100%",
                                height: "8px",
                                backgroundColor: "#e0e0e0",
                                borderRadius: "4px",
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${progressPercent}%`,
                                  height: "100%",
                                  backgroundColor: "#c23838",
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })()}

                      <div
                        style={{
                          display: "flex",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                          (day, dayIdx) => {
                            // Calculate the date for this day of the week in Eastern Time
                            const diff = dayIdx - etDayOfWeek;
                            const targetDate = new Date(
                              now.toLocaleString("en-US", {
                                timeZone: "America/New_York",
                              }),
                            );
                            targetDate.setDate(targetDate.getDate() + diff);
                            const dateStr = formatter.format(targetDate);

                            const completion = goal.completions?.find(
                              (c) => c.date === dateStr,
                            );
                            const isToday = dateStr === today;

                            return (
                              <div
                                key={day}
                                style={{
                                  flex: "0 0 auto",
                                  textAlign: "center",
                                }}
                              >
                                <label
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "center",
                                    gap: "0.25rem",
                                    cursor: isToday ? "pointer" : "default",
                                    opacity: isToday ? 1 : 0.6,
                                  }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={completion?.completed || false}
                                    onChange={() =>
                                      isToday &&
                                      handleToggleDailyCheckbox(cat.category)
                                    }
                                    disabled={!isToday}
                                    style={{
                                      width: "20px",
                                      height: "20px",
                                      cursor: isToday
                                        ? "pointer"
                                        : "not-allowed",
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: "0.75rem",
                                      color: "#666",
                                    }}
                                  >
                                    {day}
                                  </span>
                                </label>
                              </div>
                            );
                          },
                        )}
                      </div>
                    </div>
                  );
                }),
              )}
            </div>
          </div>
        )}

      {/* Weekly Checkbox Goals */}
      {weeklyStats &&
        weeklyStats.categories.some(
          (cat) =>
            cat.weekly_checkbox_goals && cat.weekly_checkbox_goals.length > 0,
        ) && (
          <div className="card" style={{ marginTop: "2rem" }}>
            <h2>Weekly Goals</h2>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: "1rem",
                marginTop: "1rem",
              }}
            >
              {weeklyStats.categories.map((cat) =>
                cat.weekly_checkbox_goals?.map((goal, idx) => (
                  <div
                    key={`${cat.category}-weekly-${idx}`}
                    style={{
                      padding: "1rem",
                      border: "1px solid #ddd",
                      borderRadius: "8px",
                      backgroundColor: "#fff",
                    }}
                  >
                    <h3
                      style={{
                        margin: "0 0 0.5rem 0",
                        fontSize: "1rem",
                        color: "#c23838",
                      }}
                    >
                      {cat.category}
                    </h3>
                    <p
                      style={{
                        margin: "0 0 1rem 0",
                        fontSize: "0.9rem",
                        color: "#666",
                      }}
                    >
                      {goal.description}
                    </p>

                    <label
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.75rem",
                        cursor: "pointer",
                        fontSize: "1rem",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={goal.completed}
                        onChange={() =>
                          handleToggleWeeklyCheckbox(cat.category)
                        }
                        style={{
                          width: "24px",
                          height: "24px",
                          cursor: "pointer",
                        }}
                      />
                      <span>Complete this week</span>
                    </label>
                  </div>
                )),
              )}
            </div>
          </div>
        )}
    </div>
  );
}
