/**
 * Block3in1col — Single-column newspaper block (3 inches wide)
 *
 * Layout (from screenshots):
 *   ┌─────────────────────────────────────┐
 *   │          [  T I T L E  ]            │  ← FitTitle, center, 2-line max
 *   │      (subtitle if present)          │
 *   │   ┌─────────────────────────────┐   │
 *   │   │         [IMAGE]             │   │  ← first image, 4:3 aspect
 *   │   │    caption (italic, 9px)    │   │
 *   │   └─────────────────────────────┘   │
 *   │   highlights box (if any)           │
 *   │   Dateline: text text text...       │  ← 11px justified paragraphs
 *   │   ...continued content...           │
 *   └─────────────────────────────────────┘
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FitTitle from './FitTitle';
import FlowColumn from './FlowColumn';
import { buildFlowItems, categoryColor } from './utils';
import type { NewspaperArticleData } from './types';

interface Block3in1colProps {
  data: NewspaperArticleData;
}

const Block3in1col: React.FC<Block3in1colProps> = ({ data }) => {
  const flowItems = buildFlowItems(data, { includeDateline: true });
  const firstImage = data.images?.[0];
  const catColor = categoryColor(data.category);

  return (
    <View style={styles.block}>
      {/* Title */}
      <FitTitle
        text={data.title}
        maxLines={2}
        minPx={9}
        maxPx={24}
        align="center"
        weight="700"
        style={styles.title}
      />

      {/* Subtitle */}
      {data.subtitle && (
        <Text style={[styles.subtitle, { color: catColor }]}>{data.subtitle}</Text>
      )}

      {/* Content: image (if any) + flow items */}
      <FlowColumn
        items={flowItems}
        fontPx={11}
        lineHeightPx={15}
        fontPxHeading={12}
        topImage={firstImage}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  block: {
    padding: 5,
    borderWidth: 0.5,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 3,
    elevation: 2,
  },
  title: {
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 12 * 1.35,
    textAlign: 'center',
    marginBottom: 5,
  },
});

export default Block3in1col;
