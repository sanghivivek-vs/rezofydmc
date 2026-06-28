import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import { LoginPage } from './LoginPage';
import { api } from '../api/client';

describe('LoginPage', () => {
  it('submits credentials to the API', async () => {
    const login = vi.spyOn(api, 'login').mockResolvedValue({
      token: 'tok',
      user: { id: 'u1', orgId: 'o1', email: 'a@b.c', name: 'A', role: 'Owner', status: 'active' },
    });

    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText('Email'), 'a@b.c');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(login).toHaveBeenCalledWith('a@b.c', 'password123');
  });
});
