import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  GetObjectTaggingCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type UploadTicket } from '@nixzora/validation';
import { type Env } from '../../config/env';
import { safeEqual } from '../../common/crypto';
import {
  contentTypeOfKey,
  IMAGE_TYPES,
  type ImageContentType,
  incomingKeyFor,
  STORAGE_KEY_PATTERN,
} from './image-type';

const UPLOAD_TTL_SECONDS = 300;

export type LocalUploadClaims = {
  key: string;
  contentType: ImageContentType;
  sizeBytes: number;
  expiresAt: number;
};

/** Storage keys of the demo catalog's bundled illustrations, e.g. "demo/pulse-s-watch.webp". */
export const DEMO_PREFIX = 'demo/';

/**
 * Where product images live.
 * - local: files under STORAGE_LOCAL_DIR, uploaded to and served by this API (development).
 * - s3: the browser uploads straight to S3 with a presigned URL; CloudFront serves the files.
 * Callers never see which driver is active.
 *
 * Uploads go to `incoming/`; MediaIntakeService checks and re-encodes them into `products/`,
 * the only prefix that is ever served.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly driver: 'local' | 's3';
  private readonly localDir: string;
  private readonly apiPublicUrl: string;
  private readonly signingSecret: string;
  private readonly s3?: S3Client;
  private readonly bucket?: string;
  private readonly assetsBaseUrl?: string;
  private readonly webAppUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.driver = config.get('STORAGE_DRIVER', { infer: true });
    this.localDir = resolve(config.get('STORAGE_LOCAL_DIR', { infer: true }));
    this.apiPublicUrl = config.get('API_PUBLIC_URL', { infer: true }).replace(/\/$/, '');
    this.webAppUrl = config.get('WEB_APP_URL', { infer: true }).replace(/\/$/, '');
    this.signingSecret =
      config.get('MEDIA_SIGNING_SECRET', { infer: true }) ?? randomBytes(32).toString('base64url');

    if (this.driver === 's3') {
      this.s3 = new S3Client({ region: config.get('S3_REGION', { infer: true }) });
      this.bucket = config.get('S3_BUCKET', { infer: true });
      this.assetsBaseUrl = config.get('ASSETS_BASE_URL', { infer: true })?.replace(/\/$/, '');
    }
  }

  get isLocal(): boolean {
    return this.driver === 'local';
  }

  newProductImageKey(contentType: ImageContentType, now = new Date()): string {
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `products/${now.getUTCFullYear()}/${month}/${randomUUID()}.${IMAGE_TYPES[contentType].ext}`;
  }

  publicUrl(key: string): string {
    // Demo catalog illustrations ship with the storefront (public/demo-products), not in storage.
    if (key.startsWith(DEMO_PREFIX)) {
      return `${this.webAppUrl}/demo-products/${key.slice(DEMO_PREFIX.length)}`;
    }
    return this.driver === 's3'
      ? `${this.assetsBaseUrl}/${key}`
      : `${this.apiPublicUrl}/api/v1/media/${key}`;
  }

  async createUpload(contentType: ImageContentType, sizeBytes: number): Promise<UploadTicket> {
    const key = this.newProductImageKey(contentType);
    const expiresAt = Date.now() + UPLOAD_TTL_SECONDS * 1000;
    // The browser uploads the original to incoming/; `key` is where the checked copy will live.

    let uploadUrl: string;
    if (this.driver === 's3' && this.s3) {
      uploadUrl = await getSignedUrl(
        this.s3,
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: incomingKeyFor(key),
          ContentType: contentType,
          ContentLength: sizeBytes,
        }),
        {
          expiresIn: UPLOAD_TTL_SECONDS,
          signableHeaders: new Set(['content-type', 'content-length']),
        },
      );
    } else {
      const claims: LocalUploadClaims = { key, contentType, sizeBytes, expiresAt };
      const query = new URLSearchParams({
        key,
        ct: contentType,
        size: String(sizeBytes),
        exp: String(expiresAt),
        sig: this.sign(claims),
      });
      uploadUrl = `${this.apiPublicUrl}/api/v1/media/upload?${query.toString()}`;
    }

    return {
      storageKey: key,
      uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(expiresAt).toISOString(),
      publicUrl: this.publicUrl(key),
    };
  }

  /** Validates a local upload link. Returns the claims, or null if forged or expired. */
  verifyLocalUpload(query: Record<string, unknown>): LocalUploadClaims | null {
    const key = String(query.key ?? '');
    const contentType = String(query.ct ?? '') as ImageContentType;
    const sizeBytes = Number(query.size);
    const expiresAt = Number(query.exp);
    const sig = String(query.sig ?? '');

    if (!STORAGE_KEY_PATTERN.test(key) || !(contentType in IMAGE_TYPES)) return null;
    if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || !Number.isFinite(expiresAt)) return null;
    if (expiresAt < Date.now()) return null;

    const claims = { key, contentType, sizeBytes, expiresAt };
    return safeEqual(sig, this.sign(claims)) ? claims : null;
  }

  /** Local driver: stores an upload (for the image that will live at `key`) in incoming/. */
  async writeLocalUpload(key: string, body: Buffer): Promise<void> {
    const path = resolve(this.localDir, incomingKeyFor(key));
    await mkdir(dirname(path), { recursive: true });
    // "wx": an upload link works once.
    await writeFile(path, body, { flag: 'wx' });
  }

  /** The uploaded original for `key`, or null if nothing was uploaded (or it was cleaned up). */
  async readUpload(key: string): Promise<Buffer | null> {
    const incoming = incomingKeyFor(key);
    try {
      if (this.driver === 's3' && this.s3) {
        const object = await this.s3.send(
          new GetObjectCommand({ Bucket: this.bucket, Key: incoming }),
        );
        return Buffer.from(await object.Body!.transformToByteArray());
      }
      return await readFile(resolve(this.localDir, incoming));
    } catch (error) {
      this.logger.debug(`Upload ${incoming} not readable: ${(error as Error).message}`);
      return null;
    }
  }

  /** Tags on the uploaded original (S3 only), e.g. the malware scan result. */
  async uploadTags(key: string): Promise<Record<string, string>> {
    if (this.driver !== 's3' || !this.s3) return {};
    const result = await this.s3.send(
      new GetObjectTaggingCommand({ Bucket: this.bucket, Key: incomingKeyFor(key) }),
    );
    return Object.fromEntries((result.TagSet ?? []).map((tag) => [tag.Key ?? '', tag.Value ?? '']));
  }

  /** Stores the checked image at its final key. Writing the same key twice is harmless. */
  async putChecked(key: string, body: Buffer): Promise<void> {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
    if (this.driver === 's3' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentTypeOfKey(key),
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return;
    }
    const path = this.localPath(key);
    await mkdir(dirname(path), { recursive: true });
    try {
      await writeFile(path, body, { flag: 'wx' });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }

  /** Removes the uploaded original once its checked copy exists (or it was refused). */
  async removeUpload(key: string): Promise<void> {
    const incoming = incomingKeyFor(key);
    try {
      if (this.driver === 's3' && this.s3) {
        await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: incoming }));
      } else {
        await rm(resolve(this.localDir, incoming), { force: true });
      }
    } catch (error) {
      // The bucket's lifecycle rule removes leftovers after a day.
      this.logger.warn(`Could not remove ${incoming}: ${(error as Error).message}`);
    }
  }

  localPath(key: string): string {
    if (!STORAGE_KEY_PATTERN.test(key)) throw new Error('Invalid storage key');
    return resolve(this.localDir, key);
  }

  get localRoot(): string {
    return this.localDir;
  }

  async exists(key: string): Promise<boolean> {
    if (!STORAGE_KEY_PATTERN.test(key)) return false;
    try {
      if (this.driver === 's3' && this.s3) {
        await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      } else {
        await stat(this.localPath(key));
      }
      return true;
    } catch (error) {
      this.logger.debug(`Object ${key} not found: ${(error as Error).message}`);
      return false;
    }
  }

  private sign(claims: LocalUploadClaims): string {
    return createHmac('sha256', this.signingSecret)
      .update(`${claims.key}|${claims.contentType}|${claims.sizeBytes}|${claims.expiresAt}`)
      .digest('base64url');
  }
}
