import { type ProductCard as Card } from '@nixzora/validation';
import { ProductCard } from './ProductCard';
import { RailArrows } from './RailArrows';

/** A titled row of product cards that scrolls sideways (touch, trackpad or the arrow buttons). */
export function ProductRail({
  id,
  title,
  products,
}: {
  id: string;
  title: string;
  products: Card[];
}) {
  if (!products.length) return null;
  return (
    <section className="section rail" aria-labelledby={`${id}-title`}>
      <div className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <RailArrows target={`${id}-track`} />
      </div>
      <ul className="rail__track" id={`${id}-track`} tabIndex={0} aria-label={title}>
        {products.map((product) => (
          <li key={product.id} className="rail__item">
            <ProductCard product={product} />
          </li>
        ))}
      </ul>
    </section>
  );
}
