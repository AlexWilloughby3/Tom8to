export interface User {
  email: string;
}

export interface FocusSession {
  email: string;
  time: string;
  focus_time_seconds: number;
  category: string;
}

export interface FocusGoal {
  email: string;
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
  email: string;
  total_focus_time_seconds: number;
  total_sessions: number;
  categories: CategoryStats[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
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
  email: string;
  category: string;
  active: boolean;
}

export interface CategoryCreate {
  category: string;
}

export interface CategoryUpdate {
  active: boolean;
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

// New types for verification code and password management
export interface VerificationCodeRequest {
  email: string;
}

export interface VerificationCodeLogin {
  email: string;
  code: string;
}

export interface PasswordChangeRequest {
  current_password: string;
  new_password: string;
}
