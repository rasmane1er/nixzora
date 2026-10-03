// Renders the hero backdrop and product cut-outs (transparent PNGs) for compose-hero.py.
// Run from the repo root: python3 tools/demo-images/hero.py && node tools/demo-images/render-hero.mjs
//   && python3 tools/demo-images/compose-hero.py
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'apps/storefront/package.json'));
const { chromium } = require('@playwright/test');

const dir = 'tools/demo-images';
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const backdrop = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await backdrop.setContent(
  `<body style="margin:0">${await readFile(join(dir, 'svg/_hero-desk.svg'), 'utf8')}</body>`,
);
await backdrop.screenshot({ path: join(dir, 'sprites/_backdrop.png') });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
for (const file of (await readdir(join(dir, 'sprites'))).filter((f) => f.endsWith('.svg'))) {
  const svg = await readFile(join(dir, 'sprites', file), 'utf8');
  await page.setContent(`<body style="margin:0;background:transparent">${svg}</body>`);
  await page.screenshot({
    path: join(dir, 'sprites', file.replace('.svg', '.png')),
    omitBackground: true,
  });
}
await browser.close();
console.log('rendered backdrop and sprites');
