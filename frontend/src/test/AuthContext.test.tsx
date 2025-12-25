import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import type { User } from '../types';

// Test component that uses the auth context
function TestComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();

  return (
    <div>
      <div data-testid="auth-status">{isAuthenticated ? 'authenticated' : 'not authenticated'}</div>
      <div data-testid="user-id">{user?.userid || 'no user'}</div>
      <button onClick={() => login({ userid: 'testuser' } as User)}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should provide authentication context', () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('not authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('no user');
  });

  it('should log in a user', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
      expect(screen.getByTestId('user-id')).toHaveTextContent('testuser');
    });
  });

  it('should persist user to localStorage', async () => {
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      const storedUser = localStorage.getItem('user');
      expect(storedUser).toBeTruthy();
      expect(JSON.parse(storedUser!).userid).toBe('testuser');
    });
  });

  it('should restore user from localStorage', () => {
    const user: User = { userid: 'storeduser' };
    localStorage.setItem('user', JSON.stringify(user));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('user-id')).toHaveTextContent('storeduser');
  });

  it('should log out a user', async () => {
    localStorage.setItem('user', JSON.stringify({ userid: 'testuser' }));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('auth-status')).toHaveTextContent('authenticated');

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(screen.getByTestId('auth-status')).toHaveTextContent('not authenticated');
      expect(screen.getByTestId('user-id')).toHaveTextContent('no user');
      expect(localStorage.getItem('user')).toBeNull();
    });
  });
});
