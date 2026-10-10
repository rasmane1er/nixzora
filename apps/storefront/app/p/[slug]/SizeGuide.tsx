'use client';

import { FIT_MIN_ANSWERS, type ProductDetail } from '@nixzora/validation';
import { useRef } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';

type Guide = NonNullable<ProductDetail['sizeGuide']>;

/**
 * Size & fit guide (p10-26): how reviewers say it fits, and the size chart in a dialog with the
 * fit breakdown. Shown on clothing and shoes, next to the size choice.
 */
export function SizeGuide({ guide }: { guide: Guide }) {
  const t = useT('sizeGuide');
  const f = useFormat();
  const dialog = useRef<HTMLDialogElement>(null);
  const { fit, chart } = guide;
  if (!chart && !fit.answers) return null;
  const share = (n: number) => (fit.answers ? n / fit.answers : 0);
  return (
    <div className="size-guide">
      {fit.verdict ? (
        <p className="size-guide__fit">
          <strong>{t(`fit_${fit.verdict}`)}</strong> · {t(`advice_${fit.verdict}`)}{' '}
          <span className="muted">{t('fitBased', { count: fit.answers })}</span>
        </p>
      ) : fit.answers >= FIT_MIN_ANSWERS ? (
        <p className="size-guide__fit muted">{t('fitMixed')}</p>
      ) : null}
      <button
        type="button"
        className="btn btn--link btn--sm"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
      >
        {t('open')}
      </button>
      <dialog ref={dialog} className="size-dialog" aria-labelledby="size-guide-title">
        <div className="size-dialog__head">
          <h2 id="size-guide-title">{chart?.name ?? t('title')}</h2>
          <button
            type="button"
            className="btn btn--link"
            onClick={() => dialog.current?.close()}
            aria-label={t('close')}
          >
            ✕
          </button>
        </div>
        {chart ? (
          <div className="table-scroll">
            <table className="plain size-table">
              <thead>
                <tr>
                  <th scope="col">{t('size')}</th>
                  {chart.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chart.rows.map((row) => (
                  <tr key={row.size}>
                    <th scope="row">{row.size}</th>
                    {row.values.map((value, i) => (
                      <td key={i}>{value}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{t('noChart')}</p>
        )}
        {chart?.note ? <p className="hint">{chart.note}</p> : null}
        <h3>{t('fitTitle')}</h3>
        {fit.answers ? (
          <>
            <ul className="fit-bars">
              {(
                [
                  ['small', fit.small],
                  ['trueToSize', fit.trueToSize],
                  ['large', fit.large],
                ] as const
              ).map(([label, n]) => (
                <li key={label}>
                  <span>{t(label)}</span>
                  <span className="funnel__track" aria-hidden="true">
                    <span className="funnel__bar" style={{ width: `${share(n) * 100}%` }} />
                  </span>
                  <span className="muted">{f.percent(share(n))}</span>
                </li>
              ))}
            </ul>
            <p className="muted" style={{ margin: 0 }}>
              {t('fitBased', { count: fit.answers })}
            </p>
          </>
        ) : (
          <p className="muted">{t('fitNone')}</p>
        )}
      </dialog>
    </div>
  );
}
