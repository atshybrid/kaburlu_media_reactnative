/**
 * Newspaper Block Types
 * Data contract matching the JSON spec
 */

export type ParagraphItem =
  | string
  | { content: string; type: 'heading' };

export interface NewspaperImage {
  uri: string;
  caption?: string;
}

export interface NewspaperArticleData {
  title: string;
  subtitle?: string;
  category?: string;
  dateline?: string;
  highlights?: string[];
  images?: NewspaperImage[];
  paragraphs: ParagraphItem[];
}

export type CategoryKey =
  | 'political'
  | 'crime'
  | 'sports'
  | 'business'
  | 'entertainment'
  | 'general';

/** Flow item produced by the normalizer for rendering */
export type FlowItem =
  | { kind: 'dateline'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'heading'; text: string }
  | { kind: 'highlights'; items: string[] }
  | { kind: 'image'; uri: string; caption?: string };
