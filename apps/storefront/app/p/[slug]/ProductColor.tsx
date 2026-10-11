'use client';

import { createContext, useContext, useState } from 'react';

type ColorState = readonly [string | null, (color: string | null) => void];

const ColorContext = createContext<ColorState>([null, () => {}]);

/**
 * Photos per color (p10-29): the color the shopper chose, shared by the option picker (which
 * sets it) and the gallery (which shows that color's photos first).
 */
export function ProductColorProvider({
  initial,
  children,
}: {
  initial: string | null;
  children: React.ReactNode;
}) {
  const state = useState<string | null>(initial);
  return <ColorContext.Provider value={state}>{children}</ColorContext.Provider>;
}

export function useProductColor(): ColorState {
  return useContext(ColorContext);
}
