import React from 'react';
import Svg, { Rect, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface KannadaSymbolProps {
  size?: number;
  color?: string;
}

export const KannadaSymbol: React.FC<KannadaSymbolProps> = ({ size = 80, color = '#9B59B6' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="kannadaGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Mysore Palace - Premium detailed */}
      {/* Grand base */}
      <Rect x="20" y="95" width="80" height="8" fill="url(#kannadaGrad)" rx="1" />
      <Rect x="22" y="93" width="76" height="2" fill="#000" opacity="0.1" />
      
      {/* Main palace structure */}
      <Rect x="25" y="55" width="70" height="40" fill="url(#kannadaGrad)" rx="1" />
      <Rect x="27" y="57" width="5" height="36" fill="#000" opacity="0.15" />
      
      {/* Ornate central dome */}
      <Circle cx="60" cy="45" r="20" fill="url(#kannadaGrad)" />
      <Circle cx="60" cy="45" r="18" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Path d="M 40 45 L 60 18 L 80 45 Z" fill="url(#kannadaGrad)" />
      <Path d="M 43 45 L 60 22 L 77 45" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="60" cy="15" r="6" fill="url(#kannadaGrad)" />
      <Circle cx="60" cy="15" r="4" fill="#fff" opacity="0.3" />
      <Path d="M 60 9 L 60 5" stroke={color} strokeWidth="2" strokeLinecap="round" />
      
      {/* Side towers with domes */}
      <Rect x="27" y="45" width="14" height="50" fill="url(#kannadaGrad)" rx="1" />
      <Rect x="29" y="47" width="3" height="46" fill="#000" opacity="0.15" />
      <Path d="M 27 45 L 34 30 L 41 45 Z" fill="url(#kannadaGrad)" />
      <Circle cx="34" cy="28" r="4" fill="url(#kannadaGrad)" />
      
      <Rect x="79" y="45" width="14" height="50" fill="url(#kannadaGrad)" rx="1" />
      <Rect x="88" y="47" width="3" height="46" fill="#000" opacity="0.15" />
      <Path d="M 79 45 L 86 30 L 93 45 Z" fill="url(#kannadaGrad)" />
      <Circle cx="86" cy="28" r="4" fill="url(#kannadaGrad)" />
      
      {/* Detailed arches and windows */}
      <Circle cx="45" cy="75" r="4" fill="#000" opacity="0.2" />
      <Circle cx="60" cy="75" r="4" fill="#000" opacity="0.2" />
      <Circle cx="75" cy="75" r="4" fill="#000" opacity="0.2" />
      <Circle cx="45" cy="65" r="2.5" fill="#fff" opacity="0.3" />
      <Circle cx="60" cy="65" r="2.5" fill="#fff" opacity="0.3" />
      <Circle cx="75" cy="65" r="2.5" fill="#fff" opacity="0.3" />
    </Svg>
  );
};
