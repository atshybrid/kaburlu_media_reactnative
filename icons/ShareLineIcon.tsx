import Svg, { Path } from 'react-native-svg';

type Props = { size?: number; color?: string };

export default function ShareLineIcon({ size = 24, color = '#111' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path d="M15 8l4-4m0 0h-4m4 0v4M7 12h6m0 0V6m0 6L4 19" stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"/>
    </Svg>
  );
}
