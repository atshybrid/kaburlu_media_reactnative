import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function ThumbsDownIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 13V4H4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h3Zm4 6-3-6V4h8.2a2 2 0 0 1 2 1.6l1.3 6.8a2 2 0 0 1-2 2.4H12v4Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round"/>
    </Svg>
  );
}
