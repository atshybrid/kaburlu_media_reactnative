/**
 * Style 7: PhotoEssayLayout - Visual Story Style
 * 
 * Features:
 * - Large hero image with minimal overlay
 * - Horizontal image gallery with dots
 * - Minimal text, focus on visuals
 * - Elegant caption treatment
 * - NO SCROLL - Fixed layout for swipe navigation
 */

import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReaction } from '@/hooks/useReaction';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleLayoutComponent } from './types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Clamp text helper
const clampText = (text: string, maxChars: number) => {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

const PhotoEssayLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

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

  // Collect all images
  const images = useMemo(() => {
    const imgs: string[] = [];
    if (article.image) imgs.push(article.image);
    if (article.images && Array.isArray(article.images)) {
      article.images.forEach(img => {
        if (img && !imgs.includes(img)) imgs.push(img);
      });
    }
    return imgs.length > 0 ? imgs : [''];
  }, [article.image, article.images]);

  // Format date
  const dateStr = useMemo(() => {
    const d = new Date(article.createdAt || Date.now());
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, [article.createdAt]);

  // Author info
  const authorName = (article as any)?.author?.name || article.publisherName || 'Kaburlu';

  // Summary text clamped
  const summaryText = clampText(article.summary || article.body || '', 180);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SCREEN_WIDTH);
    setCurrentImageIndex(idx);
  };

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
      {/* Hero Image Gallery */}
      <View style={[styles.heroContainer, { paddingTop: insets.top }]}>
        <FlatList
          ref={flatListRef}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          keyExtractor={(item, i) => `${item}-${i}`}
          renderItem={({ item }) => (
            <View style={styles.heroImageWrapper}>
              {item ? (
                <Image source={{ uri: item }} style={styles.heroImage} contentFit="cover" />
              ) : (
                <View style={[styles.heroImage, { backgroundColor: isDark ? '#333' : '#ccc' }]} />
              )}
            </View>
          )}
        />
        
        {/* Image counter */}
        {images.length > 1 && (
          <View style={styles.imageCounter}>
            <Text style={styles.counterText}>
              {currentImageIndex + 1} / {images.length}
            </Text>
          </View>
        )}

        {/* Gradient overlay */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.heroGradient}
          pointerEvents="none"
        />

        {/* Dots indicator */}
        {images.length > 1 && (
          <View style={styles.dotsContainer}>
            {images.map((_, i) => (
              <View 
                key={i} 
                style={[
                  styles.dot, 
                  currentImageIndex === i && styles.dotActive
                ]} 
              />
            ))}
          </View>
        )}
      </View>

      {/* Content section */}
      <View style={[styles.contentSection, { paddingBottom: insets.bottom + 70 }]}>
        <Text style={styles.photoEssayLabel}>PHOTO ESSAY</Text>
        
        <Text style={styles.headline} numberOfLines={3}>
          {article.title}
        </Text>
        
        <View style={styles.metaRow}>
          <Text style={styles.authorText}>By {authorName}</Text>
          <View style={styles.metaDot} />
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        <Text style={styles.summary} numberOfLines={4}>
          {summaryText}
        </Text>

        <View style={styles.bottomRow}>
          <Text style={styles.indicatorText}>
            {index + 1} / {totalArticles}
          </Text>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { 
        backgroundColor: isDark ? 'rgba(0,0,0,0.95)' : 'rgba(255,255,255,0.95)',
        paddingBottom: insets.bottom + 8
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <Feather 
            name="heart" 
            size={22} 
            color={isLiked ? '#FF4757' : (isDark ? '#888' : '#666')} 
          />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            {likeCount || ''}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <Feather name="message-circle" size={22} color={isDark ? '#888' : '#666'} />
        </Pressable>
        
        <Pressable style={styles.footerBtn}>
          <Feather name="download" size={22} color={isDark ? '#888' : '#666'} />
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <Feather name="share" size={22} color={isDark ? '#888' : '#666'} />
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },

  // Hero
  heroContainer: {
    height: SCREEN_HEIGHT * 0.5,
    position: 'relative',
  },
  heroImageWrapper: {
    width: SCREEN_WIDTH,
    height: '100%',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#222',
  },
  heroGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },

  // Image counter
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  counterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },

  // Dots
  dotsContainer: {
    position: 'absolute',
    bottom: 14,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#fff',
    width: 18,
  },

  // Content section
  contentSection: {
    flex: 1,
    padding: 20,
    backgroundColor: '#000',
  },
  photoEssayLabel: {
    color: '#FF4757',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  headline: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  authorText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    marginHorizontal: 8,
  },
  dateText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  summary: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  bottomRow: {
    marginTop: 12,
  },
  indicatorText: {
    color: 'rgba(255,255,255,0.4)',
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
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.1)',
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

export default PhotoEssayLayout;
