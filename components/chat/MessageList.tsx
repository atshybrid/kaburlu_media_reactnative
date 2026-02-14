import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, ListRenderItem, RefreshControl, StyleSheet, View } from 'react-native';
import { Message } from '../../types/chat';
import { ThemedText } from '../ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BorderRadius } from '@/constants/BorderRadius';
import { Spacing } from '@/constants/Spacing';

export interface MessageListProps {
  messages: Message[];
  onLoadOlder?: () => Promise<void> | void;
  hasMore?: boolean;
  loading?: boolean;
  onEndReachedThreshold?: number;
}

// Renders messages oldest -> newest. Parent ensures ordering.
export const MessageList: React.FC<MessageListProps> = ({ messages, onLoadOlder, hasMore, loading }) => {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const listRef = useRef<FlatList<Message>>(null);

  const renderItem: ListRenderItem<Message> = useCallback(({ item }) => {
    const pending = item.pending; const error = item.error;
    const isMe = item.senderUserId === 'me';
    return (
      <View style={[styles.row, isMe ? styles.rowMe : styles.rowOther]}>
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? c.tint : c.card,
              borderColor: c.border,
            },
          ]}
        >
          <ThemedText style={[styles.content, { color: isMe ? '#fff' : c.text }]}>{item.content}</ThemedText>
          <View style={styles.metaRow}>
            {item.sample && (
              <ThemedText style={[styles.meta, { color: isMe ? '#fff' : c.muted }]}>Sample</ThemedText>
            )}
            {pending && <ThemedText style={[styles.meta, { color: isMe ? '#fff' : c.muted }]}>Sending…</ThemedText>}
            {error && <ThemedText style={[styles.meta, { color: c.danger }]}>Failed</ThemedText>}
          </View>
        </View>
      </View>
    );
  }, [c.border, c.card, c.danger, c.muted, c.text, c.tint]);

  const keyExtractor = useCallback((m: Message) => m.id, []);

  const handleRefresh = useCallback(async () => {
    if (hasMore && onLoadOlder) await onLoadOlder();
  }, [hasMore, onLoadOlder]);

  // Auto scroll to bottom when new messages arrive (only if already near end)
  useEffect(() => {
    // naive approach: simply scroll to end on change; refine with 'isUserScrolling' guard later
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  return (
    <FlatList
      ref={listRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      contentContainerStyle={[
        styles.listContent,
        { paddingBottom: Spacing.md, backgroundColor: c.background, flexGrow: messages.length ? 0 : 1 },
      ]}
      ListEmptyComponent={
        !loading ? (
          <View style={[styles.empty, { backgroundColor: c.background }]}> 
            <ThemedText style={{ color: c.muted, textAlign: 'center' }}>
              No messages yet. Start the conversation.
            </ThemedText>
          </View>
        ) : null
      }
      refreshControl={
        <RefreshControl refreshing={!!loading} onRefresh={handleRefresh} enabled={!!hasMore} />
      }
    />
  );
};

const styles = StyleSheet.create({
  listContent: { padding: Spacing.md, gap: Spacing.sm },
  row: { width: '100%', flexDirection: 'row' },
  rowMe: { justifyContent: 'flex-end' },
  rowOther: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  content: { fontSize: 14, lineHeight: 20 },
  metaRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  meta: { fontSize: 11 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
});
