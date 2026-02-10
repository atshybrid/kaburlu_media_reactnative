import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform, Vibration } from 'react-native';
import { router } from 'expo-router';

type PushStatus = 'granted' | 'denied' | 'undetermined';

const PUSH_TOKEN_KEY = 'push_token';
const PUSH_PERMISSION_PROMPTED_KEY = 'push_permission_prompted_v1';
let initDone = false;
let listenersSetup = false;
let cachedToken: string | undefined;

// Ensure foreground notifications show a banner/toast with sound
// Skip on web - notifications not supported
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
	handleNotification: async (notification) => {
		// Vibrate when notification arrives in foreground
		Vibration.vibrate([0, 250, 100, 250]);
		
		console.log('[NOTIF] Foreground notification received, playing sound and vibrating');
		
		return {
			shouldShowAlert: true,
			shouldPlaySound: true,
			shouldSetBadge: true,
			// Newer SDKs
			shouldShowBanner: true as any,
			shouldShowList: true as any,
		} as any;
	},
  });
}

// Handle notification tap - navigate to article
function handleNotificationTap(data: any, retryCount = 0) {
	try {
		// Log ALL keys in the data object to understand backend format
		console.log('[NOTIF] ========================================');
		console.log('[NOTIF] Handling tap with data:', JSON.stringify(data, null, 2));
		console.log('[NOTIF] Data keys:', Object.keys(data || {}));
		console.log('[NOTIF] Retry count:', retryCount);
		console.log('[NOTIF] ========================================');
		
		// Determine the target ID - check multiple possible field names
		let targetId: string | null = null;
		let isShortId = false;
		
		// Try various possible field names the backend might use
		targetId = 
			data?.shortNewsId ||     // shortNewsId
			data?.shortnewsId ||     // shortnewsId (lowercase)
			data?.short_news_id ||   // snake_case
			data?.articleId ||       // articleId
			data?.article_id ||      // snake_case
			data?.id ||              // just id
			data?.newsId ||          // newsId
			data?.news_id ||         // snake_case
			data?.shortId ||         // shortId (for short URLs)
			data?.short_id ||        // snake_case
			null;
		
		// Check if it's a short ID
		if (data?.shortId || data?.short_id) {
			isShortId = true;
		}
		
		console.log('[NOTIF] Resolved targetId:', targetId, 'isShortId:', isShortId);
		
		if (!targetId) {
			console.log('[NOTIF] No navigation target found in data. Available keys:', Object.keys(data || {}));
			return;
		}
		
		// Try to navigate
		try {
			const params: any = { id: targetId };
			if (isShortId) params.isShortId = 'true';
			
			console.log('[NOTIF] Navigating to /article/[id] with params:', JSON.stringify(params));
			router.push({ pathname: '/article/[id]', params });
			console.log('[NOTIF] Navigation successful');
		} catch (navError) {
			// Router might not be ready, retry with delay
			if (retryCount < 5) {
				console.log('[NOTIF] Router not ready, retrying in 500ms...');
				setTimeout(() => handleNotificationTap(data, retryCount + 1), 500);
			} else {
				console.warn('[NOTIF] Navigation failed after retries:', navError);
			}
		}
	} catch (e) {
		console.warn('[NOTIF] Navigation failed:', e);
	}
}

/**
 * Setup notification listeners early (call from _layout.tsx)
 * This ensures we catch notification clicks even when app opens from quit state
 */
