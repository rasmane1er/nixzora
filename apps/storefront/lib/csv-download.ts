import 'server-only';
import { API_URL } from './api';
import { clientHeaders } from './client-headers';
import { accessToken } from './session';

/** Relays a CSV download from the API with the seller's token (kept on the server). */
export async function relayCsv(path: string): Promise<Response> {
  const token = await accessToken();
  if (!token) return new Response('Sign in first.', { status: 401 });
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}`, ...(await clientHeaders()) },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) return new Response('The file could not be prepared.', { status: res.status });
  return new Response(await res.text(), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': res.headers.get('content-disposition') ?? 'attachment',
      'Cache-Control': 'no-store',
    },
  });
}
