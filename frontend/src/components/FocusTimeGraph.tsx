import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { graphService } from '../api/services';
import type { GraphData, TimeRange } from '../types';
import { formatDuration } from '../utils/formatters';
import './FocusTimeGraph.css';

export default function FocusTimeGraph() {
  const { user } = useAuth();
  const { categories } = usePomodoro();
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    loadGraphData();
  }, [timeRange, selectedCategory, customStartDate, customEndDate]);

  const loadGraphData = async () => {
    if (!user) return;

    // Skip loading if custom range is selected but dates aren't set
    if (timeRange === 'custom' && (!customStartDate || !customEndDate)) {
      return;
    }

    setLoading(true);
    try {
      const category = selectedCategory === 'all' ? undefined : selectedCategory;
      const data = await graphService.getGraphData(
        user.email,
        timeRange,
        category,
        timeRange === 'custom' ? customStartDate : undefined,
        timeRange === 'custom' ? customEndDate : undefined
      );
      setGraphData(data);
      setHoveredIndex(null);
    } catch (error) {
      console.error('Failed to load graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMaxValue = () => {
    if (!graphData) return 0;
    return Math.max(...graphData.data_points.map(p => p.focus_time_seconds), 1);
  };

  const formatDate = (dateStr: string) => {
    // Parse date string manually to avoid timezone conversion issues
    // dateStr format is "YYYY-MM-DD"
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed
    if (timeRange === 'week' || timeRange === 'month') {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } else {
      // For 6month and ytd, show week of
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getYAxisLabel = () => {
    if (timeRange === '6month' || timeRange === 'ytd') {
      return 'Focus Time per Week';
    }
    return 'Focus Time per Day';
  };

  const getTimeRangeLabel = (range: TimeRange) => {
    switch (range) {
      case 'week':
        return 'Week';
      case 'month':
        return 'Month';
      case '6month':
        return '6 Months';
      case 'ytd':
        return 'YTD';
      case 'custom':
        return 'Custom';
    }
  };

  if (loading && !graphData) {
    return <div className="graph-loading">Loading graph...</div>;
  }

  const maxValue = getMaxValue();

  // Long ranges come back as one point per week; tell from the spacing, since
  // the server decides (a long custom range is weekly, an early-year YTD is daily)
  const dayGap = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
  const groupedByWeek =
    !!graphData &&
    graphData.data_points.length > 1 &&
    dayGap(graphData.data_points[0].date, graphData.data_points[1].date) === 7;

  const formatHours = (seconds: number) => {
    const hours = Math.round((seconds / 3600) * 100) / 100;
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  };

  return (
    <div className="focus-time-graph">
      <div className="graph-controls">
        <div className="time-range-toggle">
          {(['week', 'month', '6month', 'ytd', 'custom'] as TimeRange[]).map((range) => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {getTimeRangeLabel(range)}
            </button>
          ))}
        </div>

        <div className="category-filter">
          <label htmlFor="graph-category">Category:</label>
          <select
            id="graph-category"
            className="input"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {categories.map((cat) => (
              <option key={cat.category} value={cat.category}>
                {cat.category}
              </option>
            ))}
          </select>
        </div>
      </div>

      {timeRange === 'custom' && (
        <div className="custom-date-range">
          <div className="date-input-group">
            <label htmlFor="start-date">Start Date:</label>
            <input
              type="date"
              id="start-date"
              className="input"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              max={customEndDate || undefined}
            />
          </div>
          <div className="date-input-group">
            <label htmlFor="end-date">End Date:</label>
            <input
              type="date"
              id="end-date"
              className="input"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              min={customStartDate || undefined}
            />
          </div>
        </div>
      )}

      {graphData && graphData.data_points.length > 0 ? (
        <div className="graph-container">
          <div className="graph-y-axis">
            <span className="y-axis-label">{getYAxisLabel()}</span>
          </div>
          <div className="graph-chart">
            <svg className="line-graph-svg" viewBox="0 -10 900 510" preserveAspectRatio="xMidYMid meet">
              {/* Y-axis labels (4 equally spaced) */}
              {[0, 1, 2, 3].map((i) => {
                const value = (maxValue / 3) * i;
                const y = 380 - (i * 380 / 3);
                return (
                  <text
                    key={`y-${i}`}
                    x="5"
                    y={y + 5}
                    fontSize="11"
                    fill="#666"
                    textAnchor="start"
                  >
                    {formatDuration(Math.round(value))}
                  </text>
                );
              })}

              {/* Graph area with left margin for Y-axis labels */}
              <g transform="translate(80, 0)">
                {/* Grid lines */}
                <line x1="0" y1="0" x2="800" y2="0" stroke="#e0e0e0" strokeWidth="1" />
                <line x1="0" y1="127" x2="800" y2="127" stroke="#e0e0e0" strokeWidth="1" />
                <line x1="0" y1="253" x2="800" y2="253" stroke="#e0e0e0" strokeWidth="1" />
                <line x1="0" y1="380" x2="800" y2="380" stroke="#333" strokeWidth="2" />

                {/* Draw line */}
                <path
                  d={graphData.data_points.map((point, index) => {
                    const x = (index / (graphData.data_points.length - 1 || 1)) * 800;
                    const y = 380 - ((point.focus_time_seconds / maxValue) * 380);
                    return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="#c23838"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Draw dots */}
                {graphData.data_points.map((point, index) => {
                  const x = (index / (graphData.data_points.length - 1 || 1)) * 800;
                  const y = 380 - ((point.focus_time_seconds / maxValue) * 380);
                  return (
                    <g
                      key={`dot-${index}`}
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    >
                      {/* Larger invisible target so the dot is easy to hover */}
                      <circle cx={x} cy={y} r="14" fill="transparent" />
                      <circle
                        cx={x}
                        cy={y}
                        r={hoveredIndex === index ? 7 : 5}
                        fill="#c23838"
                        stroke="white"
                        strokeWidth="2"
                        className="graph-dot"
                      />
                    </g>
                  );
                })}

                {/* X-axis labels (4 equally spaced) */}
                {[0, 1, 2, 3].map((i) => {
                  const pointIndex = Math.round((graphData.data_points.length - 1) * i / 3);
                  const point = graphData.data_points[pointIndex];
                  const x = (pointIndex / (graphData.data_points.length - 1 || 1)) * 800;
                  return (
                    <text
                      key={`x-${i}`}
                      x={x}
                      y="410"
                      textAnchor="middle"
                      fontSize="12"
                      fill="#666"
                      className="graph-x-label"
                    >
                      {formatDate(point.date)}
                    </text>
                  );
                })}

                {/* Hover tooltip, drawn last so it sits above the line and labels */}
                {hoveredIndex !== null && graphData.data_points[hoveredIndex] && (() => {
                  const point = graphData.data_points[hoveredIndex];
                  const x = (hoveredIndex / (graphData.data_points.length - 1 || 1)) * 800;
                  const y = 380 - ((point.focus_time_seconds / maxValue) * 380);
                  const width = 190;
                  const height = 50;
                  // Keep the box inside the chart: clamp sideways, flip below near the top
                  const boxX = Math.min(Math.max(x - width / 2, 0), 800 - width);
                  const boxY = y - height - 14 < 0 ? y + 14 : y - height - 14;
                  return (
                    <g className="graph-tooltip" pointerEvents="none">
                      <rect x={boxX} y={boxY} width={width} height={height} rx="6" fill="#333" />
                      <text x={boxX + width / 2} y={boxY + 20} textAnchor="middle" fontSize="12" fill="#ccc">
                        {groupedByWeek ? `Week of ${formatDate(point.date)}` : formatDate(point.date)}
                      </text>
                      <text x={boxX + width / 2} y={boxY + 39} textAnchor="middle" fontSize="14" fontWeight="600" fill="#fff">
                        {`${formatHours(point.focus_time_seconds)} (${formatDuration(point.focus_time_seconds)})`}
                      </text>
                    </g>
                  );
                })()}
              </g>
            </svg>
          </div>
        </div>
      ) : (
        <div className="graph-empty">
          <p>No focus time data available for the selected time range and category.</p>
        </div>
      )}
    </div>
  );
}
