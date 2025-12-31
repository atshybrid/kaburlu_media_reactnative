import type { SvgProps } from 'react-native-svg';

// A React component type for SVG icons (from react-native-svg-transformer)
export type LanguageIconComponent = React.ComponentType<SvgProps>;

// Map language codes to their SVG icon components.
// IMPORTANT: Add your imports and mappings here. Keep keys in lowercase.
// Example (uncomment after placing files under assets/images/lang/):
// import TeIcon from '@/assets/images/lang/te.svg';
// import HiIcon from '@/assets/images/lang/hi.svg';
// import TaIcon from '@/assets/images/lang/ta.svg';
// import KnIcon from '@/assets/images/lang/kn.svg';

export const LANGUAGE_ICON_MAP: Record<string, LanguageIconComponent> = {
  // te: TeIcon,
  // hi: HiIcon,
  // ta: TaIcon,
  // kn: KnIcon,
};

// Helper: resolve the best icon by language code (handles te vs te-IN, etc.)
export function getLanguageIcon(languageCode?: string | null): LanguageIconComponent | null {
  if (!languageCode) return null;
  const code = String(languageCode).toLowerCase();
  const base = code.split('-')[0];
  return LANGUAGE_ICON_MAP[code] || LANGUAGE_ICON_MAP[base] || null;
}
