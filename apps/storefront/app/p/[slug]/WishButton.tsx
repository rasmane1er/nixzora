'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { setWish } from '../../account/wishlist/actions';

export function WishButton({
  productId,
  initial,
  slug,
}: {
  productId: string;
  initial: boolean;
  slug: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      className="wish"
      aria-pressed={saved}
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setWish(productId, !saved);
          if (result.ok) setSaved(result.saved);
          else if (result.signIn) router.push(`/account/login?next=/p/${slug}`);
        })
      }
    >
      {saved ? '♥ Saved' : '♡ Save'}
    </button>
  );
}
