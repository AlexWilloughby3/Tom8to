export interface User {
  userid: string;
}

export interface FocusSession {
  userid: string;
  time: string;
  focus_time_seconds: number;
  category: string;
}

export interface FocusGoal {
  userid: string;
  category: string;
  goal_time_per_week_seconds: number;
}

export interface CategoryStats {
  category: string;
  total_time_seconds: number;
  session_count: number;
  average_time_seconds: number;
  goal_time_per_week_seconds?: number;
  progress_percentage?: number;
}

export interface UserStats {
  userid: string;
  total_focus_time_seconds: number;
  total_sessions: number;
  categories: CategoryStats[];
}

export interface LoginCredentials {
  userid: string;
  password: string;
}

export interface RegisterData {
  userid: string;
  password: string;
}

export interface FocusSessionCreate {
  category: string;
  focus_time_seconds: number;
}

export interface FocusGoalCreate {
  category: string;
  goal_time_per_week_seconds: number;
}

export interface Category {
  userid: string;
  category: string;
}

export interface CategoryCreate {
  category: string;
}

export interface GraphDataPoint {
  date: string;
  focus_time_seconds: number;
}

export interface GraphData {
  data_points: GraphDataPoint[];
  time_range: string;
  category?: string;
}

export type TimeRange = 'week' | 'month' | '6month' | 'ytd';
