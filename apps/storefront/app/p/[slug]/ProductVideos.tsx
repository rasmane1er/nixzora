'use client';

import { type ProductVideo } from '@nixzora/validation';
import { useState } from 'react';
import { useT } from '@/components/I18nProvider';

/**
 * Product videos (p10-28). Each shows its still and a play button; the provider's player loads
 * only when the shopper presses play, so nothing is fetched from YouTube or Vimeo before that.
 */
export function ProductVideos({ videos }: { videos: ProductVideo[] }) {
  const t = useT('videos');
  const [playing, setPlaying] = useState<string | null>(null);
  // Stills that failed to load (a removed video, a blocked host): the dark tile stays.
  const [broken, setBroken] = useState<ReadonlySet<string>>(new Set());
  if (!videos.length) return null;
  return (
    <section className="section stack" aria-labelledby="videos-title">
      <h2 id="videos-title">{t('sectionTitle')}</h2>
      <ul className="video-grid">
        {videos.map((video) => (
          <li key={video.id} className="video-tile">
            <div className="video-tile__frame">
              {playing === video.id ? (
                <iframe
                  src={video.embedUrl}
                  title={video.title}
                  allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              ) : (
                <button
                  type="button"
                  className="video-tile__play"
                  onClick={() => setPlaying(video.id)}
                  aria-label={t('play', { title: video.title })}
                >
                  {video.thumbnailUrl && !broken.has(video.id) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- the provider's still
                    <img
                      src={video.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      // A still that failed before the page woke up never fires onError.
                      ref={(img) => {
                        if (img?.complete && img.naturalWidth === 0) {
                          queueMicrotask(() => setBroken((b) => new Set(b).add(video.id)));
                        }
                      }}
                      onError={() => setBroken((b) => new Set(b).add(video.id))}
                    />
                  ) : null}
                  <span className="video-tile__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="28" height="28">
                      <path d="M9 5.5v13l10.5-6.5z" fill="currentColor" />
                    </svg>
                  </span>
                </button>
              )}
            </div>
            <p className="video-tile__title">{video.title}</p>
            <p className="hint">
              {t(`playsFrom_${video.provider}`)} ·{' '}
              <a href={video.watchUrl} target="_blank" rel="noopener noreferrer">
                {t(`watchOn_${video.provider}`)}
              </a>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
