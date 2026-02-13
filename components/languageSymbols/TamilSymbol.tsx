import React from 'react';
import Svg, { Rect, Path, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface TamilSymbolProps {
  size?: number;
  color?: string;
}

export const TamilSymbol: React.FC<TamilSymbolProps> = ({ size = 80, color = '#E74C3C' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="tamilGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Meenakshi Temple Gopuram - Detailed */}
      {/* Base platform */}
      <Rect x="25" y="100" width="70" height="6" fill="url(#tamilGrad)" rx="1" />
      <Rect x="27" y="95" width="66" height="5" fill="#000" opacity="0.1" />
      
      {/* Gopuram layers with intricate details */}
      <Rect x="28" y="85" width="64" height="10" fill="url(#tamilGrad)" rx="0.5" />
      <Path d="M 30 87 L 90 87" stroke="#000" strokeWidth="0.5" opacity="0.2" />
      <Circle cx="40" cy="90" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="60" cy="90" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="80" cy="90" r="1" fill="#fff" opacity="0.4" />
      
      <Rect x="32" y="73" width="56" height="12" fill="url(#tamilGrad)" rx="0.5" />
      <Path d="M 34 76 L 86 76" stroke="#000" strokeWidth="0.5" opacity="0.2" />
      <Circle cx="42" cy="79" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="60" cy="79" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="78" cy="79" r="1" fill="#fff" opacity="0.4" />
      
      <Rect x="36" y="60" width="48" height="13" fill="url(#tamilGrad)" rx="0.5" />
      <Path d="M 38 64 L 82 64" stroke="#000" strokeWidth="0.5" opacity="0.2" />
      <Circle cx="45" cy="67" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="60" cy="67" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="75" cy="67" r="1" fill="#fff" opacity="0.4" />
      
      <Rect x="40" y="46" width="40" height="14" fill="url(#tamilGrad)" rx="0.5" />
      <Path d="M 42 51 L 78 51" stroke="#000" strokeWidth="0.5" opacity="0.2" />
      <Circle cx="48" cy="53" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="60" cy="53" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="72" cy="53" r="1" fill="#fff" opacity="0.4" />
      
      <Rect x="44" y="32" width="32" height="14" fill="url(#tamilGrad)" rx="0.5" />
      <Path d="M 46 37 L 74 37" stroke="#000" strokeWidth="0.5" opacity="0.2" />
      <Circle cx="52" cy="39" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="60" cy="39" r="1" fill="#fff" opacity="0.4" />
      <Circle cx="68" cy="39" r="1" fill="#fff" opacity="0.4" />
      
      {/* Top ornate finial */}
      <Path d="M 48 32 L 60 12 L 72 32 Z" fill="url(#tamilGrad)" />
      <Path d="M 50 30 L 60 15 L 70 30" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="60" cy="10" r="5" fill="url(#tamilGrad)" />
      <Circle cx="60" cy="10" r="3" fill="#fff" opacity="0.3" />
      <Path d="M 60 5 L 60 2" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
};
