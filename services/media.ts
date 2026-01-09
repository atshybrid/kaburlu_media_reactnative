import AsyncStorage from '@react-native-async-storage/async-storage';
import { getBaseUrl, HttpError } from './http';

/* ─────────────────────────────────────────────────────────────────────────────
 * Media Upload API
 * POST /api/v1/media/upload (multipart/form-data)
 * ───────────────────────────────────────────────────────────────────────────── */

export type MediaUploadResponse = {
  key: string;
  publicUrl: string;
  contentType: string;
  size: number;
  kind: 'image' | 'video';
};

export type UploadMediaOptions = {
  /** File URI from image picker */
  uri: string;
  /** MIME type (e.g., 'image/jpeg') */
  mimeType?: string;
  /** Original filename */
  filename?: string;
  /** Folder path (e.g., 'profiles', 'articles') */
  folder?: string;
  /** 'image' or 'video' - validates MIME type on server */
  kind?: 'image' | 'video';
};

/**
 * Upload a media file (image/video) to the server.
 * Returns the public URL that can be used for profile photos, article images, etc.
 */
export async function uploadMedia(options: UploadMediaOptions): Promise<MediaUploadResponse> {
  const jwt = await AsyncStorage.getItem('jwt');
  if (!jwt) {
    throw new HttpError(401, undefined, 'Not authenticated');
  }

  const { uri, mimeType, filename, folder, kind } = options;

  // Determine file extension and name
  const uriParts = uri.split('/');
  const originalName = filename || uriParts[uriParts.length - 1] || 'file';
  const ext = originalName.includes('.') ? originalName.split('.').pop() : 'jpg';
  const finalName = originalName.includes('.') ? originalName : `${originalName}.${ext}`;

  // Determine MIME type
  const finalMimeType = mimeType || getMimeType(ext || 'jpg');

  // Create form data
  const formData = new FormData();
  formData.append('file', {
    uri,
    type: finalMimeType,
    name: finalName,
  } as any);

  if (folder) {
    formData.append('folder', folder);
  }
  if (kind) {
    formData.append('kind', kind);
  }

  const url = `${getBaseUrl()}/media/upload`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${jwt}`,
      // Don't set Content-Type - let fetch set it with boundary for multipart
    },
    body: formData,
  });

  const text = await response.text();
  let data: any;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new HttpError(response.status, data, data?.message || `Upload failed (HTTP ${response.status})`);
  }

  // Handle wrapped response { success: true, data: {...} }
  const result = data?.data ?? data;
  return result as MediaUploadResponse;
}

/**
 * Upload a profile photo and return the public URL
 */
export async function uploadProfilePhoto(options: {
  uri: string;
  mimeType?: string;
  filename?: string;
}): Promise<{ publicUrl: string }> {
  const result = await uploadMedia({
    uri: options.uri,
    mimeType: options.mimeType,
    filename: options.filename,
    folder: 'profiles',
    kind: 'image',
  });
  return { publicUrl: result.publicUrl };
}

/**
 * Upload an article image and return the public URL
 */
export async function uploadArticleImage(uri: string): Promise<string> {
  const result = await uploadMedia({
    uri,
    folder: 'articles',
    kind: 'image',
  });
  return result.publicUrl;
}

/* ─────────────────────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────────────────────── */

function getMimeType(ext: string): string {
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    heic: 'image/heic',
    heif: 'image/heif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    webm: 'video/webm',
    avi: 'video/x-msvideo',
  };
  return mimeMap[ext.toLowerCase()] || 'application/octet-stream';
}
