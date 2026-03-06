/**
 * Pre-made notification scenarios: one place that defines who is notified
 * for each event so everyone who needs to know gets it with minimal interactions.
 * Real-time: titles/bodies use payload data; rows are inserted per target role.
 *
 * Use buildNotificationRows() after a mutation; caller inserts into notifications.
 */

import type { UserRole } from '@/types';

export type NotificationScenarioId =
  | 'issue_raised'
  | 'issue_resolved'
  | 'trip_started'
  | 'trip_completed'
  | 'expense_added'
  | 'survey_submitted'
  | 'survey_approved'
  | 'report_generated'
  | 'user_created'
  | 'password_reset'
  | 'site_assignment'
  | 'site_added'
  | 'driver_vehicle_assignment'
  | 'machine_session_completed'
  | 'machine_session_started'
  | 'task_completed'
  | 'task_assigned'
  | 'vehicle_added'
  | 'vehicle_updated'
  | 'site_task_completed'
  | 'trip_assigned'
  | 'trip_need_approval';

export interface NotificationScenario {
  id: NotificationScenarioId;
  /** Roles that receive this notification (from profiles.role). */
  targetRoles: UserRole[];
  /** Link type for deep link / UI. */
  linkType: string;
  getTitle: (payload: Record<string, unknown>) => string;
  getBody: (payload: Record<string, unknown>) => string;
  linkIdKey?: string;
}

