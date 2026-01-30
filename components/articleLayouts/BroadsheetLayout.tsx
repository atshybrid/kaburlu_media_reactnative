/**
 * Style 3: BroadsheetLayout - Classic Newspaper Style
 * 
 * Features:
 * - Elegant masthead with newspaper name and date
 * - Drop cap for first letter
 * - Justified text alignment
 * - Classic serif typography feel
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

// Clamp text to fit screen
const clampText = (text: string, maxChars: number) => {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

const BroadsheetLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
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
    const options: Intl.DateTimeFormatOptions = { 
      weekday: 'short', 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    };
    return d.toLocaleDateString('en-IN', options);
  }, [article.createdAt]);

  // Extract first letter for drop cap
  const bodyText = article.body || article.summary || '';
  const firstLetter = bodyText.charAt(0).toUpperCase();
  const restOfText = clampText(bodyText.slice(1), 350);

  // Get image
  const imageUrl = article.image || article.images?.[0] || null;

  // Author info
  const authorName = (article as any)?.author?.name || article.publisherName || 'Staff Reporter';

  // Category
  const categoryName = typeof article.category === 'string' 
    ? article.category 
    : (article.category as any)?.name || 'News';

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
    <Pressable 
      style={[styles.container, { 
        backgroundColor: isDark ? '#1a1a1a' : '#faf9f6',
        paddingTop: insets.top,
      }]}
      onPress={handleScreenTap}
    >
      {/* Masthead */}
      <View style={styles.masthead}>
        <View style={[styles.mastheadLine, { backgroundColor: isDark ? '#444' : '#1a1a1a' }]} />
        <Text style={[styles.mastheadTitle, { color: isDark ? '#fff' : '#1a1a1a' }]}>
          KABURLU
        </Text>
        <Text style={[styles.mastheadDate, { color: isDark ? '#888' : '#666' }]}>
          {dateStr} • {categoryName}
        </Text>
        <View style={[styles.mastheadLine, { backgroundColor: isDark ? '#444' : '#1a1a1a' }]} />
      </View>

      {/* Main Content Area */}
      <View style={styles.content}>
        {/* Headline */}
        <Text 
          style={[styles.headline, { color: isDark ? '#fff' : '#1a1a1a' }]}
          numberOfLines={3}
        >
          {article.title}
        </Text>

        {/* Byline */}
        <Text style={[styles.byline, { color: isDark ? '#888' : '#666' }]}>
          By {authorName}
        </Text>

        {/* Image */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
          </View>
        )}

        {/* Body with Drop Cap */}
        <View style={styles.bodyContainer}>
          {firstLetter && (
            <Text style={[styles.dropCap, { color: '#DC2626' }]}>
              {firstLetter}
            </Text>
          )}
          <Text 
            style={[styles.bodyText, { color: isDark ? '#ccc' : '#333' }]}
            numberOfLines={imageUrl ? 6 : 10}
          >
            {restOfText}
          </Text>
        </View>
      </View>

      {/* Footer Engagement Bar */}
      <View style={[styles.footer, { 
        backgroundColor: isDark ? '#1a1a1a' : '#faf9f6',
        borderTopColor: isDark ? '#333' : '#ddd',
        paddingBottom: insets.bottom + 8,
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <Feather 
            name="heart" 
            size={22} 
            color={isLiked ? '#DC2626' : (isDark ? '#888' : '#666')} 
          />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            {likeCount > 0 ? likeCount : ''}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <Feather name="message-circle" size={22} color={isDark ? '#888' : '#666'} />
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <Feather name="share" size={22} color={isDark ? '#888' : '#666'} />
        </Pressable>

        <Text style={[styles.articleCount, { color: isDark ? '#555' : '#aaa' }]}>
          {index + 1}/{totalArticles}
        </Text>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Masthead
  masthead: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  mastheadLine: {
    height: 2,
    width: '100%',
  },
  mastheadTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 6,
    marginVertical: 6,
  },
  mastheadDate: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },

  // Content
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // Headline
  headline: {
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 8,
  },

  // Byline
  byline: {
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 12,
  },

  // Image
  imageContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  image: {
    width: '100%',
    height: 160,
    backgroundColor: '#f0f0f0',
  },

  // Body with Drop Cap
  bodyContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dropCap: {
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 56,
    marginRight: 6,
    marginTop: -4,
  },
  bodyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'justify',
  },

  // Footer
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
  },
  footerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  articleCount: {
    marginLeft: 'auto',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default BroadsheetLayout;
