import Svg, { Circle, Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function MessageLineIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H10l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" stroke={color} strokeWidth={1.7} strokeLinejoin="round"/>
      <Circle cx={9} cy={12} r={1} fill={color} />
      <Circle cx={12} cy={12} r={1} fill={color} />
      <Circle cx={15} cy={12} r={1} fill={color} />
    </Svg>
  );
}
