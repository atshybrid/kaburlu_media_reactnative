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
import { useReaction } from '@/hooks/useReaction';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleLayoutComponent } from './types';
import { pickTitleColorTheme } from '@/constants/TitleColorRules';

const ACCENT_YELLOW = '#FFD93D';
const ACCENT_PINK = '#FF6B9D';

// Clamp text helper
const clampText = (text: string, maxChars: number) => {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

const TabloidBoldLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Telugu detection (glyphs need extra vertical room to avoid clipping)
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);

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
  const publisherName = article.publisherName || 'Kaburlu';

  // Summary text clamped
  const summaryText = clampText(article.summary || article.body || '', 150);

  // Get title color theme from database tags
  const themed = pickTitleColorTheme({ 
    title: article.title, 
    metaTitle: (article as any)?.metaTitle, 
    tags: (article as any)?.tags 
  });
  const tagPrimaryColor = themed?.primary || ACCENT_PINK;
  const tagSecondaryColor = themed?.secondary || ACCENT_YELLOW;

  // Headline sizing (Telugu needs a larger lineHeight)
  const headlineFontSize = 28;
  const headlineLineHeight = Math.round(headlineFontSize * (isTeluguTitle ? 1.45 : 1.25));

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
      // Use short URL if available, fallback to full URL
      const shareUrl = article.shortId 
        ? `https://s.kaburlumedia.com/${article.shortId}`
        : `https://kaburlumedia.com/article/${article.id}`;
      await Share.share({
        title: article.title,
        message: `${article.title}\n\nRead more: ${shareUrl}`,
        url: shareUrl,
      });
    } catch (error) {
      console.warn('Share failed:', error);
    }
  };

  return (
    <View style={[styles.wrapper, { paddingTop: insets.top }]}>
      <Pressable style={[styles.container, { 
        paddingBottom: insets.bottom + 70 
      }]} onPress={handleScreenTap}>
        {/* Top bar with views - only show trending if data exists */}
        <View style={styles.topBar}>
          {isTrending && (
            <View style={[styles.trendingBadge, { backgroundColor: tagPrimaryColor }]}>
              <MaterialCommunityIcons name="fire" size={14} color="#fff" />
              <Text style={styles.trendingText}>TRENDING</Text>
            </View>
          )}
          <View style={styles.viewsContainer}>
            <Feather name="eye" size={14} color='#888' />
            <Text style={styles.viewsText}>
              {formatNum(viewCount)}
            </Text>
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

        {/* Publisher row */}
        <View style={styles.publisherRow}>
          <View style={[styles.publisherAvatar, { backgroundColor: tagSecondaryColor }]}>
            <Text style={styles.publisherInitial}>
              {publisherName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.publisherName}>
            {publisherName}
          </Text>
        </View>

        {/* Side-by-side images or single large image */}
        {images.length >= 2 ? (
          <View style={styles.dualImageContainer}>
            <View style={styles.dualImageLeft}>
              <Image source={{ uri: images[0] }} style={styles.dualImage} contentFit="cover" />
            </View>
            <View style={styles.dualImageRight}>
              <Image source={{ uri: images[1] }} style={styles.dualImage} contentFit="cover" />
            </View>
          </View>
        ) : images.length === 1 ? (
          <View style={styles.singleImageContainer}>
            <Image source={{ uri: images[0] }} style={styles.singleImage} contentFit="cover" />
          </View>
        ) : null}

        {/* Summary with accent border */}
        <View style={styles.summaryContainer}>
          <LinearGradient
            colors={[tagSecondaryColor, tagPrimaryColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.summaryAccent}
          />
          <Text style={styles.summaryText} numberOfLines={5}>
            {summaryText}
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.flexSpacer} />

        {/* Source and Article indicator - always at bottom */}
        <View style={styles.bottomRow}>
          <Text style={styles.sourceText}>
            {publisherName}
          </Text>
          <Text style={styles.indicatorText}>
            {index + 1} / {totalArticles}
          </Text>
        </View>

        {/* Footer with action buttons */}
        <View style={[styles.footer, { 
          paddingBottom: insets.bottom + 8
        }]}>
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
  container: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
  },

  // Top bar
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
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
    marginBottom: 10,
  },

  // Headline
  headline: {
    fontWeight: '900',
    paddingTop: 2,
    paddingBottom: 2,
    marginTop: 6,
    marginBottom: 16,
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

  // Dual images
  dualImageContainer: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 14,
    borderRadius: 12,
    overflow: 'hidden',
  },
  dualImageLeft: {
    flex: 1,
    aspectRatio: 1,
  },
  dualImageRight: {
    flex: 1,
    aspectRatio: 1,
  },
  dualImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#333',
  },

  // Single image
  singleImageContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
  },
  singleImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#333',
  },

  // Summary
  summaryContainer: {
    flexDirection: 'row',
    marginBottom: 14,
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

  // Flex spacer
  flexSpacer: {
    flex: 1,
  },

  // Bottom row
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    marginBottom: 8,
    borderTopWidth: 1,
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 40,
    borderTopWidth: 1,
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
