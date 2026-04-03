/**
 * Newspaper Block Utilities
 */
import type { FlowItem, NewspaperArticleData, ParagraphItem } from './types';

// ── Category colours ──────────────────────────────────────────────────────────
export const CATEGORY_COLORS: Record<string, string> = {
  political:     '#2C3E50',
  crime:         '#C0392B',
  sports:        '#16A085',
  business:      '#8E44AD',
  entertainment: '#D35400',
  general:       '#34495E',
};

export function categoryColor(cat?: string): string {
  if (!cat) return CATEGORY_COLORS.general;
  return CATEGORY_COLORS[cat.toLowerCase()] ?? CATEGORY_COLORS.general;
}

// ── Highlight style constants ─────────────────────────────────────────────────
export const HIGHLIGHT_STYLE = {
  bg:          '#fbf6e8',
  border:      '#c8b97a',
  leftBorder:  '#d35400',
  bulletColor: '#d35400',
} as const;

// ── Flow normalizer ───────────────────────────────────────────────────────────
/**
 * Converts raw article data into a flat list of FlowItems, following spec rules:
 *
 * - If highlights exist: flow starts at paragraphs[0] (highlights appear above first para)
 * - If NO highlights: inject paragraphs[0] as initial text BEFORE highlights section;
 *   additionally prepend dateline to this first paragraph
 * - Headings: flush current buffer → heading node → continue buffering
 * - Sequential text items are merged into a continuous paragraph buffer
 *
 * NOTE: images are NOT injected into the flow here — they are placed by each
 * block according to its own placement policy.
 */
export function buildFlowItems(
  data: NewspaperArticleData,
  options: { includeDateline: boolean } = { includeDateline: true },
): FlowItem[] {
  const items: FlowItem[] = [];
  const hasHighlights = !!data.highlights?.length;

  // Buffer accumulates consecutive text strings to merge
  let textBuffer: string[] = [];

  const flushBuffer = () => {
    if (textBuffer.length === 0) return;
    items.push({ kind: 'text', text: textBuffer.join(' ') });
    textBuffer = [];
  };

  // Dateline prefix helper
  const withDateline = (text: string): string => {
    if (options.includeDateline && data.dateline) {
      return `${data.dateline} ${text}`;
    }
    return text;
  };

  if (!hasHighlights) {
    // Rule: inject paragraphs[0] with dateline as initial text first
    const firstPara = data.paragraphs[0];
    if (firstPara !== undefined) {
      const txt = typeof firstPara === 'string' ? firstPara : firstPara.content;
      textBuffer.push(withDateline(txt));
    }
    // Process remaining paragraphs from index 1
    const rest = data.paragraphs.slice(1);
    for (const p of rest) {
      processItem(p, textBuffer, items, flushBuffer);
    }
  } else {
    // Highlights exist — push them first (before paragraphs)
    items.push({ kind: 'highlights', items: data.highlights! });
    // Then all paragraphs; dateline prepended to first paragraph text
    let datelinePrepended = false;
    for (const p of data.paragraphs) {
      const isFirst = !datelinePrepended;
      if (typeof p === 'string') {
        textBuffer.push(isFirst && options.includeDateline && data.dateline
          ? withDateline(p)
          : p);
        datelinePrepended = true;
      } else if (p.type === 'heading') {
        flushBuffer();
        items.push({ kind: 'heading', text: p.content });
      } else {
        const txt = (isFirst && options.includeDateline && data.dateline)
          ? withDateline(p.content)
          : p.content;
        textBuffer.push(txt);
        datelinePrepended = true;
      }
    }
  }
  flushBuffer();
  return items;
}

function processItem(
  p: ParagraphItem,
  textBuffer: string[],
  items: FlowItem[],
  flushBuffer: () => void,
) {
  if (typeof p === 'string') {
    textBuffer.push(p);
  } else if (p.type === 'heading') {
    flushBuffer();
    items.push({ kind: 'heading', text: p.content });
  } else {
    textBuffer.push(p.content);
  }
}

// ── Word‐count helpers ────────────────────────────────────────────────────────
export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function flowItemWordCount(item: FlowItem): number {
  if (item.kind === 'text') return wordCount(item.text);
  if (item.kind === 'heading') return wordCount(item.text);
  if (item.kind === 'highlights') return item.items.reduce((s, i) => s + wordCount(i), 0);
  return 0;
}
