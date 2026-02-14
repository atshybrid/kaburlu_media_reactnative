/**
 * Standardized typography scale for consistent text hierarchy
 */
export const Typography = {
  /** 28px - Page/Screen titles */
  h1: 28,
  /** 24px - Major section headers */
  h2: 24,
  /** 20px - Subsection headers */
  h3: 20,
  /** 18px - Card/Component titles */
  h4: 18,
  /** 16px - Body text (default) */
  body: 16,
  /** 14px - Secondary content */
  bodySmall: 14,
  /** 12px - Helper text, captions */
  caption: 12,
  /** 10px - Minimal labels */
  tiny: 10,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
} as const;

export default Typography;
