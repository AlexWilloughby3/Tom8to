export interface User {
  email: string;
  show_on_leaderboard: boolean;
}

export interface UserUpdate {
  show_on_leaderboard: boolean;
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

export interface CategoryRename {
  new_category: string;
}

export interface CategoryRenameResponse {
  requires_merge: boolean;
  target_exists: boolean;
  message: string;
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

export type TimeRange = 'week' | 'month' | '6month' | 'ytd' | 'custom';

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

// Leaderboard types
export interface LeaderboardEntry {
  email: string;
  focus_hours_this_week: number;
  focus_hours_all_time: number;
  goals_completed_this_week: number;
  total_goals_this_week: number;
  goals_completed_all_time: number;
}

// Data export/import types
export interface ExportedCategory {
  category: string;
  active: boolean;
}

export interface ExportedGoal {
  category: string;
  goal_time_per_week_seconds: number;
}

export interface ExportedSession {
  time: string;  // ISO format datetime string
  focus_time_seconds: number;
  category: string;
}

export interface UserDataExport {
  version: string;
  export_date: string;  // ISO format datetime string
  categories: ExportedCategory[];
  goals: ExportedGoal[];
  sessions: ExportedSession[];
}

export interface UserDataImport {
  version: string;
  categories: ExportedCategory[];
  goals: ExportedGoal[];
  sessions: ExportedSession[];
}

export interface ImportResult {
  categories_imported: number;
  goals_imported: number;
  sessions_imported: number;
  message: string;
}
