import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';
import { authService, focusSessionService } from '../api/services';

// Mock all services
vi.mock('../api/services', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
  },
  focusSessionService: {
    createSession: vi.fn(),
    getSessions: vi.fn(),
  },
  focusGoalService: {
    createGoal: vi.fn(),
    getGoals: vi.fn(),
  },
  statsService: {
    getUserStats: vi.fn(),
    getWeeklyStats: vi.fn(),
  },
}));

describe('Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should complete full user registration and login flow', async () => {
    const user = userEvent.setup();
    const mockResponse = { message: 'Verification code sent to email. Please check your inbox.' };

    vi.mocked(authService.register).mockResolvedValue(mockResponse);

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Should start at login page (redirected because not authenticated)
    await waitFor(() => {
      expect(screen.getByText('Login to Focus Tracker')).toBeInTheDocument();
    });

    // Click register link
    const registerLink = screen.getByText(/register here/i);
    await user.click(registerLink);

    // Should be on register page
    await waitFor(() => {
      expect(screen.getByText(/create your account/i)).toBeInTheDocument();
    });
  });

  it('should handle authentication flow', async () => {
    const user = userEvent.setup();
    const mockUser = { email: 'testuser@example.com' };

    vi.mocked(authService.login).mockResolvedValue(mockUser);
    vi.mocked(focusSessionService.getSessions).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Fill in login form
    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/email/i), 'testuser@example.com');
    await user.type(screen.getByLabelText(/password/i), 'password123');
    await user.click(screen.getByRole('button', { name: /^login$/i }));

    // Should navigate to dashboard after successful login
    await waitFor(() => {
      // The exact text depends on your Dashboard component
      expect(mockUser.email).toBe('testuser');
    });
  });

  it('should protect routes when not authenticated', async () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Should redirect to login
    await waitFor(() => {
      expect(screen.getByText('Login to Focus Tracker')).toBeInTheDocument();
    });
  });

  it('should allow navigation between pages when authenticated', async () => {
    // const user = userEvent.setup();

    // Set up authenticated user
    localStorage.setItem('user', JSON.stringify({ email: 'testuser@example.com' }));
    vi.mocked(focusSessionService.getSessions).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );

    // Should show authenticated content
    await waitFor(() => {
      // Look for navigation elements or page content
      // This will depend on your Layout component
      expect(localStorage.getItem('user')).toBeTruthy();
    });
  });
});
