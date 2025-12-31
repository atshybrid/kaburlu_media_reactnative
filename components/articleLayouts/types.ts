import type { Article } from '@/types';

export interface ArticleLayoutProps {
  article: Article;
  index: number;
  totalArticles: number;
}

export type ArticleLayoutComponent = React.FC<ArticleLayoutProps>;
