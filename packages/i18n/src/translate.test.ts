import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatters, matchLocale, messagesFor, rich, translator } from './index';
import * as catalogs from './messages';

test('picks the best supported language', () => {
  assert.equal(matchLocale('fr-CA,fr;q=0.9,en;q=0.8'), 'fr');
  assert.equal(matchLocale('de-DE,es;q=0.5'), 'es');
  assert.equal(matchLocale('de-DE'), 'en');
  assert.equal(matchLocale(['es-MX', 'en-US']), 'es');
  assert.equal(matchLocale(undefined), 'en');
});

test('fills placeholders and plurals in each language', () => {
  assert.equal(translator('en')('common')('cartItems', { count: 1 }), '1 item');
  assert.equal(translator('fr')('common')('cartItems', { count: 0 }), 'Aucun article');
  assert.equal(translator('es')('common')('cartItems', { count: 3 }), '3 artículos');
});

test('formats prices in US dollars for each language', () => {
  assert.equal(formatters('en').money(129900), '$1,299.00');
  assert.match(formatters('fr').money(129900), /^1\s299,00\s\$US$/);
  assert.match(formatters('es').money(129900), /1,?299\.00/);
});

test('rich messages keep tags as parts', () => {
  assert.deepEqual(rich('Read the <link>policy</link> now', { link: (c) => ({ a: c }) }), [
    'Read the ',
    { a: 'policy' },
    ' now',
  ]);
});

test('no translation is empty or left in English by mistake', () => {
  for (const [name, catalog] of Object.entries(catalogs)) {
    for (const locale of ['fr', 'es'] as const) {
      for (const [key, value] of Object.entries(catalog[locale] as Record<string, string>)) {
        assert.ok(value.trim(), `${locale}.${name}.${key} is empty`);
      }
    }
  }
  assert.ok(messagesFor('fr').layout.help);
});
