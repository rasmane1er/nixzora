'use client';

import { trafficSource } from '@nixzora/validation';
import { useEffect } from 'react';
import { recordView } from './actions';

/**
 * Tells the API this product was viewed, once per page load, with where the shopper came from
 * (store analytics, p10-25): only the kind of page, never another site's address.
 */
export function ViewTracker({ productId }: { productId: string }) {
  useEffect(() => {
    void recordView(productId, trafficSource(document.referrer, window.location.origin));
  }, [productId]);
  return null;
}
