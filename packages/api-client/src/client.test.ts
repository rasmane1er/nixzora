import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient, queryString } from './client';
import { ApiError, errorMessage } from './errors';

type Call = { url: string; init: RequestInit };

function fakeFetch(responses: (Response | Error)[]) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new Error('no more responses');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const header = (call: Call, name: string) => (call.init.headers as Record<string, string>)[name];

test('query strings skip empty values', () => {
  assert.equal(
    queryString({ q: 'usb c', page: 2, brand: undefined, inStock: '' }),
    '?q=usb+c&page=2',
  );
  assert.equal(queryString({}), '');
});

test('refreshes an expired access token once and retries', async () => {
  let token = 'old';
  let refreshes = 0;
  const { calls, impl } = fakeFetch([
    json({ message: 'Expired' }, 401),
    json({ message: 'Expired' }, 401),
    json([{ id: 'o1' }]),
    json([{ id: 'o2' }]),
  ]);
  const api = createApiClient({
    baseUrl: 'http://api.test/',
    fetch: impl,
    session: {
      accessToken: () => token,
      refresh: async () => {
        refreshes += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        token = 'new';
        return token;
      },
    },
  });
  const [a, b] = await Promise.all([api.orders.mine(), api.orders.mine()]);
  assert.deepEqual(
    [a, b]
      .flat()
      .map((o) => o.id)
      .sort(),
    ['o1', 'o2'],
  );
  assert.equal(refreshes, 1, 'parallel 401s share one refresh');
  assert.equal(calls[0]!.url, 'http://api.test/api/v1/me/orders');
  assert.equal(header(calls[2]!, 'Authorization'), 'Bearer new');
});

test('guests send and remember their cart id', async () => {
  let cartId: string | null = null;
  const { calls, impl } = fakeFetch([
    json({ cartId: 'c'.repeat(43), lines: [] }),
    json({ cartId: 'c'.repeat(43) }),
  ]);
  const api = createApiClient({
    baseUrl: 'http://api.test',
    fetch: impl,
    session: {
      accessToken: () => null,
      refresh: async () => null,
      cartId: () => cartId,
      onCartId: (id) => {
        cartId = id;
      },
    },
  });
  await api.cart.add('v1');
  assert.equal(header(calls[0]!, 'X-Cart-Id'), undefined);
  await api.cart.get();
  assert.equal(header(calls[1]!, 'X-Cart-Id'), 'c'.repeat(43));
  assert.equal(calls[1]!.url, 'http://api.test/api/v1/cart');
});

test('public catalog calls never send the token', async () => {
  const { calls, impl } = fakeFetch([json({ slug: 'kestrel-14-pro', variantId: null })]);
  const api = createApiClient({
    baseUrl: 'http://api.test',
    fetch: impl,
    session: { accessToken: () => 'secret', refresh: async () => null },
  });
  await api.catalog.lookup('0036000291452');
  assert.equal(header(calls[0]!, 'Authorization'), undefined);
  assert.equal(calls[0]!.url, 'http://api.test/api/v1/catalog/lookup?code=0036000291452');
});

test('turns problem details and network failures into ApiErrors', async () => {
  const { impl } = fakeFetch([
    json(
      { message: 'Check the form.', issues: [{ field: 'email', message: 'Enter an email.' }] },
      400,
    ),
    new TypeError('Network request failed'),
  ]);
  const api = createApiClient({ baseUrl: 'http://api.test', fetch: impl });
  const invalid = await api.auth.forgotPassword('x').catch((error: unknown) => error);
  assert.ok(invalid instanceof ApiError);
  assert.equal(invalid.status, 400);
  assert.equal(invalid.field('email'), 'Enter an email.');
  assert.equal(errorMessage(invalid), 'Check the form. Enter an email.');
  const offline = await api.catalog.categories().catch((error: unknown) => error);
  assert.ok(offline instanceof ApiError && offline.offline);
  assert.match(errorMessage(offline), /Can't reach NIXZORA/);
});
