import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { Circle, Path } from 'react-native-svg';
import { AnimatedSvg } from './common';

type Props = { size?: number; color?: string; animated?: boolean; active?: boolean };

export default function FamilyTreeIcon({ size = 24, color = '#032557', animated = true, active = false }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (!animated) return;
    if (active) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 120, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ]).start();
    }
  }, [active, animated, scale]);
  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 24 24" style={{ transform: [{ scale }] }}>
      {/* Root node */}
      <Circle cx={12} cy={5} r={2} fill={color} />
      {/* Branches */}
      <Path d="M12 7v5M7 12h10M7 12v5M17 12v5" stroke={color} strokeWidth={2} strokeLinecap="round" />
      {/* Leaves/children */}
      <Circle cx={7} cy={19} r={2} fill={color} />
      <Circle cx={12} cy={14} r={2} fill={color} />
      <Circle cx={17} cy={19} r={2} fill={color} />
    </AnimatedSvg>
  );
}
