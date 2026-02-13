import React from 'react';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';

interface HindiSymbolProps {
  size?: number;
  color?: string;
}

export const HindiSymbol: React.FC<HindiSymbolProps> = ({ size = 80, color = '#138808' }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 120 120">
      <Defs>
        <RadialGradient id="hindiGrad" cx="50%" cy="50%">
          <Stop offset="0%" stopColor={color} stopOpacity="1" />
          <Stop offset="100%" stopColor={color} stopOpacity="0.8" />
        </RadialGradient>
      </Defs>
      
      {/* Ashoka Chakra - Premium detailed design */}
      {/* Outer rim with depth */}
      <Circle cx="60" cy="60" r="48" stroke="#000" strokeWidth="0.5" opacity="0.1" fill="none" />
      <Circle cx="60" cy="60" r="46" stroke={color} strokeWidth="4" fill="none" />
      <Circle cx="60" cy="60" r="44" stroke={color} strokeWidth="1.5" opacity="0.4" fill="none" />
      
      {/* Inner decorative circles */}
      <Circle cx="60" cy="60" r="20" stroke={color} strokeWidth="2" opacity="0.3" fill="none" />
      <Circle cx="60" cy="60" r="10" fill="url(#hindiGrad)" />
      <Circle cx="60" cy="60" r="6" fill={color} opacity="0.9" />
      
      {/* 24 Premium Spokes with gradient effect */}
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const x1 = 60 + 12 * Math.cos(angle);
        const y1 = 60 + 12 * Math.sin(angle);
        const x2 = 60 + 44 * Math.cos(angle);
        const y2 = 60 + 44 * Math.sin(angle);
        const xMid = 60 + 28 * Math.cos(angle);
        const yMid = 60 + 28 * Math.sin(angle);
        return (
          <React.Fragment key={i}>
            <Path
              d={`M ${x1} ${y1} L ${xMid} ${yMid} L ${x2} ${y2}`}
              stroke={color}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Circle cx={x2} cy={y2} r="1.5" fill={color} />
          </React.Fragment>
        );
      })}
      
      {/* Center ornament */}
      <Circle cx="60" cy="60" r="3" fill="#fff" opacity="0.5" />
    </Svg>
  );
};
