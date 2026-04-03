/**
 * useDeviceLayout — Responsive sizing hook for article layouts.
 *
 * Detects phone vs tablet and returns font sizes, image heights, and
 * padding values that make full use of larger screens while keeping
 * phone layouts tight and readable.
 */
import { useWindowDimensions } from 'react-native';

export interface DeviceLayout {
  /** Raw window width in dp */
  width: number;
  /** Raw window height in dp */
  height: number;
  /** true when width >= 768 (iPad mini or larger) */
  isTablet: boolean;
  /** true when width >= 1024 (iPad 13-inch / iPad Pro) */
  isLargeTablet: boolean;

  /**
   * Scale a font size designed for phones to the current device.
   * Pass your "design phone size" and get back the right size for the
   * actual screen.  Examples:
   *   scaleFontSize(22) → 22 on phone, 30 on iPad, 36 on iPad Pro 13
   *   scaleFontSize(15) → 15 on phone, 20 on iPad, 24 on iPad Pro 13
   */
  scaleFontSize: (phoneSize: number) => number;

  /**
   * Scale a line-height multiplier the same way, keeping proportions.
   */
  scaleLineHeight: (phoneSize: number, multiplier?: number) => number;

  /**
   * Recommended image height for a full-width article hero.
   * Phone: 55 % of width.  iPad: 50 % of width (wide 16:9 feel).
   * Adjustable by passing a word-count factor (0 – 1);
   * short articles → taller image to fill blank space.
   */
  imageHeight: (wordCount?: number) => number;

  /** Horizontal padding for content containers */
  horizontalPadding: number;
}

export function useDeviceLayout(): DeviceLayout {
  const { width, height } = useWindowDimensions();

  const isTablet = width >= 768;
  const isLargeTablet = width >= 1024;

  // Multiplier applied to phone font sizes
  const fontMultiplier = isLargeTablet ? 1.55 : isTablet ? 1.28 : 1.0;

  const scaleFontSize = (phoneSize: number): number =>
    Math.round(phoneSize * fontMultiplier);

  const scaleLineHeight = (phoneSize: number, multiplier = 1.55): number =>
    Math.round(phoneSize * fontMultiplier * multiplier);

  const horizontalPadding = isLargeTablet ? 40 : isTablet ? 28 : 16;

  const imageHeight = (wordCount = 60): number => {
    const contentWidth = width - horizontalPadding * 2;
    // Short articles get taller hero to fill unused body space
    let ratio: number;
    if (wordCount >= 60) {
      ratio = isTablet ? 9 / 16 : 10 / 16;       // wide 16:9 for long content
    } else if (wordCount >= 35) {
      ratio = isTablet ? 10 / 16 : 11 / 16;
    } else {
      ratio = isTablet ? 11 / 16 : 12 / 16;       // taller hero for very short content
    }
    return Math.round(contentWidth * ratio);
  };

  return {
    width,
    height,
    isTablet,
    isLargeTablet,
    scaleFontSize,
    scaleLineHeight,
    imageHeight,
    horizontalPadding,
  };
}
