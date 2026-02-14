import React, { useCallback, useMemo, useState } from 'react';
import { Image, ImageStyle, StyleSheet, Text, TextStyle, TouchableOpacity, View, ViewStyle } from 'react-native';
import { Colors } from '../../constants/Colors';
import { pickTitleColorTheme } from '../../constants/TitleColorRules';
import { useColorScheme } from '../../hooks/useColorScheme';

export type ReporterType = 'citizen' | 'newspaper';

export interface ArticleLayout3 {
  id: string;
  topCols?: string[];
  category?: string;
  subtitle?: string;
  titleLine?: string;
  excerpt?: string;
  imageUrl?: string;
  authorName?: string;
  reporterType?: ReporterType;
  reporterLogo?: string;
  reporterProfilePic?: string;
  brandName?: string;
  location?: string;
  time?: string;
  likes?: number;
  comments?: number;
  shares?: number;
  titleColor?: string;
  subtitleColor?: string;
  tags?: string[];
  metaTitle?: string;
}

interface Props {
  item: ArticleLayout3;
  onPress?: (item: ArticleLayout3) => void;
  onLikeToggle?: (item: ArticleLayout3, liked: boolean, totalLikes: number) => void;
  onCommentPress?: (item: ArticleLayout3) => void;
  onSharePress?: (item: ArticleLayout3) => void;
  compact?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const ArticleCardLayout3: React.FC<Props> = ({
  item,
  onPress,
  onLikeToggle,
  onCommentPress,
  onSharePress,
  compact,
  style,
  testID,
}) => {
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState<number>(item.likes ?? 0);

  const scheme = useColorScheme();
  const palette = Colors[scheme];

  const dynamicTitleTheme = useMemo(() => {
    if (item.titleColor || item.subtitleColor) return null;
    if (!item.titleLine) return null;
    return pickTitleColorTheme({ title: item.titleLine, metaTitle: item.metaTitle, tags: item.tags });
  }, [item]);

  const titleColor = item.titleColor || dynamicTitleTheme?.primary || '#C83B3B';
  const subtitleColor = item.subtitleColor || dynamicTitleTheme?.secondary || '#C97A56';

  const onToggleLike = useCallback(() => {
    setLiked(prev => {
      const next = !prev;
      setLikes(l => (next ? l + 1 : Math.max(0, l - 1)));
      onLikeToggle?.(item, next, next ? likes + 1 : Math.max(0, likes - 1));
      return next;
    });
  }, [item, likes, onLikeToggle]);

  const engagementColor: TextStyle = { color: palette.muted };

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress ? () => onPress(item) : undefined}
      style={[styles.card, { backgroundColor: palette.card, borderColor: palette.border, padding: compact ? 12 : 14 }, style]}
      testID={testID}
    >
      <View style={styles.topRow}>
        <View style={styles.topCols}>
          {item.topCols?.slice(0, 4).map((t, i) => (
            <Text key={i} style={[styles.topColText, { color: palette.secondary, opacity: 0.9 }, compact && { fontSize: 11, marginRight: 8 }]} numberOfLines={1}>{t}</Text>
          ))}
        </View>
        <TouchableOpacity onPress={onToggleLike} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole='button' accessibilityLabel={liked ? 'Unlike article' : 'Like article'}>
          <Text style={[styles.topHeart, liked && styles.topHeartActive]}>{liked ? '❤️' : '🤍'}</Text>
        </TouchableOpacity>
      </View>

      {item.category ? <Text style={[styles.category, { color: palette.muted }]} numberOfLines={1}>{item.category}</Text> : null}
      {item.subtitle ? <Text style={[styles.subtitle, { color: subtitleColor, fontSize: compact ? 14 : 16, marginBottom: compact ? 4 : 6 }]} numberOfLines={2}>{item.subtitle}</Text> : null}
      {item.titleLine ? <Text style={[styles.titleBig, { color: titleColor, fontSize: compact ? 30 : 36, lineHeight: compact ? 36 : 44, marginBottom: compact ? 8 : 10 }]}>{item.titleLine}</Text> : null}
      {item.excerpt ? <Text style={[styles.excerpt, { color: palette.text, lineHeight: compact ? 20 : 22, fontSize: compact ? 14 : 15 }]}>{item.excerpt}</Text> : null}

