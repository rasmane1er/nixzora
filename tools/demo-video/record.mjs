// Records the NIXZORA demo video (docs/case-study.md) from a running local stack:
//   storefront http://localhost:3000, Ops Center http://localhost:3001, API with PAYMENTS_PROVIDER=fake.
//
//   STAFF_EMAIL=… STAFF_PASSWORD=… STAFF_TOTP_SECRET=… node tools/demo-video/record.mjs
//   → tools/demo-video/out/nixzora-demo.mp4 (needs ffmpeg)
//
// The staff account must have two-step verification on (its TOTP secret is needed to sign in).
// Without STAFF_* the Ops Center part is skipped.
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const require = createRequire(join(process.cwd(), 'apps/storefront/package.json'));
const { chromium } = require('@playwright/test');
const { totp } = createRequire(join(process.cwd(), 'apps/api/package.json'))(
  join(process.cwd(), 'apps/api/dist/modules/identity/services/totp.js'),
);

const WEB = process.env.WEB_URL ?? 'http://localhost:3000';
const OPS = process.env.OPS_URL ?? 'http://localhost:3001';
const OUT = 'tools/demo-video/out';
const SIZE = { width: 1280, height: 720 };
rmSync(OUT, { recursive: true, force: true });
mkdirSync(`${OUT}/raw`, { recursive: true });

/** A caption bar at the bottom of every page, set per scene. */
const CAPTION = () => {
  const show = (text) => {
    let bar = document.getElementById('demo-caption');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'demo-caption';
      bar.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;' +
        'max-width:80%;padding:12px 22px;border-radius:12px;background:rgba(15,23,42,.88);' +
        'color:#fff;font:600 20px/1.35 system-ui,sans-serif;text-align:center;' +
        'box-shadow:0 8px 30px rgba(0,0,0,.25);pointer-events:none';
      document.documentElement.appendChild(bar);
    }
    bar.textContent = text;
    bar.style.display = text ? 'block' : 'none';
  };
  window.__caption = show;
  const saved = sessionStorage.getItem('demo-caption');
  if (saved) document.addEventListener('DOMContentLoaded', () => show(saved));
};

async function scene(page, text, ms = 2500) {
  await page.evaluate((t) => {
    sessionStorage.setItem('demo-caption', t);
    window.__caption?.(t);
  }, text);
  await page.waitForTimeout(ms);
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);

// ── Part 1: shopping ────────────────────────────────────────────────────────────────────────
const shop = await browser.newContext({
  viewport: SIZE,
  recordVideo: { dir: `${OUT}/raw`, size: SIZE },
  locale: 'en-US',
});
await shop.addInitScript(CAPTION);
const page = await shop.newPage();
page.setDefaultTimeout(20_000);

await page.goto(WEB);
await scene(page, 'NIXZORA: an AI-native marketplace for computers and electronics', 3500);
await page.mouse.wheel(0, 650);
await scene(page, 'Departments, deals and picks, on the web and in the iOS and Android app', 3000);
await page.mouse.wheel(0, -650);

await scene(page, 'Shoppers describe what they need, in their own words', 1500);
const ask = page.getByRole('searchbox', { name: 'Describe what you need' });
await ask.click();
await ask.pressSequentially('A quiet laptop for coding under $1,500', { delay: 45 });
await page.getByRole('button', { name: 'Find it' }).click();
await page.locator('.answer').first().waitFor();
await scene(page, 'The assistant understands the need and compares real products from the catalog', 4000);
await page.locator('.answer .pick').first().scrollIntoViewIfNeeded();
await scene(page, 'Every pick is grounded: live product, real price, within budget', 3500);

const follow = page.getByRole('textbox', { name: 'Message the assistant' });
await follow.click();
await follow.pressSequentially('actually under $950', { delay: 50 });
await page.getByRole('button', { name: 'Send' }).click();
const refined = page.locator('.answer').nth(1);
await refined.waitFor();
await refined.scrollIntoViewIfNeeded();
await scene(page, 'Follow-ups refine the same conversation', 3000);
await refined.getByRole('button', { name: /^Add .* to cart$/ }).first().click();
await scene(page, 'One tap adds a pick to the normal cart', 2500);

