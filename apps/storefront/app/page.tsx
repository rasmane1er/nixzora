import Link from 'next/link';
import { type Recommendations } from '@nixzora/validation';
import { ProductCard } from '@/components/ProductCard';
import { ProductRail } from '@/components/ProductRail';
import { api, catalog } from '@/lib/api';
import { visitorId } from '@/lib/visitor';
import { countProducts } from '@/lib/categories';

const PROMPTS = [
  'Quiet laptop for coding under $1,500',
  '4K monitor for photo editing',
  'Headphones for long flights under $250',
  'Gaming controller',
];

export default async function HomePage() {
  const visitor = await visitorId();
  const [categories, newest, picks] = await Promise.all([
    catalog.categories().catch(() => []),
    catalog.products('?sort=newest&pageSize=8&inStock=true').catch(() => null),
    api<Recommendations>(
      `/recommendations${visitor ? `?visitorId=${encodeURIComponent(visitor)}` : ''}`,
    ).catch(() => null),
  ]);

  return (
    <div className="wrap">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero__dot" />
        <p className="eyebrow">AI-native commerce</p>
        <h1 id="hero-title">Tell us what you need. We’ll build the cart.</h1>
        <p>
          Computers and electronics with clear specs, honest comparisons and fast delivery. Describe
          what you’re after in your own words.
        </p>
        <form action="/assistant" className="hero__ask" role="search">
          <input
            name="q"
            type="search"
            placeholder="e.g. a light laptop with 32 GB of RAM"
            aria-label="Describe what you need"
          />
          <button className="btn btn--primary" type="submit">
            Find it
          </button>
        </form>
        <div className="hero__chips" aria-label="Try one of these">
          {PROMPTS.map((prompt) => (
            <Link key={prompt} href={`/assistant?q=${encodeURIComponent(prompt)}`}>
              {prompt}
            </Link>
          ))}
        </div>
      </section>

      {categories.length ? (
        <section className="section" aria-labelledby="shop-by">
          <div className="section-head">
            <h2 id="shop-by">Shop by department</h2>
          </div>
          <div className="tiles">
            {categories.map((category) => (
              <Link key={category.id} href={`/c/${category.slug}`} className="tile">
                <strong>{category.name}</strong>
                <span className="muted">
                  {countProducts(category)} {countProducts(category) === 1 ? 'product' : 'products'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {picks ? (
        <>
          <ProductRail
            id="for-you"
            title={picks.basis === 'history' ? 'Recommended for you' : 'Popular right now'}
            products={picks.products}
          />
          <ProductRail id="recent" title="Recently viewed" products={picks.recentlyViewed} />
        </>
      ) : null}

      {newest?.items.length ? (
        <section className="section" aria-labelledby="new">
          <div className="section-head">
            <h2 id="new">New and in stock</h2>
            <Link href="/search?sort=newest">See all →</Link>
          </div>
          <div className="grid">
            {newest.items.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section promises" aria-label="Why NIXZORA">
        <div className="promise">
          <h3>Specs you can compare</h3>
          <p className="muted">Every product lists the numbers that matter, in the same format.</p>
        </div>
        <div className="promise">
          <h3>Free shipping over $99</h3>
          <p className="muted">Flat $9.99 below that. Tracking on every order.</p>
        </div>
        <div className="promise">
          <h3>Secure checkout</h3>
          <p className="muted">Card details go straight to our payment provider, never to us.</p>
        </div>
      </section>
    </div>
  );
}
