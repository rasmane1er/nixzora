import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { AuditService } from '../audit/audit.service';
import { contentTypeOfKey, STORAGE_KEY_PATTERN } from './image-type';
import { sanitizeImage, UnreadableImageError } from './image-sanitizer';
import { StorageService } from './storage.service';

/** The tag GuardDuty Malware Protection for S3 puts on every object it scans. */
const SCAN_TAG = 'GuardDutyMalwareScanStatus';
const POLL_MS = 1_000;

/**
 * Turns an upload into an image we serve (ADR-0025). Every place that accepts an uploaded image
 * (product photos, store logo and banner, profile photo) calls `ensureReady` with the key from
 * the upload ticket: the original in incoming/ is scanned (when GuardDuty is on), decoded and
 * re-encoded without metadata into products/, then deleted. Nothing uploaded is ever served as
 * it was sent.
 */
@Injectable()
export class MediaIntakeService {
  private readonly logger = new Logger(MediaIntakeService.name);
  private readonly scan: Env['MEDIA_MALWARE_SCAN'];
  private readonly waitMs: number;

  constructor(
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    config: ConfigService<Env, true>,
  ) {
    this.scan = config.get('MEDIA_MALWARE_SCAN', { infer: true });
    this.waitMs = config.get('MEDIA_SCAN_WAIT_SECONDS', { infer: true }) * 1000;
  }

  /**
   * True when `key` is ready to use (already processed, or processed now); false when nothing
   * was uploaded for it. Refuses unsafe or unreadable files.
   */
  async ensureReady(key: string): Promise<boolean> {
    if (!STORAGE_KEY_PATTERN.test(key)) return false;
    if (await this.storage.exists(key)) return true;
    const original = await this.storage.readUpload(key);
    if (!original) return false;

    await this.checkScan(key);
    let clean: Buffer;
    try {
      clean = await sanitizeImage(original, contentTypeOfKey(key));
    } catch (error) {
      if (!(error instanceof UnreadableImageError)) throw error;
      await this.storage.removeUpload(key);
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        code: 'IMAGE_UNREADABLE',
        message: 'This file is not a readable image. Try another photo.',
      });
    }
    await this.storage.putChecked(key, clean);
    await this.storage.removeUpload(key);
    return true;
  }

  /** Waits for GuardDuty's verdict on the upload; refuses it if a threat was found. */
  private async checkScan(key: string): Promise<void> {
    if (this.scan !== 'guardduty') return;
    const deadline = Date.now() + this.waitMs;
    for (;;) {
      const status = (await this.storage.uploadTags(key))[SCAN_TAG];
      if (status === 'NO_THREATS_FOUND') return;
      if (status === 'THREATS_FOUND') {
        await this.storage.removeUpload(key);
        this.logger.warn(`Malware found in upload for ${key}; deleted.`);
        await this.audit.record({
          action: 'media.upload.malware',
          entityType: 'upload',
          entityId: key,
          metadata: { scanner: 'guardduty' },
        });
        throw new UnprocessableEntityException({
          statusCode: 422,
          error: 'Unprocessable Entity',
          code: 'UPLOAD_UNSAFE',
          message: 'This file was flagged as unsafe and was deleted.',
        });
      }
      // UNSUPPORTED, ACCESS_DENIED or FAILED: the scanner could not look at it; do not accept it.
      if (status && status !== 'NO_THREATS_FOUND') {
        this.logger.error(`Malware scan of upload for ${key} ended with ${status}.`);
        throw new ServiceUnavailableException({
          statusCode: 503,
          error: 'Service Unavailable',
          code: 'UPLOAD_NOT_SCANNED',
          message: 'We could not check this file. Upload it again in a moment.',
        });
      }
      if (Date.now() >= deadline) {
        throw new ServiceUnavailableException({
          statusCode: 503,
          error: 'Service Unavailable',
          code: 'UPLOAD_CHECKING',
          message: 'We are still checking this file. Try again in a few seconds.',
        });
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}
