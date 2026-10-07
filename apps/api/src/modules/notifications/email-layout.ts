/**
 * The HTML version of NIXZORA emails. Plain text is always sent too (MailMessage.text); this adds
 * a branded, mobile-friendly version that mail clients prefer to show.
 *
 * Email HTML has its own rules: tables for layout, inline styles only, no web fonts, no images
 * that need hosting (the wordmark is text), and a 600px column that shrinks on phones. Every
 * value from the caller is escaped here, so callers pass plain strings.
 */

const INK = '#0E1726';
const MUTED = '#5B6474';
const LINE = '#E6E8EC';
const PAGE = '#F4F5F7';
/** Brand orange dark enough for white text (contrast 5:1). */
const ACCENT = '#B8461A';
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export type EmailRow = { label: string; value: string; strong?: boolean };

export type EmailBlock =
  /** Paragraphs; single line breaks inside a paragraph are kept. */
  | { kind: 'text'; paragraphs: string[] }
  /** Order lines: name and detail on the left, amount on the right. */
  | { kind: 'items'; title: string; items: { name: string; detail: string; amount: string }[] }
  /** Label / value rows, e.g. subtotal, tax, total. */
  | { kind: 'rows'; rows: EmailRow[] }
  /** A titled box of lines, e.g. the shipping address. */
  | { kind: 'box'; title: string; lines: string[] }
  /** Parcels with a tracking link each. */
  | { kind: 'links'; links: { label: string; url: string | null; linkText: string }[] };

export type EmailContent = {
  /** <html lang>. */
  lang: string;
  /** Hidden preview line shown after the subject in the inbox. */
  preheader: string;
  heading: string;
  blocks: EmailBlock[];
  button?: { label: string; url: string };
  /** Small print under the card. */
  footer: string[];
};

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Only http(s) links are ever put in an href. */
function safeUrl(url: string): string | null {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : null;
}

/** Escapes text, keeps line breaks, and turns http(s) URLs into links. */
function richText(value: string): string {
  return value
    .split(/(https?:\/\/[^\s<>"']+)/g)
    .map((part, i) => {
      if (i % 2 === 1) {
        const href = safeUrl(part);
        if (href)
          return `<a href="${href}" style="color:${ACCENT};word-break:break-all">${href}</a>`;
      }
      return escapeHtml(part).replace(/\n/g, '<br>');
    })
    .join('');
}

const td = (style: string, html: string, attrs = '') =>
  `<td${attrs} style="font-family:${FONT};${style}">${html}</td>`;

function renderBlock(block: EmailBlock): string {
  switch (block.kind) {
    case 'text':
      return block.paragraphs
        .map(
          (p) =>
            `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${INK}">${richText(p)}</p>`,
        )
        .join('');
    case 'items':
      return (
        `<p style="margin:8px 0 8px;font-family:${FONT};font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED}">${escapeHtml(block.title)}</p>` +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 8px">` +
        block.items
          .map(
            (item) =>
              `<tr>` +
              td(
                `padding:12px 0;border-top:1px solid ${LINE};font-size:15px;line-height:22px;color:${INK}`,
                `<strong>${escapeHtml(item.name)}</strong><br><span style="color:${MUTED};font-size:14px">${escapeHtml(item.detail)}</span>`,
              ) +
              td(
                `padding:12px 0 12px 16px;border-top:1px solid ${LINE};font-size:15px;color:${INK};white-space:nowrap;vertical-align:top`,
                escapeHtml(item.amount),
                ' align="right"',
              ) +
              `</tr>`,
          )
          .join('') +
        `</table>`
      );
    case 'rows':
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 16px;border-top:1px solid ${LINE}">` +
        block.rows
          .map((row) => {
            const weight = row.strong ? 'font-weight:700;font-size:17px' : 'font-size:15px';
            return (
              `<tr>` +
              td(
                `padding:6px 0;${weight};color:${row.strong ? INK : MUTED}`,
                escapeHtml(row.label),
              ) +
              td(`padding:6px 0;${weight};color:${INK}`, escapeHtml(row.value), ' align="right"') +
              `</tr>`
            );
          })
          .join('') +
        `</table>`
      );
    case 'box':
      return (
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;background:${PAGE};border-radius:8px"><tr>` +
        td(
          `padding:14px 16px;font-size:15px;line-height:22px;color:${INK}`,
          `<span style="font-size:13px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:${MUTED}">${escapeHtml(block.title)}</span><br>` +
            block.lines.map(escapeHtml).join('<br>'),
        ) +
        `</tr></table>`
      );
    case 'links':
      return block.links
        .map((link) => {
          const href = link.url ? safeUrl(link.url) : null;
          const action = href
            ? `<br><a href="${href}" style="color:${ACCENT};font-weight:600">${escapeHtml(link.linkText)}</a>`
            : '';
          return `<p style="margin:0 0 12px;font-family:${FONT};font-size:15px;line-height:22px;color:${INK}">${escapeHtml(link.label)}${action}</p>`;
        })
        .join('');
  }
}

export function renderEmail(content: EmailContent): string {
  const button = content.button && safeUrl(content.button.url);
  return `<!doctype html>
<html lang="${escapeHtml(content.lang)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:${PAGE}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(content.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAGE}">
<tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr>${td(`padding:0 4px 16px;font-size:22px;font-weight:800;letter-spacing:.12em;color:${INK}`, `NIXZORA<span style="color:${ACCENT}">.</span>`)}</tr>
<tr><td style="background:#FFFFFF;border-radius:12px;border-top:4px solid ${ACCENT};padding:28px 24px">
<h1 style="margin:0 0 20px;font-family:${FONT};font-size:22px;line-height:30px;color:${INK}">${escapeHtml(content.heading)}</h1>
${content.blocks.map(renderBlock).join('\n')}
${
  button && content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 4px"><tr><td style="border-radius:8px;background:${ACCENT}"><a href="${button}" style="display:inline-block;padding:13px 24px;font-family:${FONT};font-size:16px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:8px">${escapeHtml(content.button.label)}</a></td></tr></table>`
    : ''
}
</td></tr>
<tr><td style="padding:20px 8px 0">
${content.footer.map((line) => `<p style="margin:0 0 6px;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED}">${richText(line)}</p>`).join('')}
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
