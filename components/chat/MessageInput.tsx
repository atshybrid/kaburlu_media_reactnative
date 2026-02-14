import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { BorderRadius } from '@/constants/BorderRadius';
import { Spacing } from '@/constants/Spacing';

interface MessageInputProps {
  onSend: (text: string) => void | Promise<void>;
  placeholder?: string;
}

export const MessageInput: React.FC<MessageInputProps> = ({ onSend, placeholder = 'Message' }) => {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try { await onSend(trimmed); setText(''); } finally { setSending(false); }
  }, [text, sending, onSend]);

  return (
    <View style={[styles.container, { backgroundColor: c.background, borderColor: c.border }]}
    >
      <TextInput
        style={[styles.input, { backgroundColor: c.card, color: c.text, borderColor: c.border }]}
        value={text}
        placeholder={placeholder}
        onChangeText={setText}
        multiline
        placeholderTextColor={c.muted}
      />
      <Pressable
        style={({ pressed }) => [
          styles.sendBtn,
          { backgroundColor: sending || !text.trim() ? c.border : c.tint, borderColor: c.border },
          pressed && { opacity: 0.8 },
          sending && { opacity: 0.7 },
        ]}
        onPress={handleSend}
        disabled={sending || !text.trim()}
      >
        <ThemedText style={styles.sendLabel}>{sending ? '...' : 'Send'}</ThemedText>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 140,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendBtn: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sendLabel: { color: 'white', fontWeight: '600' },
});
