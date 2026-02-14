/**
 * Standardized border radius values for consistent rounded corners
 */
export const BorderRadius = {
  /** 4px - Minimal rounding */
  xs: 4,
  /** 8px - Small components */
  sm: 8,
  /** 12px - Default cards/buttons */
  md: 12,
  /** 16px - Large cards */
  lg: 16,
  /** 20px - Extra large components */
  xl: 20,
  /** 9999px - Fully rounded (pills, circles) */
  full: 9999,
} as const;

export default BorderRadius;
