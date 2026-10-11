import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

// One clock for the whole app (p10-38): every countdown subscribes to the same tick, so a long
// list of cards runs a single timer, and it pauses while the app is in the background.
const listeners = new Set<(now: number) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function start() {
  if (!ticker && listeners.size) {
    ticker = setInterval(() => listeners.forEach((l) => l(Date.now())), 1000);
  }
}
function stop() {
  if (ticker) clearInterval(ticker);
  ticker = null;
}

AppState.addEventListener?.('change', (state) => {
  if (state === 'active') {
    listeners.forEach((l) => l(Date.now()));
    start();
  } else stop();
});

function subscribe(listener: (now: number) => void): () => void {
  listeners.add(listener);
  start();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) stop();
  };
}

/** The time now, updated every `stepMs` (1 s for clocks, a minute for "2 h 15 min"). */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let last = Math.floor(Date.now() / stepMs);
    return subscribe((at) => {
      const step = Math.floor(at / stepMs);
      if (step !== last) {
        last = step;
        setNow(at);
      }
    });
  }, [stepMs]);
  return now;
}
