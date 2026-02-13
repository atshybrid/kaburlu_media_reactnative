import React from 'react';
import Svg, { Rect, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface EnglishSymbolProps {
  size?: number;
  color?: string;
}

export const EnglishSymbol: React.FC<EnglishSymbolProps> = ({ size = 80, color = '#E67E22' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="englishGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </SvgLinearGradient>
      </Defs>
      
      {/* India Gate - Premium design */}
      {/* Base steps */}
      <Rect x="15" y="100" width="90" height="5" fill="url(#englishGrad)" rx="1" />
      <Rect x="20" y="95" width="80" height="5" fill="url(#englishGrad)" rx="1" opacity="0.9" />
      <Rect x="17" y="98" width="86" height="2" fill="#000" opacity="0.1" />
      
      {/* Main arch structure with depth */}
      <Rect x="30" y="40" width="60" height="55" fill="url(#englishGrad)" rx="1" />
      <Rect x="32" y="42" width="6" height="51" fill="#000" opacity="0.15" />
      
      {/* Grand central arch */}
      <Path 
        d="M 42 95 Q 42 62 60 62 Q 78 62 78 95 Z" 
        fill="#000" 
        opacity={0.25}
      />
      <Path 
        d="M 44 95 Q 44 65 60 65 Q 76 65 76 95" 
        stroke="#000" 
        strokeWidth="0.5"
        opacity={0.2}
        fill="none"
      />
      
      {/* Top architrave with details */}
      <Rect x="25" y="32" width="70" height="8" fill="url(#englishGrad)" rx="0.5" />
      <Rect x="27" y="34" width="66" height="1" fill="#000" opacity="0.1" />
      
      {/* Crown section */}
      <Rect x="35" y="22" width="50" height="10" fill="url(#englishGrad)" rx="0.5" />
      <Path d="M 45 22 L 60 8 L 75 22 Z" fill="url(#englishGrad)" />
      <Path d="M 47 22 L 60 11 L 73 22" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="60" cy="6" r="5" fill="url(#englishGrad)" />
      <Circle cx="60" cy="6" r="3" fill="#fff" opacity="0.3" />
      
      {/* Side pillars */}
      <Rect x="32" y="50" width="6" height="45" fill="url(#englishGrad)" rx="0.5" />
      <Rect x="82" y="50" width="6" height="45" fill="url(#englishGrad)" rx="0.5" />
      <Rect x="33" y="52" width="2" height="41" fill="#000" opacity="0.15" />
      <Rect x="85" y="52" width="2" height="41" fill="#000" opacity="0.15" />
      
      {/* Decorative elements */}
      <Circle cx="50" cy="75" r="2" fill="#fff" opacity="0.3" />
      <Circle cx="70" cy="75" r="2" fill="#fff" opacity="0.3" />
      <Rect x="48" y="85" width="4" height="8" rx="2" fill="#000" opacity="0.15" />
      <Rect x="68" y="85" width="4" height="8" rx="2" fill="#000" opacity="0.15" />
    </Svg>
  );
};
