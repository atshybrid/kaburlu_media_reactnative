// Central config for keyword-based title color themes.
// You can edit this file to add/remove words and change colors without touching layout code.

export type TitleColorRule = {
  // Words/phrases to match (case-insensitive). If any matches, the rule applies.
  keywords: string[];
  // Primary color (accent) for the strong title line, as hex or css rgba().
  primary: string;
  // Secondary color used as the complement tint for the other line.
  secondary: string;
  // Optional note for maintainers
  note?: string;
};

// Default rules. Edit freely.
export const TITLE_COLOR_RULES: TitleColorRule[] = [
  { keywords: ['bjp','nda','బీజేపీ'], primary: '#ab3e04ff', secondary: '#f79400ff', note: 'Saffron tones' },
  { keywords: ['trs', 'brs'], primary: '#E91E63', secondary: '#ee5c8fff', note: 'Pink tones' },
  { keywords: ['congress', 'inc'], primary: '#0D47A1', secondary: '#cb7506ff', note: 'Deep blue + saffron' },
];

function normalize(text: unknown): string {
  return String(text || '').normalize('NFKC');
}

export function pickTitleColorTheme(input: { title?: string; metaTitle?: string; tags?: string[] }): { primary: string; secondary: string } | null {
  const title = normalize(input.title).toLowerCase();
  const meta = normalize(input.metaTitle).toLowerCase();
  const tags = (input.tags || []).map(normalize).join(' ').toLowerCase();
  const haystack = `${title} ${meta} ${tags}`;

  for (const rule of TITLE_COLOR_RULES) {
    const matched = rule.keywords.some((k) => new RegExp(`(^|[^a-z])${k.toLowerCase()}([^a-z]|$)`, 'i').test(haystack));
    if (matched) return { primary: rule.primary, secondary: rule.secondary };
  }
  return null;
}
