import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { MapPin, Calendar, Plus } from 'lucide-react-native';
import { colors, layout } from '@/theme/tokens';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';

export function SurveyorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { surveys, sites } = useMockAppStore();
  const mySurveys = surveys.filter((survey) => survey.surveyorId === user?.id);
  const getSiteName = (siteId: string) => sites.find((s) => s.id === siteId)?.name ?? siteId;

  const statusVariant = {
    approval_pending: 'warning' as const,
    approved: 'success' as const,
    rejected: 'danger' as const,
  };
  const statusLabelKey: Record<string, string> = {
    approval_pending: 'surveys_status_pending',
    approved: 'surveys_status_approved',
    rejected: 'surveys_status_rejected',
  };

  return (
    <View style={styles.screen}>
      <Header
        title={t('dashboard_surveyor_title')}
        subtitle={user?.name ? `${t('dashboard_welcome_name')}, ${user.name}` : ''}
        rightAction={
          <TouchableOpacity onPress={() => onNavigateTab?.('surveys', { openNewSurvey: true })} style={surveyorStyles.headerBtn}>
            <Plus size={18} color="#ffffff" />
            <Text style={surveyorStyles.headerBtnText}>{t('surveys_new_button')}</Text>
          </TouchableOpacity>
        }
      />
      <DashboardLayout>
        {/* Quick Stats */}
        <View className="flex-row mb-4 gap-3">
          <Card className="flex-1 bg-yellow-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'approval_pending').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">{t('surveys_status_pending')}</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-green-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'approved').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">{t('surveys_approved_list')}</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-red-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'rejected').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">{t('surveys_status_rejected')}</Text>
            </View>
          </Card>
        </View>

        {/* My Surveys */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('surveys_my_surveys')}</Text>
          {mySurveys.length === 0 && (
            <Text className="text-gray-500 py-4">{t('surveys_empty_surveyor')}</Text>
          )}
          {mySurveys.map((survey) => (
            <Card key={survey.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <Text className="text-base font-bold text-gray-900 flex-1">{getSiteName(survey.siteId)}</Text>
                <Badge variant={statusVariant[survey.status]} size="sm">
                  {t(statusLabelKey[survey.status] ?? 'surveys_status_pending')}
                </Badge>
              </View>
              <View className="flex-row items-center mb-2">
                <MapPin size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{getSiteName(survey.siteId)}</Text>
              </View>
              <View className="flex-row items-center mb-2">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{survey.surveyDate}</Text>
              </View>
              <View className="bg-blue-50 rounded-lg p-2 mb-2">
                <Text className="text-sm font-semibold text-gray-900">
                  {survey.volumeM3.toFixed(2)} m³
                </Text>
                <Text className="text-xs text-gray-600">{t('surveys_work_volume')}</Text>
              </View>
              {survey.status === 'rejected' && (
                <TouchableOpacity
                  onPress={() => onNavigateTab?.('surveys', { openReviseSurveyId: survey.id })}
                  className="mt-2 py-2 flex-row items-center justify-center rounded-lg border border-blue-600"
                >
                  <Text className="text-blue-600 font-semibold">{t('surveys_revise')}</Text>
                </TouchableOpacity>
              )}
            </Card>
          ))}
        </View>
      </DashboardLayout>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background } });
const surveyorStyles = StyleSheet.create({
  headerBtn: { backgroundColor: colors.primary, borderRadius: layout.cardRadius, paddingHorizontal: layout.cardPadding, paddingVertical: layout.grid, flexDirection: 'row', alignItems: 'center' },
  headerBtnText: { color: '#fff', fontWeight: '600', marginLeft: 4 },
});
