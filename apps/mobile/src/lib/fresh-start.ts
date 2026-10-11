import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, Linking } from 'react-native';
import { queryClient } from '@/lib/query';

/**
 * Reopening the app (ADR-0053): back from the background after a minute or more, it lands on
 * a freshly loaded Home screen, like opening it new. A quick switch (copying a code, a payment
 * app) keeps your place, and so do screens where you're in the middle of something.
 */
export const AWAY_MS = 60_000;

/** Screens left as they are on return: paying, signing in, writing. */
const KEEP = [
  '/checkout',
  '/stripe-redirect',
  '/sign-in',
  '/register',
  '/forgot-password',
  '/delete-account',
  '/return',
  '/review',
  '/messages',
  '/help/chat',
];

/** A notification tap or link opened the app: it goes there, not Home. */
let linkedAt = 0;
/** When the app went to the background; kept across the lock screen. */
let awaySince: number | null = null;
export function markOpenedByLink(): void {
  linkedAt = Date.now();
}

export function useFreshStartOnReturn(enabled: boolean): void {
  const pathname = usePathname();
  const path = useRef(pathname);
  path.current = pathname;

  useEffect(() => {
    // The away time is noted even while locked; the reset waits until the app is usable.
    const away = AppState.addEventListener('change', (state) => {
      if (state === 'background') awaySince = Date.now();
    });
    if (!enabled) return () => away.remove();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      if (AppState.currentState !== 'active' || awaySince === null) return;
      const gone = Date.now() - awaySince;
      awaySince = null;
      if (gone < AWAY_MS) return;
      // Give a link or notification tap a moment to arrive first.
      timer = setTimeout(() => {
        if (Date.now() - linkedAt < 3_000) return;
        if (KEEP.some((p) => path.current === p || path.current.startsWith(`${p}/`))) return;
        if (router.canDismiss()) router.dismissAll();
        router.navigate('/');
        void queryClient.invalidateQueries();
      }, 400);
    };
    const links = Linking.addEventListener('url', markOpenedByLink);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    // Just unlocked after being away.
    check();
    return () => {
      away.remove();
      sub.remove();
      links.remove();
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);
}
