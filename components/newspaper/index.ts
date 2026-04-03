/**
 * Newspaper Block Components
 *
 * Usage:
 *   import { Block3in1col, Block4in2col, Block6inAdaptive } from '@/components/newspaper';
 *   import type { NewspaperArticleData } from '@/components/newspaper';
 *
 * Data contract:
 *   {
 *     title: string;
 *     subtitle?: string;
 *     category?: 'political' | 'crime' | 'sports' | 'business' | 'entertainment' | 'general';
 *     dateline?: string;             // e.g. "హైదరాబాద్, మార్చి 4"
 *     highlights?: string[];         // bullet-point sentences
 *     images?: { uri: string; caption?: string }[];
 *     paragraphs: (string | { content: string; type: 'heading' })[];
 *   }
 *
 * Block selection guide:
 *   Block3in1col     → single narrow column article (3in / ~228px)
 *   Block4in2col     → two balanced columns with image in col2 (4in / ~304px)
 *   Block6inAdaptive → 2–4 adaptive columns based on image count (6in / ~456px)
 */
export { default as Block3in1col } from './Block3in1col';
export { default as Block4in2col } from './Block4in2col';
export { default as Block6inAdaptive } from './Block6inAdaptive';
export { default as FitTitle } from './FitTitle';
export { default as FlowColumn } from './FlowColumn';
export { default as HighlightsBox } from './HighlightsBox';
export type { NewspaperArticleData, ParagraphItem, NewspaperImage, CategoryKey, FlowItem } from './types';
export { categoryColor, CATEGORY_COLORS, HIGHLIGHT_STYLE, buildFlowItems } from './utils';
