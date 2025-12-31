import ArticlePage from '@/components/ArticlePage';
import type { Article } from '@/types';
import LayoutTwo from './LayoutTwo';
import type { ArticleLayoutComponent } from './types';

// Simple deterministic string hash for seeded random
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// (Removed pickBySeed since selection now uses parity)

export const layouts: { key: string; component: ArticleLayoutComponent }[] = [
  { key: 'articlePage', component: ArticlePage as unknown as ArticleLayoutComponent },
  { key: 'layoutTwo', component: LayoutTwo },
];

export function pickLayoutForArticle(article: Article, index?: number): ArticleLayoutComponent {
  // If index is provided by the caller, alternate strictly: even -> Layout One, odd -> Layout Two
  if (typeof index === 'number') {
    return (index % 2 === 0)
      ? (ArticlePage as unknown as ArticleLayoutComponent)
      : LayoutTwo;
  }
  // Fallback: deterministic by hash parity when index isn't provided
  const id = String(article.id ?? article.title ?? '');
  if (!id) {
    // No stable id/title; default to Layout One to avoid all items falling into Layout Two
    return (ArticlePage as unknown as ArticleLayoutComponent);
  }
  const h = hashString(id);
  // Flip parity so even hashes map to Layout One; this avoids an all-LayoutTwo fallback
  return (h % 2 === 0)
    ? (ArticlePage as unknown as ArticleLayoutComponent)
    : LayoutTwo;
}
