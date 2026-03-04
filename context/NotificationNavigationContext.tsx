/**
 * Allows notification handler (PushTokenRegistration) to switch tabs when user taps a notification.
 * AppNavigation registers setActiveTab; notification response listener calls it with the tab for linkType.
 */
import React, { createContext, useCallback, useRef, useContext } from 'react';
import type { TabId } from '@/lib/rbac';
import type { SurveyNavParams } from '@/components/RoleBasedDashboard';

type SetActiveTabFn = (tab: TabId, params?: SurveyNavParams) => void;

interface NotificationNavigationContextValue {
  registerSetActiveTab: (fn: SetActiveTabFn) => () => void;
  getSetActiveTab: () => SetActiveTabFn | null;
}

const NotificationNavigationContext = createContext<NotificationNavigationContextValue | null>(null);

export function NotificationNavigationProvider({ children }: { children: React.ReactNode }) {
  const setActiveTabRef = useRef<SetActiveTabFn | null>(null);

  const registerSetActiveTab = useCallback((fn: SetActiveTabFn) => {
    setActiveTabRef.current = fn;
    return () => {
      setActiveTabRef.current = null;
    };
  }, []);

  const getSetActiveTab = useCallback(() => setActiveTabRef.current, []);

  const value: NotificationNavigationContextValue = {
    registerSetActiveTab,
    getSetActiveTab,
  };

  return (
    <NotificationNavigationContext.Provider value={value}>
      {children}
    </NotificationNavigationContext.Provider>
  );
}

export function useNotificationNavigation(): NotificationNavigationContextValue | null {
  return useContext(NotificationNavigationContext);
}
