import Svg, { Circle, Path } from 'react-native-svg';

export default function PeopleIcon({ size = 24, color = '#111827' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={9} r={3} stroke={color} strokeWidth={1.6} />
      <Path d="M4 19a5 5 0 0 1 10 0" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
      <Circle cx={17.5} cy={9.5} r={2.5} stroke={color} strokeWidth={1.6} />
      <Path d="M14.5 19c.4-2.1 2.2-3.5 4.5-3.5 1 0 1.9.3 2.6.8" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
