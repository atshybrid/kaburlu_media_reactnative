/**
 * FitTitle
 *
 * Renders a title that starts at maxPx and steps down 1px at a time via
 * onTextLayout until the text fits within maxLines. Invisible during the
 * measurement pass to avoid a jarring font-size jump flash.
 */
import React, { useCallback, useState } from 'react';
import { Text, type TextStyle } from 'react-native';

export interface FitTitleProps {
  text: string;
  maxLines?: number;
  singleLine?: boolean;
  minPx?: number;
  maxPx?: number;
  style?: TextStyle;
  align?: 'left' | 'center' | 'right';
  weight?: TextStyle['fontWeight'];
}

const FitTitle: React.FC<FitTitleProps> = ({
  text,
  maxLines = 2,
  singleLine = false,
  minPx = 9,
  maxPx = 24,
  style,
  align = 'center',
  weight = '700',
}) => {
  const limit = singleLine ? 1 : maxLines;
  const [fontSize, setFontSize] = useState<number>(maxPx);
  const [ready, setReady] = useState<boolean>(false);

  const handleTextLayout = useCallback(
    (e: { nativeEvent: { lines: { text: string }[] } }) => {
      const lineCount = e.nativeEvent.lines.length;
      if (lineCount > limit && fontSize > minPx) {
        // Still too big — step down
        setFontSize((prev) => Math.max(prev - 1, minPx));
        setReady(false);
      } else {
        setReady(true);
      }
    },
    [fontSize, limit, minPx],
  );

  return (
    <Text
      onTextLayout={handleTextLayout}
      numberOfLines={limit}
      style={[
        {
          fontSize,
          fontWeight: weight,
          lineHeight: fontSize * 1.28,
          textAlign: align,
          color: '#111',
          opacity: ready ? 1 : 0,
        },
        style,
      ]}
    >
      {text}
    </Text>
  );
};

export default FitTitle;
