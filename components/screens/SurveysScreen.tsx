import React, { useState, useEffect, useCallback } from 'react';
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
import { parseSurveyFileContent, computeWorkVolume, computeCubature, parseAndMergeSurveyFiles } from '@/lib/surveyParser';
import { generateId } from '@/lib/id';
import { pickSurveyTextFile } from '@/lib/readSurveyFile';
import { Plus, MapPin, Calendar, CheckCircle, FileUp, Trash2, FileText } from 'lucide-react-native';
import { ModalWithKeyboard } from '@/components/ui/ModalWithKeyboard';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, radius } from '@/theme/tokens';

type TopFileEntry = { id: string; name: string; content: string };
type DepthFile = { name: string; content: string } | null;

export interface SurveysScreenProps {
  initialOpenNewSurveyModal?: boolean;
  onClearOpenNewSurveyModal?: () => void;
}

export function SurveysScreen({ initialOpenNewSurveyModal, onClearOpenNewSurveyModal }: SurveysScreenProps = {}) {
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
  const [computing, setComputing] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [topFiles, setTopFiles] = useState<TopFileEntry[]>([]);
  const [depthFile, setDepthFile] = useState<DepthFile>(null);
  const [parsedVolume, setParsedVolume] = useState<number | null>(null);
  const [parsedCubature, setParsedCubature] = useState<{ totalCut: number; totalFill: number; surfaceUtile: number; triangleCount: number } | null>(null);
  const [beforeCount, setBeforeCount] = useState(0);
  const [afterCount, setAfterCount] = useState(0);
  const [showDepthPaste, setShowDepthPaste] = useState(false);

  useEffect(() => {
    if (initialOpenNewSurveyModal && isSurveyor && sites.length > 0) {
      setNewModalVisible(true);
      onClearOpenNewSurveyModal?.();
    }
  }, [initialOpenNewSurveyModal, isSurveyor, sites.length, onClearOpenNewSurveyModal]);

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
    const topContents = topFiles.map((f) => f.content).filter((c) => c.trim());
    if (topContents.length === 0) {
      showToast(t('surveys_top_required'));
      return;
    }
    if (!depthFile?.content?.trim()) {
      showToast(t('surveys_depth_required'));
      return;
    }
    const beforePoints = parseAndMergeSurveyFiles(topContents);
    const afterPoints = parseSurveyFileContent(depthFile.content);
    const volume = computeWorkVolume(beforePoints, afterPoints);
    const site = sites.find((s) => s.id === siteId);
    if (!site || !user?.id) return;
    Keyboard.dismiss();
    setSubmittingSurvey(true);
    try {
      const beforeFileContent = topContents.join('\n\n');
      await addSurvey({
        id: generateId('sv'),
        type: 'Before/After Survey',
        siteId,
        siteName: site.name,
        surveyorId: user.id,
        measurements: {},
        status: 'submitted',
        createdAt: new Date().toISOString(),
        beforeFileContent,
        afterFileContent: depthFile.content,
        workVolume: volume,
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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl, flexGrow: 1 }}
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

        <TouchableOpacity onPress={runParse} disabled={computing} style={{ backgroundColor: computing ? colors.gray400 : colors.gray700, borderRadius: radius.md, paddingVertical: 12, marginBottom: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' }}>
          {computing ? <ActivityIndicator size="small" color="#fff" style={{ marginRight: 8 }} /> : null}
          <Text style={{ color: '#fff', fontWeight: '600' }}>{computing ? t('surveys_computing') : t('surveys_parse_volume')}</Text>
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
