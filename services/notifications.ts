import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { router } from 'expo-router';

type PushStatus = 'granted' | 'denied' | 'undetermined';

const PUSH_TOKEN_KEY = 'push_token';
const PUSH_PERMISSION_PROMPTED_KEY = 'push_permission_prompted_v1';
let initDone = false;
let cachedToken: string | undefined;

// Ensure foreground notifications show a banner/toast
Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowAlert: true,
		shouldPlaySound: true,
		shouldSetBadge: false,
		// Newer SDKs
		shouldShowBanner: true as any,
		shouldShowList: true as any,
	} as any),
});

// Handle notification tap - navigate to article
function handleNotificationTap(data: any) {
	try {
		console.log('[NOTIF] Handling tap with data:', JSON.stringify(data));
		if (data?.articleId) {
			router.push({ pathname: '/article/[id]', params: { id: data.articleId } });
		} else if (data?.shortId) {
			router.push({ pathname: '/article/[id]', params: { id: data.shortId, isShortId: 'true' } });
		} else if (data?.shortNewsId) {
			router.push({ pathname: '/article/[id]', params: { id: data.shortNewsId } });
		}
	} catch (e) {
		console.warn('[NOTIF] Navigation failed:', e);
	}
}

async function ensureNotificationsSetupInternal(options?: { requestPermission?: boolean }): Promise<{ status: PushStatus; fcmToken?: string; expoToken?: string; deviceToken?: string }> {
	try {
		const requestPermission = options?.requestPermission !== false;
		if (!initDone) {
			if (Platform.OS === 'android') {
				try {
					await Notifications.setNotificationChannelAsync('default', {
						name: 'Default',
						importance: Notifications.AndroidImportance.HIGH,
						vibrationPattern: [0, 250, 250, 250],
						lightColor: '#FF231F7C',
						sound: 'default',
					});
				} catch {}
			}

			// Listen for notifications (foreground) and user taps
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

			initDone = true;
		}

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
				console.log('[NOTIF] FCM Token:', fcmToken.substring(0, 20) + '...');
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
