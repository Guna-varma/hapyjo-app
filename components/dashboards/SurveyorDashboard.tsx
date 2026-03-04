import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { MapPin, Calendar, Plus, ImagePlus } from 'lucide-react-native';
import { colors, layout } from '@/theme/tokens';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { uploadToSupabase } from '@/features/gpsCamera/uploadToSupabase';

export function SurveyorDashboard({ onNavigateTab }: DashboardNavProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const { showToast } = useToast();
  const { surveys, updateSurvey } = useMockAppStore();
  const mySurveys = surveys.filter((survey) => survey.surveyorId === user?.id);
  const [uploadingSurveyId, setUploadingSurveyId] = useState<string | null>(null);

  const addPhotosToSurvey = useCallback(
    async (surveyId: string) => {
      const survey = mySurveys.find((s) => s.id === surveyId);
      if (!survey) return;
      setUploadingSurveyId(surveyId);
      try {
        const { launchImageLibraryAsync } = await import('expo-image-picker');
        const result = await launchImageLibraryAsync({
          mediaTypes: ['images'],
          allowsMultipleSelection: true,
          quality: 0.8,
        });
        if (result.canceled || !result.assets?.length) {
          setUploadingSurveyId(null);
          return;
        }
        const existing = survey.photos ?? [];
        const urls: string[] = [];
        for (const asset of result.assets) {
          const uri = asset.uri;
          if (uri) {
            const url = await uploadToSupabase(uri);
            urls.push(url);
          }
        }
        if (urls.length > 0) {
          await updateSurvey(surveyId, { photos: [...existing, ...urls] });
          showToast(t('surveys_photos_added'));
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Upload failed';
        Alert.alert('Error', msg);
      } finally {
        setUploadingSurveyId(null);
      }
    },
    [mySurveys, updateSurvey, showToast, t]
  );

  const statusVariant = {
    draft: 'default' as const,
    submitted: 'warning' as const,
    approved: 'success' as const,
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
          <Card className="flex-1 bg-blue-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'draft').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">{t('dashboard_drafts')}</Text>
            </View>
          </Card>
          <Card className="flex-1 bg-yellow-50">
            <View className="items-center py-3">
              <Text className="text-2xl font-bold text-gray-900">
                {mySurveys.filter((s) => s.status === 'submitted').length}
              </Text>
              <Text className="text-xs text-gray-600 mt-1">{t('dashboard_submitted')}</Text>
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
        </View>

        {/* Recent Surveys */}
        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('surveys_approved_list')}</Text>
          {mySurveys.map((survey) => (
            <Card key={survey.id} className="mb-3">
              <View className="flex-row items-start justify-between mb-2">
                <Text className="text-base font-bold text-gray-900 flex-1">{survey.type}</Text>
                <Badge variant={statusVariant[survey.status]} size="sm">
                  {survey.status}
                </Badge>
              </View>

              <View className="flex-row items-center mb-2">
                <MapPin size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{survey.siteName}</Text>
              </View>

              <View className="flex-row items-center mb-3">
                <Calendar size={14} color="#6B7280" />
                <Text className="text-sm text-gray-600 ml-1">{survey.createdAt}</Text>
              </View>

              {survey.workVolume != null && (
                <View className="bg-blue-50 rounded-lg p-2 mb-2">
                  <Text className="text-sm font-semibold text-gray-900">
                    {(survey.workVolume ?? 0).toFixed(2)} m³
                  </Text>
                  <Text className="text-xs text-gray-600">{t('surveys_work_volume')}</Text>
                </View>
              )}

              {survey.location && (
                <View className="bg-gray-50 rounded p-2 mb-3">
                  <Text className="text-xs text-gray-600">
                    GPS: {survey.location.latitude.toFixed(4)}, {survey.location.longitude.toFixed(4)}
                  </Text>
                </View>
              )}

              <View className="flex-row justify-between items-center pt-3 border-t border-gray-200">
                <TouchableOpacity
                  onPress={() => addPhotosToSurvey(survey.id)}
                  disabled={uploadingSurveyId === survey.id}
                  className="flex-row items-center"
                >
                  {uploadingSurveyId === survey.id ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 6 }} />
                  ) : (
                    <ImagePlus size={16} color="#2563eb" />
                  )}
                  <Text className="text-xs text-gray-600 ml-1">
                    {survey.photos?.length || 0} {t('common_photos')}
                  </Text>
                  <Text className="text-xs text-blue-600 font-medium ml-2">{t('surveys_add_photos')}</Text>
                </TouchableOpacity>
                {survey.status === 'draft' && (
                  <TouchableOpacity onPress={() => onNavigateTab?.('surveys')}>
                    <Text className="text-sm text-blue-600 font-semibold">{t('common_continue')}</Text>
                  </TouchableOpacity>
                )}
              </View>
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
