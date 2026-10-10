'use server';

import { api } from '@/lib/api';
import { ensureVisitorId } from '@/lib/visitor';

/** Records a search for personalized picks. Best-effort: never fails the page. */
export async function recordSearch(q: string): Promise<void> {
  const text = String(q ?? '').trim();
  if (text.length < 2 || text.length > 200) return;
  try {
    const visitorId = await ensureVisitorId();
    await api('/events/searches', { method: 'POST', body: { q: text, visitorId } });
  } catch {
    // Picks are best-effort.
  }
}
