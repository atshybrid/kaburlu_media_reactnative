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
import { MaterialCommunityIcons } from '@expo/vector-icons';
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
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { ArticleLayoutComponent } from './types';
import {
  useFonts,
  NotoSerifTelugu_700Bold,
} from '@expo-google-fonts/noto-serif-telugu';
import {
  NotoSansTelugu_400Regular,
} from '@expo-google-fonts/noto-sans-telugu';
import { pickTitleColorTheme } from '@/constants/TitleColorRules';

const BREAKING_RED = '#DC2626';

const BreakingNewsLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const [fontsLoaded] = useFonts({
    NotoSerifTelugu_700Bold,
    NotoSansTelugu_400Regular,
  });

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

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

  // Fade-in animation
  const [fadeAnim] = useState(new Animated.Value(0));
  
  // Pulsing animation for live indicator
  const [pulseAnim] = useState(new Animated.Value(1));
  
  // Slide animation for breaking banner
  const [slideAnim] = useState(new Animated.Value(-100));

  useEffect(() => {
    // Fade in content
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    // Slide in banner
    Animated.spring(slideAnim, {
      toValue: 0,
      tension: 50,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Pulse animation
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
  }, [pulseAnim, fadeAnim, slideAnim]);

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

  // Telugu detection
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);
  const isTeluguBody = isTelugu(articleText);

  // Word count for dynamic sizing
  const wordCount = articleText.split(/\s+/).filter(w => w.length > 0).length;

  // Dynamic sizing
  const titleSize = 24;
  const titleLineHeight = Math.round(titleSize * (isTeluguTitle ? 1.50 : 1.35));
  const bodySize = 15;
  const bodyLineHeight = Math.round(bodySize * 1.70);

  // Dynamic image height based on word count
  const imageHeight = (() => {
    if (wordCount >= 50) return Math.round((windowWidth - 40) * 0.45);  // 45% for long articles
    if (wordCount >= 35) return Math.round((windowWidth - 40) * 0.55);  // 55% for medium
    return Math.round((windowWidth - 40) * 0.65);  // 65% for short articles
  })();

  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'Breaking';

  // Location
  const location = (article as any)?.author?.placeName || (article as any)?.placeName || '';

  // Get title color theme from database tags
  const themed = pickTitleColorTheme({ 
    title: article.title, 
    metaTitle: (article as any)?.metaTitle, 
    tags: (article as any)?.tags 
  });
  const tagColor = themed?.primary || BREAKING_RED;

  if (!fontsLoaded) return null;

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
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim, backgroundColor: '#fff' }]}>
      <Pressable style={[styles.container, { backgroundColor: '#fff' }]} onPress={handleScreenTap}>
        {/* Breaking Banner - Animated with tag color */}
        <Animated.View style={[
          styles.breakingBanner, 
          { 
            paddingTop: insets.top,
            backgroundColor: tagColor,
            transform: [{ translateY: slideAnim }]
          }
        ]}>
          <View style={styles.breakingInner}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.breakingText}>BREAKING NEWS</Text>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
          </View>
        </Animated.View>

      {/* Main Content - WHITE BACKGROUND */}
      <View style={[styles.content, { paddingBottom: insets.bottom + 70, backgroundColor: '#fff' }]}>
        {/* Update timestamp and category */}
        <View style={styles.updateRow}>
          <View style={[styles.categoryBadge, { backgroundColor: tagColor }]}>
            <Text style={styles.categoryText}>{categoryName.toUpperCase()}</Text>
          </View>
          <MaterialCommunityIcons name="clock-outline" size={14} color={tagColor} />
          <Text style={styles.updateText}>{timeAgo}</Text>
          {location && (
            <>
              <View style={styles.updateDot} />
              <MaterialCommunityIcons name="map-marker" size={13} color="#64748B" />
              <Text style={styles.locationText} numberOfLines={1}>{location}</Text>
            </>
          )}
        </View>

        {/* Headline - WHITE BACKGROUND with tag color accent */}
        <Text 
          style={[
            styles.headline, 
            { 
              color: '#0F172A',
              fontSize: titleSize,
              lineHeight: titleLineHeight,
              backgroundColor: '#fff',
            },
            isTeluguTitle && { fontFamily: 'NotoSerifTelugu_700Bold' },
          ]} 
          numberOfLines={3}
        >
          {article.title}
        </Text>

        {/* Image - Dynamic height based on word count */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: imageUrl }} 
              style={[styles.image, { height: imageHeight }]} 
              contentFit="cover" 
            />
            <View style={[styles.liveTag, { backgroundColor: tagColor }]}>
              <Animated.View style={[styles.liveTagDot, { opacity: pulseAnim }]} />
              <Text style={styles.liveTagText}>LIVE</Text>
            </View>
          </View>
        )}

        {/* Article Text - WHITE BACKGROUND with tag color border */}
        <View style={[styles.articleTextSection, { 
          backgroundColor: '#F1F5F9',
          borderLeftColor: tagColor
        }]}>
          <Text 
            style={[
              styles.articleText, 
              { 
                color: '#334155',
                fontSize: bodySize,
                lineHeight: bodyLineHeight,
              },
              isTeluguBody && { fontFamily: 'NotoSansTelugu_400Regular' },
            ]} 
            numberOfLines={10}
          >
            {articleText}
          </Text>
        </View>

        {/* Spacer */}
        <View style={styles.flexSpacer} />

        {/* Counter and source - always at bottom */}
        <View style={[styles.bottomRow, { borderTopColor: '#eee' }]}>
          <Text style={[styles.sourceText, { color: '#999' }]}>
            {article.publisherName || 'Kaburlu News'}
          </Text>
          <Text style={[styles.counterText, { color: '#bbb' }]}>
            {index + 1} / {totalArticles}
          </Text>
        </View>
      </View>

      {/* Footer with tag color */}
      <View style={[styles.footer, { 
        backgroundColor: '#fff',
        borderTopColor: tagColor,
        paddingBottom: insets.bottom + 8
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <MaterialCommunityIcons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={22} 
            color={isLiked ? tagColor : '#94A3B8'} 
          />
          <Text style={[styles.footerBtnText, { color: '#94A3B8' }]}>
            {likeCount || ''}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <MaterialCommunityIcons name="comment-outline" size={22} color='#94A3B8' />
        </Pressable>
        
        <Pressable style={[styles.followBtn, { backgroundColor: tagColor }]}>
          <MaterialCommunityIcons name="bell" size={16} color="#fff" />
          <Text style={styles.followBtnText}>Follow</Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <MaterialCommunityIcons name="share-variant" size={22} color='#94A3B8' />
        </Pressable>
      </View>
    </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
  },

  // Breaking Banner - Animated
  breakingBanner: {
    paddingBottom: 10,
  },
  breakingInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  breakingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 2.5,
  },

  // Main content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Update row
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 8,
    flexWrap: 'wrap',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  categoryText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
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
    backgroundColor: '#94A3B8',
    marginHorizontal: 4,
  },
  locationText: {
    color: '#64748B',
    fontSize: 12,
    flex: 1,
  },

  // Headline - Beautiful styling
  headline: {
    fontWeight: '900',
    marginBottom: 16,
    letterSpacing: -0.5,
    paddingVertical: 8,
  },

  // Image - Dynamic height
  imageContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  image: {
    width: '100%',
    backgroundColor: '#1E293B',
  },
  liveTag: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveTagDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#fff',
  },
  liveTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // Article Text Section
  articleTextSection: {
    padding: 16,
    borderRadius: 10,
    borderLeftWidth: 4,
    marginBottom: 12,
  },
  articleText: {
    letterSpacing: 0.2,
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
    borderTopColor: '#E2E8F0',
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
    paddingVertical: 12,
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
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  followBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
});

export default BreakingNewsLayout;
