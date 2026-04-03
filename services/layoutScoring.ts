import { Dimensions } from 'react-native';

import type { Article } from '@/types';

export type LayoutKey =
  | 'articlePage'
  | 'layoutTwo'
  | 'broadsheet'
  | 'editorialColumn'
  | 'breakingNews'
  | 'tabloidBold';

type DeviceProfile = {
  width: number;
  height: number;
  isTablet: boolean;
  isCompact: boolean;
};

type ArticleFeatures = {
  wordCount: number;
  titleWords: number;
  hasVideo: boolean;
  imageCount: number;
  hasMultipleImages: boolean;
  hasTeluguScript: boolean;
  urgencyScore: number;
  opinionScore: number;
  trendingScore: number;
};

const LAYOUT_KEYS: LayoutKey[] = [
  'articlePage',
  'layoutTwo',
  'broadsheet',
  'editorialColumn',
  'breakingNews',
  'tabloidBold',
];

function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function getDeviceProfile(): DeviceProfile {
  const { width, height } = Dimensions.get('window');
  return {
    width,
    height,
    isTablet: width >= 768,
    isCompact: width <= 360 || height <= 680,
  };
}

function toWords(text?: string): string[] {
  return String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function extractArticleFeatures(article: Article): ArticleFeatures {
  const title = String(article.title || '');
  const summary = String(article.summary || '');
  const body = String(article.body || '');
  const category = String((article as any)?.category?.name || article.category || '').toLowerCase();
  const tags = Array.isArray((article as any)?.tags)
    ? ((article as any).tags as string[]).map((t) => String(t).toLowerCase())
    : [];

  const content = `${summary} ${body}`.trim();
  const words = toWords(content);
  const titleWords = toWords(title).length;

  const videoUrlRaw = String((article as any).videoUrl || '').trim();
  const hasVideo = !!videoUrlRaw
    && videoUrlRaw !== 'null'
    && videoUrlRaw !== 'undefined'
    && /(mp4|m3u8|webm|video|stream|cdn)/i.test(videoUrlRaw);

  const images = [article.image, ...(Array.isArray(article.images) ? article.images : [])]
    .map((x) => String(x || '').trim())
    .filter(Boolean);

  const hasTeluguScript = /[\u0C00-\u0C7F]/.test(`${title} ${content}`);

  const urgentSignals = [
    'breaking', 'alert', 'live', 'urgent', 'flash', 'exclusive',
  ];
  const opinionSignals = [
    'opinion', 'editorial', 'analysis', 'column', 'guest',
  ];
  const trendingSignals = [
    'trending', 'viral', 'hot', 'buzz', 'popular',
  ];

  const scoreFromSignals = (signals: string[]) => {
    const hay = `${title.toLowerCase()} ${category} ${tags.join(' ')}`;
    return signals.reduce((acc, s) => (hay.includes(s) ? acc + 1 : acc), 0);
  };

  return {
    wordCount: words.length,
    titleWords,
    hasVideo,
    imageCount: images.length,
    hasMultipleImages: images.length >= 2,
    hasTeluguScript,
    urgencyScore: scoreFromSignals(urgentSignals),
    opinionScore: scoreFromSignals(opinionSignals),
    trendingScore: scoreFromSignals(trendingSignals),
  };
}

function buildScores(features: ArticleFeatures, device: DeviceProfile): Record<LayoutKey, number> {
  const {
    wordCount,
    hasVideo,
    hasMultipleImages,
    imageCount,
    urgencyScore,
    opinionScore,
    trendingScore,
    hasTeluguScript,
    titleWords,
  } = features;

  const longForm = wordCount >= 110;
  const mediumForm = wordCount >= 60 && wordCount < 110;
  const shortForm = wordCount < 45;

  const scores: Record<LayoutKey, number> = {
    articlePage: 1.4,
    layoutTwo: 1.3,
    broadsheet: 1.1,
    editorialColumn: 1.0,
    breakingNews: 1.0,
    tabloidBold: 1.0,
  };

  if (hasVideo) scores.articlePage += 10;

  if (longForm) {
    scores.articlePage += 1.1;
    scores.broadsheet += 1.8;
    scores.editorialColumn += 1.3;
  }

  if (mediumForm) {
    scores.layoutTwo += 1.2;
    scores.broadsheet += 1.0;
    scores.articlePage += 0.5;
  }

  if (shortForm) {
    scores.breakingNews += 1.4;
    scores.tabloidBold += 1.8;
    scores.layoutTwo += 0.4;
  }

  if (urgencyScore > 0) {
    scores.breakingNews += 2.2 + urgencyScore * 0.8;
    scores.tabloidBold += 0.6;
  }

  if (opinionScore > 0) {
    scores.editorialColumn += 2.0 + opinionScore * 0.6;
    scores.broadsheet += 0.8;
  }

  if (trendingScore > 0) {
    scores.tabloidBold += 1.7 + trendingScore * 0.5;
    scores.breakingNews += 0.6;
  }

  if (hasMultipleImages) {
    scores.tabloidBold += 1.1;
    scores.articlePage += 0.5;
  }

  if (!imageCount) {
    scores.editorialColumn += 0.9;
    scores.broadsheet += 0.6;
    scores.tabloidBold -= 0.6;
  }

  if (hasTeluguScript) {
    scores.layoutTwo += 1.0;
    scores.broadsheet += 0.5;
  }

  if (titleWords <= 6) {
    scores.tabloidBold += 0.7;
    scores.breakingNews += 0.6;
  }

  if (device.isCompact) {
    scores.articlePage += 0.7;
    scores.layoutTwo += 0.6;
    scores.editorialColumn -= 0.4;
  }

  if (device.isTablet) {
    scores.broadsheet += 0.9;
    scores.editorialColumn += 0.7;
    scores.layoutTwo += 0.4;
  }

  return scores;
}

export function pickBestLayoutKey(article: Article): LayoutKey {
  const features = extractArticleFeatures(article);
  if (features.hasVideo) return 'articlePage';

  const scores = buildScores(features, getDeviceProfile());

  const seed = String(article.id || article.title || Date.now());
  const jitter = (hashString(seed) % 100) / 1000;

  let bestKey: LayoutKey = 'articlePage';
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const key of LAYOUT_KEYS) {
    const score = scores[key] + jitter;
    if (score > bestScore) {
      bestScore = score;
      bestKey = key;
    }
  }

  return bestKey;
}
