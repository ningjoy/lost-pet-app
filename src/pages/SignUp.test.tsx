import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignUp from './SignUp';

const { signUp } = vi.hoisted(() => ({ signUp: vi.fn() }));

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { signUp } },
}));

function renderPage() {
  render(
    <MemoryRouter>
      <SignUp />
    </MemoryRouter>,
  );
}

function fill(email: string, password: string) {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.change(screen.getByLabelText('Password'), {
    target: { value: password },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
}

describe('SignUp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(cleanup);

  it('rejects a password that is too short', () => {
    renderPage();
    fill('new@example.com', '123');
    expect(screen.getByRole('alert').textContent).toBe(
      'Use a password with at least 6 characters.',
    );
    expect(signUp).not.toHaveBeenCalled();
  });

  it('sends the name along when creating an account', async () => {
    signUp.mockResolvedValue({ error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText('Name (optional)'), {
      target: { value: 'Dana' },
    });
    fill('dana@example.com', 'password123');
    await waitFor(() =>
      expect(signUp).toHaveBeenCalledWith({
        email: 'dana@example.com',
        password: 'password123',
        options: { data: { display_name: 'Dana' } },
      }),
    );
  });
});
