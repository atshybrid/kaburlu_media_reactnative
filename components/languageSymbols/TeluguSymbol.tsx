import React from 'react';
import Svg, { Path, Rect, Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface TeluguSymbolProps {
  size?: number;
  color?: string;
}

export const TeluguSymbol: React.FC<TeluguSymbolProps> = ({ size = 80, color = '#F1C40F' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="teluguGrad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </SvgLinearGradient>
        <SvgLinearGradient id="teluguGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#000" stopOpacity="0.15" />
          <Stop offset="50%" stopColor="#000" stopOpacity="0.05" />
          <Stop offset="100%" stopColor="#000" stopOpacity="0.15" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Charminar - Professional detailed design */}
      {/* Base platform with depth */}
      <Rect x="15" y="95" width="90" height="4" fill="url(#teluguGrad2)" />
      <Rect x="18" y="88" width="84" height="7" fill="url(#teluguGrad1)" />
      
      {/* Left Tower */}
      <Rect x="20" y="45" width="18" height="43" fill="url(#teluguGrad1)" rx="1" />
      <Rect x="21" y="47" width="4" height="39" fill="#000" opacity="0.15" />
      <Path d="M 20 45 L 29 25 L 38 45 Z" fill="url(#teluguGrad1)" />
      <Path d="M 22 45 L 29 28 L 36 45" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="29" cy="20" r="6.5" fill="url(#teluguGrad1)" />
      <Path d="M 29 13 L 29 10 M 26 15 L 24 13 M 32 15 L 34 13" stroke="#000" strokeWidth="1" opacity="0.3" />
      <Rect x="24" y="65" width="10" height="8" rx="4" fill="#000" opacity="0.25" />
      
      {/* Left-Center Tower */}
      <Rect x="42" y="45" width="18" height="43" fill="url(#teluguGrad1)" rx="1" />
      <Rect x="43" y="47" width="4" height="39" fill="#000" opacity="0.15" />
      <Path d="M 42 45 L 51 25 L 60 45 Z" fill="url(#teluguGrad1)" />
      <Path d="M 44 45 L 51 28 L 58 45" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="51" cy="20" r="6.5" fill="url(#teluguGrad1)" />
      <Path d="M 51 13 L 51 10 M 48 15 L 46 13 M 54 15 L 56 13" stroke="#000" strokeWidth="1" opacity="0.3" />
      <Rect x="46" y="65" width="10" height="8" rx="4" fill="#000" opacity="0.25" />
      
      {/* Right-Center Tower */}
      <Rect x="60" y="45" width="18" height="43" fill="url(#teluguGrad1)" rx="1" />
      <Rect x="74" y="47" width="4" height="39" fill="#000" opacity="0.15" />
      <Path d="M 60 45 L 69 25 L 78 45 Z" fill="url(#teluguGrad1)" />
      <Path d="M 62 45 L 69 28 L 76 45" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="69" cy="20" r="6.5" fill="url(#teluguGrad1)" />
      <Path d="M 69 13 L 69 10 M 66 15 L 64 13 M 72 15 L 74 13" stroke="#000" strokeWidth="1" opacity="0.3" />
      <Rect x="64" y="65" width="10" height="8" rx="4" fill="#000" opacity="0.25" />
      
      {/* Right Tower */}
      <Rect x="82" y="45" width="18" height="43" fill="url(#teluguGrad1)" rx="1" />
      <Rect x="96" y="47" width="4" height="39" fill="#000" opacity="0.15" />
      <Path d="M 82 45 L 91 25 L 100 45 Z" fill="url(#teluguGrad1)" />
      <Path d="M 84 45 L 91 28 L 98 45" stroke="#000" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Circle cx="91" cy="20" r="6.5" fill="url(#teluguGrad1)" />
      <Path d="M 91 13 L 91 10 M 88 15 L 86 13 M 94 15 L 96 13" stroke="#000" strokeWidth="1" opacity="0.3" />
      <Rect x="86" y="65" width="10" height="8" rx="4" fill="#000" opacity="0.25" />
      
      {/* Central connecting arches and details */}
      <Rect x="38" y="82" width="4" height="6" fill="#000" opacity="0.1" />
      <Rect x="60" y="82" width="4" height="6" fill="#000" opacity="0.1" />
      <Rect x="78" y="82" width="4" height="6" fill="#000" opacity="0.1" />
    </Svg>
  );
};
