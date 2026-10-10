import assert from 'node:assert/strict';
import { test } from 'node:test';
import { trafficSource } from './traffic';

const own = 'https://nixzora.com';

test('own pages are sorted by where the shopper was', () => {
  assert.equal(trafficSource(`${own}/search?q=lamp`, own), 'SEARCH');
  assert.equal(trafficSource(`${own}/c/home-kitchen`, own), 'CATEGORY');
  assert.equal(trafficSource(`${own}/s/copperline`, own), 'STORE');
  assert.equal(trafficSource(`${own}/deals`, own), 'DEALS');
  assert.equal(trafficSource(`${own}/following`, own), 'FOLLOWING');
  assert.equal(trafficSource(`${own}/assistant?q=x`, own), 'ASSISTANT');
  assert.equal(trafficSource(`${own}/`, own), 'RECOMMENDED');
  assert.equal(trafficSource(`${own}/p/other-thing`, own), 'RECOMMENDED');
});

test('another site is external, and no referrer is direct', () => {
  assert.equal(trafficSource('https://www.google.com/', own), 'EXTERNAL');
  assert.equal(trafficSource('', own), 'DIRECT');
  assert.equal(trafficSource(null, own), 'DIRECT');
  assert.equal(trafficSource('not a url', own), 'DIRECT');
});
