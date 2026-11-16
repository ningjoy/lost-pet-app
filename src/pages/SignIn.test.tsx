import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignIn from './SignIn';

const { signInWithPassword } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signInWithPassword } },
}));

function renderPage() {
  render(
    <MemoryRouter>
      <SignIn />
    </MemoryRouter>,
  );
}

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
}

describe('SignIn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('asks for an email and password when they are empty', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('alert').textContent).toBe(
      'Enter your email and password.',
    );
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('shows a message when the password is wrong', async () => {
    signInWithPassword.mockResolvedValue({
      error: { message: 'Invalid login credentials' },
    });
    renderPage();
    fillAndSubmit('alice@example.com', 'wrongpass');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toBe('Incorrect email or password.');
  });

  it('calls Supabase with the email and password', async () => {
    signInWithPassword.mockResolvedValue({ error: null });
    renderPage();
    fillAndSubmit(' alice@example.com ', 'password123');
    await waitFor(() =>
      expect(signInWithPassword).toHaveBeenCalledWith({
        email: 'alice@example.com',
        password: 'password123',
      }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
