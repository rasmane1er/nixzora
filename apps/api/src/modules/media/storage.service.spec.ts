import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { StorageService } from './storage.service';

function storage(driver: 'local' | 's3'): StorageService {
  const values: Record<string, string> = {
    STORAGE_DRIVER: driver,
    STORAGE_LOCAL_DIR: './storage',
    API_PUBLIC_URL: 'https://api.example.com/',
    WEB_APP_URL: 'https://shop.example.com/',
    MEDIA_SIGNING_SECRET: 'x'.repeat(40),
    S3_REGION: 'us-east-1',
    S3_BUCKET: 'media',
    ASSETS_BASE_URL: 'https://media.example.com',
  };
  return new StorageService({ get: (key: string) => values[key] } as unknown as ConfigService<
    Env,
    true
  >);
}

describe('StorageService.publicUrl', () => {
  it('serves uploaded images from the CDN (s3) or the API (local)', () => {
    expect(storage('s3').publicUrl('products/2026/10/a.webp')).toBe(
      'https://media.example.com/products/2026/10/a.webp',
    );
    expect(storage('local').publicUrl('products/2026/10/a.webp')).toBe(
      'https://api.example.com/api/v1/media/products/2026/10/a.webp',
    );
  });

  it('serves demo illustrations from the storefront with either driver', () => {
    for (const driver of ['s3', 'local'] as const) {
      expect(storage(driver).publicUrl('demo/pulse-s-watch.webp')).toBe(
        'https://shop.example.com/demo-products/pulse-s-watch.webp',
      );
    }
  });
});

describe('StorageService.createUpload', () => {
  it('uploads to incoming/ while the ticket names the key the checked image will have', async () => {
    process.env.AWS_ACCESS_KEY_ID ??= 'test';
    process.env.AWS_SECRET_ACCESS_KEY ??= 'test';
    const ticket = await storage('s3').createUpload('image/jpeg', 1000);
    expect(ticket.storageKey).toMatch(/^products\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.jpg$/);
    const url = new URL(ticket.uploadUrl);
    expect(url.pathname).toBe(`/${ticket.storageKey.replace(/^products\//, 'incoming/')}`);
    expect(ticket.publicUrl).toBe(`https://media.example.com/${ticket.storageKey}`);
  });
});