const scenarios: Record<NotificationScenarioId, NotificationScenario> = {
  issue_raised: {
    id: 'issue_raised',
    targetRoles: ['owner', 'head_supervisor'],
    linkType: 'issue',
    linkIdKey: 'id',
    getTitle: () => 'New issue reported',
    getBody: (p) => {
      const site = p.siteName ? `[${String(p.siteName)}] ` : '';
      const desc = typeof p.description === 'string' ? p.description.slice(0, 100) : 'No description';
      const role = typeof p.createdByRole === 'string' ? ` (${p.createdByRole})` : '';
      const imgs = Array.isArray(p.imageUris) && p.imageUris.length > 0 ? ` • ${p.imageUris.length} image(s) attached` : '';
      return `${site}Issue #${p.id ?? ''}${role}. ${desc}${imgs}`.trim();
    },
  },

  issue_resolved: {
    id: 'issue_resolved',
    targetRoles: ['admin', 'owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'issue',
    linkIdKey: 'id',
    getTitle: () => 'Issue updated',
    getBody: (p) => {
      const site = p.siteName ? `[${String(p.siteName)}] ` : '';
      const status = p.status ? `Status: ${String(p.status)}.` : 'Updated.';
      const desc = typeof p.description === 'string' ? p.description.slice(0, 80) : '';
      return `${site}${status} ${desc}`.trim();
    },
  },

  trip_started: {
    id: 'trip_started',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'trip',
    linkIdKey: 'id',
    getTitle: () => 'Trip started – track live',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}] ` : '';
      const vehicle = p.vehicleNumberOrId ? ` ${String(p.vehicleNumberOrId)}` : '';
      const driver = p.driverName ? ` • ${String(p.driverName)}` : '';
      return `${site}${vehicle}${driver}`.trim() || 'Driver started a trip. Open app to track live location.';
    },
  },

  trip_completed: {
    id: 'trip_completed',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'accountant'],
    linkType: 'trip',
    linkIdKey: 'id',
    getTitle: () => 'Trip completed',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}] ` : '';
      const vehicle = p.vehicleNumberOrId ? ` ${String(p.vehicleNumberOrId)}` : '';
      const dist = p.distanceKm != null ? ` • ${p.distanceKm} km` : '';
      return `${site}${vehicle}${dist}`.trim() || 'Trip logged.';
    },
  },

  expense_added: {
    id: 'expense_added',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'accountant'],
    linkType: 'expense',
    linkIdKey: 'id',
    getTitle: () => 'New expense',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}] ` : '';
      const amount = p.amountRwf != null ? `${Number(p.amountRwf).toLocaleString()} RWF` : '';
      const desc = typeof p.description === 'string' ? p.description.slice(0, 80) : '';
      return `${site}${amount} – ${desc}`.trim();
    },
  },

  survey_submitted: {
    id: 'survey_submitted',
    targetRoles: ['admin', 'owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'survey',
    linkIdKey: 'id',
    getTitle: () => 'Survey submitted',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Survey';
      return `${site} – ready for review`;
    },
  },

  survey_approved: {
    id: 'survey_approved',
    targetRoles: ['surveyor', 'owner', 'head_supervisor', 'accountant'],
    linkType: 'survey',
    linkIdKey: 'id',
    getTitle: () => 'Survey approved',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Your survey';
      return `${site} has been approved`;
    },
  },

  report_generated: {
    id: 'report_generated',
    targetRoles: ['admin', 'owner', 'head_supervisor', 'accountant'],
    linkType: 'report',
    linkIdKey: 'id',
    getTitle: () => 'Report ready',
    getBody: (p) => {
      const title = p.title ? String(p.title) : 'Report';
      const period = p.period ? ` (${p.period})` : '';
      return `${title}${period}`;
    },
  },

  user_created: {
    id: 'user_created',
    targetRoles: ['admin', 'owner'],
    linkType: 'user',
    linkIdKey: 'user_id',
    getTitle: () => 'New user added',
    getBody: (p) => {
      const name = p.name ? String(p.name) : 'User';
      const role = p.role ? String(p.role) : '';
      return `${name}${role ? ` • ${role}` : ''}`;
    },
  },

  password_reset: {
    id: 'password_reset',
    targetRoles: [],
    linkType: 'settings',
    getTitle: () => 'Password reset',
    getBody: () => 'A new temporary password was set. Check with admin or email. Use it to sign in and change password.',
  },

  site_assignment: {
    id: 'site_assignment',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'site',
    linkIdKey: 'siteId',
    getTitle: () => 'Site assignment updated',
    getBody: (p) => {
      const site = p.siteName ? String(p.siteName) : 'A site';
      const role = p.role ? ` as ${String(p.role)}` : '';
      return `${site}${role}`;
    },
  },

  driver_vehicle_assignment: {
    id: 'driver_vehicle_assignment',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'],
    linkType: 'site',
    linkIdKey: 'siteId',
    getTitle: () => 'Vehicle assignment updated',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Site';
      const vehicles = Array.isArray(p.vehicleIds) ? `${(p.vehicleIds as string[]).length} vehicle(s)` : 'vehicles';
      return `${site} – ${vehicles}`;
    },
  },

  machine_session_completed: {
    id: 'machine_session_completed',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'accountant'],
    linkType: 'machine_session',
    linkIdKey: 'id',
    getTitle: () => 'Machine session completed',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Session';
      const hours = p.durationHours != null ? ` ${Number(p.durationHours)}h` : '';
      return `${site}${hours}`.trim();
    },
  },

  task_completed: {
    id: 'task_completed',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'task',
    linkIdKey: 'id',
    getTitle: () => 'Task completed',
    getBody: (p) => {
      const title = p.title ? String(p.title) : 'Task';
      const site = p.siteName ? ` [${p.siteName}]` : '';
      return `${title}${site}`;
    },
  },

  site_task_completed: {
    id: 'site_task_completed',
    targetRoles: ['owner', 'head_supervisor'],
    linkType: 'site',
    linkIdKey: 'siteId',
    getTitle: () => 'Site task completed',
    getBody: (p) => {
      const task = p.taskName ? String(p.taskName) : 'Task';
      const site = p.siteName ? ` at [${p.siteName}]` : '';
      return `${task}${site}`;
    },
  },

  vehicle_added: {
    id: 'vehicle_added',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'vehicle',
    linkIdKey: 'id',
    getTitle: () => 'Vehicle added',
    getBody: (p) => {
      const vehicle = p.vehicleNumberOrId ? String(p.vehicleNumberOrId) : 'Vehicle';
      const type = p.type ? ` (${String(p.type)})` : '';
      const site = p.siteName ? ` at [${p.siteName}]` : '';
      return `${vehicle}${type}${site}`;
    },
  },

  vehicle_updated: {
    id: 'vehicle_updated',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'],
    linkType: 'vehicle',
    linkIdKey: 'id',
    getTitle: () => 'Vehicle updated',
    getBody: (p) => {
      const vehicle = p.vehicleNumberOrId ? String(p.vehicleNumberOrId) : 'Vehicle';
      const site = p.siteName ? ` [${p.siteName}]` : '';
      return `${vehicle}${site}`;
    },
  },

  site_added: {
    id: 'site_added',
    targetRoles: ['admin', 'owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'site',
    linkIdKey: 'id',
    getTitle: () => 'New site added',
    getBody: (p) => {
      const name = p.name ? String(p.name) : 'Site';
      const location = p.location ? ` – ${String(p.location)}` : '';
      return `${name}${location}`;
    },
  },

  task_assigned: {
    id: 'task_assigned',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'],
    linkType: 'task',
    linkIdKey: 'id',
    getTitle: () => 'Task assigned',
    getBody: (p) => {
      const title = p.title ? String(p.title) : 'Task';
      const site = p.siteName ? ` [${p.siteName}]` : '';
      return `${title}${site}`;
    },
  },

  machine_session_started: {
    id: 'machine_session_started',
    targetRoles: ['owner', 'head_supervisor', 'assistant_supervisor'],
    linkType: 'machine_session',
    linkIdKey: 'id',
    getTitle: () => 'Machine session started',
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Site';
      const vehicle = p.vehicleNumberOrId ? ` ${String(p.vehicleNumberOrId)}` : '';
      return `${site}${vehicle}`.trim();
    },
  },

  trip_assigned: {
    id: 'trip_assigned',
    targetRoles: ['driver_truck', 'driver_machine'],
    linkType: 'assigned_trip',
    linkIdKey: 'id',
    getTitle: (p) => (p.vehicleType === 'machine' ? 'Machine task assigned' : 'Trip assigned'),
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Site';
      const vehicle = p.vehicleNumberOrId ? ` ${String(p.vehicleNumberOrId)}` : '';
      const type = p.vehicleType === 'machine' ? 'Task' : 'Trip';
      return `${type}${site}${vehicle}`.trim();
    },
  },

  trip_need_approval: {
    id: 'trip_need_approval',
    targetRoles: ['assistant_supervisor'],
    linkType: 'assigned_trip',
    linkIdKey: 'id',
    getTitle: (p) => (p.vehicleType === 'machine' ? 'Task confirmation' : 'Trip confirmation'),
    getBody: (p) => {
      const site = p.siteName ? `[${p.siteName}]` : 'Site';
      const vehicle = p.vehicleNumberOrId ? ` ${String(p.vehicleNumberOrId)}` : '';
      const driver = p.driverName ? ` • ${String(p.driverName)}` : '';
      return `${site}${vehicle}${driver}`.trim() || 'Driver marked work complete. Confirm to close.';
    },
  },
};

export function getScenario(id: NotificationScenarioId): NotificationScenario {
  const s = scenarios[id];
  if (!s) throw new Error(`Unknown notification scenario: ${id}`);
  return s;
}

export interface InsertNotificationRow {
  id: string;
  target_role: string;
  title: string;
  body: string;
  link_id?: string;
  link_type?: string;
  target_user_id?: string;
}

/** Build a single notification row for a specific user (driver/operator). Only that user sees it. */
export function buildNotificationRowForUser(
  targetRole: string,
  targetUserId: string,
  title: string,
  body: string,
  generateId: () => string,
  linkId?: string,
  linkType?: string
): InsertNotificationRow {
  return {
    id: generateId(),
    target_role: targetRole,
    target_user_id: targetUserId,
    title,
    body,
    link_id: linkId,
    link_type: linkType,
  };
}

/**
 * Build notification rows for a scenario. One row per target role.
 * Caller inserts into notifications (real-time + push via webhook).
 */
export function buildNotificationRows(
  scenarioId: NotificationScenarioId,
  payload: Record<string, unknown>,
  generateId: () => string
): InsertNotificationRow[] {
  const scenario = getScenario(scenarioId);
  if (scenario.targetRoles.length === 0) return [];

  const title = scenario.getTitle(payload);
  const body = scenario.getBody(payload);
  const linkId = scenario.linkIdKey && payload[scenario.linkIdKey] != null
    ? String(payload[scenario.linkIdKey])
    : undefined;

  return scenario.targetRoles.map((targetRole) => ({
    id: generateId(),
    target_role: targetRole,
    title,
    body,
    link_id: linkId,
    link_type: scenario.linkType,
  }));
}
