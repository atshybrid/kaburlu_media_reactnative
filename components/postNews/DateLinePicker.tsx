import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { ActivityIndicator, Pressable, StyleSheet, View, ViewStyle } from 'react-native';

interface DateLinePickerProps {
  value?: string | null;
  error?: string;
  loading?: boolean;
  onPress: () => void;
  placeholder?: string;
  style?: ViewStyle;
}

export function DateLinePicker({
  value,
  error,
  loading,
  onPress,
  placeholder = 'Search and select location',
  style,
}: DateLinePickerProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];
  const primary = c.tint;

  const hasError = !!error;

  return (
    <View style={style}>
      <View style={styles.rowBetween}>
        <ThemedText type="defaultSemiBold" style={{ color: c.text }}>
          Date Line
        </ThemedText>
        {loading ? <ActivityIndicator size="small" /> : null}
      </View>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.picker,
          {
            borderColor: hasError ? '#e53935' : c.border,
            backgroundColor: c.background,
          },
          pressed && styles.pressed,
        ]}
      >
        <MaterialIcons name="place" size={18} color={hasError ? '#e53935' : primary} />
        <ThemedText
          style={{ color: value ? c.text : c.muted, flex: 1 }}
          numberOfLines={1}
        >
          {value || placeholder}
        </ThemedText>
        <MaterialIcons name="chevron-right" size={22} color={c.muted} />
      </Pressable>

      {hasError ? (
        <View style={styles.errorRow}>
          <MaterialIcons name="error-outline" size={16} color="#e53935" />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  picker: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  errorText: {
    color: '#e53935',
    fontSize: 13,
  },
  pressed: { opacity: 0.85 },
});

export default DateLinePicker;
