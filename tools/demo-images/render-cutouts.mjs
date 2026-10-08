// Renders tools/demo-images/cutouts/*.svg to transparent PNGs for compose-store-hero.py.
// Run from the repo root. Uses the storefront's Playwright Chromium.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'apps/storefront/package.json'));
const { chromium } = require('@playwright/test');

const dir = 'tools/demo-images/cutouts';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: 1200, height: 900 },
  deviceScaleFactor: 1.5,
});
for (const file of (await readdir(dir)).filter((f) => f.endsWith('.svg'))) {
  const svg = await readFile(join(dir, file), 'utf8');
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await page.screenshot({ path: join(dir, file.replace('.svg', '.png')), omitBackground: true });
}
await browser.close();
console.log('rendered cut-outs in', dir);
