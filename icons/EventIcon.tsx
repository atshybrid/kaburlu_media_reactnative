import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Circle, Rect } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function EventIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      {/* Calendar body */}
      <Rect x={3} y={5} width={18} height={16} rx={2.5} fill={color} fillOpacity={0.12} />
      <Rect x={3} y={7} width={18} height={14} rx={2} fill={color} fillOpacity={0.12} />
      {/* Rings */}
      <Rect x={7} y={3} width={2} height={4} rx={1} fill={color} />
      <Rect x={15} y={3} width={2} height={4} rx={1} fill={color} />
      {/* Event dot */}
      <Circle cx={12} cy={15} r={2} fill={color} />
    </AnimatedSvg>
  );
}
