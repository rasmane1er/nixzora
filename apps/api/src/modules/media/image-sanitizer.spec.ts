import sharp from 'sharp';
import { MAX_IMAGE_SIDE, sanitizeImage, UnreadableImageError } from './image-sanitizer';

const photo = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } } });

describe('sanitizeImage', () => {
  it('drops EXIF metadata, including location', async () => {
    const original = await photo(64, 48)
      .withExif({ IFD0: { Copyright: 'secret', Artist: 'Jane' }, IFD3: { GPSLatitudeRef: 'N' } })
      .jpeg()
      .toBuffer();
    expect((await sharp(original).metadata()).exif).toBeDefined();

    const clean = await sanitizeImage(original, 'image/jpeg');
    const meta = await sharp(clean).metadata();
    expect(meta.exif).toBeUndefined();
    expect(meta.format).toBe('jpeg');
    expect(clean.includes(Buffer.from('secret'))).toBe(false);
  });

  it('turns a photo upright from its EXIF orientation', async () => {
    const sideways = await photo(60, 20).withMetadata({ orientation: 6 }).jpeg().toBuffer();
    const meta = await sharp(await sanitizeImage(sideways, 'image/jpeg')).metadata();
    expect([meta.width, meta.height]).toEqual([20, 60]);
    expect(meta.orientation).toBeUndefined();
  });

  it('removes anything appended after the image data (polyglot files)', async () => {
    const png = await photo(32, 32).png().toBuffer();
    const polyglot = Buffer.concat([png, Buffer.from('<script>alert(1)</script>')]);
    const clean = await sanitizeImage(polyglot, 'image/png');
    expect(clean.includes(Buffer.from('<script>'))).toBe(false);
    expect((await sharp(clean).metadata()).format).toBe('png');
  });

  it('shrinks very large images and keeps the format', async () => {
    const big = await photo(5000, 1000).webp().toBuffer();
    const meta = await sharp(await sanitizeImage(big, 'image/webp')).metadata();
    expect(meta.width).toBe(MAX_IMAGE_SIDE);
    expect(meta.height).toBe(480);
    expect(meta.format).toBe('webp');
  });

  it('refuses files that are not images, even with an image signature', async () => {
    const fake = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.from('not a jpeg')]);
    await expect(sanitizeImage(fake, 'image/jpeg')).rejects.toBeInstanceOf(UnreadableImageError);
  });
});
