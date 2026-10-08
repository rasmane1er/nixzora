// Renders tools/demo-images/svg/*.svg to apps/storefront/public/demo-products/*.webp (1200×900).
// Run from the repo root after generate.py. Uses the storefront's Playwright Chromium, which also
// encodes the WebP (canvas.toDataURL), so no image library is needed.
//
//   node tools/demo-images/render.mjs                 every product
//   node tools/demo-images/render.mjs core-yoga-mat   only these slugs (and their extra views)
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(join(process.cwd(), 'apps/storefront/package.json'));
const { chromium } = require('@playwright/test');

const src = 'tools/demo-images/svg';
const out = 'apps/storefront/public/demo-products';
const only = process.argv.slice(2);
await mkdir(out, { recursive: true });
const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
const files = (await readdir(src))
  .filter((f) => f.endsWith('.svg'))
  .filter(
    (f) =>
      !only.length ||
      only.some((slug) => f === `${slug}.svg` || (f.startsWith(`${slug}-`) && /-\d\.svg$/.test(f))),
  );
for (const file of files) {
  const svg = await readFile(join(src, file), 'utf8');
  const dataUrl = await page.evaluate(async (markup) => {
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 900;
    canvas.getContext('2d').drawImage(img, 0, 0, 1200, 900);
    return canvas.toDataURL('image/webp', 0.86);
  }, svg);
  await writeFile(
    join(out, file.replace('.svg', '.webp')),
    Buffer.from(dataUrl.split(',')[1], 'base64'),
  );
}
await browser.close();
console.log(`rendered ${files.length} WebP images to`, out);
