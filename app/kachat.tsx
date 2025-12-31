import { Colors } from '@/constants/Colors';
// import CommentIcon from '@/icons/CommentIcon';
import EventIcon from '@/icons/EventIcon';
import MessageIcon from '@/icons/MessageIcon';
import MoreIcon from '@/icons/MoreIcon';
import PeopleIcon from '@/icons/PeopleIcon';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

// Simple in-memory chat store fallback
interface ChatMessage {
  id: string;
  user: string;
  text: string;
  ts: number;
}
type ChatItem = ChatMessage | { id: string; type: 'date'; label: string };

// Profile type/flow moved to a dedicated join screen

export default function KaChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [joined, setJoined] = useState<boolean>(false);
  const [myName, setMyName] = useState<string>('You');
  const listRef = useRef<FlatList<ChatItem>>(null);
  const [inputHeight, setInputHeight] = useState<number>(56);
  const [atBottom, setAtBottom] = useState(true);
  const [currentThread, setCurrentThread] = useState<null | 'family'>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'updates' | 'ftree' | 'more'>('chats');
  const NAV_H = 62;
  const NAV_M = 12;
  const navVisible = !(activeTab === 'chats' && currentThread);
  const navBottom = NAV_M + insets.bottom;
  const fabBottom = navVisible ? (insets.bottom + NAV_H + NAV_M + 18) : (insets.bottom + 20);

  const mockGroups = useMemo(() => ([
    { id: 'family', name: 'Kaburlu Family', last: 'Dinner at 8 PM, all?', time: '7:45 PM', unread: 3 },
    { id: 'cousins', name: 'Cousins', last: 'LOL that was epic 😂', time: '6:12 PM', unread: 0 },
    { id: 'parents', name: 'Parents', last: 'Call when free', time: 'Yesterday', unread: 1 },
  ]), []);
  const familyParticipants = [
    { name: 'Arjun', relation: 'You' },
    { name: 'Meera', relation: 'Spouse' },
    { name: 'Ravi', relation: 'Father' },
    { name: 'Sita', relation: 'Mother' },
    { name: 'Diya', relation: 'Sister' },
  ];

  useEffect(() => {
    (async () => {
      // Load profile to decide joined state
      const saved = await AsyncStorage.getItem('kachat:profile');
      if (saved) {
        setJoined(true);
        try { setMyName(JSON.parse(saved)?.firstName || 'You'); } catch {}
      }
      // Load cached messages (optional stub)
      const cached = await AsyncStorage.getItem('kachat:messages');
      if (cached) {
        try { setMessages(JSON.parse(cached)); } catch {}
      }
    })();
  }, []);

  // Refresh join state when screen gains focus
  useFocusEffect(
    useCallback(() => {
      // Hide native header to prevent double app bar
      // @ts-ignore - depends on navigator implementation
      navigation?.setOptions?.({ headerShown: false });
      (async () => {
        const saved = await AsyncStorage.getItem('kachat:profile');
        if (saved) {
          setJoined(true);
          try { setMyName(JSON.parse(saved)?.firstName || 'You'); } catch {}
        }
      })();
    }, [navigation])
  );

  const onSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!joined) {
      router.push('/kachat/join' as any);
      return;
    }
    const saved = await AsyncStorage.getItem('kachat:profile');
    const user = saved ? (JSON.parse(saved)?.firstName || 'You') : 'You';
    const msg: ChatMessage = { id: String(Date.now()), user, text, ts: Date.now() };
    const next = [...messages, msg];
    setMessages(next);
    setInput('');
    await AsyncStorage.setItem('kachat:messages', JSON.stringify(next));
    // Scroll to bottom after send
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  // Inject date separators for nicer UX
  const data: ChatItem[] = useMemo(() => {
    const out: ChatItem[] = [];
    let lastDay = '';
    for (const m of messages) {
      const d = new Date(m.ts);
      const dayLabel = d.toDateString();
      if (dayLabel !== lastDay) {
        lastDay = dayLabel;
        out.push({ id: `date-${d.toISOString()}`, type: 'date', label: dayLabel });
      }
      out.push(m);
    }
    return out;
  }, [messages]);

  const renderItem = ({ item }: { item: ChatItem }) => {
    if ((item as any).type === 'date') {
      const label = (item as any).label as string;
      return (
        <View style={styles.dateChipWrap}>
          <Text style={styles.dateChip}>{label}</Text>
        </View>
      );
    }
    const msg = item as ChatMessage;
    const isMe = msg.user === myName || msg.user === 'You';
    return (
      <View style={[styles.msgRow, isMe ? styles.msgRowMe : styles.msgRowOther]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.msgUser}>{msg.user}</Text>}
          <Text style={styles.msgText}>{msg.text}</Text>
          <Text style={styles.msgTime}>{new Date(msg.ts).toLocaleTimeString().replace(/:\d{2}\s/, ' ')}</Text>
        </View>
      </View>
    );
  };

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return mockGroups;
    return mockGroups.filter(g => g.name.toLowerCase().includes(q) || g.last.toLowerCase().includes(q));
  }, [search, mockGroups]);

  const renderChatsList = () => (
    <FlatList
      data={filteredGroups}
      keyExtractor={(g) => g.id}
      contentContainerStyle={{ paddingVertical: 6, paddingBottom: navVisible ? (insets.bottom + NAV_H + NAV_M + 24) : (insets.bottom + 12) }}
      ListHeaderComponent={(
        <View style={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 }}>
          <View style={styles.searchBar}>
            <TextInput
              placeholder="Search"
              placeholderTextColor="#9ca3af"
              value={search}
              onChangeText={setSearch}
              style={{ flex: 1, color: '#111' }}
            />
          </View>
        </View>
      )}
      renderItem={({ item }) => (
        <Pressable
          style={styles.threadRow}
          onPress={() => {
            if (item.id === 'family') {
              setCurrentThread('family');
              if (messages.length === 0) {
                const seed: ChatMessage[] = [
                  { id: 'm1', user: 'Ravi (Father)', text: 'Dinner at 8 PM, all?', ts: Date.now() - 1000 * 60 * 25 },
                  { id: 'm2', user: 'Sita (Mother)', text: 'Yes, I will cook paneer. 😊', ts: Date.now() - 1000 * 60 * 23 },
                  { id: 'm3', user: 'Meera (Spouse)', text: 'I will bring sweets!', ts: Date.now() - 1000 * 60 * 22 },
                ];
                setMessages(seed);
              }
            } else {
              setCurrentThread(null);
            }
          }}
        >
          <View style={styles.threadAvatar}><Text style={styles.threadAvatarText}>{item.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</Text></View>
          <View style={styles.threadBody}>
            <View style={styles.threadTop}>
              <Text style={styles.threadName}>{item.name}</Text>
              <Text style={styles.threadTime}>{item.time}</Text>
            </View>
            {item.id === 'family' && (
              <Text style={styles.threadParticipants} numberOfLines={1}>
                {familyParticipants.map(p => `${p.name} (${p.relation})`).join(', ')}
              </Text>
            )}
            <View style={styles.threadBottom}>
              <Text style={styles.threadLast} numberOfLines={1}>{item.last}</Text>
              {item.unread > 0 && (
                <View style={styles.unreadBadge}><Text style={styles.unreadText}>{item.unread}</Text></View>
              )}
            </View>
          </View>
        </Pressable>
      )}
    />
  );

  const renderChatRoom = () => (
    <KeyboardAvoidingView behavior={Platform.select({ ios: 'padding', android: undefined })} style={{ flex: 1 }}>
      <FlatList
        ref={listRef}
        data={data}
        keyExtractor={(it) => it.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 12, paddingBottom: inputHeight + 16 }}
        onContentSizeChange={() => atBottom && listRef.current?.scrollToEnd({ animated: false })}
        onScroll={(e) => {
          const { contentSize, contentOffset, layoutMeasurement } = e.nativeEvent;
          const bottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 32;
          setAtBottom(bottom);
        }}
        scrollEventThrottle={16}
      />
      {!atBottom && (
        <Pressable style={[styles.scrollToBottom, { bottom: inputHeight + insets.bottom + 16 }]} onPress={() => listRef.current?.scrollToEnd({ animated: true })}>
          <Text style={styles.scrollToBottomText}>↓</Text>
        </Pressable>
      )}
      <View style={[styles.inputRow, { paddingBottom: Math.max(8, insets.bottom) }]} onLayout={(e) => setInputHeight(e.nativeEvent.layout.height)}>
        <View style={styles.composer}>
          <Pressable style={styles.emojiBtn} onPress={() => {}}><Text style={{ fontSize: 18 }}>😊</Text></Pressable>
          <TextInput
            style={[styles.input, !joined && { opacity: 0.6 }]}
            placeholder={joined ? 'Message' : 'Join to send messages'}
            value={input}
            onChangeText={setInput}
            editable={joined}
          />
          <Pressable style={styles.emojiBtn} onPress={() => {}}><Text style={{ fontSize: 18 }}>📎</Text></Pressable>
        </View>
        <Pressable
          style={[styles.actionBtn, !joined && styles.actionBtnDisabled]}
          onPress={() => {
            if (!joined) { router.push('/kachat/join' as any); return; }
            if (input.trim().length === 0) { /* mic tap */ return; }
            onSend();
          }}
        >
          <Text style={styles.actionBtnText}>{!joined ? 'Join' : (input.trim().length === 0 ? '🎤' : '➤')}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );

  // Secondary tabs removed; focus on chats only

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      {/* App Bar */}
      <View style={[styles.appBar, { paddingTop: insets.top, paddingBottom: 10, justifyContent: 'space-between' }]}>
        {currentThread ? (
          <>
            <Pressable onPress={() => setCurrentThread(null)} style={styles.backBtn}><Text style={styles.backBtnText}>‹</Text></Pressable>
            <View style={styles.titleRow}>
              <View style={styles.appAvatar}><Text style={styles.threadAvatarText}>KF</Text></View>
              <View>
                <Text style={styles.appBarTitle}>Kaburlu Family</Text>
                <Text style={styles.appBarSub}>5 members</Text>
              </View>
            </View>
            <View style={styles.appBarActions}>
              <Pressable style={styles.iconBtn}><Text style={{ fontSize: 16, color: Colors.light.primary }}>🔍</Text></Pressable>
              <Pressable style={styles.iconBtn}><MoreIcon size={22} color={Colors.light.primary} /></Pressable>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.brandName}>Kaburlu</Text>
            <View style={styles.appBarActions}>
              <Pressable style={styles.iconBtn}><Text style={{ fontSize: 16, color: Colors.light.primary }}>🛟</Text></Pressable>
            </View>
          </>
        )}
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {currentThread ? (
          renderChatRoom()
        ) : (
          activeTab === 'chats' ? (
            renderChatsList()
          ) : (
            <View style={styles.placeholderWrap}>
              <Text style={styles.placeholderTitle}>
                {activeTab === 'updates' ? 'Updates' : activeTab === 'ftree' ? 'Family Tree' : 'More'}
              </Text>
              <Text style={styles.placeholderText}>Coming soon</Text>
            </View>
          )
        )}
      </View>

      {/* Bottom navigation bar (floating). Hide inside thread for better chat UX */}
      {navVisible && (
        <View style={[styles.bottomNav, { bottom: navBottom }]}>
          <Pressable style={styles.navItem} onPress={() => { setActiveTab('chats'); setCurrentThread(null); }}>
            <MessageIcon size={28} color={activeTab === 'chats' ? Colors.light.primary : '#9BA1A6'} />
            <Text style={[styles.navLabel, activeTab !== 'chats' && { color: '#9BA1A6' }]}>Chats</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => { setActiveTab('updates'); setCurrentThread(null); }}>
            <EventIcon size={28} color={activeTab === 'updates' ? Colors.light.primary : '#9BA1A6'} />
            <Text style={[styles.navLabel, activeTab !== 'updates' && { color: '#9BA1A6' }]}>Updates</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => { setActiveTab('ftree'); setCurrentThread(null); }}>
            <PeopleIcon size={28} color={activeTab === 'ftree' ? Colors.light.primary : '#9BA1A6'} />
            <Text style={[styles.navLabel, activeTab !== 'ftree' && { color: '#9BA1A6' }]}>F-Tree</Text>
          </Pressable>
          <Pressable style={styles.navItem} onPress={() => { setActiveTab('more'); setCurrentThread(null); }}>
            <MoreIcon size={28} color={activeTab === 'more' ? Colors.light.primary : '#9BA1A6'} />
            <Text style={[styles.navLabel, activeTab !== 'more' && { color: '#9BA1A6' }]}>More</Text>
          </Pressable>
        </View>
      )}

      {/* Floating Join FAB on main chats only */}
      {!joined && activeTab === 'chats' && !currentThread && (
        <Pressable style={[styles.joinFab, { bottom: fabBottom }]} onPress={() => router.push('/kachat/join' as any)}>
          <Text style={styles.joinFabText}>Join</Text>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  appBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, backgroundColor: Colors.light.card, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb' },
  appBarTitle: { fontSize: 20, fontWeight: '800', color: Colors.light.primary },
  appBarSub: { fontSize: 12, color: '#6b7280' },
  backBtn: { marginRight: 8, marginLeft: -6, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 24, color: Colors.light.primary, lineHeight: 24 },
  // Bottom nav and FAB removed
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandName: { fontSize: 22, fontWeight: '900', color: Colors.light.primary },
  searchWrap: { flex: 1, height: 36, borderRadius: 18, backgroundColor: '#f3f4f6', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center' },
  searchPlaceholder: { color: '#9ca3af', fontSize: 14 },
  searchBar: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 18, height: 40, paddingHorizontal: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  appAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  bottomNav: { position: 'absolute', left: 12, right: 12, bottom: 12, flexDirection: 'row', height: 62, backgroundColor: Colors.light.card, borderRadius: 16, justifyContent: 'space-around', alignItems: 'center', paddingBottom: 2, elevation: 10, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, borderWidth: StyleSheet.hairlineWidth, borderColor: '#e5e7eb' },
  navItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 12, color: Colors.light.primary, fontWeight: '700', marginTop: 2 },
  joinFab: { position: 'absolute', right: 20, bottom: 92, backgroundColor: Colors.light.primary, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
  joinFabText: { color: '#fff', fontWeight: '800' },
  threadRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  threadAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  threadAvatarText: { fontWeight: '800', color: '#374151' },
  threadBody: { flex: 1, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e7eb', paddingBottom: 10 },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  threadName: { fontWeight: '800', fontSize: 16 },
  threadTime: { color: '#6b7280', fontSize: 12 },
  threadBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  threadLast: { color: '#374151', flex: 1, marginRight: 8 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  placeholderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  placeholderTitle: { fontWeight: '800', fontSize: 18 },
  placeholderText: { color: '#6b7280' },
  // Modern chat composer
  inputRow: { flexDirection: 'row', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#eee' },
  composer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 24, paddingHorizontal: 10, paddingVertical: 8, marginRight: 8 },
  emojiBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, paddingHorizontal: 8, paddingVertical: 6 },
  actionBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.light.primary, alignItems: 'center', justifyContent: 'center' },
  actionBtnDisabled: { backgroundColor: '#94a3b8' },
  actionBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  msgRow: { flexDirection: 'row', marginBottom: 8, paddingHorizontal: 8 },
  msgRowMe: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 12 },
  bubbleMe: { backgroundColor: '#daf8cb', borderTopRightRadius: 2 },
  bubbleOther: { backgroundColor: '#f0f0f0', borderTopLeftRadius: 2 },
  msgUser: { fontWeight: '700', marginBottom: 4, color: '#333' },
  msgText: { flexShrink: 1, color: '#111' },
  msgTime: { alignSelf: 'flex-end', color: '#666', fontSize: 10, marginTop: 4 },
  dateChipWrap: { alignItems: 'center', marginVertical: 10 },
  dateChip: { fontSize: 12, color: '#6b7280', backgroundColor: '#eef2ff', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 12 },
  scrollToBottom: { position: 'absolute', right: 16, bottom: 160, width: 36, height: 36, borderRadius: 18, backgroundColor: '#111827', opacity: 0.85, alignItems: 'center', justifyContent: 'center' },
  threadParticipants: { color: '#6b7280', fontSize: 12, marginTop: 2 },
  scrollToBottomText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
