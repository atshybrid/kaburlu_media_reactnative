/**
 * Firebase Crashlytics Service
 * 
 * Crash reports చూడడానికి:
 * 1. https://console.firebase.google.com కు వెళ్ళండి
 * 2. kaburlu project select చేయండి
 * 3. Left menu లో "Crashlytics" click చేయండి
 * 
 * Usage:
 * - Crashes automatic గా capture అవుతాయి
 * - Custom errors: logError(new Error('Something failed'))
 * - Custom logs: logMessage('User clicked button')
 * - User info: setUserId('user123')
 */

import { Platform } from 'react-native';

// Check if crashlytics is available (not on web, temporarily disabled on iOS due to initialization issues)
const isCrashlyticsAvailable = Platform.OS === 'android'; // Only Android for now

// Lazy import to avoid @react-native-firebase initialization race on iOS
// The native module self-initializes from GoogleService-Info.plist/google-services.json
let crashlyticsModule: any = null;
let firebaseAppInitialized = false;
let crashlyticsPromise: Promise<any> | null = null;

async function getCrashlytics(): Promise<any> {
  if (crashlyticsModule) return Promise.resolve(crashlyticsModule);
  if (!isCrashlyticsAvailable) return Promise.resolve(null);
  
  if (!crashlyticsPromise) {
    crashlyticsPromise = (async () => {
      // Import @react-native-firebase/app first and access it to trigger native initialization
      if (!firebaseAppInitialized) {
        try {
          const firebaseApp = await import('@react-native-firebase/app');
          // Access the default app to force native module initialization
          const app = firebaseApp.default.app();
          console.log('[Crashlytics] Firebase app initialized:', app.name);
          firebaseAppInitialized = true;
        } catch (e: any) {
          console.warn('[Crashlytics] Firebase app init failed:', e?.message);
          // Continue anyway - native module may auto-init on first use
        }
      }
      // Then import crashlytics
      const mod = await import('@react-native-firebase/crashlytics');
      crashlyticsModule = mod.default;
      return crashlyticsModule;
    })();
  }
  return crashlyticsPromise;
}

/**
 * Log a non-fatal error to Crashlytics
 */
export async function logError(error: Error, context?: Record<string, string>) {
  if (!isCrashlyticsAvailable) return;
  try {
    const crash = await getCrashlytics();
    if (!crash) return;
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        crash().setAttribute(key, value);
      });
    }
    crash().recordError(error);
  } catch (e) {
    console.warn('[Crashlytics] Failed to log error:', e);
  }
}

/**
 * Log a message to Crashlytics (will appear in crash reports)
 */
export async function logMessage(message: string) {
  if (!isCrashlyticsAvailable) return;
  try {
    const crash = await getCrashlytics();
    if (!crash) return;
    crash().log(message);
  } catch (e) {
    console.warn('[Crashlytics] Failed to log message:', e);
  }
}

/**
 * Set user ID for crash reports
 */
export async function setUserId(userId: string) {
  if (!isCrashlyticsAvailable) return;
  try {
    const crash = await getCrashlytics();
    if (!crash) return;
    crash().setUserId(userId);
  } catch (e) {
    console.warn('[Crashlytics] Failed to set user ID:', e);
  }
}

/**
 * Set custom attributes for crash reports
 */
export async function setAttributes(attributes: Record<string, string>) {
  if (!isCrashlyticsAvailable) return;
  try {
    const crash = await getCrashlytics();
    if (!crash) return;
    crash().setAttributes(attributes);
  } catch (e) {
    console.warn('[Crashlytics] Failed to set attributes:', e);
  }
}

/**
 * Force a test crash (DEV only)
 */
export async function testCrash() {
  if (!isCrashlyticsAvailable) return;
  const crash = await getCrashlytics();
  if (!crash) return;
  if (__DEV__) {
    console.log('[Crashlytics] Test crash triggered');
  }
  crash().crash();
}

/**
 * Initialize Crashlytics with user info
 */
export async function initCrashlytics(userId?: string, userAttributes?: Record<string, string>) {
  if (!isCrashlyticsAvailable) {
    console.log('[Crashlytics] Skipped on web');
    return;
  }
  try {
    const crash = await getCrashlytics();
    if (!crash) {
      console.warn('[Crashlytics] Module not available');
      return;
    }
    // Enable Crashlytics collection
    await crash().setCrashlyticsCollectionEnabled(true);
    
    if (userId) {
      await crash().setUserId(userId);
    }
    
    if (userAttributes) {
      await crash().setAttributes(userAttributes);
    }
    
    console.log('[Crashlytics] Initialized successfully');
  } catch (e) {
    console.warn('[Crashlytics] Failed to initialize:', e);
  }
}
