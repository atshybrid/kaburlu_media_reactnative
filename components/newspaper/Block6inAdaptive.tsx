/**
 * Block6inAdaptive — Adaptive multi-column newspaper block (6 inches wide)
 *
 * Column count adapts to image count:
 *   0–1 images → 2 columns
 *   2 images   → 3 columns
 *   3+ images  → 4 columns
 *
 * Image placement: col 2, 3, 4 get one image each at top.
 *   Extra images (if imageCount > colCount–1) stack in last column top.
 * Highlights: always at col 1 top.
 *
 * Balancing: adjacent-pair diff balance, max 180 iterations.
 */
import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import FitTitle from './FitTitle';
import FlowColumn from './FlowColumn';
import HighlightsBox from './HighlightsBox';
import type { FlowItem, NewspaperArticleData, NewspaperImage } from './types';
import { buildFlowItems, categoryColor } from './utils';

interface Block6inAdaptiveProps {
  data: NewspaperArticleData;
}

const COL_GAP = 6;
const MAX_ITER = 180;
const TARGET_DIFF = 6;

function getColumnCount(imageCount: number): number {
  if (imageCount <= 1) return 2;
  if (imageCount === 2) return 3;
  return 4;
}

/** Split N items into C roughly-equal groups by item count */
function initialSplit(items: FlowItem[], cols: number): FlowItem[][] {
  const base = Math.floor(items.length / cols);
  const extra = items.length % cols;
  const groups: FlowItem[][] = [];
  let cursor = 0;
  for (let c = 0; c < cols; c++) {
    const size = base + (c < extra ? 1 : 0);
    groups.push(items.slice(cursor, cursor + size));
    cursor += size;
  }
  return groups;
}

/** Balance adjacent column groups using measured heights */
function balanceColumns(
  groups: FlowItem[][],
  allHeights: Map<number, number>,
  startIndex: number[],
): FlowItem[][] {
  // Build a global item-index offset array: startIndex[c] = first item index in col c
  // We need to look up heights by absolute position in the original textFlow

  const cols = groups.length;
  // Compute column heights
  const colHeights = groups.map((g, ci) =>
    g.reduce((s, _, j) => s + (allHeights.get(startIndex[ci] + j) ?? 0), 0),
  );

  let changed = true;
  let iter = 0;

  while (changed && iter < MAX_ITER) {
    changed = false;
    iter++;

    for (let c = 0; c < cols - 1; c++) {
      const diff = colHeights[c] - colHeights[c + 1];
      if (Math.abs(diff) <= TARGET_DIFF) continue;

      if (diff > 0) {
        // Col c is taller: move last item of col c to front of col c+1
        if (groups[c].length <= 1) continue;
        const item = groups[c].pop()!;
        groups[c + 1].unshift(item);
        const h = allHeights.get(startIndex[c] + groups[c].length) ?? 0;
        colHeights[c] -= h;
        colHeights[c + 1] += h;
        // Update startIndex for all cols from c+1
        for (let k = c + 1; k < cols; k++) {
          startIndex[k] = startIndex[k - 1] + groups[k - 1].length;
        }
        changed = true;
      } else {
        // Col c+1 is taller: move first item of col c+1 to end of col c
        if (groups[c + 1].length <= 1) continue;
        const item = groups[c + 1].shift()!;
        groups[c].push(item);
        const h = allHeights.get(startIndex[c + 1]) ?? 0;
        colHeights[c] += h;
        colHeights[c + 1] -= h;
        for (let k = c + 1; k < cols; k++) {
          startIndex[k] = startIndex[k - 1] + groups[k - 1].length;
        }
        changed = true;
      }
    }
  }
  return groups;
}

