import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import Layout from './Layout';

test('phone bottom bar links to Settings', () => {
  render(
    <MemoryRouter>
      <Layout />
    </MemoryRouter>,
  );
  const phoneNav = screen.getByRole('navigation', { name: 'Phone' });
  expect(
    within(phoneNav).getByRole('link', { name: 'Settings' }),
  ).toHaveAttribute('href', '/settings');
});
