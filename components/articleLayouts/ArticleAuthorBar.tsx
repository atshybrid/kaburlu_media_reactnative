/**
 * ArticleAuthorBar — shared author section used by ALL article layouts.
 *
 * Layout:
 *   [Avatar 34px] | [fullName ──────────── placeName]
 *                 | [providerName  •  designation   ]
 *
 * Mirrors exactly the author block in ArticlePage (Style 1).
 */
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Article } from '@/types';

interface Props {
  article: Article;
  /** Use white text (for dark/overlay backgrounds). Default = false (dark text on light bg). */
  dark?: boolean;
  style?: ViewStyle;
}

const ArticleAuthorBar: React.FC<Props> = ({ article, dark = false, style }) => {
  const a: any = article.author || {};

  const fullName = String(a.fullName || a.name || 'Reporter').trim() || 'Reporter';
  const profilePhotoRaw = String(a.profilePhotoUrl || a.avatar || '').trim();
  const designationRaw = String(a.designation?.name || a.designationName || '').trim();
  const placeName: string | null = a.placeName
    || (a.location?.name ?? a.location?.placeName ?? null)
    || null;

  const tenantNameRaw =
    (article as any)?.provider ||
    (article as any)?.publisherName ||
    (article as any)?.publisher?.name ||
    null;
  const tenantName: string | null = tenantNameRaw ? String(tenantNameRaw).trim() : null;
  const tenantLogoRaw = String((article as any)?.publisherLogo || '').trim();
  const articlePrimaryImage = String((article as any)?.primaryImageUrl || (article as any)?.image || '').trim();

  const displayPhoto = profilePhotoRaw || articlePrimaryImage || tenantLogoRaw || null;

  const initials = fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase() ?? '')
    .join('');

  const humanRole = designationRaw
    ? designationRaw
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b([a-z])/g, (m: string) => m.toUpperCase())
    : null;

  const nameColor = dark ? '#fff' : '#1a1a1a';
  const metaColor = dark ? 'rgba(255,255,255,0.85)' : '#555';
  const dotColor = dark ? 'rgba(255,255,255,0.55)' : '#aaa';

  return (
    <View style={[styles.root, style]}>
      {/* Avatar */}
      {displayPhoto ? (
        <Image
          source={{ uri: displayPhoto }}
          style={styles.avatar}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={120}
        />
      ) : (
        <View style={[styles.avatar, styles.avatarFallback]}>
          {initials ? (
            <Text style={styles.initials}>{initials}</Text>
          ) : (
            <Feather name="user" size={14} color="#888" />
          )}
        </View>
      )}

      {/* Text block */}
      <View style={styles.textWrap}>
        {/* Row 1: fullName (left) + placeName (right) */}
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: nameColor }]} numberOfLines={1}>
            {fullName}
          </Text>
          {!!placeName && (
            <Text style={[styles.place, { color: metaColor }]} numberOfLines={1}>
              {placeName}
            </Text>
          )}
        </View>

        {/* Row 2: provider • designation */}
        {(tenantName || humanRole) && (
          <View style={styles.metaRow}>
            {!!tenantName && (
              <Text style={[styles.provider, { color: nameColor }]} numberOfLines={1}>
                {tenantName}
              </Text>
            )}
            {tenantName && humanRole && (
              <View style={[styles.dot, { backgroundColor: dotColor }]} />
            )}
            {!!humanRole && (
              <Text style={[styles.role, { color: metaColor }]} numberOfLines={1}>
                {humanRole}
              </Text>
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#ddd',
  },
  avatarFallback: {
    backgroundColor: '#e2e2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 11,
    fontWeight: '600',
    color: '#444',
  },
  textWrap: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  name: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  place: {
    fontSize: 12,
    flexShrink: 0,
  },
  provider: {
    fontSize: 12,
    fontWeight: '600',
    flexShrink: 1,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
  },
  role: {
    fontSize: 11,
    flexShrink: 1,
  },
});

export default ArticleAuthorBar;
