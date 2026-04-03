import type { Article } from '@/types';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.media.kaburlu&hl=en_IN';
const SHORT_BASE_URL = 'https://s.kaburlumedia.com';

export type SharePayload = {
  title: string;
  url: string;
  message: string;
};

function deriveShortSlug(article: Article): string {
  const shortId = String(article.shortId || '').trim();
  if (shortId) return shortId;

  const rawId = String(article.id || '').trim();
  if (!rawId) return '';

  // Backend fallback resolver expects >=6 alphanumeric chars.
  const compact = rawId.replace(/[^a-zA-Z0-9]/g, '');
  if (compact.length < 6) return compact;
  return compact.slice(-6);
}

export function buildArticleSharePayload(article: Article): SharePayload {
  const title = String(article.metaTitle || article.title || 'Kaburlu').trim();
  const slug = deriveShortSlug(article);
  const url = slug
    ? `${SHORT_BASE_URL}/${encodeURIComponent(slug)}`
    : SHORT_BASE_URL;

  const message = [
    title,
    '',
    url,
    '',
    'Install Kaburlu App:',
    PLAY_STORE_URL,
  ].join('\n');

  return { title, url, message };
}
