import sharp from 'sharp';
import { type ImageContentType } from './image-type';

/** Longest side of a stored image. Product photos and banners never need more. */
export const MAX_IMAGE_SIDE = 2400;
/** Refuses decompression bombs: a small file that expands to a huge bitmap. */
const MAX_INPUT_PIXELS = 50_000_000;

export class UnreadableImageError extends Error {
  constructor() {
    super('The file is not a readable image.');
  }
}

/**
 * Decodes an uploaded image and writes a fresh one in the same format: turned upright, at most
 * MAX_IMAGE_SIDE pixels on its longest side, with no metadata (EXIF location, camera serials,
 * comments, embedded thumbnails) and nothing else carried over. Anything hidden in the original
 * file (a script appended after the image data, a polyglot file) is gone, because only the
 * pixels are re-encoded. A file that does not decode is refused.
 */
export async function sanitizeImage(input: Buffer, contentType: ImageContentType): Promise<Buffer> {
  try {
    const image = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' })
      .rotate()
      .resize({
        width: MAX_IMAGE_SIDE,
        height: MAX_IMAGE_SIDE,
        fit: 'inside',
        withoutEnlargement: true,
      });
    switch (contentType) {
      case 'image/jpeg':
        return await image.jpeg({ quality: 85, mozjpeg: true }).toBuffer();
      case 'image/png':
        return await image.png({ compressionLevel: 9 }).toBuffer();
      case 'image/webp':
        return await image.webp({ quality: 85 }).toBuffer();
      case 'image/avif':
        return await image.avif({ quality: 60 }).toBuffer();
    }
  } catch {
    throw new UnreadableImageError();
  }
}
