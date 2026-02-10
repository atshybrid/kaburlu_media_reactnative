import ArticlePage from '@/components/ArticlePage';
import type { Article } from '@/types';
import BreakingNewsLayout from './BreakingNewsLayout';
import BroadsheetLayout from './BroadsheetLayout';
import EditorialColumnLayout from './EditorialColumnLayout';
import LayoutTwo from './LayoutTwo';
// Style 4 temporarily disabled - can be enabled later if needed
// import MagazineCoverLayout from './MagazineCoverLayout';
// Style 7 disabled - photo essay has black background
// import PhotoEssayLayout from './PhotoEssayLayout';
import TabloidBoldLayout from './TabloidBoldLayout';
import type { ArticleLayoutComponent } from './types';

/**
 * Layout Registry with Smart Content-Based Selection
 * 
 * Available Layouts:
 * - Style 1: ArticlePage (classic scrolling layout)
 * - Style 2: LayoutTwo (newspaper masthead with transliteration)
 * - Style 3: BroadsheetLayout (classic newspaper with drop cap)
 * - Style 4: [DISABLED] MagazineCoverLayout (full-bleed magazine style)
 * - Style 5: EditorialColumnLayout (author-focused opinion)
 * - Style 6: BreakingNewsLayout (urgent news with red banner)
 * - Style 7: [DISABLED] PhotoEssayLayout (visual story with gallery)
 * - Style 8: TabloidBoldLayout (viral/trending style)
 */

// Simple deterministic string hash for seeded random
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// All available layouts
export const layouts: { key: string; component: ArticleLayoutComponent; name: string }[] = [
  { key: 'articlePage', component: ArticlePage as unknown as ArticleLayoutComponent, name: 'Classic' },
  { key: 'layoutTwo', component: LayoutTwo, name: 'Newspaper' },
  { key: 'broadsheet', component: BroadsheetLayout, name: 'Broadsheet' },
  // Style 4 disabled - can be enabled later
  // { key: 'magazineCover', component: MagazineCoverLayout, name: 'Magazine' },
  { key: 'editorialColumn', component: EditorialColumnLayout, name: 'Editorial' },
  { key: 'breakingNews', component: BreakingNewsLayout, name: 'Breaking' },
  // Style 7 disabled - black background
  // { key: 'photoEssay', component: PhotoEssayLayout, name: 'Photo Essay' },
  { key: 'tabloidBold', component: TabloidBoldLayout, name: 'Tabloid' },
];

// All 8 layouts for cycling through in order
// Note: Style 4 (MagazineCoverLayout) and Style 7 (PhotoEssayLayout) are currently disabled
const allLayoutsOrdered: ArticleLayoutComponent[] = [
  ArticlePage as unknown as ArticleLayoutComponent,  // Style 1
  LayoutTwo,                                          // Style 2
  BroadsheetLayout,                                   // Style 3
  // MagazineCoverLayout,                             // Style 4 - DISABLED
  EditorialColumnLayout,                              // Style 5 (now appears at position 4)
  BreakingNewsLayout,                                 // Style 6 (now appears at position 5)
  // PhotoEssayLayout,                                // Style 7 - DISABLED
  TabloidBoldLayout,                                  // Style 8 (now appears at position 6)
];

/**
 * Get style name for a given layout component (for debugging)
 */
export function getLayoutStyleName(component: ArticleLayoutComponent): string {
  const found = layouts.find(l => l.component === component);
  if (!found) return 'Unknown';
  const idx = layouts.indexOf(found);
  return `Style ${idx + 1}: ${found.name}`;
}

/**
 * Pick layout and return both component and style info
 */
export function pickLayoutWithInfo(article: Article, index?: number): { 
  component: ArticleLayoutComponent; 
  styleName: string; 
  styleNumber: number;
} {
  const component = pickLayoutForArticle(article, index);
  const found = layouts.find(l => l.component === component);
  const styleNumber = found ? layouts.indexOf(found) + 1 : 0;
  const styleName = found ? found.name : 'Unknown';
  return { component, styleName, styleNumber };
}

/**
 * Analyze article content and pick the most suitable layout
 * 
 * Layout Selection Rules:
 * - Style 4 (MagazineCover): CURRENTLY DISABLED
 * - Other styles: Any article length
 * 
 * For testing: cycles through layouts based on article index
 */
export function pickLayoutForArticle(article: Article, index?: number): ArticleLayoutComponent {
  // Get article content length (word count)
  const content = article.summary || article.body || '';
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const isShortArticle = wordCount < 30;
  
  // FOR TESTING: Simply cycle through layouts based on index
  if (typeof index === 'number') {
    const layoutIndex = index % allLayoutsOrdered.length;
    return allLayoutsOrdered[layoutIndex];
  }
  
  // Fallback: deterministic by hash
  const id = String(article.id ?? article.title ?? '');
  if (!id) {
    return ArticlePage as unknown as ArticleLayoutComponent;
  }
  const h = hashString(id);
  let layoutIndex = h % allLayoutsOrdered.length;
  
  // Skip MagazineCoverLayout for long articles
  if (layoutIndex === 3 && !isShortArticle) {
    layoutIndex = 4; // Use EditorialColumnLayout instead
  }
  
  return allLayoutsOrdered[layoutIndex];
}

/**
 * Get a specific layout by key
 */
export function getLayoutByKey(key: string): ArticleLayoutComponent | undefined {
  const found = layouts.find(l => l.key === key);
  return found?.component;
}

/**
 * Get all layout options for user selection
 */
export function getLayoutOptions(): { key: string; name: string }[] {
  return layouts.map(l => ({ key: l.key, name: l.name }));
}
