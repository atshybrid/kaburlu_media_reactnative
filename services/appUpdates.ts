/**
 * App Updates Service
 * Handles OTA (Over-The-Air) updates using expo-updates
 * 
 * How it works:
 * 1. On app launch, checks for new updates
 * 2. If update available, downloads it in background
 * 3. Shows user a prompt to restart app
 * 4. New update applies on restart
 */

import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

// Telugu strings for update dialogs
const STRINGS = {
  updateAvailable: 'కొత్త అప్‌డేట్ అందుబాటులో ఉంది',
  updateMessage: 'యాప్ లో కొత్త ఫీచర్లు మరియు మెరుగుదలలు అందుబాటులో ఉన్నాయి. ఇప్పుడు అప్‌డేట్ చేయాలా?',
  updateNow: 'అప్‌డేట్ చేయి',
  later: 'తర్వాత',
  downloading: 'అప్‌డేట్ డౌన్‌లోడ్ అవుతోంది...',
  restarting: 'యాప్ రీస్టార్ట్ అవుతోంది...',
  error: 'అప్‌డేట్ లో సమస్య',
};

/**
 * Check for updates and prompt user if available
 * Call this on app startup or when user opens settings
 */
export async function checkForAppUpdates(silent = false): Promise<boolean> {
  // In development mode, updates are not available
  if (__DEV__) {
    console.log('[AppUpdates] Development mode - skipping update check');
    return false;
  }

  try {
    console.log('[AppUpdates] Checking for updates...');
    const update = await Updates.checkForUpdateAsync();

    if (update.isAvailable) {
      console.log('[AppUpdates] Update available, downloading...');
      
      if (!silent) {
        // Show downloading indicator (optional - you can add a loading state)
      }

      // Download the update
      const result = await Updates.fetchUpdateAsync();
      
      if (result.isNew) {
        console.log('[AppUpdates] Update downloaded, prompting user...');
        
        // Prompt user to restart
        return new Promise((resolve) => {
          Alert.alert(
            STRINGS.updateAvailable,
            STRINGS.updateMessage,
            [
              {
                text: STRINGS.later,
                style: 'cancel',
                onPress: () => {
                  console.log('[AppUpdates] User deferred update');
                  resolve(false);
                },
              },
              {
                text: STRINGS.updateNow,
                style: 'default',
                onPress: async () => {
                  console.log('[AppUpdates] Restarting with new update...');
                  await Updates.reloadAsync();
                  resolve(true);
                },
              },
            ],
            { cancelable: false }
          );
        });
      }
    } else {
      console.log('[AppUpdates] No updates available');
    }

    return false;
  } catch (error) {
    console.error('[AppUpdates] Error checking for updates:', error);
    
    if (!silent) {
      // Only show error in non-silent mode (e.g., when user manually checks)
      // Alert.alert(STRINGS.error, String(error));
    }
    
    return false;
  }
}

/**
 * Force download and apply update immediately
 * Use for critical updates
 */
export async function forceUpdate(): Promise<void> {
  if (__DEV__) {
    console.log('[AppUpdates] Development mode - skipping force update');
    return;
  }

  try {
    const update = await Updates.checkForUpdateAsync();
    
    if (update.isAvailable) {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
    }
  } catch (error) {
    console.error('[AppUpdates] Force update failed:', error);
    throw error;
  }
}

/**
 * Get current update info (for debugging/settings screen)
 */
export function getUpdateInfo() {
  return {
    isEmbeddedLaunch: Updates.isEmbeddedLaunch,
    updateId: Updates.updateId,
    createdAt: Updates.createdAt,
    channel: Updates.channel,
    runtimeVersion: Updates.runtimeVersion,
    isEnabled: !__DEV__,
  };
}

/**
 * Check if we're running the latest update
 * Returns true if no updates available
 */
export async function isLatestVersion(): Promise<boolean> {
  if (__DEV__) return true;

  try {
    const update = await Updates.checkForUpdateAsync();
    return !update.isAvailable;
  } catch {
    return true; // Assume latest on error
  }
}
