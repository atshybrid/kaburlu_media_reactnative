/**
 * Style 5: EditorialColumnLayout - Opinion/Editorial Style
 * 
 * Features:
 * - Prominent author profile with avatar
 * - Pull quote highlight
 * - Classic column typography
 * - Author-focused layout for opinion pieces
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
import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Animated,
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

// Clamp text to N words
const clampWords = (text: string, maxWords: number): string => {
  const words = text.trim().split(/\s+/);
  return words.length > maxWords ? words.slice(0, maxWords).join(' ') + '...' : text;
};


const EditorialColumnLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
  const [fontsLoaded] = useFonts({
    NotoSerifTelugu_700Bold,
    NotoSansTelugu_400Regular,
  });

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
      duration: 350,
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
  const likeCount = reaction.likes ?? article.likes ?? 0;

  // Format date
  const dateStr = useMemo(() => {
    const d = new Date(article.createdAt || Date.now());
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }, [article.createdAt]);

  // Author info
  const author = (article as any)?.author || {};
  const authorName = author.name || article.publisherName || 'Editorial Board';
  const authorImage = author.profileImage || author.image || null;

  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'Opinion';

  // Telugu detection
  const isTelugu = (text?: string) => /[\u0C00-\u0C7F]/.test(String(text || ''));
  const isTeluguTitle = isTelugu(article.title);
  const isTeluguBody = isTelugu(article.body || article.summary);

  // Full article text - 60 words max
  const bodyText = article.body || article.summary || '';
  const fullArticleText = clampWords(bodyText, 60);
  const wordCount = fullArticleText.split(/\s+/).filter(w => w.length > 0).length;

  // Get image and caption
  const imageUrl = article.image || article.images?.[0] || null;
  const imageCaption = (article as any)?.imageCaption || (article as any)?.caption || '';

  // Dynamic sizing based on content
  const titleSize = 26;
  const titleLineHeight = Math.round(titleSize * (isTeluguTitle ? 1.50 : 1.35));
  const bodySize = 16;
  const bodyLineHeight = Math.round(bodySize * 1.70);
  
  // Dynamic image height based on word count
  // More words = smaller image to fit everything
  const imageHeight = (() => {
    if (wordCount >= 50) return Math.round(windowWidth * 0.40);  // 40% for long articles
    if (wordCount >= 35) return Math.round(windowWidth * 0.50);  // 50% for medium
    return Math.round(windowWidth * 0.60);  // 60% for short articles
  })();

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
    <Animated.View style={[styles.wrapper, { opacity: fadeAnim }]}>
      <Pressable 
        style={[styles.container, { 
          backgroundColor: isDark ? '#0F172A' : '#FAFBFC',
          paddingTop: insets.top + 16,
          paddingBottom: insets.bottom + 70 
        }]}
        onPress={handleScreenTap}
      >
      {/* Category label */}
      <View style={styles.categoryRow}>
        <View style={[styles.categoryLine, { backgroundColor: '#E74C3C' }]} />
        <Text style={[styles.categoryText, { color: '#E74C3C' }]}>
          {categoryName.toUpperCase()}
        </Text>
        <View style={styles.spacer} />
        <Text style={[styles.dateText, { color: isDark ? '#666' : '#999' }]}>
          {dateStr}
        </Text>
      </View>

      {/* Headline - Center aligned with proper spacing */}
      <Text 
        style={[
          styles.headline, 
          { 
            color: isDark ? '#F8FAFC' : '#0F172A',
            fontSize: titleSize,
            lineHeight: titleLineHeight,
          },
          isTeluguTitle && { fontFamily: 'NotoSerifTelugu_700Bold' },
        ]} 
        numberOfLines={3}
      >
        {article.title}
      </Text>

      {/* Author Row */}
      <View style={styles.authorRow}>
        {authorImage ? (
          <Image source={{ uri: authorImage }} style={styles.authorAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.authorAvatar, { backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }]}>
            <MaterialCommunityIcons name="account" size={20} color={isDark ? '#64748B' : '#94A3B8'} />
          </View>
        )}
        <Text style={[styles.authorName, { color: isDark ? '#CBD5E1' : '#475569' }]}>
          {authorName}
        </Text>
      </View>

      {/* Full Article Quote */}
      <View style={styles.pullQuoteContainer}>
        <View style={[styles.pullQuoteLine, { backgroundColor: '#DC2626' }]} />
        <Text 
          style={[
            styles.pullQuote, 
            { 
              color: isDark ? '#CBD5E1' : '#334155',
              fontSize: bodySize,
              lineHeight: bodyLineHeight,
            },
            isTeluguBody && { fontFamily: 'NotoSansTelugu_400Regular' },
          ]} 
          numberOfLines={10}
        >
          {fullArticleText}
        </Text>
      </View>

      {/* Photo with Caption - Dynamic height */}
      {imageUrl && (
        <View style={styles.photoContainer}>
          <Image 
            source={{ uri: imageUrl }} 
            style={[styles.articleImage, { height: imageHeight }]} 
            contentFit="cover" 
          />
          {imageCaption ? (
            <Text style={[styles.captionText, { color: isDark ? '#64748B' : '#64748B' }]}>
              {imageCaption}
            </Text>
          ) : null}
        </View>
      )}

      {/* Spacer to push signature to bottom */}
      <View style={styles.flexSpacer} />

      {/* Signature and indicator - always at bottom */}
      <View style={[styles.signatureRow, { borderTopColor: isDark ? '#333' : '#eee' }]}>
        <Text style={[styles.signature, { color: isDark ? '#666' : '#888' }]}>
          — {authorName}
        </Text>
        <Text style={[styles.indicatorText, { color: isDark ? '#555' : '#999' }]}>
          {index + 1} / {totalArticles}
        </Text>
      </View>

      {/* Footer Engagement Bar */}
      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#0F172A' : '#FAFBFC',
        borderTopColor: isDark ? '#1E293B' : '#E2E8F0',
        paddingBottom: insets.bottom + 8
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <MaterialCommunityIcons
            name={isLiked ? 'thumb-up' : 'thumb-up-outline'}
            size={22} 
            color={isLiked ? '#DC2626' : (isDark ? '#64748B' : '#94A3B8')} 
          />
          <Text style={[styles.footerBtnText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            {likeCount > 0 ? `${likeCount}` : 'Agree'}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <MaterialCommunityIcons name="comment-outline" size={22} color={isDark ? '#64748B' : '#94A3B8'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            Respond
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <MaterialCommunityIcons name="share-variant" size={22} color={isDark ? '#64748B' : '#94A3B8'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            Share
          </Text>
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
    paddingHorizontal: 20,
  },

  // Category
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 10,
  },
  categoryLine: {
    width: 24,
    height: 3,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  spacer: {
    flex: 1,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
  },

  // Headline - Center aligned
  headline: {
    fontWeight: '800',
    marginBottom: 18,
    textAlign: 'center',
    letterSpacing: -0.4,
    paddingHorizontal: 8,
  },

  // Author Row - Center aligned
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  authorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  authorName: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Pull Quote
  pullQuoteContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingLeft: 4,
  },
  pullQuoteLine: {
    width: 4,
    borderRadius: 2,
    marginRight: 14,
  },
  pullQuote: {
    flex: 1,
    textAlign: 'left',
    letterSpacing: 0.2,
  },

  // Photo with caption - dynamic height
  photoContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  articleImage: {
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  captionText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    paddingHorizontal: 4,
  },

  // Flex spacer to push signature to bottom
  flexSpacer: {
    flex: 1,
  },

  // Signature row
  signatureRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  signature: {
    fontSize: 14,
    fontStyle: 'italic',
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
    borderTopWidth: 1,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  footerBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default EditorialColumnLayout;
