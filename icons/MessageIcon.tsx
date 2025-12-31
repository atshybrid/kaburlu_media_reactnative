import Svg, { Path } from 'react-native-svg';

export default function MessageIcon({ size = 24, color = '#111827' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 8h10a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-2.7c-.28 0-.55.09-.78.26L10 20l.7-2.95c.07-.31-.17-.6-.49-.6H7a3 3 0 0 1-3-3v-2a3 3 0 0 1 3-3Z"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M9 12h6M9 15h4" stroke={color} strokeWidth={1.6} strokeLinecap="round" />
    </Svg>
  );
}
