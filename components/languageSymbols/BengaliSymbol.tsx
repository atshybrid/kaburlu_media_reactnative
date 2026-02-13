import React from 'react';
import Svg, { Rect, Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface BengaliSymbolProps {
  size?: number;
  color?: string;
}

export const BengaliSymbol: React.FC<BengaliSymbolProps> = ({ size = 80, color = '#ECEFF1' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="bengaliGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
         <Stop offset="100%" stopColor="#B0BEC5" stopOpacity="0.8" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Victoria Memorial - Premium detailed */}
      {/* Grand base */}
      <Rect x="15" y="95" width="90" height="10" fill="url(#bengaliGrad)" rx="1" />
      <Rect x="17" y="97" width="86" height="2" fill="#000" opacity="0.08" />
      
      {/* Main building structure */}
      <Rect x="25" y="55" width="70" height="40" fill="url(#bengaliGrad)" rx="1" />
      <Rect x="27" y="57" width="6" height="36" fill="#000" opacity="0.12" />
      
      {/* Grand central dome */}
      <Circle cx="60" cy="42" r="22" fill="url(#bengaliGrad)" />
      <Circle cx="60" cy="40" r="20" stroke="#000" strokeWidth="0.5" opacity="0.1" fill="none" />
      <Circle cx="60" cy="42" r="16" fill="#fff" opacity="0.15" />
      
      {/* Angel statue representation (top ornament) */}
      <Path d="M 52 22 L 60 8 L 68 22 Z" fill="url(#bengaliGrad)" />
      <Path d="M 54 22 L 60 11 L 66 22" stroke="#000" strokeWidth="0.5" opacity="0.1" fill="none" />
      <Circle cx="60" cy="5" r="4" fill="url(#bengaliGrad)" />
      <Circle cx="60" cy="5" r="2.5" fill="#fff" opacity="0.3" />
      
      {/* Side wings (smaller buildings) */}
      <Rect x="18" y="68" width="20" height="27" fill="url(#bengaliGrad)" rx="1" />
      <Rect x="20" y="70" width="4" height="23" fill="#000" opacity="0.12" />
      <Rect x="82" y="68" width="20" height="27" fill="url(#bengaliGrad)" rx="1" />
      <Rect x="98" y="70" width="4" height="23" fill="#000" opacity="0.12" />
      
      {/* Side domes */}
      <Circle cx="28" cy="62" r="10" fill="url(#bengaliGrad)" />
      <Circle cx="92" cy="62" r="10" fill="url(#bengaliGrad)" />
      <Circle cx="28" cy="60" r="7" fill="#fff" opacity="0.15" />
      <Circle cx="92" cy="60" r="7" fill="#fff" opacity="0.15" />
      
      {/* Entrance arch */}
      <Path 
        d="M 45 95 Q 45 74 60 74 Q 75 74 75 95 Z" 
        fill="#000" 
        opacity={0.18}
      />
      <Path 
        d="M 47 95 Q 47 76 60 76 Q 73 76 73 95" 
        stroke="#000" 
        strokeWidth="0.5"
        opacity={0.12}
        fill="none"
      />
      
      {/* Decorative windows */}
      <Circle cx="45" cy="70" r="2.5" fill="#000" opacity="0.15" />
      <Circle cx="60" cy="70" r="2.5" fill="#000" opacity="0.15" />
      <Circle cx="75" cy="70" r="2.5" fill="#000" opacity="0.15" />
      <Circle cx="50" cy="82" r="2" fill="#fff" opacity="0.25" />
      <Circle cx="70" cy="82" r="2" fill="#fff" opacity="0.25" />
    </Svg>
  );
};