      {item.imageUrl ? (
        <Image source={{ uri: item.imageUrl }} style={[styles.image, { marginBottom: compact ? 10 : 12 }]} resizeMode='cover' />
      ) : (
        <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: scheme === 'dark' ? '#2a2f33' : '#fafafa', borderColor: palette.border, marginBottom: compact ? 10 : 12 }]} />
      )}

      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {/* Show reporter profile photo if reporter exists, otherwise show tenant brand icon */}
          {item.reporterProfilePic ? (
            <Image source={{ uri: item.reporterProfilePic }} style={styles.avatar} />
          ) : item.reporterLogo ? (
            <Image source={{ uri: item.reporterLogo }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: palette.border }]} />
          )}
          <View style={{ marginLeft: 8 }}>
            {/* Show reporter name if available, otherwise show "Source: {brandName}" */}
            {item.authorName ? (
              <>
                <Text style={[styles.brandText, { color: palette.text }, compact && { fontSize: 12 }]} numberOfLines={1}>
                  {item.authorName}
                </Text>
                {item.location && (
                  <Text style={[styles.byText, { color: palette.muted }, compact && { fontSize: 11 }]} numberOfLines={1}>
                    {item.location}
                  </Text>
                )}
              </>
            ) : (
              <Text style={[styles.brandText, { color: palette.text }, compact && { fontSize: 12 }]} numberOfLines={1}>
                Source: {item.brandName || 'Unknown'}
              </Text>
            )}
          </View>
        </View>
        {!!item.time && <Text style={[styles.timeText, { color: palette.muted }, compact && { fontSize: 11 }]} numberOfLines={1}>{item.time}</Text>}
      </View>

      <View style={styles.engagementRow}>
        <TouchableOpacity onPress={onToggleLike} style={styles.engBtn} accessibilityLabel='Like'>
          <Text style={engagementColor}>👍 {likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onCommentPress?.(item)} style={styles.engBtn} accessibilityLabel='Comments'>
          <Text style={engagementColor}>💬 {item.comments ?? 0}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onSharePress?.(item)} style={styles.engBtn} accessibilityLabel='Share'>
          <Text style={engagementColor}>↗️ {item.shares ?? 0}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

// Using untyped create to avoid strict union friction between ViewStyle/TextStyle/ImageStyle.
// This is acceptable for UI layer; if you prefer stricter typing, split into separate objects.
const styles: any = StyleSheet.create({
  card: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth } as ViewStyle,
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as ViewStyle,
  topCols: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 } as ViewStyle,
  topColText: { fontSize: 12, marginRight: 10, fontWeight: '600' } as TextStyle,
  topHeart: { fontSize: 20 } as TextStyle,
  topHeartActive: { transform: [{ scale: 1.05 }] } as ViewStyle,
  category: { fontSize: 13, marginTop: 8, marginBottom: 6, fontWeight: '600' } as TextStyle,
  subtitle: { fontWeight: '600', textAlign: 'center' } as TextStyle,
  titleBig: { fontWeight: '800', textAlign: 'center', marginTop: 6 } as TextStyle,
  excerpt: { marginBottom: 12, paddingHorizontal: 4 } as TextStyle,
  image: { width: '100%', aspectRatio: 16 / 9, borderRadius: 12, overflow: 'hidden' } as ImageStyle,
  imagePlaceholder: { borderWidth: 1 } as ViewStyle,
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } as ViewStyle,
  footerLeft: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 } as ViewStyle,
  avatar: { width: 38, height: 38, borderRadius: 19 } as ImageStyle,
  avatarPlaceholder: {} as ViewStyle,
  brandText: { fontSize: 13, fontWeight: '600' } as TextStyle,
  byText: { fontSize: 12 } as TextStyle,
  timeText: { fontSize: 12, marginLeft: 8 } as TextStyle,
  engagementRow: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 12 } as ViewStyle,
  engBtn: { paddingVertical: 8, minWidth: 80, alignItems: 'center' } as ViewStyle,
});

export default ArticleCardLayout3;
