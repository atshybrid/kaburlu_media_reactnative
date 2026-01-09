import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface PostNewsAppBarProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export function PostNewsAppBar({
  title = 'Post News',
  subtitle,
  onBack,
  rightAction,
  style,
}: PostNewsAppBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const router = useRouter();

  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={[styles.appBar, { borderBottomColor: c.border, backgroundColor: c.background }, style]}>
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.iconBtn,
          { borderColor: c.border, backgroundColor: c.card },
          pressed && styles.pressed,
        ]}
        hitSlop={10}
        accessibilityLabel="Go back"
      >
        <MaterialIcons name="arrow-back" size={22} color={c.text} />
      </Pressable>

      <View style={styles.appBarCenter} pointerEvents="none">
        <ThemedText type="defaultSemiBold" style={[styles.title, { color: c.text }]}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.subtitle, { color: c.muted }]}>{subtitle}</ThemedText>
        ) : null}
      </View>

      {rightAction ? (
        <View style={styles.rightAction}>{rightAction}</View>
      ) : (
        <View style={styles.appBarRightSpacer} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appBarCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16 },
  subtitle: { fontSize: 12, marginTop: 2 },
  appBarRightSpacer: { width: 40 },
  rightAction: { width: 40, alignItems: 'center' },
  pressed: { opacity: 0.85 },
});

export default PostNewsAppBar;
