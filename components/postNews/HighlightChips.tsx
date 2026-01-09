import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface HighlightChipsProps {
  highlights: string[];
  maxCount?: number;
  onEdit?: (index: number) => void;
  onRemove?: (index: number) => void;
  style?: ViewStyle;
}

export function HighlightChips({
  highlights,
  maxCount = 5,
  onEdit,
  onRemove,
  style,
}: HighlightChipsProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  const list = highlights.slice(0, maxCount).filter((h) => h.trim());

  if (!list.length) {
    return (
      <View style={style}>
        <ThemedText style={{ color: c.muted, marginTop: 8 }}>
          Add up to {maxCount} highlights.
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {list.map((text, idx) => (
        <Pressable
          key={`${idx}-${text}`}
          onPress={() => onEdit?.(idx)}
          style={[
            styles.chip,
            {
              borderColor: c.border,
              backgroundColor: c.background,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Edit highlight ${idx + 1}`}
        >
          <ThemedText style={{ color: c.text, flex: 1 }} numberOfLines={1}>
            {text}
          </ThemedText>
          {onRemove ? (
            <Pressable
              onPress={() => onRemove(idx)}
              hitSlop={8}
              style={({ pressed }) => [pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`Remove highlight ${idx + 1}`}
            >
              <MaterialIcons name="close" size={18} color={c.muted} />
            </Pressable>
          ) : null}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: '100%',
  },
  pressed: { opacity: 0.85 },
});

export default HighlightChips;
