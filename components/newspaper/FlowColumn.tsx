/**
 * FlowColumn
 *
 * Renders a list of FlowItems inside a column. Used by all three block types.
 * Supports optional image injection (handled by each parent block).
 */
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { FlowItem } from './types';
import HighlightsBox from './HighlightsBox';

export interface FlowColumnProps {
  items: FlowItem[];
  /** font size for body text */
  fontPx?: number;
  /** line height for body text */
  lineHeightPx?: number;
  fontPxHeading?: number;
  /** inject an image at the very top of this column */
  topImage?: { uri: string; caption?: string };
}

const FlowColumn: React.FC<FlowColumnProps> = ({
  items,
  fontPx = 11,
  lineHeightPx = 15,
  fontPxHeading = 12,
  topImage,
}) => {
  return (
    <View style={styles.col}>
      {topImage && (
        <View style={styles.imageWrap}>
          <Image source={{ uri: topImage.uri }} style={styles.image} resizeMode="cover" />
          {topImage.caption ? (
            <Text style={styles.caption}>{topImage.caption}</Text>
          ) : null}
        </View>
      )}
      {items.map((item, i) => {
        if (item.kind === 'highlights') {
          return <HighlightsBox key={i} items={item.items} fontPx={fontPx} />;
        }
        if (item.kind === 'heading') {
          return (
            <Text key={i} style={[styles.heading, { fontSize: fontPxHeading }]}>
              {item.text}
            </Text>
          );
        }
        if (item.kind === 'dateline') {
          return (
            <Text key={i} style={[styles.body, { fontSize: fontPx, lineHeight: lineHeightPx }]}>
              <Text style={styles.dateline}>{item.text} </Text>
            </Text>
          );
        }
        if (item.kind === 'text') {
          return (
            <Text key={i} style={[styles.body, { fontSize: fontPx, lineHeight: lineHeightPx }]}>
              {item.text}
            </Text>
          );
        }
        return null;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  col: {
    flex: 1,
  },
  imageWrap: {
    marginBottom: 4,
  },
  image: {
    width: '100%',
    aspectRatio: 4 / 3,
  },
  caption: {
    fontSize: 9,
    fontStyle: 'italic',
    color: '#555',
    marginTop: 2,
    textAlign: 'center',
  },
  heading: {
    fontWeight: '700',
    color: '#111',
    marginTop: 5,
    marginBottom: 2,
  },
  body: {
    color: '#222',
    textAlign: 'justify',
    marginBottom: 4,
  },
  dateline: {
    fontWeight: '700',
    color: '#111',
  },
});

export default FlowColumn;
