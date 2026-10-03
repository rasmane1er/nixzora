'use client';

import { type ListingImportResult } from '@nixzora/validation';
import Link from 'next/link';
import { useState } from 'react';
import { importListings } from '../../actions';

const MAX_BYTES = 1_000_000;

/** Pick a CSV, check it (nothing saved), then import. Errors are listed by row and column. */
export function ImportForm() {
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
    if (file.size > MAX_BYTES) return setProblem('Files can be up to 1 MB. Split it in two.');
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
        CSV file <span className="hint">Saved from Excel, Numbers or Google Sheets.</span>
        <input type="file" accept=".csv,text/csv" onChange={choose} disabled={busy} />
      </label>
      {busy ? <p className="muted">Checking {fileName}…</p> : null}
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
                {result.errors.length === 1
                  ? '1 thing to fix'
                  : `${result.errors.length} things to fix`}{' '}
                before importing. Nothing was saved.
              </p>
              <div className="table-scroll">
                <table className="plain">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Problem</th>
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
            <p className="banner banner--info">
              Everything in this file already matches your listings.
            </p>
          ) : (
            <>
              <p className="banner banner--ok" role="status">
                Ready: {result.rows} rows · {result.newListings} new{' '}
                {result.newListings === 1 ? 'listing' : 'listings'} ({result.newOptions} options) ·{' '}
                {result.updatedOptions} price or stock{' '}
                {result.updatedOptions === 1 ? 'change' : 'changes'}.
              </p>
              <div>
                <button
                  className="btn btn--primary"
                  type="button"
                  disabled={busy || !csv}
                  onClick={() => csv && void send(csv, false)}
                >
                  Import now
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}

      {clean && result && !result.dryRun ? (
        <p className="banner banner--ok" role="status">
          Done.{' '}
          {[
            result.createdIds.length
              ? `${result.createdIds.length} new ${result.createdIds.length === 1 ? 'draft' : 'drafts'}`
              : '',
            result.updatedOptions
              ? `${result.updatedOptions} price or stock ${result.updatedOptions === 1 ? 'change' : 'changes'}`
              : '',
          ]
            .filter(Boolean)
            .join(' and ')}
          . <Link href="/sell/listings?status=DRAFT">See your drafts →</Link> Add photos to them,
          then submit them for review.
        </p>
      ) : null}
      {result && !result.dryRun && result.errors.length ? (
        <p className="banner banner--error" role="alert">
          Imported, except: {result.errors.map((e) => `row ${e.row}: ${e.message}`).join('; ')}
        </p>
      ) : null}
    </div>
  );
}
