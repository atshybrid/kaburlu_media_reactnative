import { useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '../../components/ThemedText';
import { useChatStore } from '../../state/chatStore';

export default function DirectChatListScreen() {
  const router = useRouter();
  const { directChatIds, chats } = useChatStore((s: any) => ({ directChatIds: s.directChatIds, chats: s.chats }));

  return (
    <FlatList
      style={styles.list}
      data={directChatIds}
      keyExtractor={(id: string) => id}
      renderItem={({ item }) => {
        const chat = chats[item];
        return (
          <Pressable style={styles.row} onPress={() => (router.push as any)({ pathname: '/kachat/direct/[id]', params: { id: item } })}>
            <ThemedText>{chat?.title || 'Direct Chat'}</ThemedText>
          </Pressable>
        );
      }}
      ListEmptyComponent={<View style={styles.empty}><ThemedText>No direct chats yet.</ThemedText></View>}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: 'black' },
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#222' },
  empty: { padding: 32, alignItems: 'center' },
});
