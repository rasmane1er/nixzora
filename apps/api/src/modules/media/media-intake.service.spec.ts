import { type ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { type Env } from '../../config/env';
import { type AuditService } from '../audit/audit.service';
import { MediaIntakeService } from './media-intake.service';
import { type StorageService } from './storage.service';

const KEY = 'products/2027/03/0190a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b.png';

async function setup(opts: { scan: 'off' | 'guardduty'; tags?: Record<string, string>[] }) {
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  const stored = new Map<string, Buffer>();
  const removed: string[] = [];
  const tags = [...(opts.tags ?? [])];
  const storage = {
    exists: jest.fn(async (key: string) => stored.has(key)),
    readUpload: jest.fn(async () => (removed.length ? null : png)),
    uploadTags: jest.fn(async () => tags.shift() ?? {}),
    putChecked: jest.fn(async (key: string, body: Buffer) => void stored.set(key, body)),
    removeUpload: jest.fn(async (key: string) => void removed.push(key)),
  };
  const audit = { record: jest.fn(async () => undefined) };
  const config = {
    get: (key: string) => ({ MEDIA_MALWARE_SCAN: opts.scan, MEDIA_SCAN_WAIT_SECONDS: 2 })[key],
  };
  const intake = new MediaIntakeService(
    storage as unknown as StorageService,
    audit as unknown as AuditService,
    config as unknown as ConfigService<Env, true>,
  );
  return { intake, storage, stored, removed, audit };
}

describe('MediaIntakeService', () => {
  it('re-encodes the upload into its final key and deletes the original', async () => {
    const { intake, stored, removed } = await setup({ scan: 'off' });
    expect(await intake.ensureReady(KEY)).toBe(true);
    expect(stored.has(KEY)).toBe(true);
    expect(removed).toEqual([KEY]);
    // Already processed: nothing to do the second time.
    expect(await intake.ensureReady(KEY)).toBe(true);
  });

  it('says so when nothing was uploaded, and ignores keys it did not issue', async () => {
    const { intake, storage } = await setup({ scan: 'off' });
    storage.readUpload.mockResolvedValueOnce(null);
    expect(await intake.ensureReady(KEY)).toBe(false);
    expect(await intake.ensureReady('incoming/2027/03/x.png')).toBe(false);
    expect(await intake.ensureReady('../etc/passwd')).toBe(false);
  });

  it('waits for the malware scan and accepts a clean file', async () => {
    const { intake, stored } = await setup({
      scan: 'guardduty',
      tags: [{}, { GuardDutyMalwareScanStatus: 'NO_THREATS_FOUND' }],
    });
    expect(await intake.ensureReady(KEY)).toBe(true);
    expect(stored.has(KEY)).toBe(true);
  });

  it('deletes and refuses a file with malware, and records it', async () => {
    const { intake, stored, removed, audit } = await setup({
      scan: 'guardduty',
      tags: [{ GuardDutyMalwareScanStatus: 'THREATS_FOUND' }],
    });
    await expect(intake.ensureReady(KEY)).rejects.toMatchObject({ status: 422 });
    expect(stored.size).toBe(0);
    expect(removed).toEqual([KEY]);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'media.upload.malware' }),
    );
  });

  it('asks to try again when the scan has not finished in time', async () => {
    const { intake, stored } = await setup({ scan: 'guardduty' });
    await expect(intake.ensureReady(KEY)).rejects.toMatchObject({ status: 503 });
    expect(stored.size).toBe(0);
  }, 10_000);
});
