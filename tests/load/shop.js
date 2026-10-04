// NIXZORA shopper load test (k6). Usage: docs/performance/load-testing.md
//   k6 run tests/load/shop.js                                  # smoke, against localhost
//   PROFILE=load DURATION=10m k6 run tests/load/shop.js
//   WEB_URL=https://staging.nixzora.com API_URL=https://api.staging.nixzora.com PROFILE=load k6 run …
import { check, group, sleep } from 'k6';
import http from 'k6/http';
import { API_URL, CHECKOUT, PROFILE, SCALE, WEB_URL } from './lib/config.js';
import { loadCatalog, pick } from './lib/data.js';
import { report } from './lib/report.js';

export { options } from './lib/config.js';

export function setup() {
  const catalog = loadCatalog();
  if (!catalog.slugs.length) throw new Error('The catalog is empty: seed it first (pnpm db:seed).');
  return catalog;
}

const ok = (res, name) =>
  check(res, { [`${name}: 2xx`]: (r) => r.status >= 200 && r.status < 300 });

/** Home page → a department → a product page (server-rendered, like a real visit). */
export function browse(data) {
  group('browse', () => {
    ok(http.get(`${WEB_URL}/`, { tags: { kind: 'page', name: 'home' } }), 'home');
    ok(
      http.get(`${WEB_URL}/c/${pick(data.categories)}`, {
        tags: { kind: 'page', name: 'category' },
      }),
      'category',
    );
    const slug = pick(data.slugs);
    ok(
      http.get(`${WEB_URL}/p/${slug}`, { tags: { kind: 'page', name: 'product' } }),
      'product page',
    );
    ok(
      http.get(`${API_URL}/catalog/products/${slug}/related`, {
        tags: { kind: 'api', name: 'related' },
      }),
      'related',
    );
  });
}

/** Search the way the search box does (hybrid keyword + semantic), then filter and sort. */
export function search(data) {
  group('search', () => {
    const q = encodeURIComponent(pick(data.queries));
    ok(
      http.get(`${API_URL}/catalog/products?q=${q}`, { tags: { kind: 'api', name: 'search' } }),
      'search',
    );
    ok(
      http.get(
        `${API_URL}/catalog/products?category=${pick(data.categories)}&sort=price_asc&inStock=true`,
        {
          tags: { kind: 'api', name: 'filter' },
        },
      ),
      'filter',
    );
  });
}

/** One question to the shopping assistant. */
export function assistant(data) {
  group('assistant', () => {
    const res = http.post(
      `${API_URL}/assistant/chat`,
      JSON.stringify({ messages: [{ role: 'user', content: pick(data.questions) }] }),
      {
        headers: { 'content-type': 'application/json' },
        tags: { kind: 'assistant', name: 'chat' },
      },
    );
    ok(res, 'assistant');
    check(res, { 'assistant: suggests products': (r) => (r.json('picks') || []).length > 0 });
  });
}

const ADDRESS = {
  fullName: 'Load Test',
  line1: '100 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

/** Guest checkout with the test payment provider: cart → order → payment → paid. */
export function checkout(data) {
  if (!CHECKOUT || !data.buyable.length) return;
  group('checkout', () => {
    const json = { headers: { 'content-type': 'application/json' } };
    const added = http.post(
      `${API_URL}/cart/items`,
      JSON.stringify({ variantId: pick(data.buyable), quantity: 1 }),
      { ...json, tags: { kind: 'checkout', name: 'add to cart' } },
    );
    if (!ok(added, 'add to cart')) return;
    const cartId = added.json('cartId');
    const order = http.post(
      `${API_URL}/checkout`,
      JSON.stringify({
        cartId,
        email: `load-${__VU}-${__ITER}@example.com`,
        shippingAddress: ADDRESS,
      }),
      { ...json, tags: { kind: 'checkout', name: 'place order' } },
    );
    if (!ok(order, 'place order')) return;
    sleep(1); // the shopper types their card
    const paid = http.post(
      `${API_URL}/payments/fake/confirm`,
      JSON.stringify({ clientSecret: order.json('payment.clientSecret'), outcome: 'succeeded' }),
      { ...json, tags: { kind: 'checkout', name: 'pay' } },
    );
    ok(paid, 'pay');
  });
}

export function handleSummary(summary) {
  return report(summary, {
    profile: PROFILE,
    scale: SCALE,
    web: WEB_URL,
    api: API_URL,
    checkout: CHECKOUT,
  });
}
