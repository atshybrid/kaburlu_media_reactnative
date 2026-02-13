import React from 'react';
import Svg, { Rect, Circle, Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

interface PunjabiSymbolProps {
  size?: number;
  color?: string;
}

export const PunjabiSymbol: React.FC<PunjabiSymbolProps> = ({ size = 80, color = '#FFB300' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <SvgLinearGradient id="punjabiGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </SvgLinearGradient>
      </Defs>
      
      {/* Golden Temple (Harmandir Sahib) - Premium detailed */}
      {/* Sacred pool base */}
      <Rect x="15" y="98" width="90" height="7" fill="url(#punjabiGrad)" rx="1" opacity="0.7" />
      <Rect x="17" y="100" width="86" height="3" fill="#fff" opacity="0.15" />
      
      {/* Main platform */}
      <Rect x="20" y="90" width="80" height="8" fill="url(#punjabiGrad)" rx="1" />
      <Rect x="22" y="92" width="76" height="2" fill="#000" opacity="0.1" />
      
      {/* Main temple structure */}
      <Rect x="28" y="55" width="64" height="35" fill="url(#punjabiGrad)" rx="1" />
      <Rect x="30" y="57" width="6" height="31" fill="#000" opacity="0.12" />
      
      {/* Golden onion dome */}
      <Circle cx="60" cy="42" r="20" fill="url(#punjabiGrad)" />
      <Circle cx="60" cy="40" r="18" stroke="#fff" strokeWidth="0.5" opacity="0.2" fill="none" />
      <Path d="M 40 42 L 60 15 L 80 42 Z" fill="url(#punjabiGrad)" />
      <Path d="M 42 42 L 60 18 L 78 42" stroke="#000" strokeWidth="0.5" opacity="0.15" fill="none" />
      
      {/* Kalash (sacred finial) */}
      <Circle cx="60" cy="13" r="6" fill="url(#punjabiGrad)" />
      <Circle cx="60" cy="13" r="4" fill="#fff" opacity="0.25" />
      <Path d="M 58 13 L 60 5 L 62 13" stroke={color} strokeWidth="2" fill="none" />
      <Circle cx="60" cy="4" r="2" fill={color} />
      
      {/* Side pavilions */}
      <Rect x="20" y="62" width="15" height="28" fill="url(#punjabiGrad)" rx="1" />
      <Rect x="22" y="64" width="3" height="24" fill="#000" opacity="0.12" />
      <Rect x="85" y="62" width="15" height="28" fill="url(#punjabiGrad)" rx="1" />
      <Rect x="95" y="64" width="3" height="24" fill="#000" opacity="0.12" />
      
      {/* Small domes on pavilions */}
      <Circle cx="27.5" cy="57" r="8" fill="url(#punjabiGrad)" />
      <Circle cx="92.5" cy="57" r="8" fill="url(#punjabiGrad)" />
      <Circle cx="27.5" cy="56" r="6" fill="#fff" opacity="0.15" />
      <Circle cx="92.5" cy="56" r="6" fill="#fff" opacity="0.15" />
      
      {/* Grand entrance arch */}
      <Path 
        d="M 42 90 Q 42 71 60 71 Q 78 71 78 90 Z" 
        fill="#000" 
        opacity={0.2}
      />
      <Path 
        d="M 44 90 Q 44 73 60 73 Q 76 73 76 90" 
        stroke="#000" 
        strokeWidth="0.5"
        opacity={0.15}
        fill="none"
      />
      
      {/* Decorative arches */}
      <Circle cx="48" cy="75" r="3" fill="#fff" opacity="0.3" />
     <Circle cx="60" cy="75" r="3" fill="#fff" opacity="0.3" />
      <Circle cx="72" cy="75" r="3" fill="#fff" opacity="0.3" />
      
      {/* Water reflection lines */}
      <Rect x="22" y="95" width="76" height="1" fill="#fff" opacity="0.2" />
    </Svg>
  );
};
