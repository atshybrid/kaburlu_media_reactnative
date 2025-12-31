import { getLanguageIcon } from '@/icons/languageIcons';
import { useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

type Props = {
  languageCode?: string | null;
  onPress?: () => void;
  style?: ViewStyle;
  size?: number; // diameter
};

// Small FAB that changes its inner glyph based on language code.
// For English: shows "EN"; for Telugu (te/te-IN): shows "తెలు"; otherwise, first 2 letters uppercased.
export default function LanguageFab({ languageCode, onPress, style, size = 56 }: Props) {
  const label = useMemo(() => {
    const code = (languageCode || 'en').toLowerCase();
    if (code.startsWith('te')) return 'తెలు';
    if (code.startsWith('en')) return 'EN';
    return code.slice(0, 2).toUpperCase();
  }, [languageCode]);
  const IconComp = useMemo(() => getLanguageIcon(languageCode), [languageCode]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { width: size, height: size, borderRadius: size / 2, opacity: pressed ? 0.9 : 1 },
        style,
      ]}
      accessibilityRole="button"
      accessibilityLabel="Change language"
    >
      <View style={styles.inner}>
        {IconComp ? (
          <IconComp width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} preserveAspectRatio="xMidYMid meet" />
        ) : (
          <Text style={styles.text}>{label}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    backgroundColor: '#2563eb',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
      android: { elevation: 6 },
      default: {},
    }),
  },
  inner: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700', fontSize: 14, letterSpacing: 0.5 },
});
