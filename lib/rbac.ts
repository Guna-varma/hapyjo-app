/**
 * RBAC – single source of truth for HapyJo Ltd PRD roles and permissions.
 * All role checks in the app should use this module.
 */

import type { UserRole } from '@/types';

export type { UserRole };
export type TabId = 'dashboard' | 'reports' | 'tasks' | 'users' | 'sites' | 'vehicles' | 'expenses' | 'surveys' | 'issues' | 'gps_camera' | 'settings';

const TAB_ACCESS: Record<TabId, UserRole[]> = {
  dashboard: ['admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'],
  reports: ['admin', 'owner', 'head_supervisor', 'accountant'],
  tasks: ['assistant_supervisor', 'driver_truck', 'driver_machine'],
  users: ['admin', 'owner', 'head_supervisor'],
  sites: ['admin', 'head_supervisor'],
  vehicles: ['admin', 'owner', 'head_supervisor', 'assistant_supervisor'],
  expenses: ['assistant_supervisor'],
  surveys: ['admin', 'owner', 'head_supervisor', 'assistant_supervisor', 'surveyor'],
  issues: ['owner', 'head_supervisor', 'assistant_supervisor', 'driver_truck', 'driver_machine'],
  gps_camera: ['owner', 'head_supervisor', 'assistant_supervisor', 'surveyor'],
  settings: ['admin', 'owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'],
};

export function canAccessTab(role: UserRole, tabId: TabId): boolean {
  return TAB_ACCESS[tabId].includes(role);
}

export function getTabsForRole(role: UserRole): TabId[] {
  return (Object.keys(TAB_ACCESS) as TabId[]).filter((tabId) => canAccessTab(role, tabId));
}

export function canCreateUser(role: UserRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'head_supervisor';
}

/** Roles the current user can assign when creating a user. Owner cannot assign Admin. */
export function getAssignableRoles(creatorRole: UserRole): UserRole[] {
  const allExceptAdmin: UserRole[] = [
    'owner',
    'head_supervisor',
    'accountant',
    'assistant_supervisor',
    'surveyor',
    'driver_truck',
    'driver_machine',
  ];
  if (creatorRole === 'owner') {
    return allExceptAdmin;
  }
  if (creatorRole === 'admin') {
    return ['owner', 'head_supervisor', 'accountant', 'assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine', 'admin'];
  }
  if (creatorRole === 'head_supervisor') {
    return ['assistant_supervisor', 'surveyor', 'driver_truck', 'driver_machine'];
  }
  return [];
}

export function isReportsReadOnly(role: UserRole): boolean {
  return role === 'accountant';
}

export function canSeeFinancialSummary(role: UserRole): boolean {
  return role === 'admin' || role === 'owner' || role === 'head_supervisor' || role === 'accountant';
}

/** Translation key for role display label (use with t(key) for i18n). */
const ROLE_LABEL_KEYS: Record<UserRole, string> = {
  admin: 'role_admin',
  owner: 'role_owner',
  head_supervisor: 'role_head_supervisor',
  accountant: 'role_accountant',
  assistant_supervisor: 'role_assistant_supervisor',
  surveyor: 'role_surveyor',
  driver_truck: 'role_driver_truck',
  driver_machine: 'role_driver_machine',
};

export function getRoleLabelKey(role: UserRole): string {
  return ROLE_LABEL_KEYS[role] ?? role;
}

/** English fallback when t() not available (e.g. scripts). Prefer t(getRoleLabelKey(role)) in UI. Use "Operator" for machine (not Driver–Machine) per docs. */
export function getRoleDisplayLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    owner: 'Owner',
    head_supervisor: 'Head Supervisor',
    accountant: 'Accountant',
    assistant_supervisor: 'Assistant Supervisor',
    surveyor: 'Surveyor',
    driver_truck: 'Driver – Truck',
    driver_machine: 'Operator',
  };
  return labels[role] ?? role;
}
