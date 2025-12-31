import React, { useCallback, useEffect, useRef } from 'react';
import { FlatList, ListRenderItem, RefreshControl, StyleSheet, View } from 'react-native';
import { Message } from '../../types/chat';
import { ThemedText } from '../ThemedText';

export interface MessageListProps {
  messages: Message[];
  onLoadOlder?: () => Promise<void> | void;
  hasMore?: boolean;
  loading?: boolean;
  onEndReachedThreshold?: number;
}

// Renders messages oldest -> newest. Parent ensures ordering.
export const MessageList: React.FC<MessageListProps> = ({ messages, onLoadOlder, hasMore, loading }) => {
  const listRef = useRef<FlatList<Message>>(null);

  const renderItem: ListRenderItem<Message> = useCallback(({ item }) => {
    const pending = item.pending; const error = item.error;
    return (
      <View style={[styles.bubble, item.senderUserId === 'me' ? styles.mine : styles.theirs]}>
        <ThemedText style={styles.content}>{item.content}</ThemedText>
        {pending && <ThemedText style={styles.meta}>Sending...</ThemedText>}
        {error && <ThemedText style={[styles.meta, styles.error]}>Failed</ThemedText>}
      </View>
    );
  }, []);

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
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={!!loading} onRefresh={handleRefresh} enabled={!!hasMore} />
      }
    />
  );
};

const styles = StyleSheet.create({
  listContent: { padding: 12, gap: 8 },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#333', // TODO: use theme tokens
  },
  mine: { alignSelf: 'flex-end', backgroundColor: '#2563eb' },
  theirs: { alignSelf: 'flex-start', backgroundColor: '#444' },
  content: { color: 'white' },
  meta: { fontSize: 10, marginTop: 4, color: '#ddd' },
  error: { color: '#f87171' },
});
