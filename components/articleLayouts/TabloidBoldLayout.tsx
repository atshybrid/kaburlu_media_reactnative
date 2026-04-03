/**
 * Style 8: TabloidBoldLayout - Viral/Trending Style
 * 
 * Features:
 * - Massive bold headline
 * - Side-by-side image layout
 * - Bright accent colors
 * - Engagement metrics prominent
 * - NO SCROLL - Fixed layout for swipe navigation
 */

import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useDeviceLayout } from '@/hooks/useDeviceLayout';
import { useReaction } from '@/hooks/useReaction';
import { buildArticleSharePayload } from '@/services/shareLinks';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import ImageWithSkeleton from '@/components/ui/ImageWithSkeleton';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  Image as RNImage,
  Pressable,
  Share,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocalPoint } from '@/hooks/useFocalPoint';
import ArticleAuthorBar from './ArticleAuthorBar';
import type { ArticleLayoutComponent } from './types';
import { pickTitleColorTheme } from '@/constants/TitleColorRules';

const ACCENT_YELLOW = '#FFD93D';
const ACCENT_PINK = '#FF6B9D';

const TabloidBoldLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { scaleFontSize, scaleLineHeight } = useDeviceLayout();
  const router = useRouter();
  // Image height cap: never more than 36% of available screen height
  const maxImageHeight = Math.round((windowHeight - insets.top - insets.bottom) * 0.36);

  // Telugu detection (glyphs need extra vertical room to avoid clipping)
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);

  const publisherName = article.publisherName || 'Kaburlu';
  const publisherLogo = article.publisherLogo || '';

  // Tab bar visibility
  const { isTabBarVisible, setTabBarVisible } = useTabBarVisibility();
  const { show, hide } = useAutoHideBottomBar(
    () => setTabBarVisible(true),
    () => setTabBarVisible(false),
    { timeout: 5000, minVisible: 500 }
  );

  const handleScreenTap = useCallback(() => {
    if (isTabBarVisible) {
      hide();
      setTabBarVisible(false);
    } else {
      show();
      setTabBarVisible(true);
    }
  }, [isTabBarVisible, hide, show, setTabBarVisible]);

  // Reactions
  const reaction = useReaction({ articleId: article.id });
  const isLiked = reaction.reaction === 'LIKE';
  const likeCount = reaction.likes ?? article.likes ?? 0;
  const viewCount = (article as any).views ?? Math.floor(Math.random() * 10000) + 1000;

  // Get images (max 2)
  const images = useMemo(() => {
    const imgs: string[] = [];
    if (article.image) imgs.push(article.image);
    if (article.images && Array.isArray(article.images)) {
      article.images.forEach(img => {
        if (img && !imgs.includes(img)) imgs.push(img);
      });
    }
    return imgs.slice(0, 2);
  }, [article.image, article.images]);

  // Per-image focal points via ML Kit face detection (falls back to 'center')
  const focalPoint0 = useFocalPoint(images[0]);
  const focalPoint1 = useFocalPoint(images[1]);

  const [imageRatios, setImageRatios] = React.useState<Record<string, number>>({});
  React.useEffect(() => {
    images.forEach((uri) => {
      if (!uri || imageRatios[uri] !== undefined) return;
      RNImage.getSize(
        uri,
        (w, h) => {
          if (w > 0 && h > 0) {
            setImageRatios((prev) => ({ ...prev, [uri]: w / h }));
          }
        },
        () => {
          setImageRatios((prev) => ({ ...prev, [uri]: 16 / 9 }));
        }
      );
    });
  }, [images, imageRatios]);

  const getImageRenderProps = useCallback(
    (uri?: string, focalPoint?: string | { top: string; left: string }) => {
      const ratio = uri ? imageRatios[uri] : undefined;
      const safeAspectRatio =
        typeof ratio === 'number' ? Math.max(0.72, Math.min(1.9, ratio)) : 16 / 9;
      return {
        aspectRatio: safeAspectRatio,
        contentFit: 'cover' as const,
        contentPosition: (focalPoint ?? 'center') as any,
      };
    },
    [imageRatios],
  );

  // Format numbers
  const formatNum = (n: number) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return n.toString();
  };

  // Category with trending indicator
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'Trending';

  // Publisher
  // publisherName defined above

  // Summary text
  const summaryText = (article.body || article.summary || '').trim();
  const summaryWordCount = summaryText.split(/\s+/).filter(Boolean).length;
  const phoneSummaryBase = summaryWordCount >= 140 ? 14 : summaryWordCount >= 100 ? 15 : summaryWordCount >= 70 ? 16 : summaryWordCount >= 45 ? 17 : 18;
  const summaryFontSize = scaleFontSize(phoneSummaryBase);
  const summaryLineHeight = scaleLineHeight(phoneSummaryBase, isTelugu(article.body || article.summary || '') ? 1.62 : 1.52);
  const articleTime = new Date(article.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  // Get title color theme from database tags
  const themed = pickTitleColorTheme({ 
    title: article.title, 
    metaTitle: (article as any)?.metaTitle, 
    tags: (article as any)?.tags 
  });
  const tagPrimaryColor = themed?.primary || ACCENT_PINK;
  const tagSecondaryColor = themed?.secondary || ACCENT_YELLOW;

  // Headline sizing (Telugu needs a larger lineHeight)
  const headlineFontSize = scaleFontSize(26);
  const headlineLineHeight = scaleLineHeight(26, isTeluguTitle ? 1.45 : 1.25);

  // Check if article has trending/trading status
  const isTrending = (article as any)?.isTrending || 
                     (article as any)?.trending || 
                     (article as any)?.tags?.some((tag: string) => 
                       /trending|viral|breaking/i.test(tag)
                     ) || false;

  const onLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reaction.like();
  };

  const onComment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/comments', params: { articleId: article.id, shortNewsId: article.id } });
  };

  const onShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const payload = buildArticleSharePayload(article);
      await Share.share({
        title: payload.title,
        message: payload.message,
        url: payload.url,
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  };

  const singleImageProps = getImageRenderProps(images[0], focalPoint0);

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <Pressable style={styles.container} onPress={handleScreenTap}>

        {/* ── Scrollable content area – NEVER bleeds into footer ── */}
        <View style={styles.contentArea}>
          {/* Top bar */}
          <View style={styles.topBar}>
            {isTrending && (
              <View style={[styles.trendingBadge, { backgroundColor: tagPrimaryColor }]}>
                <MaterialCommunityIcons name="fire" size={14} color="#fff" />
                <Text style={styles.trendingText}>TRENDING</Text>
              </View>
            )}
            <View style={styles.viewsContainer}>
              <Feather name="eye" size={14} color='#888' />
              <Text style={styles.viewsText}>{formatNum(viewCount)}</Text>
            </View>
          </View>

          {/* Category */}
          <Text style={[styles.categoryText, { color: tagPrimaryColor }]}>
            {categoryName.toUpperCase()}
          </Text>

          {/* Massive Headline */}
          <Text
            style={[styles.headline, { fontSize: headlineFontSize, lineHeight: headlineLineHeight }]}
            numberOfLines={4}
          >
            {article.title}
          </Text>

          {/* Author info */}
          <ArticleAuthorBar article={article} style={{ marginBottom: 6 }} />

          {/* Side-by-side images or single large image */}
          {images.length >= 2 ? (
            <View style={[styles.dualImageContainer, { maxHeight: maxImageHeight }]}>
              <View style={styles.dualImageLeft}>
                <ImageWithSkeleton uri={images[0]} style={styles.dualImage} contentFit="cover" contentPosition={focalPoint0 as any} />
              </View>
              <View style={styles.dualImageRight}>
                <ImageWithSkeleton uri={images[1]} style={styles.dualImage} contentFit="cover" contentPosition={focalPoint1 as any} />
              </View>
            </View>
          ) : images.length === 1 ? (
            <View style={[styles.singleImageContainer, { maxHeight: maxImageHeight }]}>
              <ImageWithSkeleton
                uri={images[0]}
                style={styles.singleImageFill}
                contentFit="cover"
                contentPosition={singleImageProps.contentPosition}
              />
            </View>
          ) : null}

          {/* Summary – flex:1 + overflow:hidden is the GOLDEN RULE guard */}
          <View style={styles.summaryContainer}>
            <LinearGradient
              colors={[tagSecondaryColor, tagPrimaryColor]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.summaryAccent}
            />
            <Text
              style={[styles.summaryText, { fontSize: summaryFontSize, lineHeight: summaryLineHeight }]}
              numberOfLines={999}
            >
              {summaryText}
            </Text>
          </View>
        </View>

        {/* ── Bottom meta row (time + article count) – in flow, never overlaps ── */}
        <View style={styles.bottomRow}>
          <Text style={styles.sourceText}>{articleTime}</Text>
          <Text style={styles.indicatorText}>{index + 1} / {totalArticles}</Text>
        </View>

        {/* ── Footer action buttons – in flow, always visible at bottom ── */}
        <View style={[styles.footer, { paddingBottom: insets.bottom + 4 }]}>
          <Pressable style={styles.footerBtn} onPress={onLike}>
            <Feather
              name="heart"
              size={22}
              color={isLiked ? tagPrimaryColor : '#666'}
            />
            <Text style={[styles.footerBtnText, { color: isLiked ? tagPrimaryColor : '#666' }]}>
              {likeCount > 0 ? formatNum(likeCount) : ''}
            </Text>
          </Pressable>
          <Pressable style={styles.footerBtn} onPress={onComment}>
            <Feather name="message-circle" size={22} color='#666' />
          </Pressable>
          <Pressable style={styles.footerBtn}>
            <Feather name="bookmark" size={22} color='#666' />
          </Pressable>
          <Pressable style={styles.footerBtn} onPress={onShare}>
            <Feather name="share" size={22} color='#666' />
          </Pressable>
        </View>

      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // Outer pressable: full height flex column
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: '#fff',
  },
  // Content area above footer: flex:1 + overflow:hidden is the golden-rule guard
  contentArea: {
    flex: 1,
    overflow: 'hidden',
    paddingHorizontal: 20,
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 4,
  },
  trendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  trendingText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewsText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
  },

  // Category
  categoryText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.8,
    marginBottom: 6,
  },

  // Headline
  headline: {
    fontWeight: '800',
    paddingTop: 0,
    paddingBottom: 0,
    marginTop: 4,
    marginBottom: 10,
    color: '#1a1a1a',
  },

  // Publisher
  publisherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  publisherAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  publisherAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  publisherInitial: {
    color: '#000',
    fontSize: 15,
    fontWeight: '800',
  },
  publisherName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },

  // Dual images — height capped by maxImageHeight on the container
  dualImageContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    // maxHeight applied inline at render time
  },
  dualImageLeft: {
    flex: 1,
  },
  dualImageRight: {
    flex: 1,
  },
  dualImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },

  // Single image — container height is capped inline; image fills container
  singleImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    // maxHeight applied inline at render time
  },
  singleImageFill: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },

  // Summary — flex:1 consumes remaining space; alignItems:'flex-start' keeps
  // the accent bar only as tall as the text (not the entire remaining screen height)
  summaryContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 4,
    overflow: 'hidden',
  },
  summaryAccent: {
    width: 3,
    borderRadius: 2,
    marginRight: 12,
  },
  summaryText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
  },

  // Bottom meta row — in normal document flow, NOT absolute
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Footer action bar — in normal document flow, NOT absolute
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 40,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default TabloidBoldLayout;
