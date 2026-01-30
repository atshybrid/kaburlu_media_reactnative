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

// Clamp text helper
const clampText = (text: string, maxChars: number) => {
  if (!text || text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
};

const EditorialColumnLayout: ArticleLayoutComponent = ({ article, index, totalArticles }) => {
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

  // Full article text for quote (clamped to fit screen without scroll)
  const bodyText = article.body || article.summary || '';
  const fullArticleText = clampText(bodyText, 400);

  // Get image and caption
  const imageUrl = article.image || article.images?.[0] || null;
  const imageCaption = (article as any)?.imageCaption || (article as any)?.caption || '';

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
        backgroundColor: isDark ? '#121212' : '#ffffff',
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

      {/* Headline */}
      <Text style={[styles.headline, { color: isDark ? '#fff' : '#1a1a1a' }]} numberOfLines={3}>
        {article.title}
      </Text>

      {/* Author Row */}
      <View style={styles.authorRow}>
        {authorImage ? (
          <Image source={{ uri: authorImage }} style={styles.authorAvatar} contentFit="cover" />
        ) : (
          <View style={[styles.authorAvatar, { backgroundColor: isDark ? '#333' : '#ddd' }]}>
            <Feather name="user" size={18} color={isDark ? '#888' : '#666'} />
          </View>
        )}
        <Text style={[styles.authorName, { color: isDark ? '#ccc' : '#444' }]}>
          {authorName}
        </Text>
      </View>

      {/* Full Article Quote */}
      <View style={styles.pullQuoteContainer}>
        <View style={[styles.pullQuoteLine, { backgroundColor: '#E74C3C' }]} />
        <Text style={[styles.pullQuote, { color: isDark ? '#ddd' : '#333' }]} numberOfLines={8}>
          &ldquo;{fullArticleText}&rdquo;
        </Text>
      </View>

      {/* Photo with Caption */}
      {imageUrl && (
        <View style={styles.photoContainer}>
          <Image source={{ uri: imageUrl }} style={styles.articleImage} contentFit="cover" />
          {imageCaption ? (
            <Text style={[styles.captionText, { color: isDark ? '#888' : '#666' }]}>
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
        backgroundColor: isDark ? '#121212' : '#ffffff',
        borderTopColor: isDark ? '#2a2a2a' : '#eee',
        paddingBottom: insets.bottom + 8
      }]}>
        <Pressable style={styles.footerBtn} onPress={onLike}>
          <Feather 
            name="thumbs-up" 
            size={20} 
            color={isLiked ? '#E74C3C' : (isDark ? '#888' : '#666')} 
          />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            {likeCount > 0 ? `${likeCount}` : 'Agree'}
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onComment}>
          <Feather name="message-square" size={20} color={isDark ? '#888' : '#666'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            Respond
          </Text>
        </Pressable>
        
        <Pressable style={styles.footerBtn} onPress={onShare}>
          <Feather name="share-2" size={20} color={isDark ? '#888' : '#666'} />
          <Text style={[styles.footerBtnText, { color: isDark ? '#888' : '#666' }]}>
            Share
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },

  // Category
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 10,
  },
  categoryLine: {
    width: 20,
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

  // Headline
  headline: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 16,
  },

  // Author Row
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 16,
    fontStyle: 'italic',
    lineHeight: 24,
  },

  // Photo with caption
  photoContainer: {
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  articleImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#333',
  },
  captionText: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 6,
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
    borderTopColor: '#eee',
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
