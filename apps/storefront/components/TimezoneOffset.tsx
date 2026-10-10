'use client';

import { useEffect, useRef } from 'react';

/**
 * Sends the browser's UTC offset with a form, so times typed into datetime-local fields mean
 * the seller's local time rather than the server's.
 */
export function TimezoneOffset({ name = 'tzOffset' }: { name?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = String(new Date().getTimezoneOffset());
  }, []);
  return <input ref={ref} type="hidden" name={name} defaultValue="" />;
}
