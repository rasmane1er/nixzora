import { z } from 'zod';

/**
 * Product videos (p10-28): links to YouTube or Vimeo, played in their privacy-enhanced players.
 * NIXZORA stores no video, so there is nothing to host, transcode or scan, and no cost.
 */
export const MAX_PRODUCT_VIDEOS = 3;

export type VideoProvider = 'YOUTUBE' | 'VIMEO';

export type ParsedVideo = { provider: VideoProvider; videoId: string };

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const VIMEO_ID = /^\d{6,12}$/;
const VIMEO_HASH = /^[a-f0-9]{6,20}$/;

/**
 * The video a link points to, or null. YouTube: watch, youtu.be, shorts, embed and live links.
 * Vimeo: public links, channel and group links, the player, and unlisted links with their key
 * (kept as "123456789:abcdef12").
 */
export function parseVideoUrl(input: string): ParsedVideo | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, '');
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : ['shorts', 'embed', 'live', 'v'].includes(parts[0] ?? '')
            ? parts[1]
            : null;
    return id && YOUTUBE_ID.test(id) ? { provider: 'YOUTUBE', videoId: id } : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const at = parts.findIndex((p) => VIMEO_ID.test(p));
    if (at === -1) return null;
    const hash = url.searchParams.get('h') ?? parts[at + 1];
    return {
      provider: 'VIMEO',
      videoId: hash && VIMEO_HASH.test(hash) ? `${parts[at]}:${hash}` : parts[at]!,
    };
  }
  return null;
}

/** Where a video plays: the embed (privacy-enhanced, no tracking cookies) and its own page. */
export function videoUrls(video: ParsedVideo): { embedUrl: string; watchUrl: string } {
  if (video.provider === 'YOUTUBE') {
    return {
      embedUrl: `https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1&playsinline=1`,
      watchUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
    };
  }
  const [id, hash] = video.videoId.split(':');
  return {
    embedUrl: `https://player.vimeo.com/video/${id}?autoplay=1&dnt=1${hash ? `&h=${hash}` : ''}`,
    watchUrl: `https://vimeo.com/${id}${hash ? `/${hash}` : ''}`,
  };
}

export const ProductVideoAddSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    .refine((v) => parseVideoUrl(v) !== null, 'Paste a YouTube or Vimeo link to the video.'),
  /** What it shows ("Unboxing", "How to set it up"); the video's own title when left out. */
  title: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => v || undefined),
});
export type ProductVideoAdd = z.infer<typeof ProductVideoAddSchema>;

export const ProductVideoSchema = z.object({
  id: z.uuid(),
  provider: z.enum(['YOUTUBE', 'VIMEO']),
  videoId: z.string(),
  title: z.string(),
  /** A still from the video, when the provider has one. */
  thumbnailUrl: z.string().nullable(),
  embedUrl: z.string(),
  watchUrl: z.string(),
});
export type ProductVideo = z.infer<typeof ProductVideoSchema>;
