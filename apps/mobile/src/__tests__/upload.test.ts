import * as FileSystem from 'expo-file-system/legacy';
import { fileSize, uploadFile } from '@/lib/upload';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
  uploadAsync: jest.fn(),
  FileSystemUploadType: { BINARY_CONTENT: 0, MULTIPART: 1 },
}));

const fs = FileSystem as jest.Mocked<typeof FileSystem>;
const ticket = {
  uploadUrl: 'https://bucket.s3.amazonaws.com/incoming/x.jpg?sig',
  headers: { 'Content-Type': 'image/jpeg' },
};

describe('photo uploads on a phone', () => {
  it('measures the file on disk rather than trusting the picker', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: true, size: 1234 } as never);
    expect(await fileSize('file:///crop.jpg', 999)).toBe(1234);
  });

  it('falls back to the picker size, and gives up when neither knows', async () => {
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
    expect(await fileSize('file:///crop.jpg', 999)).toBe(999);
    fs.getInfoAsync.mockResolvedValueOnce({ exists: false } as never);
    expect(await fileSize('file:///crop.jpg')).toBeNull();
  });

  it('PUTs the raw bytes with the signed headers through the native uploader', async () => {
    fs.uploadAsync.mockResolvedValueOnce({ status: 200 } as never);
    expect(await uploadFile('file:///crop.jpg', ticket)).toBe(200);
    expect(fs.uploadAsync).toHaveBeenCalledWith(ticket.uploadUrl, 'file:///crop.jpg', {
      httpMethod: 'PUT',
      headers: ticket.headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
  });
});
