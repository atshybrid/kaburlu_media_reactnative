import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MessageInput } from '../../../components/chat/MessageInput';
import { MessageList } from '../../../components/chat/MessageList';
import { ThemedText } from '../../../components/ThemedText';
import { useMessages } from '../../../hooks/useMessages';
import { useChatStore } from '../../../state/chatStore';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Spacing } from '@/constants/Spacing';
import type { Message } from '@/types/chat';

export default function DirectChatScreen() {
  const router = useRouter();
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = params.id;
  const ensureDirectChat = useChatStore((s: any) => s.ensureDirectChat);
  const chats = useChatStore((s: any) => s.chats);
  useEffect(() => { if (chatId) ensureDirectChat(chatId).catch(()=>{}); }, [chatId, ensureDirectChat]);
  const { messages, sendMessage, loadOlder, hasMore, loading } = useMessages(chatId);

  const demoMessages: Message[] = useMemo(() => {
    const now = Date.now();
    const title = (chatId && chats?.[chatId]?.title) ? String(chats[chatId].title) : 'KaChat';
    return [
      { id: `${chatId}:demo:1`, chatId: String(chatId ?? 'demo'), senderUserId: 'other', content: `Hi! This is a sample chat preview for “${title}”.`, createdAt: now - 1000 * 60 * 6, sample: true },
      { id: `${chatId}:demo:2`, chatId: String(chatId ?? 'demo'), senderUserId: 'me', content: 'Nice—so the chat screen is never blank.', createdAt: now - 1000 * 60 * 5, sample: true },
      { id: `${chatId}:demo:3`, chatId: String(chatId ?? 'demo'), senderUserId: 'other', content: 'You can start typing below to send a real message.', createdAt: now - 1000 * 60 * 4, sample: true },
    ];
  }, [chatId, chats]);

  const displayMessages = messages.length ? messages : (loading ? messages : demoMessages);

  if (!chatId) {
    return (
      <View style={[styles.center, { backgroundColor: c.background }]}> 
        <ThemedText>Missing chat id</ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}> 
      <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.background }]}> 
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ThemedText style={{ color: c.tint, fontWeight: '800' }}>Back</ThemedText>
        </Pressable>
        <View style={{ flex: 1 }}>
          <ThemedText style={{ fontSize: 16, fontWeight: '800', color: c.text }} numberOfLines={1}>
            {String(chats?.[chatId]?.title ?? 'Direct Chat')}
          </ThemedText>
          {!loading && !messages.length && (
            <ThemedText style={{ color: c.muted, fontSize: 12 }}>
              Showing sample messages
            </ThemedText>
          )}
        </View>
      </View>

      <MessageList messages={displayMessages} onLoadOlder={loadOlder} hasMore={hasMore} loading={loading} />
      <MessageInput onSend={sendMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    paddingVertical: 8,
    paddingRight: 8,
  },
});
