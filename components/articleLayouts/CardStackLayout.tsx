import { Image } from 'expo-image';
import { Animated, Pressable, StyleSheet, Text, View, useColorScheme, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useCallback } from 'react';
import type { ArticleLayoutComponent } from './types';
import { useTabBarVisibility } from '@/context/TabBarVisibilityContext';
import { useAutoHideBottomBar } from '@/hooks/useAutoHideBottomBar';
import { useReaction } from '@/hooks/useReaction';
import {
  useFonts,
  NotoSerifTelugu_700Bold,
} from '@expo-google-fonts/noto-serif-telugu';
import {
  NotoSansTelugu_400Regular,
  NotoSansTelugu_600SemiBold,
} from '@expo-google-fonts/noto-sans-telugu';

// Professional theme colors - Enhanced
const THEME = {
  primary: '#0F172A',
  secondary: '#334155',
  accent: '#DC2626',
  accentLight: '#EF4444',
  border: '#E2E8F0',
  lightBg: '#F8FAFC',
  darkBg: '#0F172A',
  cardBg: '#FFFFFF',
  gradient1: '#DC2626',
  gradient2: '#B91C1C',
};

// Utility: Limit text to N words
const clampWords = (text: string, maxWords: number): string => {
  const words = text.trim().split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '...' : text;
};

const CardStackLayout: ArticleLayoutComponent = ({ article }) => {
  const [fontsLoaded] = useFonts({
    NotoSerifTelugu_700Bold,
    NotoSansTelugu_400Regular,
    NotoSansTelugu_600SemiBold,
  });

  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();

  // Fade-in animation
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  React.useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const isDisliked = reaction.reaction === 'DISLIKE';
  const likeCount = reaction.likes ?? article.likes ?? 0;
  const dislikeCount = reaction.dislikes ?? article.dislikes ?? 0;
  const onLike = reaction.like;
  const onDislike = reaction.dislike;

  // Telugu detection
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);
  const isTeluguBody = isTelugu(article.body || article.summary);

  // Content processing - 60 words max
  const bodyText = clampWords(article.body || article.summary || '', 60);
  const imageUrl = article.image || article.images?.[0] || null;
  const authorName = (article as any)?.author?.name || article.publisherName || 'Staff Reporter';
  const authorPlace = (article as any)?.author?.placeName || '';
  
  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || '';

  // Responsive sizing for mobile - optimized for readability
  const cardWidth = windowWidth - 24;
  const titleSize = 24;  // Reduced for better fit
  const titleLineHeight = Math.round(titleSize * (isTeluguTitle ? 1.50 : 1.35));  // Increased for Telugu
  const bodySize = 16;  // Increased for better readability
  const bodyLineHeight = Math.round(bodySize * 1.70);  // Better spacing
  const imageHeight = Math.round(cardWidth * 0.50);  // Reduced image size

  if (!fontsLoaded) return null;

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <Pressable onPress={handleScreenTap} style={styles.pressable}>
        {/* Main card with clean simple design */}
        <View style={[styles.card, { width: cardWidth, backgroundColor: isDark ? THEME.darkBg : THEME.cardBg }]}>
          
          {/* Image */}
          {imageUrl && (
            <View style={[styles.imageContainer, { height: imageHeight }]}>
              <Image
                source={{ uri: imageUrl }}
                style={styles.image}
                contentFit="cover"
              />
              {/* Category badge overlay */}
              {categoryName && (
                <View style={styles.categoryBadge}>
                  <Text style={styles.categoryText}>{categoryName}</Text>
                </View>
              )}
            </View>
          )}

          {/* Content */}
          <View style={styles.content}>
            {/* Title with proper spacing */}
            <Text
              style={[
                styles.title,
                {
                  color: isDark ? '#F8FAFC' : THEME.primary,
                  fontSize: titleSize,
                  lineHeight: titleLineHeight,
                },
                isTeluguTitle && { fontFamily: 'NotoSerifTelugu_700Bold' },
              ]}
            >
              {article.title}
            </Text>

            {/* Author - simple text only */}
            {(authorName || authorPlace) && (
              <Text
                style={[
                  styles.author,
                  { color: isDark ? '#94A3B8' : '#64748B' },
                ]}
              >
                {authorName}{authorPlace ? ` • ${authorPlace}` : ''}
              </Text>
            )}

            {/* Body - clear and readable */}
            <Text
              style={[
                styles.body,
                {
                  color: isDark ? '#CBD5E1' : '#334155',
                  fontSize: bodySize,
                  lineHeight: bodyLineHeight,
                },
                isTeluguBody && { fontFamily: 'NotoSansTelugu_400Regular' },
              ]}
            >
              {bodyText}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Footer engagement bar - fixed positioning */}
      <View
        style={[
          styles.footer,
          {
            backgroundColor: isDark ? '#1E293B' : THEME.cardBg,
            borderTopColor: isDark ? '#334155' : THEME.border,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        <View style={styles.engagementGroup}>
          <Pressable
            style={[styles.footerBtn, isLiked && styles.footerBtnActive]}
            onPress={onLike}
          >
            <MaterialCommunityIcons
              name={isLiked ? 'thumb-up' : 'thumb-up-outline'}
              size={20}
              color={isLiked ? THEME.accent : isDark ? '#9CA3AF' : '#6B7280'}
            />
            <Text
              style={[
                styles.footerBtnText,
                { color: isLiked ? THEME.accent : isDark ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              {likeCount}
            </Text>
          </Pressable>
          <Pressable
            style={[styles.footerBtn, isDisliked && styles.footerBtnActive]}
            onPress={onDislike}
          >
            <MaterialCommunityIcons
              name={isDisliked ? 'thumb-down' : 'thumb-down-outline'}
              size={20}
              color={isDisliked ? THEME.accent : isDark ? '#9CA3AF' : '#6B7280'}
            />
            <Text
              style={[
                styles.footerBtnText,
                { color: isDisliked ? THEME.accent : isDark ? '#9CA3AF' : '#6B7280' },
              ]}
            >
              {dislikeCount}
            </Text>
          </Pressable>
        </View>
        <Pressable style={styles.shareBtn}>
          <MaterialCommunityIcons
            name="share-variant"
            size={22}
            color={isDark ? '#9CA3AF' : '#6B7280'}
          />
        </Pressable>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  pressable: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 12,
  },

  // Main card - clean simple design
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },

  // Image
  imageContainer: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  categoryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },

  // Content
  content: {
    padding: 20,
    paddingTop: 20,
  },
  title: {
    fontWeight: '800',
    marginBottom: 10,
    letterSpacing: -0.4,
    paddingTop: 4,
  },
  author: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 14,
    fontStyle: 'italic',
  },
  body: {
    textAlign: 'left',
    letterSpacing: 0.2,
  },

  // Footer - fixed positioning
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  engagementGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 4,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 18,
  },
  footerBtnActive: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  shareBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
  },
});

export default CardStackLayout;
