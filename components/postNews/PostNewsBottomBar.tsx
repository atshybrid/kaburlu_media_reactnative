import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

export interface BottomBarAction {
  label: string;
  icon?: keyof typeof MaterialIcons.glyphMap;
  iconPosition?: 'left' | 'right';
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
}

interface PostNewsBottomBarProps {
  actions: BottomBarAction[];
  busy?: boolean;
  busyText?: string;
  style?: ViewStyle;
}

export function PostNewsBottomBar({
  actions,
  busy,
  busyText,
  style,
}: PostNewsBottomBarProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  return (
    <View style={[styles.bottomBar, { borderTopColor: c.border, backgroundColor: c.background }, style]}>
      {busy || busyText ? (
        <View style={styles.busyRow}>
          <ThemedText style={{ color: c.muted }}>{busyText || 'Working…'}</ThemedText>
          {busy ? <ActivityIndicator size="small" /> : null}
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        {actions.map((action, idx) => {
          const isPrimary = action.primary;
          const isDisabled = action.disabled || busy;
          const iconLeft = action.icon && action.iconPosition !== 'right';
          const iconRight = action.icon && action.iconPosition === 'right';

          return (
            <Pressable
              key={idx}
              onPress={action.onPress}
              disabled={isDisabled}
              style={({ pressed }) => [
                styles.bottomBtn,
                {
                  borderColor: isPrimary ? primary : c.border,
                  backgroundColor: isPrimary ? primary : c.card,
                },
                pressed && !isDisabled && styles.pressed,
                isDisabled && { opacity: 0.5 },
              ]}
            >
              {iconLeft && action.icon ? (
                <MaterialIcons
                  name={action.icon}
                  size={18}
                  color={isPrimary ? c.background : c.text}
                />
              ) : null}
              <ThemedText
                type="defaultSemiBold"
                style={{ color: isPrimary ? c.background : c.text }}
              >
                {action.label}
              </ThemedText>
              {iconRight && action.icon ? (
                <MaterialIcons
                  name={action.icon}
                  size={18}
                  color={isPrimary ? c.background : primary}
                />
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  busyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bottomBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pressed: { opacity: 0.85 },
});

export default PostNewsBottomBar;
