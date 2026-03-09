import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  Keyboard,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Platform,
  Alert,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { parseSurveyFileContent, computeWorkVolume, computeCubature, parseAndMergeSurveyFiles } from '@/lib/surveyParser';
import { generateId } from '@/lib/id';
import { pickSurveyTextFile } from '@/lib/readSurveyFile';
import { printSurveyToPdf, type SurveyPdfData } from '@/lib/surveyPdf';
import { Plus, MapPin, Calendar, CheckCircle, FileUp, Trash2, FileText, BarChart3, Box, ClipboardList } from 'lucide-react-native';
import { ModalWithKeyboard } from '@/components/ui/ModalWithKeyboard';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, radius, scrollConfig } from '@/theme/tokens';

type TopFileEntry = { id: string; name: string; content: string };
type DepthFile = { name: string; content: string } | null;

export interface SurveysScreenProps {
  initialOpenNewSurveyModal?: boolean;
  onClearOpenNewSurveyModal?: () => void;
  initialOpenReviseSurveyId?: string;
  onClearOpenReviseSurveyId?: () => void;
  /** When set (e.g. from dashboard Excavation production click), filter lists to this date (YYYY-MM-DD) */
  initialSurveyDateFilter?: string;
  onClearSurveyDateFilter?: () => void;
}

