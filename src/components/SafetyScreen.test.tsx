import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import SafetyScreen from './SafetyScreen';

afterEach(cleanup);

test('I understand calls onAcknowledge', () => {
  const onAcknowledge = vi.fn();
  render(<SafetyScreen onAcknowledge={onAcknowledge} />);
  fireEvent.click(screen.getByRole('button', { name: 'I understand' }));
  expect(onAcknowledge).toHaveBeenCalledTimes(1);
});
