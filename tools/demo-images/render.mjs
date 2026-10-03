// Renders tools/demo-images/svg/*.svg to apps/storefront/public/demo-products/*.webp (1200×900).
// Run from the repo root after generate.py. Uses the storefront's Playwright Chromium.
import { readdir, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'apps/storefront/package.json'));
const { chromium } = require('@playwright/test');

const src = 'tools/demo-images/svg';
const out = 'apps/storefront/public/demo-products';
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
for (const file of (await readdir(src)).filter((f) => f.endsWith('.svg'))) {
  const svg = await readFile(join(src, file), 'utf8');
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  await page.screenshot({ path: join(out, file.replace('.svg', '.png')) });
}
await browser.close();
console.log('rendered PNGs to', out);
