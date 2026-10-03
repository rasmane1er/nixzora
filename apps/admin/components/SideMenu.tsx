'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

/**
 * On phones and small tablets the Ops Center menu folds behind a button, so each page starts
 * with its content instead of a screenful of links. On wider screens it is always shown.
 */
export function SideMenu({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  // Close after navigating (state derived from the route, no effect needed).
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="side__toggle"
        aria-expanded={open}
        aria-controls="side-menu"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? 'Close' : 'Menu'}
      </button>
      <div id="side-menu" className="side__body" data-open={open}>
        {children}
      </div>
    </>
  );
}
