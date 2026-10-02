import { type ProductCard as Card } from '@nixzora/validation';
import { Price } from '@nixzora/ui';
import Link from 'next/link';

export function ProductCard({ product, priority = false }: { product: Card; priority?: boolean }) {
  return (
    <Link href={`/p/${product.slug}`} className="product-card">
      <div className="product-card__img">
        {product.image ? (
          // Product photos come from our media host/CDN; sizes are fixed by the card.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.image.url}
            alt={product.image.alt}
            loading={priority ? 'eager' : 'lazy'}
            width={400}
            height={300}
          />
        ) : (
          <span aria-hidden="true">{product.category.name}</span>
        )}
      </div>
      <div className="product-card__body">
        <span className="product-card__brand">{product.brand?.name ?? ' '}</span>
        <span className="product-card__title">{product.title}</span>
        <Price
          cents={product.priceFromCents}
          compareAtCents={product.compareAtCents}
          currency={product.currency}
          prefix="From"
        />
        <span className={`stock${product.inStock ? '' : ' stock--out'}`}>
          {product.inStock ? 'In stock' : 'Sold out'}
        </span>
      </div>
    </Link>
  );
}
