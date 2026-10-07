import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

/** A message the screen can show as is (the generic API error text would hide it). */
export class UploadError extends Error {}

type Ticket = { uploadUrl: string; headers: Record<string, string> };

/** Size in bytes of a picked file, or null when the platform cannot say. */
export async function fileSize(uri: string, reported?: number | null): Promise<number | null> {
  if (Platform.OS === 'web') return (await (await fetch(uri)).blob()).size;
  // The bytes on disk, not the picker's figure: the signed link must match them exactly.
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists && info.size > 0) return info.size;
  return reported && reported > 0 ? reported : null;
}

/**
 * PUTs a picked file to a signed upload link. On phones the file goes through the native
 * uploader as raw bytes with an exact Content-Length, which the signed S3 link checks; uploading
 * `fetch(uri).blob()` from JavaScript failed on Android. The web build keeps using fetch.
 * Returns the HTTP status.
 */
export async function uploadFile(uri: string, ticket: Ticket): Promise<number> {
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const put = await fetch(ticket.uploadUrl, {
      method: 'PUT',
      headers: ticket.headers,
      body: blob,
    });
    return put.status;
  }
  const result = await FileSystem.uploadAsync(ticket.uploadUrl, uri, {
    httpMethod: 'PUT',
    headers: ticket.headers,
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
  });
  return result.status;
}
