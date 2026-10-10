'use client';

import { useEffect } from 'react';
import { recordSearch } from './actions';

/** Remembers this search for "Because you searched for…" picks (p10-02), once per query. */
export function SearchTracker({ q }: { q: string }) {
  useEffect(() => {
    void recordSearch(q);
  }, [q]);
  return null;
}
