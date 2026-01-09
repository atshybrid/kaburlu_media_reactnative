import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface PostNewsModalProps {
  visible: boolean;
  onClose?: () => void;
  title?: string;
  children: React.ReactNode;
  contentStyle?: ViewStyle;
  showCloseButton?: boolean;
  maxHeight?: number | string;
}

export function PostNewsModal({
  visible,
  onClose,
  title,
  children,
  contentStyle,
  showCloseButton = true,
  maxHeight = '70%',
}: PostNewsModalProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: c.card, borderColor: c.border, maxHeight: maxHeight as any },
            contentStyle,
          ]}
        >
          {(title || showCloseButton) && (
            <View style={styles.rowBetween}>
              {title ? (
                <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
                  {title}
                </ThemedText>
              ) : (
                <View />
              )}
              {showCloseButton && onClose ? (
                <Pressable onPress={onClose} hitSlop={10}>
                  <MaterialIcons name="close" size={20} color={c.text} />
                </Pressable>
              ) : (
                <View />
              )}
            </View>
          )}
          {children}
        </View>
      </View>
    </Modal>
  );
}

interface ModalListItemProps {
  icon?: keyof typeof MaterialIcons.glyphMap;
  label: string;
  sublabel?: string;
  onPress: () => void;
}

export function ModalListItem({ icon, label, sublabel, onPress }: ModalListItemProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickRow,
        { borderColor: c.border, backgroundColor: c.background },
        pressed && styles.pressed,
      ]}
    >
      {icon ? <MaterialIcons name={icon} size={18} color={primary} /> : null}
      <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>
        {label}
      </ThemedText>
      {sublabel ? (
        <ThemedText style={{ color: c.muted, marginLeft: 8 }}>{sublabel}</ThemedText>
      ) : null}
    </Pressable>
  );
}

interface LoadingModalProps {
  visible: boolean;
  text?: string;
  animation?: React.ReactNode;
}

export function LoadingModal({ visible, text = 'Working…', animation }: LoadingModalProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: c.text, opacity: 0.25 }]} />
        <View
          style={[
            styles.modalCard,
            { backgroundColor: c.card, borderColor: c.border, alignItems: 'center' },
          ]}
        >
          {animation}
          <ThemedText style={{ color: c.text, marginTop: 10 }}>{text}</ThemedText>
          <ActivityIndicator style={{ marginTop: 12 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  pickRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  pressed: { opacity: 0.85 },
});

export default PostNewsModal;
