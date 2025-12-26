import { api } from './client';
import type {
  User,
  LoginCredentials,
  RegisterData,
  FocusSession,
  FocusSessionCreate,
  FocusGoal,
  FocusGoalCreate,
  UserStats,
  Category,
  CategoryCreate,
  GraphData,
  TimeRange,
} from '../types';

// User/Auth Services
export const authService = {
  async register(data: RegisterData): Promise<User> {
    return api.post<User>('/users/register', data);
  },

  async login(credentials: LoginCredentials): Promise<User> {
    return api.post<User>('/users/login', credentials);
  },

  async getUser(userid: string): Promise<User> {
    return api.get<User>(`/users/${userid}`);
  },

  async deleteUser(userid: string): Promise<void> {
    return api.delete<void>(`/users/${userid}`);
  },
};

// Focus Session Services
export const focusSessionService = {
  async createSession(userid: string, data: FocusSessionCreate): Promise<FocusSession> {
    return api.post<FocusSession>(`/users/${userid}/focus-sessions`, data);
  },

  async getSessions(
    userid: string,
    params?: {
      skip?: number;
      limit?: number;
      category?: string;
      start_date?: string;
      end_date?: string;
    }
  ): Promise<FocusSession[]> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return api.get<FocusSession[]>(
      `/users/${userid}/focus-sessions${query ? `?${query}` : ''}`
    );
  },

  async deleteSession(userid: string, timestamp: string): Promise<void> {
    return api.delete<void>(`/users/${userid}/focus-sessions/${encodeURIComponent(timestamp)}`);
  },
};

// Focus Goal Services
export const focusGoalService = {
  async createGoal(userid: string, data: FocusGoalCreate): Promise<FocusGoal> {
    return api.post<FocusGoal>(`/users/${userid}/focus-goals`, data);
  },

  async getGoals(userid: string): Promise<FocusGoal[]> {
    return api.get<FocusGoal[]>(`/users/${userid}/focus-goals`);
  },

  async getGoal(userid: string, category: string): Promise<FocusGoal> {
    return api.get<FocusGoal>(`/users/${userid}/focus-goals/${encodeURIComponent(category)}`);
  },

  async deleteGoal(userid: string, category: string): Promise<void> {
    return api.delete<void>(`/users/${userid}/focus-goals/${encodeURIComponent(category)}`);
  },
};

// Stats Services
export const statsService = {
  async getUserStats(
    userid: string,
    params?: {
      start_date?: string;
      end_date?: string;
    }
  ): Promise<UserStats> {
    const queryParams = new URLSearchParams();
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) queryParams.append(key, String(value));
      });
    }
    const query = queryParams.toString();
    return api.get<UserStats>(
      `/users/${userid}/stats${query ? `?${query}` : ''}`
    );
  },

  async getWeeklyStats(userid: string): Promise<UserStats> {
    return api.get<UserStats>(`/users/${userid}/stats/weekly`);
  },
};

// Category Services
export const categoryService = {
  async createCategory(userid: string, data: CategoryCreate): Promise<Category> {
    return api.post<Category>(`/users/${userid}/categories`, data);
  },

  async getCategories(userid: string): Promise<Category[]> {
    return api.get<Category[]>(`/users/${userid}/categories`);
  },

  async deleteCategory(userid: string, category: string): Promise<void> {
    return api.delete<void>(`/users/${userid}/categories/${encodeURIComponent(category)}`);
  },
};

// Graph Data Services
export const graphService = {
  async getGraphData(userid: string, timeRange: TimeRange, category?: string): Promise<GraphData> {
    const params = new URLSearchParams({ time_range: timeRange });
    if (category) {
      params.append('category', category);
    }
    return api.get<GraphData>(`/users/${userid}/graph-data?${params.toString()}`);
  },
};
