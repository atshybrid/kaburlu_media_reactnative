import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';

const PERM_KEY = 'permission_status';
export type PermissionStatus = {
  notifications?: 'granted' | 'denied' | 'undetermined';
  location?: 'granted' | 'denied' | 'undetermined';
  // iOS may return 'limited' for photo library
  mediaLibrary?: 'granted' | 'denied' | 'undetermined' | 'limited';
  mediaCanAskAgain?: boolean;
  pushToken?: string;
  coords?: { latitude: number; longitude: number } | null;
  // Detailed device-provided fields (if available)
  coordsDetailed?: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    altitude?: number | null;
    altitudeAccuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    timestamp?: number; // epoch ms
  } | null;
  // Reverse-geocoded place info (best-effort)
  place?: {
    name?: string;
    street?: string;
    district?: string;
    city?: string;
    subregion?: string;
    region?: string; // state
    postalCode?: string;
    country?: string;
    isoCountryCode?: string;
    fullName?: string; // convenience, may be composed
  } | null;
};

export async function getCachedPermissions(): Promise<PermissionStatus> {
  const raw = await AsyncStorage.getItem(PERM_KEY);
  return raw ? JSON.parse(raw) as PermissionStatus : {};
}

export async function requestAppPermissions(): Promise<PermissionStatus> {
  const status: PermissionStatus = await getCachedPermissions();

  try {
    // Always try permissions; safe in Expo Go and Dev Client
    const Notifications = await import('expo-notifications');
  const Constants = await import('expo-constants');
    const current = await Notifications.getPermissionsAsync();
    let notifStatus = current.status;
    if (notifStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      notifStatus = req.status;
    }
    status.notifications = notifStatus as any;

    if (notifStatus === 'granted') {
      try {
        // Prefer Expo push token (requires projectId for dev client/standalone)
        const projectId = (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
          || (Constants as any)?.expoConfig?.extra?.eas?.projectId
          || undefined;
        const expoToken = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } as any : undefined as any);
        status.pushToken = expoToken?.data;
      } catch {
        console.warn('[PERM] Expo push token unavailable, will try device token fallback');
      }

      if (!status.pushToken) {
        try {
          const deviceToken = await Notifications.getDevicePushTokenAsync();
          const tokenStr = (deviceToken as any)?.data || (deviceToken as any)?.token || String(deviceToken || '');
          status.pushToken = tokenStr || undefined;
        } catch {
          console.warn('[PERM] Device push token unavailable');
        }
      }
    }
    console.log('[PERM] Notifications', { status: status.notifications, pushToken: status.pushToken || 'none' });
  } catch (e) { console.warn('[PERM] Notifications check failed', e instanceof Error ? e.message : e); }

  // Media library (photos) permission via expo-image-picker
  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    let granted = current?.granted ?? false;
    let mediaStatus = (current as any)?.status as PermissionStatus['mediaLibrary'];
    let canAskAgain = (current as any)?.canAskAgain ?? true;
    if (!granted) {
      const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
      granted = req?.granted ?? false;
      mediaStatus = (req as any)?.status as PermissionStatus['mediaLibrary'];
      canAskAgain = (req as any)?.canAskAgain ?? canAskAgain;
    }
    status.mediaLibrary = mediaStatus || (granted ? 'granted' : 'denied');
    status.mediaCanAskAgain = !!canAskAgain;
    console.log('[PERM] MediaLibrary', { status: status.mediaLibrary, canAskAgain: status.mediaCanAskAgain });
  } catch (e) {
    console.warn('[PERM] Media library permission check failed', e instanceof Error ? e.message : e);
  }

  try {
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
    status.location = locStatus as any;
    if (locStatus === 'granted') {
      const last = await Location.getLastKnownPositionAsync();
      let pos = last;
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (pos?.coords) {
        const c = pos.coords;
        status.coords = { latitude: c.latitude, longitude: c.longitude };
        status.coordsDetailed = {
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy: c.accuracy ?? null,
          altitude: c.altitude ?? null,
          altitudeAccuracy: c.altitudeAccuracy ?? null,
          heading: c.heading ?? null,
          speed: c.speed ?? null,
          timestamp: pos.timestamp,
        };
        try {
          const places = await Location.reverseGeocodeAsync({ latitude: c.latitude, longitude: c.longitude });
          const p = places?.[0];
          if (p) {
            status.place = {
              name: p.name || p.city || p.street || undefined,
              street: p.street || undefined,
              district: (p.district as any) || p.subregion || undefined,
              city: p.city || undefined,
              subregion: p.subregion || undefined,
              region: p.region || undefined,
              postalCode: p.postalCode || undefined,
              country: p.country || undefined,
              isoCountryCode: p.isoCountryCode || undefined,
              fullName: [p.name, p.district || p.subregion, p.region, p.country].filter(Boolean).join(', '),
            };
          } else {
            status.place = null;
          }
        } catch {
          status.place = null;
        }
      } else {
        status.coords = null;
        status.coordsDetailed = null;
        status.place = null;
      }
    } else {
      status.coords = null;
      status.coordsDetailed = null;
      status.place = null;
    }
    console.log('[PERM] Location', {
      status: status.location,
      coords: status.coords ? { lat: status.coords.latitude, lng: status.coords.longitude } : null,
      details: status.coordsDetailed,
      place: status.place,
    });
  } catch { /* ignore */ }

  await AsyncStorage.setItem(PERM_KEY, JSON.stringify(status));
  return status;
}

