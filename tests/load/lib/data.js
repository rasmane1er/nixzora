import http from 'k6/http';
import { API_URL } from './config.js';

/** What the journeys pick from: real products, categories and queries from the catalog. */
export function loadCatalog() {
  const list = http.get(`${API_URL}/catalog/products?pageSize=48`, { tags: { kind: 'setup' } });
  if (list.status !== 200) throw new Error(`Catalog unavailable (${list.status}): is the API up?`);
  const items = list.json('items');
  const categories = http
    .get(`${API_URL}/catalog/categories`, { tags: { kind: 'setup' } })
    .json()
    .map((c) => c.slug);
  return {
    slugs: items.map((p) => p.slug),
    // Single-option, in-stock products can go straight to the cart.
    buyable: items.filter((p) => p.defaultVariantId && p.inStock).map((p) => p.defaultVariantId),
    categories,
    queries: [
      'laptop',
      'monitor 4k',
      'headphones noise cancelling',
      'gaming controller',
      'keyboard',
      'speakers',
      'quiet laptop for coding',
      'usb-c monitor for a macbook',
    ],
    questions: [
      'a quiet laptop for coding under $1,500',
      'headphones for long flights under $250',
      'a 4K monitor for photo editing',
      'a gift for a gamer under $100',
    ],
  };
}

export const pick = (list) => list[Math.floor(Math.random() * list.length)];
