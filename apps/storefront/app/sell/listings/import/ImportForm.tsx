'use client';

import { type ListingImportResult } from '@nixzora/validation';
import { rich } from '@nixzora/i18n';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/components/I18nProvider';
import { importListings } from '../../actions';

const MAX_BYTES = 1_000_000;

/** Pick a CSV, check it (nothing saved), then import. Errors are listed by row and column. */
export function ImportForm() {
  const t = useT('sellerTools');
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<ListingImportResult | null>(null);

  async function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setResult(null);
    setProblem(null);
    setCsv(null);
    if (!file) return;
    if (file.size > MAX_BYTES) return setProblem(t('fileTooBig'));
    setFileName(file.name);
    const text = await file.text();
    setCsv(text);
    await send(text, true);
  }

  async function send(text: string, dryRun: boolean) {
    setBusy(true);
    setProblem(null);
    const response = await importListings(text, dryRun);
    setBusy(false);
    if (!response.ok) return setProblem(response.error);
    setResult(response.data);
  }

  const clean = result && result.errors.length === 0;
  const nothing = clean && !result.newListings && !result.updatedOptions;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <label>
        {t('csvFile')} <span className="hint">{t('csvFileHint')}</span>
        <input type="file" accept=".csv,text/csv" onChange={choose} disabled={busy} />
      </label>
      {busy ? <p className="muted">{t('checkingFile', { file: fileName })}</p> : null}
      {problem ? (
        <p className="banner banner--error" role="alert">
          {problem}
        </p>
      ) : null}

      {result && result.dryRun ? (
        <section className="stack" aria-live="polite" style={{ gap: 12 }}>
          {result.errors.length ? (
            <>
              <p className="banner banner--error" role="alert">
                {t('thingsToFix', { count: result.errors.length })}
              </p>
              <div className="table-scroll">
                <table className="plain">
                  <thead>
                    <tr>
                      <th>{t('colRow')}</th>
                      <th>{t('colColumn')}</th>
                      <th>{t('colProblem')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.slice(0, 200).map((issue, i) => (
                      <tr key={i}>
                        <td className="mono">{issue.row}</td>
                        <td className="mono">{issue.column ?? '—'}</td>
                        <td>{issue.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : nothing ? (
            <p className="banner banner--info">{t('allMatch')}</p>
          ) : (
            <>
              <p className="banner banner--ok" role="status">
                {t('readySummary', {
                  rows: result.rows,
                  listings: result.newListings,
                  options: result.newOptions,
                  changes: result.updatedOptions,
                })}
              </p>
              <div>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={busy || !csv}
                  onClick={() => csv && void send(csv, false)}
                >
                  {t('importNow')}
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {clean && result && !result.dryRun ? (
        <p className="banner banner--ok" role="status">
          {rich(
            t('doneSummary', {
              summary: [
                result.createdIds.length
                  ? t('doneDrafts', { count: result.createdIds.length })
                  : '',
                result.updatedOptions ? t('doneChanges', { count: result.updatedOptions }) : '',
              ]
                .filter(Boolean)
                .join(t('and')),
            }),
            {
              link: (chunk) => (
                <Link key="drafts" href="/sell/listings?status=DRAFT">
                  {chunk}
                </Link>
              ),
            },
          )}
        </p>
      ) : null}
      {result && !result.dryRun && result.errors.length ? (
        <p className="banner banner--error" role="alert">
          {t('importedExcept', {
            list: result.errors
              .map((e) => t('rowError', { row: e.row, message: e.message }))
              .join('; '),
          })}
        </p>
      ) : null}
    </div>
  );
}
