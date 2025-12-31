import {
    AnekTelugu_400Regular,
    AnekTelugu_700Bold,
    useFonts as useAnekTeluguFonts,
} from '@expo-google-fonts/anek-telugu';
import {
    Mandali_400Regular,
    useFonts as useMandaliFonts,
} from '@expo-google-fonts/mandali';
import { Asset } from 'expo-asset';
import * as Font from 'expo-font';
import { useEffect, useState } from 'react';

// Unified hook to load required fonts once and expose a boolean
export function useAppFonts() {
  const [mandaliLoaded] = useMandaliFonts({ Mandali_400Regular });
  const [anekLoaded] = useAnekTeluguFonts({ AnekTelugu_400Regular, AnekTelugu_700Bold });
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
