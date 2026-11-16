import { describe, expect, test } from 'vitest';
import { parsePushPayload } from './sw-helpers';

describe('parsePushPayload', () => {
  test('reads title, body and url from JSON', () => {
    expect(
      parsePushPayload('{"title":"Hi","body":"There","url":"/pets/1"}'),
    ).toEqual({ title: 'Hi', body: 'There', url: '/pets/1' });
  });

  test('falls back to defaults for missing fields', () => {
    expect(parsePushPayload('{}')).toEqual({
      title: 'Lost Pet Neighbor',
      body: '',
      url: '/',
    });
  });

  test('treats non-JSON text as the body', () => {
    expect(parsePushPayload('plain text')).toEqual({
      title: 'Lost Pet Neighbor',
      body: 'plain text',
      url: '/',
    });
  });

  test('handles an empty push', () => {
    expect(parsePushPayload(null).title).toBe('Lost Pet Neighbor');
  });
});
