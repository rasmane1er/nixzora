import { type ProductCard as Card, type SponsoredProduct } from '@nixzora/validation';
import { AboutAds } from './AboutAds';
import { ProductCard } from './ProductCard';
import { RailArrows } from './RailArrows';

/**
 * A titled row of product cards that scrolls sideways (touch, trackpad or the arrow buttons).
 * With `sponsored`, the cards are ads: labelled, with links that record the click.
 */
export function ProductRail({
  id,
  title,
  products = [],
  sponsored,
}: {
  id: string;
  title: string;
  products?: Card[];
  sponsored?: SponsoredProduct[];
}) {
  const items = sponsored ?? products.map((product) => ({ product, token: undefined }));
  if (!items.length) return null;
  return (
    <section className="section rail" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <RailArrows target={`${id}-track`} />
      </div>
      {sponsored ? <AboutAds /> : null}
      <ul className="rail__track" id={`${id}-track`} tabIndex={0} aria-label={title}>
        {items.map((item) => (
          <li key={item.product.id} className="rail__item">
            <ProductCard product={item.product} adToken={item.token} />
          </li>
        ))}
      </ul>
    </section>
  );
}
