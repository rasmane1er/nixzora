import sharp from 'sharp';

/** Length of a signature: a 4×4 RGB layout (48) and a 16-bin colour histogram. */
export const VISUAL_DIMENSIONS = 64;
const HUE_BINS = 15;
/** Share of the signature's weight on layout; the rest is on colour (squares sum to 1). */
const LAYOUT_WEIGHT = 0.55;
const COLOUR_WEIGHT = Math.sqrt(1 - LAYOUT_WEIGHT ** 2);

/**
 * A small, free image signature for search by photo (ADR-0036). Not a learned embedding: it
 * captures what a product photo's colours are and roughly where they sit, which is enough to
 * bring the right product and its look-alikes to the top in a catalog of thousands. Cosine
 * distance between two signatures compares them.
 *
 * Steps: orient by EXIF, flatten transparency onto white, crop a plain border (so a product
 * shot close-up and one with margins compare alike), then
 * - layout: the image shrunk to 4×4 RGB, centred on its own mean (so lighting matters less)
 *   and scaled to unit length;
 * - colour: 15 hue bins weighted by how colourful each pixel is (split between neighbouring
 *   bins so a hue on a boundary does not jump), plus one bin for greys, whites and blacks.
 */
export async function visualSignature(input: Buffer): Promise<number[]> {
  const base = await sharp(input, { limitInputPixels: 50_000_000 })
    .rotate()
    .flatten({ background: '#ffffff' })
    .resize(256, 256, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();
  let framed = base;
  try {
    framed = await sharp(base).trim({ threshold: 18 }).png().toBuffer();
  } catch {
    // A plain image has nothing to trim.
  }

  const grid = await sharp(framed)
    .resize(4, 4, { fit: 'fill', kernel: 'cubic' })
    .removeAlpha()
    .raw()
    .toBuffer();
  const mean = grid.reduce((sum, value) => sum + value, 0) / grid.length;
  const layout = unit(Array.from(grid, (value) => (value - mean) / 255));

  const { data, info } = await sharp(framed)
    .resize(48, 48, { fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const colour = new Array<number>(HUE_BINS + 1).fill(0);
  for (let i = 0; i < data.length; i += info.channels) {
    const [h, s, v] = hsv(data[i]! / 255, data[i + 1]! / 255, data[i + 2]! / 255);
    const vivid = s * v;
    if (vivid > 0.12) {
      const position = (h * HUE_BINS) % HUE_BINS;
      const low = Math.floor(position);
      const share = position - low;
      colour[low] = colour[low]! + vivid * (1 - share);
      colour[(low + 1) % HUE_BINS] = colour[(low + 1) % HUE_BINS]! + vivid * share;
    }
    colour[HUE_BINS] = colour[HUE_BINS]! + (1 - vivid) * 0.5;
  }

  return [
    ...layout.map((value) => round(value * LAYOUT_WEIGHT)),
    ...unit(colour).map((value) => round(value * COLOUR_WEIGHT)),
  ];
}

/** pgvector's text form, e.g. "[0.1,0.2]". */
export function vectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}

function unit(values: number[]): number[] {
  const length = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
  return length < 1e-6 ? values.map(() => 0) : values.map((value) => value / length);
}

function round(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/** Hue (0–1), saturation and value of an RGB colour in 0–1. */
function hsv(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta + 6) % 6;
    else if (max === g) h = (b - r) / delta + 2;
    else h = (r - g) / delta + 4;
  }
  return [h / 6, max === 0 ? 0 : delta / max, max];
}