export function setupNotificationListeners() {
	// Skip on web - notifications not supported
	if (Platform.OS === 'web') {
		console.log('[NOTIF] Skipping notification listeners on web');
		return;
	}
	
	if (listenersSetup) return;
	listenersSetup = true;
	
	console.log('[NOTIF] Setting up notification listeners');
	
	// Android notification channels with sound and vibration
	if (Platform.OS === 'android') {
		// Default channel - for regular news
		Notifications.setNotificationChannelAsync('default', {
			name: 'వార్తలు (News)',
			description: 'Regular news notifications',
			importance: Notifications.AndroidImportance.HIGH,
			vibrationPattern: [0, 250, 250, 250],
			lightColor: '#109edc',
			sound: 'default',
			enableVibrate: true,
			enableLights: true,
			showBadge: true,
		}).catch((e) => console.warn('[NOTIF] default channel failed:', e));
		
		// Breaking news channel - high priority
		Notifications.setNotificationChannelAsync('breaking', {
			name: 'బ్రేకింగ్ న్యూస్ (Breaking News)',
			description: 'Important breaking news alerts',
			importance: Notifications.AndroidImportance.MAX,
			vibrationPattern: [0, 500, 200, 500, 200, 500],
			lightColor: '#FF0000',
			sound: 'default',
			enableVibrate: true,
			enableLights: true,
			showBadge: true,
			bypassDnd: true,
		}).catch((e) => console.warn('[NOTIF] breaking channel failed:', e));
		
		// Short news channel
		Notifications.setNotificationChannelAsync('shortnews', {
			name: 'షార్ట్ న్యూస్ (Short News)',
			description: 'Quick short news updates',
			importance: Notifications.AndroidImportance.HIGH,
			vibrationPattern: [0, 200, 100, 200],
			lightColor: '#10b981',
			sound: 'default',
			enableVibrate: true,
			enableLights: true,
			showBadge: true,
		}).catch((e) => console.warn('[NOTIF] shortnews channel failed:', e));
	}
	
	// Listen for notifications (foreground)
	Notifications.addNotificationReceivedListener((n) => {
		console.log('[NOTIF] received (fg)', JSON.stringify(n.request?.content));
	});
	
	// Handle notification tap - navigate to article
	Notifications.addNotificationResponseReceivedListener((resp) => {
		console.log('[NOTIF] response', JSON.stringify(resp.notification?.request?.content));
		const data = resp.notification?.request?.content?.data;
		if (data) {
			handleNotificationTap(data);
		}
	});
	
	// Check if app was opened from a notification (quit state)
	Notifications.getLastNotificationResponseAsync().then((response) => {
		if (response) {
			console.log('[NOTIF] App opened from notification (quit state):', JSON.stringify(response.notification?.request?.content));
			const data = response.notification?.request?.content?.data;
			if (data) {
				// Delay to ensure router is ready
				setTimeout(() => {
					handleNotificationTap(data);
				}, 1000);
			}
		}
	}).catch((e) => {
		console.warn('[NOTIF] getLastNotificationResponseAsync failed:', e);
	});
}

async function ensureNotificationsSetupInternal(options?: { requestPermission?: boolean }): Promise<{ status: PushStatus; fcmToken?: string; expoToken?: string; deviceToken?: string }> {
	try {
		const requestPermission = options?.requestPermission !== false;
		
		// Ensure listeners are setup (idempotent)
		setupNotificationListeners();
		initDone = true;

		// Check/request permission
		const current = await Notifications.getPermissionsAsync();
		let status = current.status as PushStatus;
		if (status !== 'granted' && requestPermission) {
			const req = await Notifications.requestPermissionsAsync();
			status = req.status as PushStatus;
		}
		if (status !== 'granted') {
			console.warn('[NOTIF] permission not granted');
			return { status };
		}

		// ✅ PRIMARY: Get FCM/APNs device token (preferred for Firebase backend)
		let fcmToken: string | undefined;
		try {
			const device = await Notifications.getDevicePushTokenAsync();
			fcmToken = (device as any)?.data || (device as any)?.token;
			if (fcmToken) {
				cachedToken = fcmToken;
				await AsyncStorage.setItem(PUSH_TOKEN_KEY, fcmToken);
				// Log full token for debugging
				console.log('[NOTIF] FCM Token (full):', fcmToken);
			}
		} catch (e) {
			console.warn('[NOTIF] getDevicePushTokenAsync failed', e instanceof Error ? e.message : e);
		}

		// FALLBACK: Expo push token (if FCM fails)
		let expoToken: string | undefined;
		if (!fcmToken) {
			try {
				const projectId = (Constants as any)?.expoConfig?.extra?.eas?.projectId
					|| (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
					|| undefined;
				const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } as any : undefined as any);
				expoToken = tokenData?.data;
				cachedToken = expoToken || cachedToken;
				if (expoToken) await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoToken);
			} catch (e) {
				console.warn('[NOTIF] getExpoPushTokenAsync failed', e instanceof Error ? e.message : e);
			}
		}

		console.log('[NOTIF] setup done', { 
			status, 
			fcmToken: fcmToken ? `${fcmToken.slice(0, 12)}…` : 'none', 
			expoToken: expoToken ? `${expoToken.slice(0, 12)}…` : 'none' 
		});
		return { status, fcmToken, expoToken, deviceToken: fcmToken };
	} catch (e) {
		console.warn('[NOTIF] setup failed', e instanceof Error ? e.message : e);
		return { status: 'undetermined' };
	}
}

export async function ensureNotificationsSetup(): Promise<{ status: PushStatus; fcmToken?: string; expoToken?: string; deviceToken?: string }> {
	// Existing behavior: request permission if not yet granted
	return ensureNotificationsSetupInternal({ requestPermission: true });
}

