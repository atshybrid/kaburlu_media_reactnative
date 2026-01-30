/**
 * Style 4: MagazineCoverLayout - Full-bleed Magazine Cover Style
 * 
 * Features:
 * - Full-screen background image
 * - Gradient overlay for text readability
 * - Floating card at bottom with title and summary
 * - Premium magazine aesthetic
 * - NO SCROLL - Fixed layout for swipe navigation
 */

import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReaction } from '@/hooks/useReaction';
import { Feather } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
import {
  Dimensions,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleLayoutComponent } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Clamp text
const clampText = (text: string, maxChars: number) => {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

const MagazineCoverLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Tab bar visibility toggle
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

  // Format date
  const dateStr = useMemo(() => {
    const d = new Date(article.createdAt || Date.now());
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }, [article.createdAt]);

  // Get image
  const imageUrl = article.image || article.images?.[0] || null;

  // Author info
  const authorName = (article as any)?.author?.name || article.publisherName || 'Kaburlu';

  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'Feature';

  // Summary text (clamped)
  const summaryText = clampText(article.summary || article.body || '', 200);

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
    <Pressable style={styles.container} onPress={handleScreenTap}>
      {/* Full-bleed background image */}
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={styles.backgroundImage} contentFit="cover" />
      ) : (
        <View style={[styles.backgroundImage, { backgroundColor: isDark ? '#1a1a1a' : '#333' }]} />
      )}

      {/* Gradient overlay */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.4)', 'rgba(0,0,0,0.9)']}
        locations={[0, 0.4, 1]}
        style={styles.gradient}
      />

      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Text style={styles.magazineTitle}>KABURLU</Text>
        <Text style={styles.issueText}>{dateStr}</Text>
      </View>

      {/* Content at bottom */}
      <View style={[styles.contentContainer, { paddingBottom: insets.bottom + 70 }]}>
        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{categoryName.toUpperCase()}</Text>
        </View>

        {/* Headline */}
        <Text style={styles.headline} numberOfLines={3}>
          {article.title}
        </Text>

        {/* Author and reading info */}
        <View style={styles.metaRow}>
          <Text style={styles.authorText}>By {authorName}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.readTimeText}>
            {Math.ceil((article.body?.length || article.summary?.length || 500) / 1000)} min read
          </Text>
        </View>

        {/* Summary */}
        <Text style={styles.summary} numberOfLines={4}>
          {summaryText}
        </Text>

        {/* Article indicator */}
        <Text style={styles.indicatorText}>
          {index + 1} / {totalArticles}
        </Text>
      </View>

      {/* Footer engagement bar */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 8 }]}>
        {Platform.OS === 'ios' ? (
          <BlurView intensity={80} tint="dark" style={styles.blurFooter}>
            <FooterButtons 
              isLiked={isLiked} 
              likeCount={likeCount} 
              onLike={onLike} 
              onComment={onComment}
              onShare={onShare}
            />
          </BlurView>
        ) : (
          <View style={styles.androidFooter}>
            <FooterButtons 
              isLiked={isLiked} 
              likeCount={likeCount} 
              onLike={onLike} 
              onComment={onComment}
              onShare={onShare}
            />
          </View>
        )}
      </View>
    </Pressable>
  );
};

// Footer buttons component
const FooterButtons = ({ 
  isLiked, 
  likeCount, 
  onLike, 
  onComment,
  onShare,
}: { 
  isLiked: boolean; 
  likeCount: number; 
  onLike: () => void; 
  onComment: () => void;
  onShare: () => void;
}) => (
  <View style={styles.footerButtons}>
    <Pressable style={styles.footerBtn} onPress={onLike}>
      <Feather 
        name="heart" 
        size={22} 
        color={isLiked ? '#FF4757' : '#fff'} 
      />
      <Text style={styles.footerBtnText}>
        {likeCount > 0 ? likeCount : ''}
      </Text>
    </Pressable>
    
    <Pressable style={styles.footerBtn} onPress={onComment}>
      <Feather name="message-circle" size={22} color="#fff" />
    </Pressable>
    
    <Pressable style={styles.footerBtn}>
      <Feather name="bookmark" size={22} color="#fff" />
    </Pressable>
    
    <Pressable style={styles.footerBtn} onPress={onShare}>
      <Feather name="share" size={22} color="#fff" />
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    zIndex: 10,
  },
  magazineTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 4,
  },
  issueText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },

  // Content container at bottom
  contentContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
  },

  // Category
  categoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#FF4757',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },

  // Headline
  headline: {
    fontSize: 28,
    fontWeight: '900',
    color: '#fff',
    lineHeight: 34,
    marginBottom: 12,
  },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  authorText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: '500',
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.5)',
    marginHorizontal: 10,
  },
  readTimeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },

  // Summary
  summary: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },

  // Article indicator
  indicatorText: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  blurFooter: {
    overflow: 'hidden',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  androidFooter: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 8,
  },
  footerBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default MagazineCoverLayout;
