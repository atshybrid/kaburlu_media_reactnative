import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function OpinionIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Speech bubble with tail - clean line style */}
      <Path d="M4 5h12a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-4l-4 3v-3H8a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" />
      {/* Small horizontal lines to suggest text */}
      <Path d="M8 10h8M8 13h6" stroke={color} strokeWidth={1.7} strokeLinecap="round" />
    </Svg>
  );
}
