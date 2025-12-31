import { useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { MessageInput } from '../../../components/chat/MessageInput';
import { MessageList } from '../../../components/chat/MessageList';
import { ThemedText } from '../../../components/ThemedText';
import { useMessages } from '../../../hooks/useMessages';
import { useChatStore } from '../../../state/chatStore';

export default function DirectChatScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const chatId = params.id;
  const ensureDirectChat = useChatStore((s: any) => s.ensureDirectChat);
  useEffect(() => { if (chatId) ensureDirectChat(chatId).catch(()=>{}); }, [chatId, ensureDirectChat]);
  const { messages, sendMessage, loadOlder, hasMore, loading } = useMessages(chatId);
  if (!chatId) return <View style={styles.center}><ThemedText>Missing chat id</ThemedText></View>;
  return (
    <View style={styles.container}>
      <MessageList messages={messages} onLoadOlder={loadOlder} hasMore={hasMore} loading={loading} />
      <MessageInput onSend={sendMessage} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'black' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'black' },
});
