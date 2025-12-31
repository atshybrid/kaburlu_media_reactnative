import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { MessageInput } from '../../components/chat/MessageInput';
import { MessageList } from '../../components/chat/MessageList';
import { ThemedText } from '../../components/ThemedText';
import { useMessages } from '../../hooks/useMessages';
import { useChatStore } from '../../state/chatStore';

export default function FamilyChatScreen() {
  const { familyChatId, initFamily } = useChatStore((s: any) => ({ familyChatId: s.familyChatId, initFamily: s.initFamily }));
  useEffect(() => { if (!familyChatId) initFamily(); }, [familyChatId, initFamily]);
  const { messages, sendMessage, loadOlder, hasMore, loading } = useMessages(familyChatId);

  if (!familyChatId) {
    return <View style={styles.center}><ThemedText>Loading family chat...</ThemedText></View>;
  }
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
