/**
 * useFocalPoint
 *
 * Returns the optimal `contentPosition` value for expo-image so the image
 * is cropped toward the most prominent detected face.
 *
 * Falls back to `'center'` when:
 *  - no URL is given
 *  - detection is still running (shows 'center' until result arrives)
 *  - no face detected in the image
 *  - the native ML Kit module is not yet linked
 *
 * Usage:
 *   const contentPosition = useFocalPoint(imageUrl);
 *   <Image source={{ uri: imageUrl }} contentFit="cover" contentPosition={contentPosition} />
 */

import { useEffect, useState } from 'react';
import { detectFocalPoint, type FocalPoint } from '@/services/faceDetectionService';

// expo-image contentPosition object shape
type ContentPositionObj = { top: string; left: string };

function toContentPosition(focal: FocalPoint | null): string | ContentPositionObj {
  if (!focal) return 'center';
  return {
    top: `${Math.round(focal.yPct * 100)}%`,
    left: `${Math.round(focal.xPct * 100)}%`,
  };
}

/**
 * @param imageUrl - Remote or local image URI to analyse
 * @returns A `contentPosition` value ready for expo-image
 */
export function useFocalPoint(
  imageUrl?: string,
): string | ContentPositionObj {
  const [focal, setFocal] = useState<FocalPoint | null>(null);

  useEffect(() => {
    let active = true;
    setFocal(null); // reset when URL changes

    if (!imageUrl) return;

    detectFocalPoint(imageUrl).then((result) => {
      if (active) setFocal(result);
    });

    return () => {
      active = false;
    };
  }, [imageUrl]);

  return toContentPosition(focal);
}
