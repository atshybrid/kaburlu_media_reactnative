import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function OpinionPositiveIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round"/>
      <Path d="M8.5 12.2l2 2 5-5" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
