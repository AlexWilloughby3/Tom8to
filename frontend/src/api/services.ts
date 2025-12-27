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
  CategoryUpdate,
  GraphData,
  TimeRange,
  PasswordChangeRequest,
} from '../types';

// User/Auth Services
export const authService = {
  async register(data: RegisterData): Promise<{ message: string }> {
    return api.post<{ message: string }>('/users/register', data);
  },

  async verifyRegistration(email: string, code: string): Promise<User> {
    return api.post<User>('/users/verify-registration', { email, code });
  },

  async login(credentials: LoginCredentials): Promise<User> {
    return api.post<User>('/users/login', credentials);
  },

  async getUser(email: string): Promise<User> {
    return api.get<User>(`/users/${encodeURIComponent(email)}`);
  },

  async deleteUser(email: string): Promise<void> {
    return api.delete<void>(`/users/${encodeURIComponent(email)}`);
  },
};

// Focus Session Services
export const focusSessionService = {
  async createSession(email: string, data: FocusSessionCreate): Promise<FocusSession> {
    return api.post<FocusSession>(`/users/${encodeURIComponent(email)}/focus-sessions`, data);
  },

  async getSessions(
    email: string,
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
      `/users/${encodeURIComponent(email)}/focus-sessions${query ? `?${query}` : ''}`
    );
  },

  async deleteSession(email: string, timestamp: string): Promise<void> {
    return api.delete<void>(`/users/${encodeURIComponent(email)}/focus-sessions/${encodeURIComponent(timestamp)}`);
  },
};

// Focus Goal Services
export const focusGoalService = {
  async createGoal(email: string, data: FocusGoalCreate): Promise<FocusGoal> {
    return api.post<FocusGoal>(`/users/${encodeURIComponent(email)}/focus-goals`, data);
  },

  async getGoals(email: string): Promise<FocusGoal[]> {
    return api.get<FocusGoal[]>(`/users/${encodeURIComponent(email)}/focus-goals`);
  },

  async getGoal(email: string, category: string): Promise<FocusGoal> {
    return api.get<FocusGoal>(`/users/${encodeURIComponent(email)}/focus-goals/${encodeURIComponent(category)}`);
  },

  async deleteGoal(email: string, category: string): Promise<void> {
    return api.delete<void>(`/users/${encodeURIComponent(email)}/focus-goals/${encodeURIComponent(category)}`);
  },
};

// Stats Services
export const statsService = {
  async getUserStats(
    email: string,
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
      `/users/${encodeURIComponent(email)}/stats${query ? `?${query}` : ''}`
    );
  },

  async getWeeklyStats(email: string): Promise<UserStats> {
    return api.get<UserStats>(`/users/${encodeURIComponent(email)}/stats/weekly`);
  },
};

// Category Services
export const categoryService = {
  async createCategory(email: string, data: CategoryCreate): Promise<Category> {
    return api.post<Category>(`/users/${encodeURIComponent(email)}/categories`, data);
  },

  async getCategories(email: string): Promise<Category[]> {
    return api.get<Category[]>(`/users/${encodeURIComponent(email)}/categories`);
  },

  async updateCategory(email: string, category: string, data: CategoryUpdate): Promise<Category> {
    return api.patch<Category>(`/users/${encodeURIComponent(email)}/categories/${encodeURIComponent(category)}`, data);
  },

  async deleteCategory(email: string, category: string): Promise<void> {
    return api.delete<void>(`/users/${encodeURIComponent(email)}/categories/${encodeURIComponent(category)}`);
  },
};

// Graph Data Services
export const graphService = {
  async getGraphData(email: string, timeRange: TimeRange, category?: string): Promise<GraphData> {
    const params = new URLSearchParams({ time_range: timeRange });
    if (category) {
      params.append('category', category);
    }
    return api.get<GraphData>(`/users/${encodeURIComponent(email)}/graph-data?${params.toString()}`);
  },
};

// Verification Code Services (for passwordless login)
export const verificationService = {
  async requestCode(email: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/users/request-verification-code', { email });
  },

  async loginWithCode(email: string, code: string): Promise<User> {
    return api.post<User>('/users/login-with-code', { email, code });
  },
};

// Account Management Services
export const accountService = {
  async changePassword(email: string, data: PasswordChangeRequest): Promise<{ message: string }> {
    return api.post<{ message: string }>(`/users/${encodeURIComponent(email)}/change-password`, data);
  },

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/users/request-password-reset', { email });
  },

  async resetPassword(token: string, new_password: string): Promise<{ message: string }> {
    return api.post<{ message: string }>('/users/reset-password', { token, new_password });
  },
};
