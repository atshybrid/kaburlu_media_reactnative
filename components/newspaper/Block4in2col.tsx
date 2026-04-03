/**
 * Block4in2col — Two-column balanced newspaper block (4 inches wide)
 *
 * Layout:
 *   ┌────────────────────────────────────────────────────────┐
 *   │                 [  T I T L E  ] single-line            │  ← FitTitle 18–28px
 *   │                (subtitle if present)                    │
 *   ├──────────────────────────┬─────────────────────────────┤
 *   │ [highlights if any]      │ [IMAGE first-only]          │
 *   │ Dateline body text…      │ caption                     │
 *   │ continues flowing…       │ overflow text continues…    │
 *   │ …balanced with col 2…    │ …balanced with col 1…       │
 *   └──────────────────────────┴─────────────────────────────┘
 *
 * Balancing: measure each flow item at column width, iteratively shift
 * the split index until adjacent column heights differ ≤ 6px (max 120 tries).
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FitTitle from './FitTitle';
import FlowColumn from './FlowColumn';
import HighlightsBox from './HighlightsBox';
import type { FlowItem, NewspaperArticleData } from './types';
import { buildFlowItems, categoryColor } from './utils';

interface Block4in2colProps {
  data: NewspaperArticleData;
}

const COL_GAP = 8;
const MAX_ITER = 120;
const TARGET_DIFF = 6;

const Block4in2col: React.FC<Block4in2colProps> = ({ data }) => {
  const catColor = categoryColor(data.category);
  const firstImage = data.images?.[0];

  // Build flow: text only (highlights extracted separately)
  const hasHighlights = !!data.highlights?.length;
  const textFlow: FlowItem[] = buildFlowItems(
    { ...data, highlights: undefined },
    { includeDateline: true },
  );

  // ── Measurement state ───────────────────────────────────────────────────────
  const [colWidth, setColWidth] = useState(0);
  const measuredHeights = useRef<Map<number, number>>(new Map());
  const [splitIndex, setSplitIndex] = useState<number>(Math.ceil(textFlow.length / 2));

  const onBlockLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const w = (e.nativeEvent.layout.width - COL_GAP - 10) / 2; // 10 = 2×padding
      if (Math.abs(w - colWidth) > 1) {
        setColWidth(w);
        measuredHeights.current = new Map();
        setSplitIndex(Math.ceil(textFlow.length / 2));
      }
    },
    [colWidth, textFlow.length],
  );

  // Record each item's measured height from the hidden pass
  const onItemLayout = useCallback(
    (index: number, height: number) => {
      measuredHeights.current.set(index, height);
      if (measuredHeights.current.size === textFlow.length) {
        computeSplit();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [textFlow.length, colWidth],
  );

  const computeSplit = () => {
    const heights = textFlow.map((_, i) => measuredHeights.current.get(i) ?? 0);
    const total = heights.reduce((s, h) => s + h, 0);
    let split = Math.ceil(textFlow.length / 2);
    let bestDiff = Infinity;

    for (let iter = 0; iter < MAX_ITER && iter < textFlow.length; iter++) {
      const col1H = heights.slice(0, split).reduce((s, h) => s + h, 0);
      const col2H = total - col1H;
      const diff = Math.abs(col1H - col2H);

      if (diff < bestDiff) {
        bestDiff = diff;
      }
      if (diff <= TARGET_DIFF) break;

      // Shift split toward the taller column
      if (col1H > col2H && split > 1) {
        split -= 1;
      } else if (col2H > col1H && split < textFlow.length - 1) {
        split += 1;
      } else {
        break;
      }
    }
    setSplitIndex(split);
  };

  const col1Items = textFlow.slice(0, splitIndex);
  const col2Items = textFlow.slice(splitIndex);

  return (
    <View style={styles.block} onLayout={onBlockLayout}>
      {/* Title spanning full width */}
      <FitTitle
        text={data.title}
        singleLine
        minPx={18}
        maxPx={28}
        align="center"
        weight="700"
        style={styles.title}
      />

      {/* Subtitle */}
      {data.subtitle && (
        <Text style={[styles.subtitle, { color: catColor }]}>{data.subtitle}</Text>
      )}

      {/* Two columns */}
      {colWidth > 0 && (
        <View style={styles.columns}>
          {/* Column 1 */}
          <View style={[styles.col, { width: colWidth }]}>
            {hasHighlights && <HighlightsBox items={data.highlights!} fontPx={10} />}
            <FlowColumn items={col1Items} fontPx={11} lineHeightPx={16} fontPxHeading={12} />
          </View>

          <View style={styles.colGap} />

          {/* Column 2 */}
          <View style={[styles.col, { width: colWidth }]}>
            <FlowColumn
              items={col2Items}
              fontPx={11}
              lineHeightPx={16}
              fontPxHeading={12}
              topImage={firstImage}
            />
          </View>
        </View>
      )}

      {/* ── Hidden measurement pass ─────────────────────────────────────────── */}
      {colWidth > 0 && measuredHeights.current.size < textFlow.length && (
        <View
          style={{ position: 'absolute', opacity: 0, top: 9999, left: 0, width: colWidth }}
          pointerEvents="none"
        >
          {textFlow.map((item, i) => (
            <MeasureItem
              key={`m-${i}`}
              item={item}
              fontPx={11}
              lineHeightPx={16}
              fontPxHeading={12}
              onMeasured={(h) => onItemLayout(i, h)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ── Measure helper ────────────────────────────────────────────────────────────
interface MeasureItemProps {
  item: FlowItem;
  fontPx: number;
  lineHeightPx: number;
  fontPxHeading: number;
  onMeasured: (height: number) => void;
}

const MeasureItem: React.FC<MeasureItemProps> = ({
  item,
  fontPx,
  lineHeightPx,
  fontPxHeading,
  onMeasured,
}) => {
  if (item.kind === 'highlights') {
    return (
      <View onLayout={(e) => onMeasured(e.nativeEvent.layout.height)}>
        <HighlightsBox items={item.items} fontPx={fontPx} />
      </View>
    );
  }
  if (item.kind === 'heading') {
    return (
      <View onLayout={(e) => onMeasured(e.nativeEvent.layout.height)}>
        <Text style={{ fontSize: fontPxHeading, fontWeight: '700', color: '#111' }}>
          {item.text}
        </Text>
      </View>
    );
  }
  if (item.kind === 'text' || item.kind === 'dateline') {
    return (
      <View onLayout={(e) => onMeasured(e.nativeEvent.layout.height)}>
        <Text style={{ fontSize: fontPx, lineHeight: lineHeightPx, color: '#222', textAlign: 'justify' }}>
          {item.text}
        </Text>
      </View>
    );
  }
  return <View onLayout={(e) => onMeasured(e.nativeEvent.layout.height)} />;
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
    lineHeight: 12 * 1.3,
    textAlign: 'center',
    marginBottom: 5,
  },
  columns: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  col: {
    flexShrink: 0,
  },
  colGap: {
    width: COL_GAP,
  },
});

export default Block4in2col;