// Optional: dedicated helper to (re)request only media library permission where needed
export async function requestMediaPermissionsOnly(): Promise<Pick<PermissionStatus, 'mediaLibrary' | 'mediaCanAskAgain'>> {
  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    if (current.granted) {
      return { mediaLibrary: (current as any).status, mediaCanAskAgain: (current as any).canAskAgain } as any;
    }
    const req = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return { mediaLibrary: (req as any).status, mediaCanAskAgain: (req as any).canAskAgain } as any;
  } catch {
    return { mediaLibrary: 'undetermined', mediaCanAskAgain: true } as any;
  }
}

/**
 * Request ONLY location permission - for in-context use (e.g., when user tries to post news).
 * This is Play Store compliant as it's called only when the user performs a location-requiring action.
 */
export async function requestLocationPermissionOnly(): Promise<PermissionStatus> {
  const status: PermissionStatus = await getCachedPermissions();

  try {
    const { status: locStatus } = await Location.requestForegroundPermissionsAsync();
    status.location = locStatus as any;
    if (locStatus === 'granted') {
      const last = await Location.getLastKnownPositionAsync();
      let pos = last;
      if (!pos) {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      }
      if (pos?.coords) {
        const c = pos.coords;
        status.coords = { latitude: c.latitude, longitude: c.longitude };
        status.coordsDetailed = {
          latitude: c.latitude,
          longitude: c.longitude,
          accuracy: c.accuracy ?? null,
          altitude: c.altitude ?? null,
          altitudeAccuracy: c.altitudeAccuracy ?? null,
          heading: c.heading ?? null,
          speed: c.speed ?? null,
          timestamp: pos.timestamp,
        };
        try {
          const places = await Location.reverseGeocodeAsync({ latitude: c.latitude, longitude: c.longitude });
          const p = places?.[0];
          if (p) {
            status.place = {
              name: p.name || p.city || p.street || undefined,
              street: p.street || undefined,
              district: (p.district as any) || p.subregion || undefined,
              city: p.city || undefined,
              subregion: p.subregion || undefined,
              region: p.region || undefined,
              postalCode: p.postalCode || undefined,
              country: p.country || undefined,
              isoCountryCode: p.isoCountryCode || undefined,
              fullName: [p.name, p.district || p.subregion, p.region, p.country].filter(Boolean).join(', '),
            };
          } else {
            status.place = null;
          }
        } catch {
          status.place = null;
        }
      } else {
        status.coords = null;
        status.coordsDetailed = null;
        status.place = null;
      }
    } else {
      status.coords = null;
      status.coordsDetailed = null;
      status.place = null;
    }
    console.log('[PERM] Location (in-context)', {
      status: status.location,
      coords: status.coords ? { lat: status.coords.latitude, lng: status.coords.longitude } : null,
    });
  } catch (e) {
    console.warn('[PERM] Location permission request failed', e instanceof Error ? e.message : e);
  }

  await AsyncStorage.setItem(PERM_KEY, JSON.stringify(status));
  return status;
}

/**
 * Check current permission status WITHOUT requesting any permissions.
 * Use this for UI display or deciding when to show permission prompts.
 * Play Store compliant - no permission dialogs shown.
 */
export async function checkPermissionsOnly(): Promise<PermissionStatus> {
  const status: PermissionStatus = await getCachedPermissions();

  try {
    const Notifications = await import('expo-notifications');
    const current = await Notifications.getPermissionsAsync();
    status.notifications = current.status as any;
    
    // Get FCM token if notification permission is granted
    if (current.status === 'granted') {
      try {
        // Prefer FCM/Device token over Expo token
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        const tokenStr = (deviceToken as any)?.data || (deviceToken as any)?.token;
        if (tokenStr) {
          status.pushToken = tokenStr;
          console.log('[PERM] FCM Token (full):', tokenStr);
        }
      } catch (e) {
        console.warn('[PERM] FCM token fetch failed, trying Expo token');
        try {
          const Constants = await import('expo-constants');
          const projectId = (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
            || (Constants as any)?.expoConfig?.extra?.eas?.projectId;
          const expoToken = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } as any : undefined as any);
          status.pushToken = expoToken?.data;
          console.log('[PERM] Expo Token:', status.pushToken);
        } catch {}
      }
    }
  } catch {}

  try {
    const current = await ImagePicker.getMediaLibraryPermissionsAsync();
    status.mediaLibrary = (current as any)?.status || (current?.granted ? 'granted' : 'undetermined');
    status.mediaCanAskAgain = (current as any)?.canAskAgain ?? true;
  } catch {}

  try {
    const { status: locStatus } = await Location.getForegroundPermissionsAsync();
    status.location = locStatus as any;
    // If already granted, try to get cached location
    if (locStatus === 'granted') {
      const last = await Location.getLastKnownPositionAsync();
      if (last?.coords) {
        status.coords = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        status.coordsDetailed = {
          latitude: last.coords.latitude,
          longitude: last.coords.longitude,
          accuracy: last.coords.accuracy ?? null,
          altitude: last.coords.altitude ?? null,
          altitudeAccuracy: last.coords.altitudeAccuracy ?? null,
          heading: last.coords.heading ?? null,
          speed: last.coords.speed ?? null,
          timestamp: last.timestamp,
        };
      }
    }
  } catch {}

  await AsyncStorage.setItem(PERM_KEY, JSON.stringify(status));
  return status;
}