export function SurveysScreen({ initialOpenNewSurveyModal, onClearOpenNewSurveyModal, initialOpenReviseSurveyId, onClearOpenReviseSurveyId, initialSurveyDateFilter, onClearSurveyDateFilter }: SurveysScreenProps = {}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, surveys, siteAssignments, users, addSurvey, updateSurvey, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const isSurveyor = user?.role === 'surveyor';
  const isAssistantSupervisor = user?.role === 'assistant_supervisor';
  const mySiteIds = useMemo(
    () => (user?.id ? siteAssignments.filter((a) => a.userId === user.id).map((a) => a.siteId) : []) as string[],
    [user?.id, siteAssignments],
  );

  const mySurveys = surveys.filter((s) => s.surveyorId === user?.id);
  const pendingSurveys = isAssistantSupervisor
    ? surveys.filter((s) => s.status === 'approval_pending' && mySiteIds.includes(s.siteId))
    : [];
  const approvedSurveys = surveys.filter((s) => s.status === 'approved');
  const getSiteName = useCallback((sid: string) => sites.find((s) => s.id === sid)?.name ?? sid, [sites]);

  const today = new Date().toISOString().slice(0, 10);
  const [newModalVisible, setNewModalVisible] = useState(false);
  const [submittingSurvey, setSubmittingSurvey] = useState(false);
  const [computing, setComputing] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [surveyDate, setSurveyDate] = useState(today);
  const [topFiles, setTopFiles] = useState<TopFileEntry[]>([]);
  const [depthFile, setDepthFile] = useState<DepthFile>(null);
  const [parsedVolume, setParsedVolume] = useState<number | null>(null);
  const [parsedCubature, setParsedCubature] = useState<{ totalCut: number; totalFill: number; surfaceUtile: number; triangleCount: number } | null>(null);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);
  const [showDepthPaste, setShowDepthPaste] = useState(false);
  const [revisingSurveyId, setRevisingSurveyId] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(initialSurveyDateFilter ?? null);
  const [exportingPdfId, setExportingPdfId] = useState<string | null>(null);

  useEffect(() => {
    if (initialSurveyDateFilter) setDateFilter(initialSurveyDateFilter);
  }, [initialSurveyDateFilter]);

  const matchDate = (s: { surveyDate: string }) => s.surveyDate.slice(0, 10) === (dateFilter ?? '');
  const filteredMySurveys = dateFilter ? mySurveys.filter(matchDate) : mySurveys;
  const filteredPendingSurveys = dateFilter ? pendingSurveys.filter(matchDate) : pendingSurveys;
  const filteredApprovedSurveys = dateFilter ? approvedSurveys.filter(matchDate) : approvedSurveys;

  // Per-site summary from the (possibly date-filtered) list
  const siteSummaries = React.useMemo(() => {
    const list = isSurveyor ? filteredMySurveys : filteredApprovedSurveys;
    const bySite = new Map<string, { siteId: string; totalVolumeM3: number; count: number }>();
    for (const s of list) {
      const cur = bySite.get(s.siteId);
      if (cur) {
        cur.totalVolumeM3 += s.volumeM3;
        cur.count += 1;
      } else {
        bySite.set(s.siteId, { siteId: s.siteId, totalVolumeM3: s.volumeM3, count: 1 });
      }
    }
    return Array.from(bySite.values()).map((x) => ({ ...x, siteName: getSiteName(x.siteId) }));
  }, [isSurveyor, filteredMySurveys, filteredApprovedSurveys, getSiteName]);

  useEffect(() => {
    if (initialOpenNewSurveyModal && isSurveyor && sites.length > 0) {
      setNewModalVisible(true);
      onClearOpenNewSurveyModal?.();
    }
  }, [initialOpenNewSurveyModal, isSurveyor, sites.length, onClearOpenNewSurveyModal]);

  useEffect(() => {
    if (initialOpenReviseSurveyId && isSurveyor) {
      const s = mySurveys.find((x) => x.id === initialOpenReviseSurveyId);
      if (s) {
        setRevisingSurveyId(s.id);
        setSiteId(s.siteId);
        setSurveyDate(s.surveyDate);
        setTopFiles([]);
        setDepthFile(null);
        setParsedVolume(null);
        setNewModalVisible(true);
      }
      onClearOpenReviseSurveyId?.();
    }
  }, [initialOpenReviseSurveyId, isSurveyor, mySurveys, onClearOpenReviseSurveyId]);

  const addTopFile = () => {
    setTopFiles((prev) => [...prev, { id: generateId('tf'), name: '', content: '' }]);
    setParsedVolume(null);
    setParsedCubature(null);
  };

  const setTopFileAtIndex = (index: number, patch: Partial<TopFileEntry>) => {
    setTopFiles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...patch };
      return next;
    });
    setParsedVolume(null);
    setParsedCubature(null);
  };

  const removeTopFile = (index: number) => {
    setTopFiles((prev) => prev.filter((_, i) => i !== index));
    setParsedVolume(null);
    setParsedCubature(null);
  };

  const pickTopFile = async (index: number) => {
    const picked = await pickSurveyTextFile();
    if (picked) setTopFileAtIndex(index, { name: picked.name, content: picked.content });
  };

  const pickDepthFile = async () => {
    const picked = await pickSurveyTextFile();
    if (picked) {
      setDepthFile({ name: picked.name, content: picked.content });
      setParsedVolume(null);
      setParsedCubature(null);
    }
  };

  const runParse = useCallback(() => {
    const topContents = topFiles.map((f) => f.content).filter((c) => c.trim());
    const depthContent = depthFile?.content?.trim();
    if (topContents.length === 0) {
      showToast(t('surveys_top_required'));
      return;
    }
    if (!depthContent) {
      showToast(t('surveys_depth_required'));
      return;
    }
    setComputing(true);
    setParsedVolume(null);
    setParsedCubature(null);
    setTimeout(() => {
      try {
        const beforePoints = parseAndMergeSurveyFiles(topContents);
        const afterPoints = parseSurveyFileContent(depthContent);
        const cubature = computeCubature(beforePoints, afterPoints);
        const volume = computeWorkVolume(beforePoints, afterPoints);
        setBeforeCount(beforePoints.length);
        setAfterCount(afterPoints.length);
        setParsedVolume(volume);
        setParsedCubature(cubature);
      } finally {
        setComputing(false);
      }
    }, 0);
  }, [topFiles, depthFile, t, showToast]);

  const submitNewSurvey = async () => {
    if (parsedVolume === null) {
      showToast(t('surveys_parse_first'));
      return;
    }
    const site = sites.find((s) => s.id === siteId);
    if (!site || !user?.id) return;
    Keyboard.dismiss();
    setSubmittingSurvey(true);
    try {
      await addSurvey({
        id: generateId('sv'),
        siteId,
        surveyDate,
        volumeM3: parsedVolume,
        status: 'approval_pending',
        surveyorId: user.id,
        createdAt: new Date().toISOString(),
      });
      setNewModalVisible(false);
      setTopFiles([]);
      setDepthFile(null);
      setParsedVolume(null);
      setParsedCubature(null);
      showToast(t('surveys_toast_submitted'));
    } finally {
      setSubmittingSurvey(false);
    }
  };

  const submitReviseSurvey = async () => {
    if (revisingSurveyId == null || parsedVolume === null || !user?.id) return;
    Keyboard.dismiss();
    setSubmittingSurvey(true);
    try {
      await updateSurvey(revisingSurveyId, {
        volumeM3: parsedVolume,
        surveyDate,
        status: 'approval_pending',
        approvedById: null,
        approvedAt: null,
      });
      setNewModalVisible(false);
      setRevisingSurveyId(null);
      setTopFiles([]);
      setDepthFile(null);
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

  const rejectSurvey = async (surveyId: string) => {
    await updateSurvey(surveyId, { status: 'rejected' });
    showToast(t('surveys_toast_rejected'));
  };

  const canDownloadSurveyPdf = useCallback((s: { surveyorId: string; siteId: string; status: string }) => {
    if (!user?.id) return false;
    if (isSurveyor) return s.surveyorId === user.id;
    if (isAssistantSupervisor) return mySiteIds.includes(s.siteId) && (s.status === 'approval_pending' || s.status === 'approved');
    if (user.role === 'owner' || user.role === 'head_supervisor') return s.status === 'approved';
    return false;
  }, [user?.id, user?.role, isSurveyor, isAssistantSupervisor, mySiteIds]);

  const handleDownloadSurveyPdf = useCallback(async (
    survey: { id: string; siteId: string; surveyDate: string; volumeM3: number; status: string; surveyorId: string; createdAt: string; approvedById?: string | null; approvedAt?: string | null },
    calculation?: { beforePoints: number; afterPoints: number; surfaceUtile?: number; triangleCount?: number; totalFill?: number }
  ) => {
    setExportingPdfId(survey.id);
    try {
      const siteName = getSiteName(survey.siteId);
      const surveyorName = users.find((u) => u.id === survey.surveyorId)?.name ?? survey.surveyorId.slice(0, 8);
      const approvedByName = survey.approvedById ? (users.find((u) => u.id === survey.approvedById)?.name ?? survey.approvedById) : null;
      const data: SurveyPdfData = {
        survey: { ...survey },
        siteName,
        surveyorName,
        approvedByName,
        calculation,
      };
      const uri = await printSurveyToPdf(data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('surveys_download_pdf') });
      }
    } catch (e) {
      Alert.alert(t('surveys_pdf_failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setExportingPdfId(null);
    }
  }, [users, getSiteName, t]);

  const handleDownloadModalPdf = useCallback(async () => {
    if (parsedVolume == null || !user?.id) return;
    setExportingPdfId('modal');
    try {
      const siteName = getSiteName(siteId);
      const surveyorName = users.find((u) => u.id === user.id)?.name ?? user.id.slice(0, 8);
      const data: SurveyPdfData = {
        survey: {
          id: 'preview',
          siteId,
          surveyDate,
          volumeM3: parsedVolume,
          status: 'approval_pending',
          surveyorId: user.id,
          createdAt: new Date().toISOString(),
        },
        siteName,
        surveyorName,
        approvedByName: null,
        calculation: parsedCubature ? { beforePoints: beforeCount, afterPoints: afterCount, surfaceUtile: parsedCubature.surfaceUtile, triangleCount: parsedCubature.triangleCount, totalFill: parsedCubature.totalFill } : { beforePoints: beforeCount, afterPoints: afterCount },
      };
      const uri = await printSurveyToPdf(data);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: t('surveys_download_pdf') });
      }
    } catch (e) {
      Alert.alert(t('surveys_pdf_failed'), e instanceof Error ? e.message : String(e));
    } finally {
      setExportingPdfId(null);
    }
  }, [parsedVolume, parsedCubature, beforeCount, afterCount, siteId, surveyDate, user, users, getSiteName, t]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const statusVariant = { approval_pending: 'warning' as const, approved: 'success' as const, rejected: 'danger' as const };
  const statusLabelKey: Record<string, string> = { approval_pending: 'surveys_status_pending', approved: 'surveys_status_approved', rejected: 'surveys_status_rejected' };
  const isRevise = revisingSurveyId != null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={t('surveys_title')}
        subtitle={isSurveyor ? t('surveys_subtitle_surveyor') : isAssistantSupervisor ? t('surveys_subtitle_assistant') : t('surveys_subtitle_view')}
        rightAction={
          isSurveyor && sites.length > 0 ? (
            <TouchableOpacity
              onPress={() => {
                setRevisingSurveyId(null);
                setSiteId(sites[0]?.id ?? '');
                setSurveyDate(today);
                setTopFiles([]);
                setDepthFile(null);
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

      {/* Frozen summary by site location – all locations at top; scroll inside when many */}
      {!loading && siteSummaries.length > 0 && (
        <View style={[surveySummaryStyles.stickySummary, { paddingHorizontal: theme.screenPadding, paddingVertical: theme.spacingMd }]}>
          <View style={surveySummaryStyles.summaryHeader}>
            <BarChart3 size={theme.scale(20)} color={colors.primary} style={{ marginRight: theme.spacingSm }} />
            <View style={{ flex: 1 }}>
              <Text style={[surveySummaryStyles.summaryTitle, { fontSize: theme.fontSizeTitle }]}>{t('surveys_summary_by_site')}</Text>
              {siteSummaries.length > 1 && (
                <Text style={[surveySummaryStyles.locationCount, { fontSize: theme.fontSizeCaption }]}>{siteSummaries.length} {t('surveys_locations')}</Text>
              )}
            </View>
          </View>
          <ScrollView
            style={[surveySummaryStyles.sitesScroll, { maxHeight: theme.scale(220) }]}
            showsVerticalScrollIndicator={siteSummaries.length > 2}
            nestedScrollEnabled
            {...scrollConfig}
          >
            {siteSummaries.map((sum) => (
              <View key={sum.siteId} style={[surveySummaryStyles.siteRow, { paddingVertical: theme.spacingSm }]}>
                <View style={surveySummaryStyles.siteNameRow}>
                  <MapPin size={theme.scale(18)} color={colors.primary} style={{ marginRight: theme.spacingXs }} />
                  <Text style={[surveySummaryStyles.siteName, { fontSize: theme.fontSizeBase }]} numberOfLines={1}>{sum.siteName}</Text>
                </View>
                <View style={surveySummaryStyles.metricsRow}>
                  <View style={surveySummaryStyles.metricItem}>
                    <Box size={theme.scale(16)} color={colors.primary} style={{ marginRight: theme.spacingXs }} />
                    <Text style={[surveySummaryStyles.volumeText, { fontSize: theme.fontSizeBase }]}>
                      {t('surveys_total_volume_site')}: <Text style={surveySummaryStyles.volumeValue}>{sum.totalVolumeM3.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</Text>
                    </Text>
                  </View>
                  <View style={surveySummaryStyles.metricItem}>
                    <ClipboardList size={theme.scale(16)} color={colors.gray600} style={{ marginRight: theme.spacingXs }} />
                    <Text style={[surveySummaryStyles.countText, { fontSize: theme.fontSizeCaption }]}>
                      {t('surveys_surveys_count')}: {sum.count}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={true}
        nestedScrollEnabled
        {...scrollConfig}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            {dateFilter && (
              <Card className="mb-3 flex-row items-center justify-between bg-blue-50 border border-blue-200">
                <Text className="text-sm text-gray-800 flex-1">
                  {t('surveys_showing_for_date')}: <Text className="font-semibold">{dateFilter}</Text>
                </Text>
                <TouchableOpacity
                  onPress={() => { setDateFilter(null); onClearSurveyDateFilter?.(); }}
                  className="ml-2 px-3 py-1.5 rounded-lg bg-blue-600"
                >
                  <Text className="text-sm font-medium text-white">{t('surveys_clear_date_filter')}</Text>
                </TouchableOpacity>
              </Card>
            )}
        {isSurveyor ? (
          <>
            <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_my_surveys')}</Text>
            {filteredMySurveys.length === 0 && <Text className="text-gray-500 py-4">{dateFilter ? t('surveys_no_surveys_for_date') : t('surveys_empty_surveyor')}</Text>}
            {filteredMySurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{getSiteName(s.siteId)}</Text>
                  <Badge variant={statusVariant[s.status]} size="sm">{t(statusLabelKey[s.status] ?? 'surveys_status_pending')}</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <Calendar size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.surveyDate}</Text>
                </View>
                <Text className="text-sm font-medium text-gray-700 mt-1">{t('surveys_total_cubic_m')}: {s.volumeM3.toFixed(2)} m³</Text>
                {s.status === 'rejected' && (
                  <TouchableOpacity
                    onPress={() => {
                      setRevisingSurveyId(s.id);
                      setSiteId(s.siteId);
                      setSurveyDate(s.surveyDate);
                      setTopFiles([]);
                      setDepthFile(null);
                      setParsedVolume(null);
                      setNewModalVisible(true);
                    }}
                    className="mt-2 py-2 flex-row items-center justify-center rounded-lg border border-blue-600"
                  >
                    <Text className="text-blue-600 font-semibold">{t('surveys_revise')}</Text>
                  </TouchableOpacity>
                )}
                {canDownloadSurveyPdf(s) && (
                  <TouchableOpacity
                    onPress={() => handleDownloadSurveyPdf(s)}
                    disabled={exportingPdfId === s.id}
                    className="mt-2 py-2 flex-row items-center justify-center rounded-lg border border-gray-300 bg-gray-50"
                  >
                    {exportingPdfId === s.id ? (
                      <ActivityIndicator size="small" color={colors.gray600} />
                    ) : (
                      <Text className="text-gray-700 font-semibold">{t('surveys_download_pdf')}</Text>
                    )}
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </>
        ) : (
          <>
            {isAssistantSupervisor && (
              <>
                <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_submitted_to_approve')}</Text>
                {filteredPendingSurveys.length === 0 && (
                  <Text className="text-gray-500 py-4">{dateFilter ? t('surveys_no_surveys_for_date') : t('surveys_no_waiting')}</Text>
                )}
                {filteredPendingSurveys.map((s) => (
                  <Card key={s.id} className="mb-3">
                    <View className="flex-row items-start justify-between mb-2">
                      <Text className="font-semibold text-gray-900">{getSiteName(s.siteId)}</Text>
                      <Badge variant="warning" size="sm">{t('surveys_status_pending')}</Badge>
                    </View>
                    <View className="flex-row items-center mb-1">
                      <Calendar size={14} color="#6B7280" />
                      <Text className="text-sm text-gray-600 ml-1">{s.surveyDate}</Text>
                    </View>
                    <Text className="text-sm text-gray-700 mb-2">{t('surveys_total_cubic_m')}: {s.volumeM3.toFixed(2)} m³</Text>
                    <View className="flex-row gap-2 mt-2">
                      <TouchableOpacity
                        onPress={() => rejectSurvey(s.id)}
                        className="flex-1 py-2 rounded-lg border border-gray-400 items-center justify-center"
                      >
                        <Text className="text-gray-700 font-semibold">{t('surveys_reject_button')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => approveSurvey(s.id)}
                        className="flex-1 bg-green-600 rounded-lg py-2 flex-row items-center justify-center"
                      >
                        <CheckCircle size={18} color={colors.surface} />
                        <Text className="text-white font-semibold ml-2">{t('surveys_approve_button')}</Text>
                      </TouchableOpacity>
                    </View>
                    {canDownloadSurveyPdf(s) && (
                      <TouchableOpacity
                        onPress={() => handleDownloadSurveyPdf(s)}
                        disabled={exportingPdfId === s.id}
                        className="mt-2 py-2 flex-row items-center justify-center rounded-lg border border-gray-300 bg-gray-50"
                      >
                        {exportingPdfId === s.id ? <ActivityIndicator size="small" color={colors.gray600} /> : <Text className="text-gray-700 font-semibold">{t('surveys_download_pdf')}</Text>}
                      </TouchableOpacity>
                    )}
                  </Card>
                ))}
                <Text className="text-lg font-bold text-gray-900 mb-2 mt-4">{t('surveys_approved_list')}</Text>
              </>
            )}
            {!isAssistantSupervisor && (
              <Text className="text-lg font-bold text-gray-900 mb-2">{t('surveys_approved_list')}</Text>
            )}

            {filteredApprovedSurveys.length === 0 && (
              <Text className="text-gray-500 py-4">{dateFilter ? t('surveys_no_surveys_for_date') : t('surveys_no_approved')}</Text>
            )}
            {filteredApprovedSurveys.map((s) => (
              <Card key={s.id} className="mb-3">
                <View className="flex-row items-start justify-between mb-2">
                  <Text className="font-semibold text-gray-900">{getSiteName(s.siteId)}</Text>
                  <Badge variant="success" size="sm">{t('surveys_status_approved')}</Badge>
                </View>
                <View className="flex-row items-center mb-1">
                  <Calendar size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-1">{s.surveyDate}</Text>
                </View>
                <Text className="text-sm text-gray-700">{t('surveys_total_cubic_m')}: {s.volumeM3.toFixed(2)} m³</Text>
                {canDownloadSurveyPdf(s) && (
                  <TouchableOpacity
                    onPress={() => handleDownloadSurveyPdf(s)}
                    disabled={exportingPdfId === s.id}
                    className="mt-2 py-2 flex-row items-center justify-center rounded-lg border border-gray-300 bg-gray-50"
                  >
                    {exportingPdfId === s.id ? <ActivityIndicator size="small" color={colors.gray600} /> : <Text className="text-gray-700 font-semibold">{t('surveys_download_pdf')}</Text>}
                  </TouchableOpacity>
                )}
              </Card>
            ))}
          </>
        )}
          </>
        )}
      </ScrollView>

      <ModalWithKeyboard
        visible={newModalVisible}
        onOverlayPress={() => { setNewModalVisible(false); setRevisingSurveyId(null); }}
        submitting={submittingSurvey}
        maxHeightRatio={0.9}
        footer={
          <View style={modalStyles.footer}>
            {parsedVolume !== null ? (
              <>
                <PressableScale onPress={() => { setParsedVolume(null); setParsedCubature(null); }} disabled={submittingSurvey} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                  <Text style={modalStyles.btnTextSecondary}>{t('surveys_revise')}</Text>
                </PressableScale>
                {isSurveyor && (
                  <PressableScale
                    onPress={handleDownloadModalPdf}
                    disabled={submittingSurvey || exportingPdfId === 'modal'}
                    style={[modalStyles.btn, modalStyles.btnSecondary]}
                  >
                    {exportingPdfId === 'modal' ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={modalStyles.btnTextSecondary}>{t('surveys_download_pdf')}</Text>
                    )}
                  </PressableScale>
                )}
                <Button
                  variant="primary"
                  onPress={isRevise ? submitReviseSurvey : submitNewSurvey}
                  disabled={submittingSurvey}
                  loading={submittingSurvey}
                  style={modalStyles.btn}
                >
                  {t('surveys_submit_survey')}
                </Button>
              </>
            ) : (
              <>
                <PressableScale onPress={() => { setNewModalVisible(false); setRevisingSurveyId(null); }} disabled={submittingSurvey} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                  <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                </PressableScale>
                <Button variant="primary" onPress={runParse} disabled={computing || !depthFile?.content?.trim() || topFiles.every((f) => !f.content.trim())} loading={computing} style={modalStyles.btn}>
                  {computing ? t('surveys_computing') : t('surveys_parse_volume')}
                </Button>
              </>
            )}
          </View>
        }
      >
        <Text style={modalStyles.title}>{isRevise ? t('surveys_revise_title') : t('surveys_new_survey')}</Text>
        <Text style={modalStyles.label}>{t('tab_sites')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {sites.map((s) => (
            <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: siteId === s.id ? colors.blue600 : colors.gray200 }}>
              <Text style={{ color: siteId === s.id ? '#fff' : colors.gray700, fontWeight: '500' }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={modalStyles.label}>{t('surveys_survey_date')}</Text>
        <TextInput
          value={surveyDate}
          onChangeText={setSurveyDate}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.placeholder}
          style={[modalStyles.input, { marginBottom: 12 }]}
        />
        <Text style={modalStyles.label}>{t('surveys_top_files')}</Text>
        {topFiles.map((f, index) => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.gray100, borderRadius: radius.md }}>
            <FileText size={20} color={colors.gray600} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.gray800 }} numberOfLines={1}>
              {f.name || (f.content.trim() ? t('surveys_paste_placeholder') : `${t('surveys_top_file_add')} #${index + 1}`)}
            </Text>
            <TouchableOpacity onPress={() => pickTopFile(index)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.blue600, borderRadius: radius.sm, marginRight: 8 }}>
              <FileUp size={14} color="#fff" />
              <Text style={{ fontSize: 12, color: '#fff', marginLeft: 4 }}>{t('surveys_pick_file')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => removeTopFile(index)} style={{ padding: 4 }}>
              <Trash2 size={18} color={colors.gray600} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={addTopFile} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, marginBottom: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.gray400, borderRadius: radius.md }}>
          <Plus size={18} color={colors.gray600} />
          <Text style={{ color: colors.gray600, fontWeight: '500', marginLeft: 6 }}>{t('surveys_top_file_add')}</Text>
        </TouchableOpacity>

        <Text style={modalStyles.label}>{t('surveys_depth_file')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6, paddingVertical: 8, paddingHorizontal: 10, backgroundColor: colors.gray100, borderRadius: radius.md }}>
          <FileText size={20} color={colors.gray600} style={{ marginRight: 10 }} />
          <Text style={{ flex: 1, fontSize: 14, color: depthFile?.name || depthFile?.content?.trim() ? colors.gray800 : colors.gray500 }} numberOfLines={1}>
            {depthFile ? (depthFile.name || (depthFile.content.trim() ? t('surveys_paste_placeholder') : '')) : ''}
          </Text>
          <TouchableOpacity onPress={pickDepthFile} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, paddingHorizontal: 10, backgroundColor: colors.blue600, borderRadius: radius.sm, marginRight: 6 }}>
            <FileUp size={14} color="#fff" />
            <Text style={{ fontSize: 12, color: '#fff', marginLeft: 4 }}>{t('surveys_pick_file')}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowDepthPaste((v) => !v)} style={{ paddingVertical: 4, paddingHorizontal: 6 }}>
            <Text style={{ fontSize: 12, color: colors.blue600 }}>{showDepthPaste ? t('common_cancel') : t('surveys_paste_placeholder')}</Text>
          </TouchableOpacity>
        </View>
        {showDepthPaste && (
          <TextInput
            placeholder="Paste depth file content here"
            placeholderTextColor={colors.placeholder}
            multiline
            numberOfLines={3}
            value={depthFile?.content ?? ''}
            onChangeText={(txt) => setDepthFile((prev) => (prev ? { ...prev, content: txt, name: prev.name || 'Pasted' } : { name: 'Pasted', content: txt }))}
            style={[modalStyles.input, { minHeight: 56, fontSize: 11, marginBottom: 8 }]}
          />
        )}
        {!depthFile?.content?.trim() && (
          <Text style={[modalStyles.label, { fontSize: 12, color: colors.gray500, marginTop: 0, marginBottom: 8 }]}>{t('surveys_depth_required')}</Text>
        )}

        {parsedVolume === null && (
          <TouchableOpacity onPress={runParse} disabled={computing} style={{ backgroundColor: computing ? colors.gray400 : colors.gray700, borderRadius: radius.md, paddingVertical: 12, marginBottom: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
            {computing ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /> : null}
            <Text style={{ color: '#fff', fontWeight: '600' }}>{computing ? t('surveys_computing') : t('surveys_parse_volume')}</Text>
          </TouchableOpacity>
        )}
        {(parsedVolume !== null || parsedCubature !== null) && (
          <View style={{ marginBottom: theme.spacingMd, padding: theme.spacingMd, backgroundColor: colors.blue50, borderRadius: radius.md }}>
            <Text style={[modalStyles.label, { marginBottom: theme.spacingXs, fontSize: theme.fontSizeCaption }]}>{t('surveys_result_preview')}</Text>
            <Text style={{ fontSize: theme.fontSizeBase, color: colors.gray700 }}>{t('tab_sites')}: {getSiteName(siteId)}</Text>
            <Text style={{ fontSize: theme.fontSizeBase, color: colors.gray700 }}>{t('surveys_survey_date')}: {surveyDate}</Text>
            <Text style={{ fontSize: theme.fontSizeTitle, fontWeight: '700', color: colors.text, marginTop: theme.spacingSm }}>{t('surveys_calculated_volume')}: {parsedVolume != null ? parsedVolume.toFixed(2) : (parsedCubature?.totalCut ?? 0).toFixed(2)} m³</Text>
            {parsedCubature != null && (
              <>
                <Text style={{ fontSize: theme.fontSizeCaption, color: colors.textSecondary, marginTop: theme.spacingSm }}>{t('surveys_surface_utile')}: {parsedCubature.surfaceUtile.toFixed(2)} m²</Text>
                <Text style={{ fontSize: theme.fontSizeCaption, color: colors.textSecondary }}>{t('surveys_triangles')}: {parsedCubature.triangleCount}</Text>
                {parsedCubature.totalFill > 0 && (
                  <Text style={{ fontSize: theme.fontSizeCaption, color: colors.textSecondary }}>{t('surveys_fill_volume')}: {parsedCubature.totalFill.toFixed(2)} m³</Text>
                )}
                <Text style={{ fontSize: theme.fontSizeCaption - 1, color: colors.textSecondary, marginTop: theme.spacingXs }}>{t('surveys_boundary_auto')}</Text>
                <Text style={{ fontSize: theme.fontSizeCaption - 1, color: colors.textSecondary }}>{t('surveys_breaklines_enabled')}</Text>
              </>
            )}
            <Text style={{ fontSize: theme.fontSizeCaption, color: colors.textSecondary, marginTop: theme.spacingXs }}>{t('surveys_before_points')}: {beforeCount} · {t('surveys_after_points')}: {afterCount}</Text>
          </View>
        )}
      </ModalWithKeyboard>
    </View>
  );
}

const surveySummaryStyles = StyleSheet.create({
  stickySummary: {
    backgroundColor: colors.blue50,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderBottomColor: colors.border,
    ...Platform.select({
      web: { boxShadow: '0 1px 3px rgba(0,0,0,0.06)' as const },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
      },
    }),
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  summaryTitle: {
    fontWeight: '700',
    color: colors.text,
  },
  locationCount: {
    color: colors.gray600,
    marginTop: 2,
  },
  sitesScroll: {
    marginHorizontal: -4,
  },
  siteRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  siteNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  siteName: {
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
    gap: 16,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  volumeText: {
    color: colors.gray700,
  },
  volumeValue: {
    fontWeight: '700',
    color: colors.primary,
  },
  countText: {
    color: colors.gray600,
  },
});
