'use client';

import { useEffect } from 'react';
import { recordView } from './actions';

/** Tells the API this product was viewed, once per page load. */
export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    void recordView(productId);
  }, [productId]);
  return null;
}
