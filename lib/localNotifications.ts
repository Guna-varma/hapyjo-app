/**
 * Real-time system notifications: shown when a new notification row arrives (Realtime INSERT).
 * Template inspired by common apps: app name as source, title + body in notification tray.
 * App icon comes from app.json expo-notifications plugin (icon + color); same in real APK and when testing.
 */

import { Platform } from 'react-native';
import Constants from 'expo-constants';

const APP_NAME = 'Hapyjo';
/** Must match app.json expo-notifications defaultChannel so the app icon and color are used. */
const ANDROID_CHANNEL_ID = 'default';

/**
 * Load expo-notifications only when NOT in Expo Go to avoid "unknown module 3308" crash.
 * In Expo Go the native module is not available; use a real APK or dev build to test notifications.
 */
async function getNotificationsModule() {
  if (Constants.appOwnership === 'expo') return null;
  try {
    return await import('expo-notifications');
  } catch {
    return null;
  }
}

async function ensureChannelAndHandler(Notifications: NonNullable<Awaited<ReturnType<typeof getNotificationsModule>>>) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  if (Platform.OS === 'android') {
    try {
      const importance = (Notifications as { AndroidImportance?: { HIGH?: number; DEFAULT?: number } }).AndroidImportance?.HIGH
        ?? (Notifications as { AndroidImportance?: { DEFAULT?: number } }).AndroidImportance?.DEFAULT ?? 4;
      await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
        name: APP_NAME,
        description: 'Real-time updates and alerts',
        importance,
        sound: 'default', // System default notification sound; add custom in app.json "sounds" to use your own
        enableVibrate: true,
      });
    } catch {
      // ignore
    }
  }
}

/**
 * Show a system notification in the tray (app icon from app.json plugin).
 * Template: title as main line, body as detail – like common apps. Uses default channel so icon and color apply.
 */
export async function showSystemNotification(title: string, body: string): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;
  try {
    await ensureChannelAndHandler(Notifications);
    const displayTitle = title && title.trim() ? title.trim() : APP_NAME;
    const displayBody = body && body.trim() ? body.trim() : 'New update';
    await Notifications.scheduleNotificationAsync({
      content: {
        title: displayTitle,
        body: displayBody,
        sound: 'default',
        ...(Platform.OS === 'android' && { channelId: ANDROID_CHANNEL_ID }),
      },
      trigger: null,
    });
  } catch {
    // ignore (e.g. Expo Go or permission denied)
  }
}

/** No-op: demo repeating notifications removed; only real-time system notifications are used. */
export function startDemoRepeatingNotifications(): () => void {
  return () => {};
}

/** No-op: kept for API compatibility (e.g. logout cleanup). */
export function cancelDemoRepeatingNotifications(): void {}
