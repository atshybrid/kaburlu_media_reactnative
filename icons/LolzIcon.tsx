import { SvgProps } from 'react-native-svg';
import SvgAsset from '../assets/images/Kaburlu_LoLz.svg';

type Props = { size?: number; color?: string; active?: boolean } & Partial<SvgProps>;

export default function LolzIcon({ size = 40, color = '#032557', active = false, ...rest }: Props) {
  // Many exported SVGs omit viewBox; pass an explicit viewBox so content is visible when scaled down.
  // Note: This SVG has fixed fills; `color` will only apply where paths use currentColor.
  return (
    <SvgAsset
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
      color={color}
      accessibilityRole="image"
      {...rest}
    />
  );
}
