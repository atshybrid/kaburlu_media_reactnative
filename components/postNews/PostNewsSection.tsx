import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

interface PostNewsSectionProps {
  children: React.ReactNode;
  style?: ViewStyle;
  noPadding?: boolean;
}

export function PostNewsSection({ children, style, noPadding }: PostNewsSectionProps) {
  const scheme = useColorScheme() ?? 'light';
  const c = Colors[scheme];

  return (
    <View
      style={[
        styles.section,
        { borderColor: c.border, backgroundColor: c.card },
        noPadding && { padding: 0 },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
  },
});

export default PostNewsSection;
