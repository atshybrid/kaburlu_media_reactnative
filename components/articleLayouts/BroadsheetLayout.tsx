/**
 * Style 3: BroadsheetLayout - Premium Newspaper Edition
 * 
 * Features:
 * - Centered elegant masthead
 * - Auto line height (leading) based on font size
 * - 16:9 responsive images with smart sizing
 * - Professional author section with avatar
 * - Hyphenate & Justify text (very narrow columns)
 * - Modern Material icons
 * - Industry-standard typography
 */

import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useReaction } from '@/hooks/useReaction';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useCallback, useMemo } from 'react';
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

// Professional color palette
const THEME = {
  primary: '#1F2937',
  secondary: '#6B7280',
  accent: '#DC2626',
  border: '#E5E7EB',
  lightBg: '#FAFBFC',
  darkBg: '#111827',
};

// Smart text utilities

const clampWords = (text: string, maxWords: number) => {
  if (!text) return '';
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '…';
};

const BroadsheetLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  // Fade-in animation
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const isDisliked = reaction.reaction === 'DISLIKE';
  const likeCount = reaction.likes ?? article.likes ?? 0;
  const dislikeCount = reaction.dislikes ?? article.dislikes ?? 0;

  // Format date
  const dateStr = useMemo(() => {
    const d = new Date(article.createdAt || Date.now());
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    };
    return d.toLocaleDateString('en-IN', options);
  }, [article.createdAt]);

  // 16:9 responsive image sizing
  const imageHeight = useMemo(() => {
    const contentWidth = windowWidth - 40; // Account for padding
    return Math.round(contentWidth * (9/16));
  }, [windowWidth]);
  // Check if Telugu content
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);
  const isTeluguBody = isTelugu(article.body || article.summary);
  // Body text with smart word limiting - 60 words max
  const bodyText = clampWords(article.body || article.summary || '', 60);

  // Get image
  const imageUrl = article.image || article.images?.[0] || null;

  // Author info (simplified for Style 3)
  const authorName = (article as any)?.author?.name || article.publisherName || 'Staff Reporter';
  const authorPlace = (article as any)?.author?.placeName || '';

  // Auto line height calculation - reduced for mobile fit
  const titleSize = 26;  // Reduced from 32
  const titleLineHeight = Math.round(titleSize * 1.30);  // Increased multiplier for better spacing
  const bodySize = 15;  // Reduced from 16
  const bodyLineHeight = Math.round(bodySize * 1.60);

  const onLike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reaction.like();
  };

  const onDislike = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    reaction.dislike();
  };

  const onComment = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({ pathname: '/comments', params: { articleId: article.id, shortNewsId: article.id } });
  };

  const onShare = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
    <Pressable 
      style={[styles.innerContainer, { 
        backgroundColor: isDark ? THEME.darkBg : '#FFFFFF',
        paddingTop: insets.top + 8,
      }]}
      onPress={handleScreenTap}
    >
      {/* Premium Masthead - Centered */}
      <View style={styles.masthead}>
        <View style={[styles.mastheadTopLine, { backgroundColor: isDark ? '#444' : THEME.primary }]} />
        <Text style={[styles.mastheadTitle, { color: isDark ? '#fff' : THEME.primary }]}>
          KABURLU
        </Text>
        <Text style={[styles.mastheadSubtitle, { color: isDark ? '#888' : THEME.secondary }]}>
          Premium Edition
        </Text>
        <Text style={[styles.mastheadDate, { color: isDark ? '#888' : THEME.secondary }]}>
          {dateStr}
        </Text>
        <View style={[styles.mastheadBottomLine, { backgroundColor: isDark ? '#444' : THEME.primary }]} />
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Headline - Centered with Auto Leading */}
        <Text 
          style={[styles.headline, { 
            color: isDark ? '#fff' : THEME.primary,
            fontSize: titleSize,
            lineHeight: titleLineHeight,
          },
          // Telugu fonts like Style 1
          isTeluguTitle && { fontFamily: 'NotoSerifTelugu_700Bold' },
          ]}
          numberOfLines={3}
        >
          {article.title}
        </Text>

        {/* Author Section - Simple */}
        <View style={styles.authorSimple}>
          <Text style={[styles.authorText, { color: isDark ? '#9CA3AF' : THEME.secondary }]}>
            {authorName}{authorPlace ? ` • ${authorPlace}` : ''}
          </Text>
        </View>

        {/* 16:9 Responsive Image */}
        {imageUrl && (
          <View style={[styles.imageContainer, { height: imageHeight }]}>
            <Image 
              source={{ uri: imageUrl }} 
              style={styles.image} 
              contentFit="cover"
            />
          </View>
        )}

        {/* Body Text - Simple Clean Style */}
        <Text 
          style={[styles.bodyText, { 
            color: isDark ? '#D1D5DB' : '#374151',
            fontSize: bodySize,
            lineHeight: bodyLineHeight,
          },
          // Telugu fonts like Style 1
          isTeluguBody && { fontFamily: 'NotoSansTelugu_400Regular' },
          ]}
        >
          {bodyText}
        </Text>
      </View>

      {/* Footer Engagement Bar - Modern Design */}
      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#1F2937' : THEME.lightBg,
        borderTopColor: isDark ? '#374151' : THEME.border,
        paddingBottom: insets.bottom + 10,
      }]}>
        <View style={styles.engagementGroup}>
          <Pressable 
            style={[styles.footerBtn, isLiked && styles.footerBtnActive]}
            onPress={onLike}
          >
            <MaterialCommunityIcons 
              name={isLiked ? "thumb-up" : "thumb-up-outline"} 
              size={24} 
              color={isLiked ? THEME.accent : (isDark ? '#9CA3AF' : THEME.secondary)} 
            />
            <Text style={[styles.footerBtnText, { color: isLiked ? THEME.accent : (isDark ? '#9CA3AF' : THEME.secondary) }]}>
              {likeCount > 0 ? likeCount : ''}
            </Text>
          </Pressable>

          <View style={[styles.divider, { backgroundColor: isDark ? '#374151' : THEME.border }]} />

          <Pressable 
            style={[styles.footerBtn, isDisliked && styles.footerBtnActive]}
            onPress={onDislike}
          >
            <MaterialCommunityIcons 
              name={isDisliked ? "thumb-down" : "thumb-down-outline"} 
              size={24} 
              color={isDisliked ? '#7C3AED' : (isDark ? '#9CA3AF' : THEME.secondary)} 
            />
            <Text style={[styles.footerBtnText, { color: isDisliked ? '#7C3AED' : (isDark ? '#9CA3AF' : THEME.secondary) }]}>
              {dislikeCount > 0 ? dislikeCount : ''}
            </Text>
          </Pressable>
        </View>
        
        <View style={styles.actionGroup}>
          <Pressable style={styles.footerIconBtn} onPress={onComment}>
            <MaterialCommunityIcons name="comment-text-outline" size={24} color={isDark ? '#9CA3AF' : THEME.secondary} />
          </Pressable>
          
          <Pressable style={styles.footerIconBtn} onPress={onShare}>
            <MaterialCommunityIcons name="share-variant-outline" size={24} color={isDark ? '#9CA3AF' : THEME.secondary} />
          </Pressable>
        </View>

        <Text style={[styles.articleCount, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
          {index + 1}/{totalArticles}
        </Text>
      </View>
    </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  innerContainer: {
    flex: 1,
  },
  
  // Premium Masthead - Centered
  masthead: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  mastheadTopLine: {
    height: 3,
    width: '100%',
    marginBottom: 10,
  },
  mastheadTitle: {
    fontSize: 36,
    fontWeight: '900',
    letterSpacing: 8,
    marginBottom: 2,
  },
  mastheadSubtitle: {
    fontSize: 10,
    letterSpacing: 3,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginBottom: 6,
  },
  mastheadDate: {
    fontSize: 11,
    letterSpacing: 0.5,
    marginBottom: 10,
    fontWeight: '500',
  },
  mastheadBottomLine: {
    height: 1,
    width: '60%',
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,  // Reduced from 12
  },

  // Headline - Centered with Auto Leading
  headline: {
    fontWeight: '800',  // Reduced from 900
    textAlign: 'center',
    marginBottom: 12,  // Reduced from 16
    letterSpacing: -0.3,  // Reduced from -0.5
    paddingHorizontal: 4,  // Reduced from 8
  },

  // Author Simple - Just text
  authorSimple: {
    alignItems: 'center',
    marginBottom: 12,
  },
  authorText: {
    fontSize: 13,
    fontWeight: '500',
    fontStyle: 'italic',
  },

  // 16:9 Responsive Image
  imageContainer: {
    width: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 16,
    backgroundColor: '#F3F4F6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  image: {
    width: '100%',
    height: '100%',
  },

  // Body Text - Clean Simple Style
  bodyText: {
    textAlign: 'left',
    letterSpacing: 0.3,
    marginBottom: 16,
  },

  // Footer - Modern Engagement Bar
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    gap: 12,
  },
  engagementGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerBtnActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderRadius: 20,
  },
  footerBtnText: {
    fontSize: 15,
    fontWeight: '700',
    minWidth: 20,
    textAlign: 'center',
  },
  divider: {
    width: 1.5,
    height: 24,
    marginHorizontal: 2,
  },
  actionGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  footerIconBtn: {
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  articleCount: {
    marginLeft: 'auto',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});

export default BroadsheetLayout;
