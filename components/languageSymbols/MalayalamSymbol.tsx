import React from 'react';
import Svg, { Path, Circle, Ellipse, Defs, RadialGradient, Stop } from 'react-native-svg';

interface MalayalamSymbolProps {
  size?: number;
  color?: string;
}

export const MalayalamSymbol: React.FC<MalayalamSymbolProps> = ({ size = 80, color = '#27AE60' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="malayalamGrad" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
        </RadialGradient>
      </Defs>
      
      {/* Kathakali Mask - Premium detailed traditional Kerala art */}
      {/* Face base */}
      <Circle cx="60" cy="60" r="42" fill="url(#malayalamGrad)" />
      <Circle cx="60" cy="60" r="40" stroke="#000" strokeWidth="0.5" opacity="0.1" fill="none" />
      
      {/* Ornate crown (kireedam) */}
      <Path 
        d="M 28 32 Q 60 12 92 32 L 88 42 Q 60 28 32 42 Z" 
        fill="url(#malayalamGrad)" 
      />
      <Path 
        d="M 30 34 Q 60 16 90 34" 
        stroke="#000" 
        strokeWidth="0.5"
        opacity="0.15"
        fill="none"
      />
      <Path d="M 50 28 L 50 20 M 60 24 L 60 16 M 70 28 L 70 20" stroke="#FFD700" strokeWidth="2" strokeLinecap="round" />
      
      {/* Expressive Kathakali eyes */}
      <Ellipse cx="45" cy="55" rx="10" ry="12" fill="#fff" />
      <Ellipse cx="75" cy="55" rx="10" ry="12" fill="#fff" />
      <Circle cx="45" cy="57" r="5" fill="#1a1a1a" />
      <Circle cx="75" cy="57" r="5" fill="#1a1a1a" />
      <Circle cx="46" cy="56" r="2" fill="#fff" opacity="0.8" />
      <Circle cx="76" cy="56" r="2" fill="#fff" opacity="0.8" />
      
      {/* Dramatic eye makeup lines (chutti) */}
      <Path d="M 33 52 L 56 52" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M 64 52 L 87 52" stroke="#1a1a1a" strokeWidth="2.5" strokeLinecap="round" />
      <Path d="M 33 50 L 55 50" stroke="#1a1a1a" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
      <Path d="M 65 50 L 87 50" stroke="#1a1a1a" strokeWidth="1.5" opacity="0.6" strokeLinecap="round" />
      
      {/* Nose with traditional shading */}
      <Path d="M 60 60 L 57 72 L 63 72 Z" fill="#1a1a1a" opacity="0.25" />
      <Path d="M 58 72 L 62 72" stroke="#1a1a1a" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Ornate mustache (meesha) */}
      <Path 
        d="M 32 75 Q 42 68 60 70 Q 78 68 88 75" 
        stroke="#1a1a1a" 
        strokeWidth="4" 
        strokeLinecap="round"
        fill="none"
      />
      <Path 
        d="M 34 76 Q 43 70 60 71 Q 77 70 86 76" 
        stroke="#1a1a1a" 
        strokeWidth="2.5" 
        opacity="0.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Traditional makeup dots (pottu) */}
      <Circle cx="37" cy="42" r="3" fill="#FFD700" />
      <Circle cx="83" cy="42" r="3" fill="#FFD700" />
      <Circle cx="30" cy="60" r="2.5" fill="#FFD700" />
      <Circle cx="90" cy="60" r="2.5" fill="#FFD700" />
      <Circle cx="35" cy="68" r="2" fill="#FF6B35" opacity="0.8" />
      <Circle cx="85" cy="68" r="2" fill="#FF6B35" opacity="0.8" />
      
      {/* Bottom ornamental curve */}
      <Path 
        d="M 42 88 Q 60 94 78 88" 
        stroke="url(#malayalamGrad)" 
        strokeWidth="5" 
        fill="none"
        strokeLinecap="round"
      />
      <Path 
        d="M 44 89 Q 60 93 76 89" 
        stroke="#FFD700" 
        strokeWidth="2" 
        fill="none"
        opacity="0.6"
        strokeLinecap="round"
      />
    </Svg>
  );
};
