import assert from 'node:assert/strict';
import { test } from 'node:test';
import { plurals } from './intl';

/** Runs `fn` as if the engine had no Intl.PluralRules, like Hermes on Android. */
function withoutPluralRules<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!;
  Reflect.deleteProperty(Intl, 'PluralRules');
  try {
    return fn();
  } finally {
    Object.defineProperty(Intl, 'PluralRules', descriptor);
  }
}

test('plural rules work on engines without Intl.PluralRules (Hermes on Android)', () => {
  // Tags no other test uses, so the cache cannot hand back a native instance.
  const [en, fr, es] = withoutPluralRules(() => ['en-GB', 'fr-CH', 'es-MX'].map(plurals));
  assert.deepEqual(
    [0, 1, 2].map((n) => en!.select(n)),
    ['other', 'one', 'other'],
  );
  assert.deepEqual(
    [0, 1, 1.5, 2].map((n) => fr!.select(n)),
    ['one', 'one', 'one', 'other'],
  );
  assert.deepEqual(
    [0, 1, 2].map((n) => es!.select(n)),
    ['other', 'one', 'other'],
  );
});

test('the fallback agrees with Intl.PluralRules for whole numbers', () => {
  const tags = ['en-AU', 'fr-BE', 'es-AR'];
  const fallback = withoutPluralRules(() => tags.map(plurals));
  tags.forEach((tag, i) => {
    const native = new Intl.PluralRules(tag);
    for (const n of [0, 1, 2, 5, 21, 100]) {
      assert.equal(fallback[i]!.select(n), native.select(n), `${tag} ${n}`);
    }
  });
});
