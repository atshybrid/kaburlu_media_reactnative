import React from 'react';
import Svg, { Rect, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface MarathiSymbolProps {
  size?: number;
  color?: string;
}

export const MarathiSymbol: React.FC<MarathiSymbolProps> = ({ size = 80, color = '#FF6B35' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="marathiGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Gateway of India - Premium detailed */}
      {/* Base platform */}
      <Rect x="18" y="98" width="84" height="7" fill="url(#marathiGrad)" rx="1" />
      <Rect x="20" y="96" width="80" height="2" fill="#000" opacity="0.1" />
      
      {/* Main pillars with depth */}
      <Rect x="25" y="35" width="18" height="63" fill="url(#marathiGrad)" rx="1" />
      <Rect x="27" y="37" width="4" height="59" fill="#000" opacity="0.15" />
      <Rect x="77" y="35" width="18" height="63" fill="url(#marathiGrad)" rx="1" />
      <Rect x="91" y="37" width="4" height="59" fill="#000" opacity="0.15" />
      
      {/* Central arch structure */}
      <Rect x="43" y="45" width="34" height="53" fill="url(#marathiGrad)" rx="1" />
      <Rect x="45" y="47" width="5" height="49" fill="#000" opacity="0.12" />
      
      {/* Grand arch opening */}
      <Path 
        d="M 48 98 Q 48 68 60 68 Q 72 68 72 98 Z" 
        fill="#000" 
        opacity={0.22}
      />
      <Path 
        d="M 50 98 Q 50 71 60 71 Q 70 71 70 98" 
        stroke="#000" 
        strokeWidth="0.5"
        opacity={0.15}
        fill="none"
      />
      
      {/* Top architrave */}
      <Rect x="22" y="28" width="76" height="7" fill="url(#marathiGrad)" rx="0.5" />
      <Rect x="24" y="30" width="72" height="1" fill="#000" opacity="0.1" />
      
      {/* Indo-Saracenic domes */}
      <Circle cx="34" cy="23" r="10" fill="url(#marathiGrad)" />
      <Circle cx="60" cy="23" r="10" fill="url(#marathiGrad)" />
      <Circle cx="86" cy="23" r="10" fill="url(#marathiGrad)" />
      
      {/* Dome highlights */}
      <Circle cx="34" cy="21" r="6" fill="#fff" opacity="0.2" />
      <Circle cx="60" cy="21" r="6" fill="#fff" opacity="0.2" />
      <Circle cx="86" cy="21" r="6" fill="#fff" opacity="0.2" />
      
      {/* Top finials */}
      <Circle cx="34" cy="13" r="4" fill="url(#marathiGrad)" />
      <Circle cx="60" cy="13" r="4" fill="url(#marathiGrad)" />
      <Circle cx="86" cy="13" r="4" fill="url(#marathiGrad)" />
      <Path d="M 34 9 L 34 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M 60 9 L 60 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <Path d="M 86 9 L 86 6" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Decorative arches */}
      <Circle cx="53" cy="80" r="2.5" fill="#fff" opacity="0.3" />
      <Circle cx="67" cy="80" r="2.5" fill="#fff" opacity="0.3" />
    </Svg>
  );
};
