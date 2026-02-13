import React from 'react';
import Svg, { Rect, Circle, Line, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface GujaratiSymbolProps {
  size?: number;
  color?: string;
}

export const GujaratiSymbol: React.FC<GujaratiSymbolProps> = ({ size = 80, color = '#D35400' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="gujaratiGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.75" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Rann of Kutch pattern with intricate embroidery design */}
      {/* Outer ornate frame */}
      <Rect x="18" y="18" width="84" height="84" fill="none" stroke="url(#gujaratiGrad)" strokeWidth="4" rx="2" />
      <Rect x="20" y="20" width="80" height="80" fill="none" stroke={color} strokeWidth="1" opacity={0.4} />
      
      {/* Inner decorative square */}
      <Rect x="30" y="30" width="60" height="60" fill="none" stroke="url(#gujaratiGrad)" strokeWidth="3" rx="1" />
      <Rect x="32" y="32" width="56" height="56" fill="none" stroke={color} strokeWidth="1" opacity={0.3} />
      
      {/* Central mandala pattern */}
      <Circle cx="60" cy="60" r="24" fill="none" stroke="url(#gujaratiGrad)" strokeWidth="3" />
      <Circle cx="60" cy="60" r="20" fill="none" stroke={color} strokeWidth="2" opacity={0.5} />
      <Circle cx="60" cy="60" r="15" fill="url(#gujaratiGrad)" opacity={0.3} />
      <Circle cx="60" cy="60" r="8" fill="url(#gujaratiGrad)" />
      <Circle cx="60" cy="60" r="4" fill="#fff" opacity={0.4} />
      
      {/* Diagonal traditional pattern lines */}
      <Line x1="30" y1="30" x2="90" y2="90" stroke="url(#gujaratiGrad)" strokeWidth="2.5" opacity={0.6} />
      <Line x1="90" y1="30" x2="30" y2="90" stroke="url(#gujaratiGrad)" strokeWidth="2.5" opacity={0.6} />
      <Line x1="60" y1="30" x2="60" y2="90" stroke={color} strokeWidth="1.5" opacity={0.4} />
      <Line x1="30" y1="60" x2="90" y2="60" stroke={color} strokeWidth="1.5" opacity={0.4} />
      
      {/* Corner decorations (traditional Gujarati bandhani pattern) */}
      <Circle cx="30" cy="30" r="5" fill="url(#gujaratiGrad)" />
      <Circle cx="90" cy="30" r="5" fill="url(#gujaratiGrad)" />
      <Circle cx="30" cy="90" r="5" fill="url(#gujaratiGrad)" />
      <Circle cx="90" cy="90" r="5" fill="url(#gujaratiGrad)" />
      <Circle cx="30" cy="30" r="3" fill="#FFD700" opacity={0.6} />
      <Circle cx="90" cy="30" r="3" fill="#FFD700" opacity={0.6} />
      <Circle cx="30" cy="90" r="3" fill="#FFD700" opacity={0.6} />
      <Circle cx="90" cy="90" r="3" fill="#FFD700" opacity={0.6} />
      
      {/* Mid-point decorations */}
      <Circle cx="60" cy="30" r="4" fill="url(#gujaratiGrad)" />
      <Circle cx="60" cy="90" r="4" fill="url(#gujaratiGrad)" />
      <Circle cx="30" cy="60" r="4" fill="url(#gujaratiGrad)" />
      <Circle cx="90" cy="60" r="4" fill="url(#gujaratiGrad)" />
      
      {/* Mirror work representation (shisha embroidery) */}
      <Circle cx="42" cy="42" r="3" fill="#FFD700" opacity={0.7} />
      <Circle cx="78" cy="42" r="3" fill="#FFD700" opacity={0.7} />
      <Circle cx="42" cy="78" r="3" fill="#FFD700" opacity={0.7} />
      <Circle cx="78" cy="78" r="3" fill="#FFD700" opacity={0.7} />
      <Circle cx="42" cy="42" r="2" fill="#fff" opacity={0.5} />
      <Circle cx="78" cy="42" r="2" fill="#fff" opacity={0.5} />
      <Circle cx="42" cy="78" r="2" fill="#fff" opacity={0.5} />
      <Circle cx="78" cy="78" r="2" fill="#fff" opacity={0.5} />
      
      {/* Additional ornamental dots */}
      <Circle cx="48" cy="60" r="2" fill={color} opacity={0.5} />
      <Circle cx="72" cy="60" r="2" fill={color} opacity={0.5} />
      <Circle cx="60" cy="48" r="2" fill={color} opacity={0.5} />
      <Circle cx="60" cy="72" r="2" fill={color} opacity={0.5} />
    </Svg>
  );
};
