import {
    AnekTelugu_400Regular,
    AnekTelugu_700Bold,
    useFonts as useAnekTeluguFonts,
} from '@expo-google-fonts/anek-telugu';
import {
    Mandali_400Regular,
    useFonts as useMandaliFonts,
} from '@expo-google-fonts/mandali';
import {
    NotoSerifTelugu_400Regular,
    NotoSerifTelugu_700Bold,
    useFonts as useNotoSerifTeluguFonts,
} from '@expo-google-fonts/noto-serif-telugu';
import {
    NotoSansTelugu_400Regular,
    NotoSansTelugu_600SemiBold,
    useFonts as useNotoSansTeluguFonts,
} from '@expo-google-fonts/noto-sans-telugu';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

// Unified hook to load required fonts once and expose a boolean
export function useAppFonts() {
  const [mandaliLoaded] = useMandaliFonts({ Mandali_400Regular });
  const [anekLoaded] = useAnekTeluguFonts({ AnekTelugu_400Regular, AnekTelugu_700Bold });
  const [notoSerifLoaded] = useNotoSerifTeluguFonts({ 
    NotoSerifTelugu_400Regular, 
    NotoSerifTelugu_700Bold 
  });
  const [notoSansLoaded] = useNotoSansTeluguFonts({ 
    NotoSansTelugu_400Regular, 
    NotoSansTelugu_600SemiBold 
  });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Map logical names used in styles to loaded font faces
        // Mandali regular
        if (mandaliLoaded) {
          await Font.loadAsync({
            Mandali: Mandali_400Regular as any,
            'Mandali-Regular': Mandali_400Regular as any,
            // Bold synthetic mapping (weight 700). Many Android renderers accept weight.
            'Mandali-Bold': Mandali_400Regular as any,
          });
        }
        // Anek Telugu regular + bold
        if (anekLoaded) {
          await Font.loadAsync({
            'AnekTelugu': AnekTelugu_400Regular as any,
            'AnekTelugu-Regular': AnekTelugu_400Regular as any,
            'AnekTelugu-Bold': AnekTelugu_700Bold as any,
          });
        }
        // Noto Serif Telugu (for titles/headlines) - Google Fonts recommended
        if (notoSerifLoaded) {
          await Font.loadAsync({
            'NotoSerifTelugu': NotoSerifTelugu_400Regular as any,
            'NotoSerifTelugu_400Regular': NotoSerifTelugu_400Regular as any,
            'NotoSerifTelugu_700Bold': NotoSerifTelugu_700Bold as any,
          });
        }
        // Noto Sans Telugu (for subtitles and body) - Google Fonts recommended
        if (notoSansLoaded) {
          await Font.loadAsync({
            'NotoSansTelugu': NotoSansTelugu_400Regular as any,
            'NotoSansTelugu_400Regular': NotoSansTelugu_400Regular as any,
            'NotoSansTelugu_600SemiBold': NotoSansTelugu_600SemiBold as any,
          });
        }
        // Try to load Potti Sreeramulu from assets if available
        try {
          const potti = Asset.fromModule(require('../../assets/fonts/Pottisreeramulu.ttf'));
          await potti.downloadAsync();
          await Font.loadAsync({ Pottisreeramulu: potti.localUri ? { uri: potti.localUri } as any : potti as any });
        } catch {
          // Fallback: if asset not found, skip without crashing
          if (__DEV__) console.log('[FONTS] Potti Sreeramulu not found, skipping');
        }
      } catch (e) {
        console.log('[FONTS] load error', (e as any)?.message);
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, [mandaliLoaded, anekLoaded]);

  return ready;
}
