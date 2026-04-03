/**
 * faceDetectionService.ts
 *
 * On-device face detection using Google ML Kit.
 * Detects the most prominent face in an image and returns a normalized focal
 * point (0–1) so expo-image can pan/crop toward the subject.
 *
 * IMPORTANT: Requires a native rebuild after installing:
 *   @react-native-ml-kit/face-detection
 * and running `pod install` for iOS.
 *
 * Gracefully falls back to `null` (→ 'center') when the native module is not
 * linked yet (Expo Go, first install without rebuild).
 */

import FaceDetection from '@react-native-ml-kit/face-detection';
// expo-file-system v19 moved classic helpers to the /legacy sub-path
import {
  cacheDirectory,
  downloadAsync,
  getInfoAsync,
} from 'expo-file-system/legacy';
import { Image as RNImage } from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FocalPoint {
  /** 0 = leftmost edge, 1 = rightmost edge */
  xPct: number;
  /** 0 = topmost edge,  1 = bottommost edge */
  yPct: number;
}

// ─── In-memory cache (keyed by original image URL) ────────────────────────────
// `null`     → detection ran but found nothing (use 'center')
// `undefined` → not yet attempted

const focalCache = new Map<string, FocalPoint | null>();

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeFileName(url: string): string {
  // Produce a stable, FS-safe filename from the URL (max 80 chars)
  return url.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
}

async function getImageSize(
  uri: string,
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve(w > 0 && h > 0 ? { width: w, height: h } : null),
      () => resolve(null),
    );
  });
}

/**
 * Download a remote image to Expo's cache directory and return the local path.
 * Re-uses an already-downloaded file when present.
 */
async function ensureLocalCopy(remoteUrl: string): Promise<string> {
  const cacheDir = cacheDirectory ?? '';
  const localPath = `${cacheDir}fd_${safeFileName(remoteUrl)}.jpg`;

  const info = await getInfoAsync(localPath);
  if (!info.exists) {
    await downloadAsync(remoteUrl, localPath);
  }
  return localPath;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Detect the most prominent face in `imageUrl` and return a normalised focal
 * point.  Returns `null` when:
 * - the native module isn't linked yet (graceful degradation)
 * - no face is found
 * - the detection throws for any reason
 *
 * Results are cached in memory for the lifetime of the JS process.
 */
export async function detectFocalPoint(
  imageUrl: string,
): Promise<FocalPoint | null> {
  if (!imageUrl) return null;

  // Return cached result immediately
  if (focalCache.has(imageUrl)) {
    return focalCache.get(imageUrl) ?? null;
  }

  try {
    // ML Kit needs a local file; download if remote
    const isRemote =
      imageUrl.startsWith('http://') || imageUrl.startsWith('https://');
    const localUri = isRemote ? await ensureLocalCopy(imageUrl) : imageUrl;

    // Run face detection and fetch image dimensions in parallel
    const [faces, dims] = await Promise.all([
      FaceDetection.detect(localUri, {
        performanceMode: 'fast',
        landmarkMode: 'none',
        minFaceSize: 0.08,
      }),
      getImageSize(imageUrl),
    ]);

    if (!faces?.length || !dims) {
      focalCache.set(imageUrl, null);
      return null;
    }

    // Pick the largest face (most prominent subject in frame)
    const largest = faces.reduce((a, b) =>
      b.frame.width * b.frame.height > a.frame.width * a.frame.height ? b : a,
    );

    const xPct = Math.max(
      0.1,
      Math.min(0.9, (largest.frame.left + largest.frame.width / 2) / dims.width),
    );
    const yPct = Math.max(
      0.1,
      Math.min(0.9, (largest.frame.top + largest.frame.height / 2) / dims.height),
    );

    const focal: FocalPoint = { xPct, yPct };
    focalCache.set(imageUrl, focal);
    return focal;
  } catch {
    // Native module not linked or detection failed — degrade silently
    focalCache.set(imageUrl, null);
    return null;
  }
}

/** Purge the in-memory focal-point cache (call on logout / memory pressure). */
export function clearFocalPointCache(): void {
  focalCache.clear();
}
