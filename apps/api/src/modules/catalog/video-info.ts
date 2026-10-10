import { type ParsedVideo, videoUrls } from '@nixzora/validation';

export type VideoInfo =
  | { ok: true; title: string | null; thumbnailUrl: string | null }
  /** The provider says the video is private, gone, or can't be embedded. */
  | { ok: false };

/**
 * Asks the provider about a video (oEmbed: public, no key, free). A definite "no" (private,
 * removed, embedding turned off) is reported; if the provider can't be reached the link is
 * taken as given, so a slow provider never blocks a store.
 */
export async function lookUpVideo(video: ParsedVideo, timeoutMs = 4000): Promise<VideoInfo> {
  const { watchUrl } = videoUrls(video);
  const endpoint =
    video.provider === 'YOUTUBE'
      ? `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(watchUrl)}`;
  let res: Response;
  try {
    res = await fetch(endpoint, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
      redirect: 'error',
    });
  } catch {
    return { ok: true, title: null, thumbnailUrl: null };
  }
  if ([400, 401, 403, 404].includes(res.status)) return { ok: false };
  if (!res.ok) return { ok: true, title: null, thumbnailUrl: null };
  try {
    const body = (await res.json()) as { title?: unknown; thumbnail_url?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : null;
    const thumb = typeof body.thumbnail_url === 'string' ? body.thumbnail_url : null;
    // Only the providers' own image hosts, over https.
    const safeThumb =
      thumb && /^https:\/\/(i\.ytimg\.com|i\.vimeocdn\.com)\//.test(thumb) ? thumb : null;
    return { ok: true, title: title || null, thumbnailUrl: safeThumb };
  } catch {
    return { ok: true, title: null, thumbnailUrl: null };
  }
}
