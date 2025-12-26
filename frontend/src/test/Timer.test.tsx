import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import Timer from '../pages/Timer';
import { AuthProvider } from '../contexts/AuthContext';
import { focusSessionService } from '../api/services';

// Mock the focus session service
vi.mock('../api/services', () => ({
  focusSessionService: {
    createSession: vi.fn(),
  },
}));

function renderTimer() {
  // Set up a logged-in user
  localStorage.setItem('user', JSON.stringify({ email: 'testuser@example.com' }));

  return render(
    <BrowserRouter>
      <AuthProvider>
        <Timer />
      </AuthProvider>
    </BrowserRouter>
  );
}

describe('Timer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render timer interface', () => {
    renderTimer();

    expect(screen.getByText('Focus Timer')).toBeInTheDocument();
    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start/i })).toBeInTheDocument();
  });

  it('should start and stop timer', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    const startButton = screen.getByRole('button', { name: /start/i });
    await user.click(startButton);

    // Timer should be running
    expect(screen.getByText(/recording/i)).toBeInTheDocument();

    // Advance time by 5 seconds
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.getByText('00:00:05')).toBeInTheDocument();
    });

    // Pause the timer
    const pauseButton = screen.getByRole('button', { name: /pause/i });
    await user.click(pauseButton);

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });

  it('should save focus session when stopped', async () => {
    const user = userEvent.setup({ delay: null });
    vi.mocked(focusSessionService.createSession).mockResolvedValue({
      email: 'testuser@example.com',
      category: 'Work',
      focus_time_seconds: 10,
      time: new Date().toISOString(),
    });

    renderTimer();

    // Start timer
    await user.click(screen.getByRole('button', { name: /start/i }));

    // Run for 10 seconds
    vi.advanceTimersByTime(10000);

    await waitFor(() => {
      expect(screen.getByText('00:00:10')).toBeInTheDocument();
    });

    // Pause timer
    await user.click(screen.getByRole('button', { name: /pause/i }));

    // Save session
    await user.click(screen.getByRole('button', { name: /save session/i }));

    await waitFor(() => {
      expect(focusSessionService.createSession).toHaveBeenCalledWith('testuser@example.com', {
        category: 'Work',
        focus_time_seconds: 10,
      });
      expect(screen.getByText(/focus session saved/i)).toBeInTheDocument();
    });
  });

  it('should reset timer', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    // Start and run timer
    await user.click(screen.getByRole('button', { name: /start/i }));
    vi.advanceTimersByTime(5000);

    await waitFor(() => {
      expect(screen.getByText('00:00:05')).toBeInTheDocument();
    });

    // Pause
    await user.click(screen.getByRole('button', { name: /pause/i }));

    // Reset
    await user.click(screen.getByRole('button', { name: /reset/i }));

    expect(screen.getByText('00:00:00')).toBeInTheDocument();
    expect(screen.getByText(/ready to start/i)).toBeInTheDocument();
  });

  it('should allow selecting different categories', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    const categorySelect = screen.getByLabelText(/category/i);

    await user.selectOptions(categorySelect, 'Study');
    expect(categorySelect).toHaveValue('Study');

    await user.selectOptions(categorySelect, 'Exercise');
    expect(categorySelect).toHaveValue('Exercise');
  });

  it('should allow custom category', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    const categorySelect = screen.getByLabelText(/category/i);
    await user.selectOptions(categorySelect, 'Custom');

    // Custom input should appear
    const customInput = screen.getByLabelText(/custom category name/i);
    expect(customInput).toBeInTheDocument();

    await user.type(customInput, 'Programming');
    expect(customInput).toHaveValue('Programming');
  });

  it('should show error when trying to save session with 0 seconds', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    // Don't start timer, just try to save
    // Actually we can't click save without starting first, so let's start then immediately stop
    await user.click(screen.getByRole('button', { name: /start/i }));
    await user.click(screen.getByRole('button', { name: /pause/i }));

    // Timer is at 0 seconds (or maybe 1), let's reset it
    await user.click(screen.getByRole('button', { name: /reset/i }));

    // Now try to start and immediately pause without any time passing
    await user.click(screen.getByRole('button', { name: /start/i }));
    await user.click(screen.getByRole('button', { name: /pause/i }));

    await user.click(screen.getByRole('button', { name: /save session/i }));

    await waitFor(() => {
      expect(screen.getByText(/timer must run for at least 1 second/i)).toBeInTheDocument();
    });
  });

  it('should disable category selection while timer is running', async () => {
    const user = userEvent.setup({ delay: null });
    renderTimer();

    const categorySelect = screen.getByLabelText(/category/i);
    expect(categorySelect).not.toBeDisabled();

    await user.click(screen.getByRole('button', { name: /start/i }));

    expect(categorySelect).toBeDisabled();
  });
});
