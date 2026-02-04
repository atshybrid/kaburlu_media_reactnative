import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

interface Props {
  size?: number;
  color?: string;
  active?: boolean;
}

/**
 * Newspaper icon for Digital Daily tab
 */
export default function NewspaperIcon({ size = 24, color = '#666', active = false }: Props) {
  const strokeWidth = active ? 2 : 1.5;
  const fillOpacity = active ? 0.15 : 0;
  
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Main newspaper body */}
      <Rect 
        x="4" 
        y="3" 
        width="14" 
        height="18" 
        rx="2" 
        stroke={color} 
        strokeWidth={strokeWidth}
        fill={color}
        fillOpacity={fillOpacity}
      />
      {/* Fold/side section */}
      <Path 
        d="M18 8V19C18 20.1046 18.8954 21 20 21V21C21.1046 21 22 20.1046 22 19V8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      {/* Headline bar */}
      <Path 
        d="M7 7H15" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round"
      />
      {/* Text lines */}
      <Path 
        d="M7 11H11" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round"
      />
      <Path 
        d="M7 14H11" 
        stroke={color} 
        strokeWidth={strokeWidth} 
        strokeLinecap="round"
      />
      {/* Image placeholder */}
      <Rect 
        x="12" 
        y="10" 
        width="3" 
        height="5" 
        rx="0.5" 
        stroke={color} 
        strokeWidth={strokeWidth}
        fill={active ? color : 'none'}
        fillOpacity={active ? 0.3 : 0}
      />
    </Svg>
  );
}
