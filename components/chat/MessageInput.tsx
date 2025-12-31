import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '../ThemedText';

interface MessageInputProps {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, placeholder = 'Message' }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try { await onSend(trimmed); setText(''); } finally { setSending(false); }
  }, [text, sending, onSend]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        placeholder={placeholder}
        onChangeText={setText}
        multiline
        placeholderTextColor="#999"
      />
      <Pressable style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }, sending && { opacity: 0.5 }]} onPress={handleSend} disabled={sending}>
        <ThemedText style={styles.sendLabel}>{sending ? '...' : 'Send'}</ThemedText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'flex-end', padding: 8, gap: 8, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#333', backgroundColor: '#111' },
  input: { flex: 1, minHeight: 40, maxHeight: 120, color: 'white', padding: 8, borderRadius: 12, backgroundColor: '#222' },
  sendBtn: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#2563eb', borderRadius: 12 },
  sendLabel: { color: 'white', fontWeight: '600' },
});
