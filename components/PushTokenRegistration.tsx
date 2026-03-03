/**
 * Registers the device for real-time push notifications when the user is logged in.
 * Permissions are taken from the authenticated user (RLS on push_tokens).
 * No-op in Expo Go (push was removed in SDK 53); only runs in dev/production builds.
 */
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { registerPushTokenForUser } from '@/lib/registerPushToken';
import { useAuth } from '@/context/AuthContext';

export function PushTokenRegistration() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let cancelled = false;
    (async () => {
      const Notifications = await import('expo-notifications');
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });
      if (cancelled) return;
      if (!user?.id) {
        registered.current = false;
        return;
      }
      if (registered.current) return;
      try {
        await registerPushTokenForUser(user.id);
        if (!cancelled) registered.current = true;
      } catch {
        // ignore (e.g. permission denied, no projectId in dev)
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;
    let sub: { remove: () => void } | null = null;
    (async () => {
      const Notifications = await import('expo-notifications');
      sub = Notifications.addNotificationResponseReceivedListener((response: { notification: { request: { content: { data?: { linkId?: string; linkType?: string } } } } }) => {
        const data = response.notification.request.content.data;
        if (data?.linkId && data?.linkType === 'issue') {
          // Could navigate to issue screen; app will refetch on focus via Realtime
        }
      });
    })();
    return () => {
      sub?.remove();
    };
  }, []);

  return null;
}
