/**
 * Style 6: BreakingNewsLayout - Urgent News Alert Style
 * 
 * Features:
 * - Red "BREAKING" banner at top
 * - Live indicator with pulsing dot
 * - Key points as bullet list
 * - Timestamp with "Updated X ago"
 * - NO SCROLL - Fixed layout for swipe navigation
 */

import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReaction } from '@/hooks/useReaction';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleLayoutComponent } from './types';

const BREAKING_RED = '#DC2626';

const BreakingNewsLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();

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

  // Pulsing animation for live indicator
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // Reactions
  const reaction = useReaction({ articleId: article.id });
  const isLiked = reaction.reaction === 'LIKE';
  const likeCount = reaction.likes ?? article.likes ?? 0;

  // Time ago
  const timeAgo = useMemo(() => {
    const now = Date.now();
    const created = new Date(article.createdAt || now).getTime();
    const diffMs = now - created;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  }, [article.createdAt]);

  // Get image
  const imageUrl = article.image || article.images?.[0] || null;

  // Article text (max 60 words)
  const articleText = useMemo(() => {
    const body = article.body || article.summary || '';
    const words = body.split(/\s+/).filter(w => w.length > 0);
    if (words.length <= 60) return body.trim();
    return words.slice(0, 60).join(' ') + '…';
  }, [article.body, article.summary]);

  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'Breaking';

  // Location
  const location = (article as any)?.author?.placeName || (article as any)?.placeName || '';

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
    <Pressable style={[styles.container, { backgroundColor: isDark ? '#0a0a0a' : '#fff' }]} onPress={handleScreenTap}>
      {/* Breaking Banner */}
      <View style={[styles.breakingBanner, { paddingTop: insets.top }]}>
        <View style={styles.breakingInner}>
          <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
          <Text style={styles.breakingText}>BREAKING NEWS</Text>
        </View>
      </View>

      {/* Main Content */}
      <View style={[styles.content, { paddingBottom: insets.bottom + 70 }]}>
        {/* Update timestamp and category */}
        <View style={styles.updateRow}>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{categoryName.toUpperCase()}</Text>
          </View>
          <Feather name="clock" size={13} color={BREAKING_RED} />
          <Text style={styles.updateText}>{timeAgo}</Text>
          {location && (
            <>
              <View style={styles.updateDot} />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
            </>
          )}
        </View>

        {/* Headline */}
        <Text style={[styles.headline, { color: isDark ? '#fff' : '#1a1a1a' }]} numberOfLines={3}>
          {article.title}
        </Text>

        {/* Image */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
            <View style={styles.liveTag}>
              <Animated.View style={[styles.liveTagDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          </View>
        )}

        {/* Article Text */}
        <View style={[styles.articleTextSection, { 
          backgroundColor: isDark ? '#1a1a1a' : '#fafafa',
          borderLeftColor: BREAKING_RED
        }]}>
          <Text style={[styles.articleText, { color: isDark ? '#ddd' : '#333' }]} numberOfLines={8}>
            {articleText}
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.flexSpacer} />

        {/* Counter and source - always at bottom */}
        <View style={[styles.bottomRow, { borderTopColor: isDark ? '#333' : '#eee' }]}>
          <Text style={[styles.sourceText, { color: isDark ? '#666' : '#999' }]}>
            {article.publisherName || 'Kaburlu News'}
          </Text>
          <Text style={[styles.counterText, { color: isDark ? '#444' : '#bbb' }]}>
            {index + 1} / {totalArticles}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#0a0a0a' : '#fff',
        borderTopColor: BREAKING_RED,
        paddingBottom: insets.bottom + 8
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <Feather 
            name="heart" 
            size={20} 
            color={isLiked ? BREAKING_RED : (isDark ? '#888' : '#666')} 
          />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            {likeCount || ''}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <Feather name="message-circle" size={20} color={isDark ? '#888' : '#666'} />
        </Pressable>
        
        <Pressable style={[styles.followBtn]}>
          <Feather name="bell" size={14} color="#fff" />
          <Text style={styles.followBtnText}>Follow</Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <Feather name="share" size={20} color={isDark ? '#888' : '#666'} />
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // Breaking Banner
  breakingBanner: {
    backgroundColor: BREAKING_RED,
    paddingBottom: 8,
  },
  breakingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  breakingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 2,
  },

  // Main content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
  },

  // Update row
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    backgroundColor: BREAKING_RED,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  updateText: {
    color: BREAKING_RED,
    fontSize: 12,
    fontWeight: '700',
  },
  updateDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#999',
    marginHorizontal: 4,
  },
  locationText: {
    color: '#888',
    fontSize: 12,
    flex: 1,
  },

  // Headline
  headline: {
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 28,
    marginBottom: 14,
  },

  // Image
  imageContainer: {
    marginBottom: 14,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#222',
  },
  liveTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: BREAKING_RED,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  liveTagDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveTagText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },

  // Article Text Section
  articleTextSection: {
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  articleText: {
    fontSize: 15,
    lineHeight: 24,
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
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  sourceText: {
    fontSize: 12,
    fontWeight: '500',
  },
  counterText: {
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
    paddingVertical: 10,
    borderTopWidth: 3,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    padding: 8,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BREAKING_RED,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default BreakingNewsLayout;
