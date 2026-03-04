/**
 * Registers the device for real-time push notifications when the user is logged in.
 * On notification tap (local or push), switches to the correct tab via NotificationNavigationContext.
 */
import { useEffect, useRef } from 'react';
import Constants from 'expo-constants';
import { registerPushTokenForUser } from '@/lib/registerPushToken';
import { useAuth } from '@/context/AuthContext';
import { useNotificationNavigation } from '@/context/NotificationNavigationContext';
import { getTabForLinkType } from '@/lib/notificationDeepLink';

export function PushTokenRegistration() {
  const { user } = useAuth();
  const registered = useRef(false);
  const nav = useNotificationNavigation();

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
      sub = Notifications.addNotificationResponseReceivedListener(
        (response: { notification: { request: { content: { data?: { linkId?: string; linkType?: string } } } } }) => {
          const data = response.notification.request.content.data;
          const linkType = data?.linkType;
          const setActiveTab = nav?.getSetActiveTab?.() ?? null;
          if (linkType && setActiveTab) {
            const tab = getTabForLinkType(linkType);
            setActiveTab(tab);
          }
        }
      );
    })();
    return () => {
      sub?.remove();
    };
  }, [nav]);

  return null;
}
