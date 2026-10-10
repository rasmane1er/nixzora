'use client';

import { useSyncExternalStore } from 'react';
import { COMPARE_MAX } from '@nixzora/validation';

/**
 * The products picked to compare (p10-13), by slug, in this browser only. Storage can be
 * missing (private mode); then the list just lives for the page.
 */
const KEY = 'nx_compare';
const listeners = new Set<() => void>();
let memory: string[] = [];
let cached: string[] | null = null;

function read(): string[] {
  if (cached) return cached;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cached = Array.isArray(parsed)
      ? parsed.filter((s): s is string => typeof s === 'string').slice(0, COMPARE_MAX)
      : [];
  } catch {
    cached = memory;
  }
  return cached;
}

function write(next: string[]) {
  memory = next;
  cached = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private mode: keep it in memory.
  }
  for (const listener of listeners) listener();
}

const EMPTY: string[] = [];

export function useCompareList(): string[] {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    read,
    () => EMPTY,
  );
}

/** Adds or removes a product; false when the list is already full. */
export function toggleCompare(slug: string): boolean {
  const list = read();
  if (list.includes(slug)) {
    write(list.filter((s) => s !== slug));
    return true;
  }
  if (list.length >= COMPARE_MAX) return false;
  write([...list, slug]);
  return true;
}

export function clearCompare() {
  write([]);
}

export function compareHref(slugs: string[]): string {
  return `/compare?products=${slugs.map(encodeURIComponent).join(',')}`;
}
