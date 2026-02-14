import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useChatStore } from '../../state/chatStore';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Spacing } from '@/constants/Spacing';
import { useMemo } from 'react';

export default function DirectChatListScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const { directChatIds, chats } = useChatStore((s: any) => ({ directChatIds: s.directChatIds, chats: s.chats }));

  const data = useMemo(() => {
    if (directChatIds?.length) return directChatIds;
    return ['demo-1', 'demo-2'];
  }, [directChatIds]);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <ThemedText style={{ color: c.tint, fontWeight: '800' }}>Back</ThemedText>
        </Pressable>
        <ThemedText style={{ flex: 1, textAlign: 'center', fontWeight: '900', color: c.text }}>
          Direct Chats
        </ThemedText>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        style={styles.list}
        data={data}
        keyExtractor={(id: string) => id}
        renderItem={({ item }) => {
          const isDemo = item.startsWith('demo-');
          const chat = isDemo
            ? {
                title: item === 'demo-1' ? 'Local Community' : 'Family Group',
                last: item === 'demo-1' ? 'Welcome! This is a sample preview.' : 'Tap to open this sample chat.',
              }
            : chats[item];

          const title = String(chat?.title || 'Direct Chat');
          const initials = title
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w: string) => w[0]?.toUpperCase())
            .join('');

          return (
            <Pressable
              style={[styles.row, { borderColor: c.border }]}
              onPress={() => (router.push as any)({ pathname: '/kachat/direct/[id]', params: { id: item } })}
            >
              <View style={[styles.avatar, { backgroundColor: c.card, borderColor: c.border }]}>
                <ThemedText style={{ fontWeight: '900', color: c.muted }}>{initials || 'C'}</ThemedText>
              </View>
              <View style={{ flex: 1 }}>
                <ThemedText style={{ fontWeight: '900', color: c.text }} numberOfLines={1}>
                  {title}
                </ThemedText>
                <ThemedText style={{ color: c.muted, fontSize: 12 }} numberOfLines={1}>
                  {String((chat as any)?.last || (isDemo ? 'Sample preview (no backend needed)' : 'Tap to open'))}
                </ThemedText>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText style={{ fontWeight: '900', color: c.text }}>No direct chats yet</ThemedText>
            <ThemedText style={{ color: c.muted, textAlign: 'center' }}>
              Sample chats will appear here until you start one.
            </ThemedText>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 44, paddingVertical: 8 },
  list: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { padding: 32, alignItems: 'center', gap: 6 },
});
