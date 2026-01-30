import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

export interface GatheredContext {
  pushToken?: string;
  languageId?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number;
    provider?: string;
    timestampUtc?: string;
    source?: string;
  };
}

export async function gatherRegistrationContext(): Promise<GatheredContext> {
  const out: GatheredContext = {};
  try {
    const raw = await AsyncStorage.getItem('selectedLanguage');
    if (raw) {
      try { out.languageId = JSON.parse(raw)?.id; } catch {}
    }
  } catch {}
  
  // Only GET existing permission status - don't REQUEST permissions during registration
  // This is Play Store compliant - permissions should be requested in-context
  try {
    const perm = await Notifications.getPermissionsAsync();
    if (perm.granted) {
      // Only get token if already granted
      const tokenData = await Notifications.getExpoPushTokenAsync();
      out.pushToken = tokenData.data;
    }
  } catch {}
  
  try {
    // Check if location permission is already granted (don't request)
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status === 'granted') {
      // Try to get last known position (faster, no GPS wait)
      let loc = await Location.getLastKnownPositionAsync();
      if (!loc) {
        loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (loc) {
        out.location = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracyMeters: loc.coords.accuracy || undefined,
          provider: loc.coords.altitude ? 'gps' : 'network',
          timestampUtc: new Date(loc.timestamp).toISOString(),
          source: 'device',
        };
      }
    }
  } catch {}
  return out;
}
