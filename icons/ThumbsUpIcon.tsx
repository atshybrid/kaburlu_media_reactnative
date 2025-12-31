import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function ThumbsUpIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M7 11v9H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h3Zm4-6l-3 6v9h8.2a2 2 0 0 0 2-1.6l1.3-6.8a2 2 0 0 0-2-2.4H12V5Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round"/>
    </Svg>
  );
}
