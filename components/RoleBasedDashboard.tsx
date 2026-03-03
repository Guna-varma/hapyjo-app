import React from 'react';
import { View } from 'react-native';
import { useAuth } from '@/context/AuthContext';
import { AdminDashboard } from '@/components/dashboards/AdminDashboard';
import { OwnerDashboard } from '@/components/dashboards/OwnerDashboard';
import { HeadSupervisorDashboard } from '@/components/dashboards/HeadSupervisorDashboard';
import { AccountantDashboard } from '@/components/dashboards/AccountantDashboard';
import { AssistantSupervisorDashboard } from '@/components/dashboards/AssistantSupervisorDashboard';
import { DriverDashboard } from '@/components/dashboards/DriverDashboard';
import { SurveyorDashboard } from '@/components/dashboards/SurveyorDashboard';
import { UserRole } from '@/types';
import type { TabId } from '@/lib/rbac';

export interface SurveyNavParams {
  openNewSurvey?: boolean;
}

export interface DashboardNavProps {
  onNavigateTab?: (tab: TabId, params?: SurveyNavParams) => void;
}

const DASHBOARDS: Record<UserRole, React.ComponentType<DashboardNavProps>> = {
  admin: AdminDashboard,
  owner: OwnerDashboard,
  head_supervisor: HeadSupervisorDashboard,
  accountant: AccountantDashboard,
  assistant_supervisor: AssistantSupervisorDashboard,
  surveyor: SurveyorDashboard,
  driver_truck: DriverDashboard,
  driver_machine: DriverDashboard,
};

export function RoleBasedDashboard({ onNavigateTab }: DashboardNavProps) {
  const { user } = useAuth();

  if (!user) {
    return <View className="flex-1 bg-gray-50" />;
  }

  const DashboardComponent = DASHBOARDS[user.role];

  return <DashboardComponent onNavigateTab={onNavigateTab} />;
}
