/**
 * Registers the current device's Expo push token with Supabase (push_tokens).
 * Permissions are taken from the authenticated user; RLS ensures user can only
 * insert/update their own token.
 * Uses dynamic import for expo-notifications so Expo Go (where push is unsupported) never loads it.
 * In Expo Go on Android we still request POST_NOTIFICATIONS via PermissionsAndroid so the prompt shows when testing.
 */

import { Platform, PermissionsAndroid } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

const ANDROID_DEFAULT_CHANNEL_ID = 'default';

/** Set Android notification channel (required for Android 8+). No-op on iOS. */
async function setAndroidChannelIfNeeded(Notifications: typeof import('expo-notifications')) {
  if (Platform.OS !== 'android') return;
  try {
    const importance = (Notifications as { AndroidImportance?: { DEFAULT?: number } }).AndroidImportance?.DEFAULT ?? 3;
    await Notifications.setNotificationChannelAsync(ANDROID_DEFAULT_CHANNEL_ID, {
      name: 'Default',
      importance,
    });
  } catch {
    // ignore
  }
}

const POST_NOTIFICATIONS = 'android.permission.POST_NOTIFICATIONS';

/**
 * Request notification permission so real-time system notifications show in the tray.
 * Must ask in BOTH Android Expo Go and real APK so you can demo to the client.
 * Android: Uses PermissionsAndroid so the system "Allow notifications" dialog appears (Expo Go + APK).
 * iOS: expo-notifications (real APK only; skipped in Expo Go to avoid crash).
 */
export async function requestNotificationPermissionAsync(): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;

  const isExpoGo = Constants.appOwnership === 'expo';

  if (Platform.OS === 'android') {
    try {
      const perm = (PermissionsAndroid as { PERMISSIONS?: { POST_NOTIFICATIONS?: string } }).PERMISSIONS?.POST_NOTIFICATIONS ?? POST_NOTIFICATIONS;
      await PermissionsAndroid.request(perm as Parameters<typeof PermissionsAndroid.request>[0], {
        title: 'Hapyjo notifications',
        message: 'Allow Hapyjo to show real-time notifications (trips, expenses, issues, etc.).',
        buttonNegative: 'Deny',
        buttonPositive: 'Allow',
      });
    } catch {
      // Android < 13 has no runtime notification permission; ignore
    }
    if (!isExpoGo) {
      try {
        const Notifications = await import('expo-notifications');
        await setAndroidChannelIfNeeded(Notifications);
        const { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
          await Notifications.requestPermissionsAsync();
        }
      } catch {
        // ignore
      }
    }
    return;
  }

  if (Platform.OS === 'ios') {
    if (isExpoGo) return; // Avoid requiring expo-notifications in Expo Go (unknown module crash)
    try {
      const Notifications = await import('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }
    } catch {
      // ignore (e.g. simulator)
    }
  }
}

/** Call once when user is authenticated. Requests permission, gets token, upserts into push_tokens. */
export async function registerPushTokenForUser(userId: string): Promise<void> {
  if (Platform.OS !== 'android' && Platform.OS !== 'ios') return;
  if (Constants.appOwnership === 'expo') return;

  const Notifications = await import('expo-notifications');
  await setAndroidChannelIfNeeded(Notifications);
  const { status: existing } = await Notifications.getPermissionsAsync();
  let final = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    final = status;
  }
  if (final !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: projectId ?? undefined,
  });
  const expoPushToken = tokenData.data;
  if (!expoPushToken || !expoPushToken.startsWith('ExpoPushToken[')) return;

  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      expo_push_token: expoPushToken,
    },
    {
      onConflict: 'user_id,expo_push_token',
      ignoreDuplicates: false,
    }
  );
}