await page.goto(`${WEB}/cart`);
await scene(page, 'Prices, tax and shipping are always computed on the server', 3000);
await page.getByRole('link', { name: 'Check out' }).click();
await scene(page, 'Guest checkout, or sign in with a passkey, Google or Apple', 2000);
const typeInto = async (label, text, exact = false) => {
  const field = page.getByLabel(label, { exact });
  await field.click();
  await field.pressSequentially(text, { delay: 25 });
};
await typeInto('Email for your receipt', `demo-${Date.now()}@example.com`);
await typeInto('Full name', 'Ada Lovelace');
await typeInto('Address', '100 Main St', true);
await typeInto('City', 'Brandywine');
await page.getByLabel('State').selectOption('MD');
await typeInto('ZIP code', '20613');
await page.getByRole('button', { name: 'Continue to payment' }).click();
await page.getByRole('heading', { name: 'Payment' }).waitFor();
await scene(page, 'Live payments use Stripe (this demo: built-in test mode); card data never reaches our servers', 3500);
await page.getByRole('button', { name: /^Pay .* \(test\)$/ }).click();
await page
  .getByRole('heading', { level: 1, name: 'Thank you! Your order is confirmed.' })
  .waitFor({ timeout: 20_000 });
await scene(page, 'Paid by a signed webhook, stock committed, receipt emailed: all in one transaction', 4000);

await page.goto(`${WEB}/account/register`);
await scene(page, 'Sign-up with live password checks, consent recorded, in English, French and Spanish', 3500);
await page.goto(`${WEB}/sell`);
await scene(page, 'Independent stores sell on NIXZORA: six-step onboarding, payouts through Stripe Connect', 3500);
await scene(page, '', 300);
const parts = [];
const shopVideo = page.video();
await shop.close();
parts.push(await shopVideo.path());

// ── Part 2: operations ──────────────────────────────────────────────────────────────────────
const { STAFF_EMAIL, STAFF_PASSWORD, STAFF_TOTP_SECRET } = process.env;
if (STAFF_EMAIL && STAFF_PASSWORD && STAFF_TOTP_SECRET) {
  // Sign in off camera (two-step verification), then film with the session.
  const login = await browser.newContext({ viewport: SIZE });
  const lp = await login.newPage();
  await lp.goto(`${OPS}/login`);
  await lp.getByLabel(/email/i).fill(STAFF_EMAIL);
  await lp.getByLabel(/password/i).fill(STAFF_PASSWORD);
  await lp.getByRole('button', { name: /sign in/i }).click();
  await lp.waitForURL(/verify/);
  await lp.getByLabel(/code/i).first().fill(totp(STAFF_TOTP_SECRET));
  await lp.getByRole('button', { name: /verify|continue|sign in/i }).first().click();
  await lp.waitForURL((url) => !url.pathname.startsWith('/login'));
  const cookies = await login.cookies();
  await login.close();

  const ops = await browser.newContext({
    viewport: SIZE,
    recordVideo: { dir: `${OUT}/raw`, size: SIZE },
  });
  await ops.addCookies(cookies);
  await ops.addInitScript(CAPTION);
  const op = await ops.newPage();
  await op.goto(OPS);
  await scene(op, 'The Ops Center: staff tools behind roles and required two-step verification', 3500);
  await op.goto(`${OPS}/orders`);
  await scene(op, 'Orders, returns, refunds and shipping labels', 3000);
  await op.goto(`${OPS}/risk`);
  await scene(op, 'Fraud signals hold risky orders and payouts; each reason is shown in words', 4500);
  await op.goto(`${OPS}/audit`);
  await scene(op, 'Every privileged action lands in an append-only audit log', 3500);
  await scene(op, '', 300);
  const opsVideo = op.video();
  await ops.close();
  parts.push(await opsVideo.path());
}
await browser.close();

// ── Join the parts, end card, MP4 ───────────────────────────────────────────────────────────
// In the order they were filmed: shopping, then operations.
const inputs = parts.flatMap((part) => ['-i', part]);
const card =
  "drawtext=text='NIXZORA':fontcolor=white:fontsize=72:x=(w-text_w)/2:y=(h-text_h)/2-40," +
  "drawtext=text='github.com/rasmane1er/nixzora':fontcolor=0xE8622C:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+50";
execFileSync('ffmpeg', [
  '-y',
  ...inputs,
  '-f', 'lavfi', '-t', '4', '-i', `color=c=0x0F172A:s=${SIZE.width}x${SIZE.height}:r=25`,
  '-filter_complex',
  `${parts.map((_, i) => `[${i}:v]fps=25,setsar=1[v${i}]`).join(';')};[${parts.length}:v]${card},setsar=1[end];` +
    `${parts.map((_, i) => `[v${i}]`).join('')}[end]concat=n=${parts.length + 1}:v=1:a=0[out]`,
  '-map', '[out]',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '26', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
  join(OUT, 'nixzora-demo.mp4'),
], { stdio: 'inherit' });
console.log(`wrote ${join(OUT, 'nixzora-demo.mp4')}`);
