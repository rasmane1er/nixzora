/**
 * What a scanned code means. QR codes on NIXZORA shelf labels and marketing carry a product link
 * (https://<store>/p/<slug> or nixzora://p/<slug>) and open directly; anything else (EAN/UPC
 * barcodes, SKUs) is resolved by the API.
 */
export type ScanTarget = { kind: 'product'; slug: string } | { kind: 'code'; code: string };

const PRODUCT_LINK =
  /^(?:https?:\/\/[^/]+|nixzora(?:-[a-z]+)?:\/\/)\/?p\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/i;

export function scanTarget(raw: string): ScanTarget | null {
  const data = raw.trim();
  if (!data) return null;
  const link = PRODUCT_LINK.exec(data);
  if (link?.[1]) return { kind: 'product', slug: link[1].toLowerCase() };
  if (/^\d{8,14}$/.test(data)) return { kind: 'code', code: data };
  // SKUs: letters, digits and hyphens. Anything else (random QR codes, URLs) is ignored.
  if (/^[A-Za-z0-9][A-Za-z0-9-]{2,63}$/.test(data))
    return { kind: 'code', code: data.toUpperCase() };
  return null;
}
