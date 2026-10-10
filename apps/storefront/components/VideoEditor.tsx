import { MAX_PRODUCT_VIDEOS, type ProductVideo } from '@nixzora/validation';
import { getT } from '@/lib/i18n';

/** Product videos (p10-28): a listing's videos, and a link field to add one. */
export async function VideoEditor({
  productId,
  videos,
  live,
  add,
  remove,
}: {
  productId: string;
  videos: ProductVideo[];
  /** A live listing goes back to review when a video is added. */
  live: boolean;
  add: (form: FormData) => Promise<void>;
  remove: (form: FormData) => Promise<void>;
}) {
  const t = await getT('videos');
  return (
    <section className="card stack" id="videos" aria-labelledby="videos-editor">
      <h2 id="videos-editor">{t('editorTitle')}</h2>
      <p className="muted" style={{ margin: 0, maxWidth: 760 }}>
        {t('editorHint', { max: MAX_PRODUCT_VIDEOS })}
      </p>
      {videos.length ? (
        <ul className="video-editor">
          {videos.map((video) => (
            <li key={video.id}>
              {video.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- the provider's still
                <img src={video.thumbnailUrl} alt="" width={96} height={54} loading="lazy" />
              ) : (
                <span className="video-editor__blank" aria-hidden="true">
                  ▶
                </span>
              )}
              <span className="stack" style={{ gap: 2, minWidth: 0 }}>
                <strong>{video.title}</strong>
                <a href={video.watchUrl} target="_blank" rel="noopener noreferrer" className="hint">
                  {t(`watchOn_${video.provider}`)}
                </a>
              </span>
              <form action={remove}>
                <input type="hidden" name="productId" value={productId} />
                <input type="hidden" name="videoId" value={video.id} />
                <button type="submit" className="btn btn--secondary btn--sm">
                  {t('remove')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('none')}
        </p>
      )}
      {videos.length < MAX_PRODUCT_VIDEOS ? (
        <form action={add} className="video-editor__add">
          <input type="hidden" name="productId" value={productId} />
          <input type="hidden" name="live" value={String(live)} />
          <label className="stack" style={{ gap: 4 }}>
            {t('url')}
            <input
              name="url"
              type="url"
              required
              maxLength={500}
              placeholder={t('urlPlaceholder')}
              inputMode="url"
            />
          </label>
          <label className="stack" style={{ gap: 4 }}>
            {t('titleLabel')}
            <input name="title" maxLength={100} placeholder={t('titlePlaceholder')} />
          </label>
          <button type="submit" className="btn btn--primary">
            {t('add')}
          </button>
        </form>
      ) : (
        <p className="hint" style={{ margin: 0 }}>
          {t('full', { max: MAX_PRODUCT_VIDEOS })}
        </p>
      )}
    </section>
  );
}