export async function ensureNotificationsSetupOnceAfterSplash(): Promise<{ status: PushStatus; fcmToken?: string; expoToken?: string; deviceToken?: string }> {
	// New behavior: prompt at most once across app opens.
	// - If permission already granted: fetch tokens.
	// - If not granted and already prompted: do not prompt again.
	// - If not granted and not yet prompted: prompt once.
	try {
		const current = await Notifications.getPermissionsAsync();
		const status = current.status as PushStatus;
		if (status === 'granted') {
			return ensureNotificationsSetupInternal({ requestPermission: false });
		}

		const prompted = await AsyncStorage.getItem(PUSH_PERMISSION_PROMPTED_KEY);
		if (prompted) {
			return ensureNotificationsSetupInternal({ requestPermission: false });
		}

		await AsyncStorage.setItem(PUSH_PERMISSION_PROMPTED_KEY, '1');
		return ensureNotificationsSetupInternal({ requestPermission: true });
	} catch (e) {
		console.warn('[NOTIF] setup-once failed', e instanceof Error ? e.message : e);
		return { status: 'undetermined' };
	}
}

export async function getCurrentPushToken(): Promise<string | undefined> {
	if (cachedToken) return cachedToken;
	const t = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
	cachedToken = t || undefined;
	return cachedToken;
}

/**
 * Sync push token on app foreground.
 * If user grants notification permission later from device settings,
 * this will get the new token and update backend.
 */
export async function syncPushTokenOnForeground(): Promise<void> {
	try {
		const Notifications = await import('expo-notifications');
		const current = await Notifications.getPermissionsAsync();
		
		if (current.status !== 'granted') {
			console.log('[NOTIF] Permission not granted, skipping token sync');
			return;
		}

		// Get current FCM token
		let newToken: string | undefined;
		try {
			const device = await Notifications.getDevicePushTokenAsync();
			newToken = (device as any)?.data || (device as any)?.token;
		} catch {}

		if (!newToken) {
			try {
				const Constants = await import('expo-constants');
				const projectId = (Constants as any)?.default?.expoConfig?.extra?.eas?.projectId
					|| (Constants as any)?.expoConfig?.extra?.eas?.projectId;
				const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } as any : undefined as any);
				newToken = tokenData?.data;
			} catch {}
		}

		if (!newToken) {
			console.log('[NOTIF] No token available');
			return;
		}

		// Check if token changed from cached
		const cachedT = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
		if (cachedT === newToken) {
			console.log('[NOTIF] Token unchanged, skipping sync');
			return;
		}

		// Token is new or changed - update backend
		console.log('[NOTIF] Token changed, updating backend...');
		await AsyncStorage.setItem(PUSH_TOKEN_KEY, newToken);
		cachedToken = newToken;

		// Update backend preferences
		try {
			const { updatePreferences } = await import('./api');
			await updatePreferences({ pushToken: newToken });
			console.log('[NOTIF] Token synced to backend');
		} catch (e) {
			console.warn('[NOTIF] Token sync to backend failed:', e instanceof Error ? e.message : e);
		}
	} catch (e) {
		console.warn('[NOTIF] syncPushTokenOnForeground failed:', e instanceof Error ? e.message : e);
	}
}

export async function scheduleLocalTestNotification(seconds = 3) {
	try {
			await Notifications.scheduleNotificationAsync({
			content: {
				title: 'Test notification',
				body: 'This is a local test notification from Kaburlu',
				sound: 'default',
			},
				trigger: {
					type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
					seconds,
					channelId: Platform.OS === 'android' ? 'default' : undefined,
					repeats: false,
				} as any,
		});
		console.log('[NOTIF] local test scheduled in', seconds, 'sec');
	} catch (e) {
		console.warn('[NOTIF] schedule local failed', e instanceof Error ? e.message : e);
	}
}

/**
 * Get and display push token for testing
 * Usage: In console, call this function to get the token for backend testing
 */
export async function getPushTokenForTesting(): Promise<string | undefined> {
	try {
		const token = await getCurrentPushToken();
		if (token) {
			console.log('\n\n');
			console.log('═══════════════════════════════════════════════════════════');
			console.log('📱 PUSH NOTIFICATION TOKEN FOR TESTING:');
			console.log('═══════════════════════════════════════════════════════════');
			console.log(token);
			console.log('═══════════════════════════════════════════════════════════');
			console.log('Copy this token and use it in your backend API call');
			console.log('\n\n');
			return token;
		} else {
			console.log('[NOTIF TEST] No token available yet. Make sure notifications are enabled.');
			return undefined;
		}
	} catch (e) {
		console.warn('[NOTIF TEST] Failed to get token:', e);
		return undefined;
	}
}

