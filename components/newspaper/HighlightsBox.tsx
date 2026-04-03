/**
 * HighlightsBox
 *
 * Renders bullet-point highlights section using the shared spec style.
 * Background: #fbf6e8, border: 1px solid #c8b97a, left accent bar: 3px #d35400
 * Bullet: filled square ▪ in #d35400
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { HIGHLIGHT_STYLE } from './utils';

interface HighlightsBoxProps {
  items: string[];
  fontPx?: number;
}

const HighlightsBox: React.FC<HighlightsBoxProps> = ({ items, fontPx = 10 }) => {
  if (!items.length) return null;
  return (
    <View style={styles.outer}>
      {items.map((item, i) => (
        <View key={i} style={styles.row}>
          <Text style={[styles.bullet, { fontSize: fontPx }]}>▪</Text>
          <Text style={[styles.text, { fontSize: fontPx, lineHeight: fontPx * 1.55 }]}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  outer: {
    backgroundColor: HIGHLIGHT_STYLE.bg,
    borderWidth: 1,
    borderColor: HIGHLIGHT_STYLE.border,
    borderLeftWidth: 3,
    borderLeftColor: HIGHLIGHT_STYLE.leftBorder,
    paddingHorizontal: 7,
    paddingVertical: 6,
    marginBottom: 5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: 3,
  },
  bullet: {
    color: HIGHLIGHT_STYLE.bulletColor,
    marginTop: 1,
  },
  text: {
    flex: 1,
    color: '#222',
    fontFamily: 'System',
  },
});

export default HighlightsBox;
