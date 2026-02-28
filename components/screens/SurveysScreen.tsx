import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  Keyboard,
  RefreshControl,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { parseSurveyFileContent, computeWorkVolume, computeCubature } from '@/lib/surveyParser';
import { generateId } from '@/lib/id';
import { Plus, MapPin, Calendar, CheckCircle } from 'lucide-react-native';
import { ModalWithKeyboard } from '@/components/ui/ModalWithKeyboard';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, radius } from '@/theme/tokens';

export function SurveysScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, surveys, siteAssignments, addSurvey, updateSurvey, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const isSurveyor = user?.role === 'surveyor';
  const isAssistantSupervisor = user?.role === 'assistant_supervisor';
  const mySiteIds = (user?.id ? siteAssignments.filter((a) => a.userId === user.id).map((a) => a.siteId) : []) as string[];

  const mySurveys = surveys.filter((s) => s.surveyorId === user?.id);
  const submittedSurveys = isAssistantSupervisor
    ? surveys.filter((s) => s.status === 'submitted' && mySiteIds.includes(s.siteId))
    : [];
  const approvedSurveys = surveys.filter((s) => s.status === 'approved');

  const [newModalVisible, setNewModalVisible] = useState(false);
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [parsedVolume, setParsedVolume] = useState<number | null>(null);
  const [parsedCubature, setParsedCubature] = useState<{ totalCut: number; totalFill: number; surfaceUtile: number; triangleCount: number } | null>(null);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);

  const runParse = () => {
    const beforePoints = parseSurveyFileContent(beforeText);
    const afterPoints = parseSurveyFileContent(afterText);
    const cubature = computeCubature(beforePoints, afterPoints);
    const volume = computeWorkVolume(beforePoints, afterPoints);
    setBeforeCount(beforePoints.length);
    setAfterCount(afterPoints.length);
    setParsedVolume(volume);
    setParsedCubature(cubature);
  };

  const submitNewSurvey = async () => {
    const beforePoints = parseSurveyFileContent(beforeText);
    const afterPoints = parseSurveyFileContent(afterText);
    const volume = computeWorkVolume(beforePoints, afterPoints);
    const site = sites.find((s) => s.id === siteId);
    if (!site || !user?.id) return;
    Keyboard.dismiss();
    setSubmittingSurvey(true);
    try {
      await addSurvey({
        id: generateId('sv'),
        type: 'Before/After Survey',
        siteId,
        siteName: site.name,
        surveyorId: user.id,
        measurements: {},
        status: 'submitted',
        createdAt: new Date().toISOString(),
        beforeFileContent: beforeText,
        afterFileContent: afterText,
        workVolume: volume,
      });
      setNewModalVisible(false);
      setBeforeText('');
      setAfterText('');
      setParsedVolume(null);
      setParsedCubature(null);
      showToast(t('surveys_toast_submitted'));
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const approveSurvey = async (surveyId: string) => {
    if (!user?.id) return;
    await updateSurvey(surveyId, {
      status: 'approved',
      approvedById: user.id,
      approvedAt: new Date().toISOString(),
    });
    showToast(t('surveys_toast_approved'));
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const statusVariant = { draft: 'default' as const, submitted: 'warning' as const, approved: 'success' as const };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={t('surveys_title')}
        subtitle={isSurveyor ? t('surveys_subtitle_surveyor') : isAssistantSupervisor ? t('surveys_subtitle_assistant') : t('surveys_subtitle_view')}
        rightAction={
          isSurveyor && sites.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setSiteId(sites[0]?.id ?? '');
                setBeforeText('');
                setAfterText('');
                setParsedVolume(null);
                setParsedCubature(null);
                setNewModalVisible(true);
              }}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center"
            >
              <Plus size={18} color={colors.surface} />
              <Text className="text-white font-semibold ml-1">{t('surveys_new_button')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.screenPadding, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : isSurveyor ? (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_my_surveys')}</Text>
            {mySurveys.length === 0 && <Text className="text-gray-500 py-4">{t('surveys_empty_surveyor')}</Text>}
            {mySurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{s.type}</Text>
                  <Badge variant={statusVariant[s.status]} size="sm">{s.status}</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                </View>
                <View className="flex-row items-center mb-1">
                  <Calendar size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.createdAt.slice(0, 10)}</Text>
                </View>
                {s.workVolume != null && (
                  <Text className="text-sm font-medium text-gray-700 mt-1">{t('surveys_total_cubic_m')}: {s.workVolume.toFixed(2)} m³</Text>
                )}
              </Card>
            ))}
          </>
        ) : (
          <>
            {isAssistantSupervisor && (
              <>
                <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_submitted_to_approve')}</Text>
                {submittedSurveys.length === 0 && (
                  <Text className="text-gray-500 py-4">{t('surveys_no_waiting')}</Text>
                )}
                {submittedSurveys.map((s) => (
                  <Card key={s.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="font-semibold text-gray-900">{s.type}</Text>
                      <Badge variant="warning" size="sm">submitted</Badge>
                    </View>
                    <View className="flex-row items-center mb-1">
                      <MapPin size={14} color="#6B7280" />
                      <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                    </View>
                    {s.workVolume != null && (
                      <Text className="text-sm text-gray-700 mb-2">{t('surveys_total_cubic_m')}: {s.workVolume.toFixed(2)} m³</Text>
                    )}
                    <TouchableOpacity
                      onPress={() => approveSurvey(s.id)}
                      className="bg-green-600 rounded-lg py-2 flex-row items-center justify-center mt-2"
                    >
                      <CheckCircle size={18} color={colors.surface} />
                      <Text className="text-white font-semibold ml-2">{t('surveys_approve_button')}</Text>
                    </TouchableOpacity>
                  </Card>
                ))}
                <Text className="text-lg font-bold text-gray-900 mb-2 mt-4">{t('surveys_approved_list')}</Text>
              </>
            )}
            {!isAssistantSupervisor && (
              <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_approved_list')}</Text>
            )}
            {approvedSurveys.length === 0 && (
              <Text className="text-gray-500 py-4">{t('surveys_no_approved')}</Text>
            )}
            {approvedSurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{s.type}</Text>
                  <Badge variant="success" size="sm">approved</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <MapPin size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.siteName}</Text>
                </View>
                {s.workVolume != null && (
                  <Text className="text-sm text-gray-700">{t('surveys_total_cubic_m')}: {s.workVolume.toFixed(2)} m³</Text>
                )}
              </Card>
            ))}
          </>
        )}
      </ScrollView>

      <ModalWithKeyboard
        visible={newModalVisible}
        onOverlayPress={() => setNewModalVisible(false)}
        submitting={submittingSurvey}
        maxHeightRatio={0.9}
        footer={
          <View style={modalStyles.footer}>
            <PressableScale onPress={() => setNewModalVisible(false)} disabled={submittingSurvey} style={[modalStyles.btn, modalStyles.btnSecondary]}>
              <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
            </PressableScale>
            <Button variant="primary" onPress={submitNewSurvey} disabled={submittingSurvey} loading={submittingSurvey} style={modalStyles.btn}>
              {t('surveys_submit_survey')}
            </Button>
          </View>
        }
      >
        <Text style={modalStyles.title}>{t('surveys_new_survey')}</Text>
        <Text style={modalStyles.label}>{t('tab_sites')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {sites.map((s) => (
            <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: siteId === s.id ? colors.blue600 : colors.gray200 }}>
              <Text style={{ color: siteId === s.id ? '#fff' : colors.gray700, fontWeight: '500' }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={modalStyles.label}>{t('surveys_before_file')}</Text>
        <TextInput value={beforeText} onChangeText={(txt) => { setBeforeText(txt); setParsedVolume(null); setParsedCubature(null); }} placeholder="pt0,4746483.0150,492544.8142,1419.0430,..." multiline numberOfLines={4} placeholderTextColor={colors.placeholder} style={[modalStyles.input, { minHeight: 80 }]} />
        <Text style={modalStyles.label}>{t('surveys_after_file')}</Text>
        <TextInput value={afterText} onChangeText={(txt) => { setAfterText(txt); setParsedVolume(null); setParsedCubature(null); }} placeholder="pt0,4746486.3917,492580.3485,1417.6798,..." multiline numberOfLines={4} placeholderTextColor={colors.placeholder} style={[modalStyles.input, { minHeight: 80 }]} />
        <TouchableOpacity onPress={runParse} style={{ backgroundColor: colors.gray700, borderRadius: radius.md, paddingVertical: 12, marginBottom: 12, alignItems: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '600' }}>{t('surveys_parse_volume')}</Text>
        </TouchableOpacity>
        {(parsedVolume !== null || parsedCubature !== null) && (
          <View style={{ marginBottom: 16, padding: 12, backgroundColor: colors.gray100, borderRadius: radius.md }}>
            <Text style={{ fontSize: 12, color: colors.gray700 }}>{t('surveys_before_points')}: {beforeCount} · {t('surveys_after_points')}: {afterCount}</Text>
            {parsedCubature != null && (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>{t('surveys_surface_utile')}: {parsedCubature.surfaceUtile.toFixed(2)} m² · {t('surveys_triangles')}: {parsedCubature.triangleCount}</Text>
            )}
            <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 4 }}>{t('surveys_total_cubic_m')}: {parsedVolume != null ? parsedVolume.toFixed(2) : (parsedCubature?.totalCut ?? 0).toFixed(2)} m³</Text>
            {parsedCubature != null && parsedCubature.totalFill > 0 && (
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{t('surveys_fill_volume')}: {parsedCubature.totalFill.toFixed(2)} m³</Text>
            )}
          </View>
        )}
      </ModalWithKeyboard>
    </View>
  );
}