const Block6inAdaptive: React.FC<Block6inAdaptiveProps> = ({ data }) => {
  const catColor = categoryColor(data.category);
  const images = data.images ?? [];
  const numCols = getColumnCount(images.length);

  // Images for non-first columns: images[0] → col2, images[1] → col3, etc.
  // Extra images (> numCols-1) stacked in last column
  const colImages: (NewspaperImage | undefined)[] = [undefined]; // col1 has no image
  for (let c = 1; c < numCols; c++) {
    colImages.push(images[c - 1]); // one image per non-first col
  }
  // Stack extras in last col — we'll pass them as additionalImages to FlowColumn
  const extraImages = images.slice(numCols - 1);

  const hasHighlights = !!data.highlights?.length;
  const textFlow: FlowItem[] = buildFlowItems(
    { ...data, highlights: undefined },
    { includeDateline: true },
  );

  // ── Measurement state ────────────────────────────────────────────────────────
  const [colWidth, setColWidth] = useState(0);
  const allHeights = useRef<Map<number, number>>(new Map());
  const [columnGroups, setColumnGroups] = useState<FlowItem[][]>(() =>
    initialSplit(textFlow, numCols),
  );

  const onBlockLayout = useCallback(
    (e: { nativeEvent: { layout: { width: number } } }) => {
      const totalGap = COL_GAP * (numCols - 1);
      const w = (e.nativeEvent.layout.width - totalGap - 10) / numCols;
      if (Math.abs(w - colWidth) > 1) {
        setColWidth(w);
        allHeights.current = new Map();
        setColumnGroups(initialSplit(textFlow, numCols));
      }
    },
    [colWidth, numCols, textFlow],
  );

  const onItemLayout = useCallback(
    (index: number, height: number) => {
      allHeights.current.set(index, height);
      if (allHeights.current.size === textFlow.length) {
        // All measured — balance
        const groups = initialSplit(textFlow, numCols);
        const startIndexes = groups.map((_, i) =>
          groups.slice(0, i).reduce((s, g) => s + g.length, 0),
        );
        const balanced = balanceColumns(
          groups.map((g) => [...g]),
          allHeights.current,
          [...startIndexes],
        );
        setColumnGroups(balanced);
      }
    },
    [textFlow, numCols],
  );

  return (
    <View style={styles.block} onLayout={onBlockLayout}>
      {/* Title */}
      <FitTitle
        text={data.title}
        singleLine
        minPx={20}
        maxPx={34}
        align="center"
        weight="700"
        style={styles.title}
      />

      {/* Subtitle */}
      {data.subtitle && (
        <Text style={[styles.subtitle, { color: catColor }]}>{data.subtitle}</Text>
      )}

      {/* Columns */}
      {colWidth > 0 && (
        <View style={styles.columns}>
          {columnGroups.map((items, ci) => (
            <React.Fragment key={ci}>
              {ci > 0 && <View style={styles.colGap} />}
              <View style={[styles.col, { width: colWidth }]}>
                {/* Col 1 gets highlights at top */}
                {ci === 0 && hasHighlights && (
                  <HighlightsBox items={data.highlights!} fontPx={11} />
                )}
                <FlowColumn
                  items={items}
                  fontPx={12}
                  lineHeightPx={17}
                  fontPxHeading={13}
                  topImage={colImages[ci]}
                />
                {/* Extra images stack in last col top */}
                {ci === numCols - 1 &&
                  extraImages.slice(1).map((img, k) => (
                    <FlowColumn
                      key={`extra-${k}`}
                      items={[]}
                      fontPx={12}
                      lineHeightPx={17}
                      fontPxHeading={13}
                      topImage={img}
                    />
                  ))}
              </View>
            </React.Fragment>
          ))}
        </View>
      )}

      {/* ── Hidden measurement pass ───────────────────────────────────────── */}
      {colWidth > 0 && allHeights.current.size < textFlow.length && (
        <View
          style={{ position: 'absolute', opacity: 0, top: 9999, width: colWidth }}
          pointerEvents="none"
        >
          {textFlow.map((item, i) => (
            <MeasureItem6
              key={`m6-${i}`}
              item={item}
              fontPx={12}
              lineHeightPx={17}
              fontPxHeading={13}
              onMeasured={(h) => onItemLayout(i, h)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ── Measure helper ────────────────────────────────────────────────────────────
interface MeasureItem6Props {
  item: FlowItem;
  fontPx: number;
  lineHeightPx: number;
  fontPxHeading: number;
  onMeasured: (h: number) => void;
}

const MeasureItem6: React.FC<MeasureItem6Props> = ({ item, fontPx, lineHeightPx, fontPxHeading, onMeasured }) => {
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
        <Text style={{ fontSize: fontPxHeading, fontWeight: '700' }}>{item.text}</Text>
      </View>
    );
  }
  return (
    <View onLayout={(e) => onMeasured(e.nativeEvent.layout.height)}>
      <Text style={{ fontSize: fontPx, lineHeight: lineHeightPx, textAlign: 'justify' }}>
        {item.kind === 'text' || item.kind === 'dateline' ? item.text : ''}
      </Text>
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
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 13 * 1.3,
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

export default Block6inAdaptive;
