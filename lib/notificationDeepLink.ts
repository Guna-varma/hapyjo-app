/**
 * Maps notification link_type to the app tab/screen so notification tap opens the right place.
 * Used by PushTokenRegistration and notification response handler.
 */
import type { TabId } from '@/lib/rbac';

export type NotificationLinkType =
  | 'issue'
  | 'trip'
  | 'machine_session'
  | 'expense'
  | 'survey'
  | 'report'
  | 'user'
  | 'site'
  | 'vehicle'
  | 'task'
  | 'settings';

/** Map link_type from notifications table to TabId. Returns dashboard for unknown so user lands in a valid tab. */
export function getTabForLinkType(linkType: string | undefined): TabId {
  switch (linkType) {
    case 'issue':
      return 'issues';
    case 'trip':
    case 'machine_session':
    case 'task':
      return 'tasks';
    case 'expense':
      return 'expenses';
    case 'survey':
      return 'surveys';
    case 'report':
      return 'reports';
    case 'user':
      return 'users';
    case 'site':
    case 'driver_vehicle_assignment':
      return 'sites';
    case 'vehicle':
      return 'vehicles';
    case 'settings':
      return 'settings';
    default:
      return 'dashboard';
  }
}

export interface PendingNotificationLink {
  linkType: string;
  linkId?: string;
}
