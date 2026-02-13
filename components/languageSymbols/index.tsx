// State symbols for language selection
export { TeluguSymbol } from './TeluguSymbol';
export { HindiSymbol } from './HindiSymbol';
export { TamilSymbol } from './TamilSymbol';
export { KannadaSymbol } from './KannadaSymbol';
export { EnglishSymbol } from './EnglishSymbol';
export { MarathiSymbol } from './MarathiSymbol';
export { BengaliSymbol } from './BengaliSymbol';
export { MalayalamSymbol } from './MalayalamSymbol';
export { PunjabiSymbol } from './PunjabiSymbol';
export { GujaratiSymbol } from './GujaratiSymbol';

// Helper function to get state symbol by language code
import React from 'react';
import { TeluguSymbol } from './TeluguSymbol';
import { HindiSymbol } from './HindiSymbol';
import { TamilSymbol } from './TamilSymbol';
import { KannadaSymbol } from './KannadaSymbol';
import { EnglishSymbol } from './EnglishSymbol';
import { MarathiSymbol } from './MarathiSymbol';
import { BengaliSymbol } from './BengaliSymbol';
import { MalayalamSymbol } from './MalayalamSymbol';
import { PunjabiSymbol } from './PunjabiSymbol';
import { GujaratiSymbol } from './GujaratiSymbol';

interface SymbolProps {
  size?: number;
  color?: string;
}

export const getStateSymbol = (
  languageCode: string
): React.FC<SymbolProps> | null => {
  const symbols: Record<string, React.FC<SymbolProps>> = {
    te: TeluguSymbol,
    hi: HindiSymbol,
    ta: TamilSymbol,
    kn: KannadaSymbol,
    en: EnglishSymbol,
    mr: MarathiSymbol,
    bn: BengaliSymbol,
    ml: MalayalamSymbol,
    pa: PunjabiSymbol,
    gu: GujaratiSymbol,
  };

  return symbols[languageCode] || null;
};
