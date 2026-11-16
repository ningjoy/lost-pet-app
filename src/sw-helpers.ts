export type PushPayload = { title: string; body: string; url: string };

const DEFAULT_TITLE = 'Lost Pet Neighbor';

export function parsePushPayload(text: string | null): PushPayload {
  if (!text) return { title: DEFAULT_TITLE, body: '', url: '/' };
  try {
    const data = JSON.parse(text) as Partial<PushPayload>;
    return {
      title: data.title || DEFAULT_TITLE,
      body: data.body ?? '',
      url: data.url || '/',
    };
  } catch {
    return { title: DEFAULT_TITLE, body: text, url: '/' };
  }
}
