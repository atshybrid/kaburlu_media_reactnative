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

import crashlytics from '@react-native-firebase/crashlytics';
import { Platform } from 'react-native';

// Check if crashlytics is available (not on web)
const isCrashlyticsAvailable = Platform.OS !== 'web';

/**
 * Log a non-fatal error to Crashlytics
 */
export function logError(error: Error, context?: Record<string, string>) {
  if (!isCrashlyticsAvailable) return;
  try {
    if (context) {
      Object.entries(context).forEach(([key, value]) => {
        crashlytics().setAttribute(key, value);
      });
    }
    crashlytics().recordError(error);
  } catch (e) {
    console.warn('[Crashlytics] Failed to log error:', e);
  }
}

/**
 * Log a message to Crashlytics (will appear in crash reports)
 */
export function logMessage(message: string) {
  if (!isCrashlyticsAvailable) return;
  try {
    crashlytics().log(message);
  } catch (e) {
    console.warn('[Crashlytics] Failed to log message:', e);
  }
}

/**
 * Set user ID for crash reports
 */
export function setUserId(userId: string) {
  if (!isCrashlyticsAvailable) return;
  try {
    crashlytics().setUserId(userId);
  } catch (e) {
    console.warn('[Crashlytics] Failed to set user ID:', e);
  }
}

/**
 * Set custom attributes for crash reports
 */
export function setAttributes(attributes: Record<string, string>) {
  if (!isCrashlyticsAvailable) return;
  try {
    crashlytics().setAttributes(attributes);
  } catch (e) {
    console.warn('[Crashlytics] Failed to set attributes:', e);
  }
}

/**
 * Force a test crash (DEV only)
 */
export function testCrash() {
  if (!isCrashlyticsAvailable) return;
  if (__DEV__) {
    console.log('[Crashlytics] Test crash triggered');
  }
  crashlytics().crash();
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
    // Enable Crashlytics collection
    await crashlytics().setCrashlyticsCollectionEnabled(true);
    
    if (userId) {
      await crashlytics().setUserId(userId);
    }
    
    if (userAttributes) {
      await crashlytics().setAttributes(userAttributes);
    }
    
    console.log('[Crashlytics] Initialized successfully');
  } catch (e) {
    console.warn('[Crashlytics] Failed to initialize:', e);
  }
}
