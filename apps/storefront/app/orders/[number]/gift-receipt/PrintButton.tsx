'use client';

export function PrintButton({ label }: { label: string }) {
  return (
    <button type="button" className="btn btn--secondary no-print" onClick={() => window.print()}>
      {label}
    </button>
  );
}
