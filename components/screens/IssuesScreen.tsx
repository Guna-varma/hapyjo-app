import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Pressable,
  Image,
  Alert,
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
import { generateId } from '@/lib/id';
import { AlertCircle, Plus, MapPin, Calendar } from 'lucide-react-native';
import { ModalWithKeyboard } from '@/components/ui/ModalWithKeyboard';
import { Button } from '@/components/ui/Button';
import { PressableScale } from '@/components/ui/PressableScale';
import { modalStyles } from '@/components/ui/modalStyles';
import { colors, radius } from '@/theme/tokens';

export function IssuesScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, issues, addIssue, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const [refreshing, setRefreshing] = useState(false);
  const canRaise = user?.role === 'driver_truck' || user?.role === 'driver_machine' || user?.role === 'assistant_supervisor';
  const canViewAll = user?.role === 'head_supervisor' || user?.role === 'owner';
  const thumbnailSize = theme.scaleMin(64);
  const modalMaxHeight = theme.height * theme.modalMaxHeightRatio;

  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [submittingIssue, setSubmittingIssue] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);

  const filteredIssues = filterSiteId ? issues.filter((i) => i.siteId === filterSiteId) : issues;
  const myIssues = !canViewAll ? issues.filter((i) => i.raisedById === user?.id) : undefined;
  const listIssues = canViewAll ? filteredIssues : myIssues ?? [];

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const statusVariant = { open: 'warning' as const, acknowledged: 'info' as const, resolved: 'success' as const };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const addImage = async () => {
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true });
      if (!result.canceled && result.assets?.length) {
        setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
      }
    } catch { /* user cancelled or picker error */ }
  };

  const removeImage = (uri: string) => setImageUris((prev) => prev.filter((u) => u !== uri));

  const submitIssue = async () => {
    if (!description.trim() || !siteId || !user?.id) return;
    const site = sites.find((s) => s.id === siteId);
    Keyboard.dismiss();
    setSubmittingIssue(true);
    try {
      await addIssue({
        id: generateId('i'),
        siteId,
        siteName: site?.name,
        raisedById: user.id,
        description: description.trim(),
        imageUris: [...imageUris],
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      setRaiseModalVisible(false);
      setDescription('');
      setImageUris([]);
      showToast(t('issues_raise_success_message'));
    } finally {
      setSubmittingIssue(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={t('issues_title')}
        subtitle={canViewAll ? t('issues_subtitle_view') : t('issues_subtitle_raise')}
        rightAction={
          canRaise ? (
            <TouchableOpacity
              onPress={() => { setSiteId(sites[0]?.id ?? ''); setDescription(''); setImageUris([]); setRaiseModalVisible(true); }}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center"
            >
              <Plus size={18} color={colors.surface} />
              <Text className="text-white font-semibold ml-1">{t('issues_raise')}</Text>
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
        ) : (
          <>
        {canViewAll && sites.length > 1 && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            <Pressable
              onPress={() => setFilterSiteId(null)}
              className={`px-3 py-2 rounded-lg ${filterSiteId === null ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <Text className={filterSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>{t('reports_all')}</Text>
            </Pressable>
            {sites.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => setFilterSiteId(s.id)}
                className={`px-3 py-2 rounded-lg ${filterSiteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <Text className={filterSiteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
              </Pressable>
            ))}
          </View>
        )}

        <Text className="text-lg font-bold text-gray-900 mb-2">{canViewAll ? t('issues_all_issues') : t('issues_my_issues')}</Text>
        {listIssues.length === 0 && (
          <Text className="text-gray-500 py-4">{canViewAll ? t('issues_none_reported') : t('issues_none_raised')}</Text>
        )}
        {listIssues.map((issue) => (
          <Card key={issue.id} className="mb-3">
            <View className="flex-row items-start justify-between mb-2">
              <Text className="font-semibold text-gray-900 flex-1">{issue.description.slice(0, 60)}{issue.description.length > 60 ? '…' : ''}</Text>
              <Badge variant={statusVariant[issue.status]} size="sm">{issue.status}</Badge>
            </View>
            <View className="flex-row items-center mb-1">
              <MapPin size={14} color="#6B7280" />
              <Text className="text-sm text-gray-600 ml-1">{issue.siteName ?? getSiteName(issue.siteId)}</Text>
            </View>
            <View className="flex-row items-center">
              <Calendar size={14} color="#6B7280" />
              <Text className="text-xs text-gray-500 ml-1">{issue.createdAt.slice(0, 10)}</Text>
            </View>
            {issue.imageUris.length > 0 && (
              <Text className="text-xs text-gray-500 mt-1">{issue.imageUris.length} {t('issues_images_attached')}</Text>
            )}
          </Card>
        ))}
          </>
        )}
      </ScrollView>

      <ModalWithKeyboard
        visible={raiseModalVisible}
        onOverlayPress={() => setRaiseModalVisible(false)}
        submitting={submittingIssue}
        maxHeightRatio={modalMaxHeight / theme.height}
        footer={
          <View style={modalStyles.footer}>
            <PressableScale onPress={() => setRaiseModalVisible(false)} disabled={submittingIssue} style={[modalStyles.btn, modalStyles.btnSecondary]}>
              <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
            </PressableScale>
            <Button variant="primary" onPress={submitIssue} disabled={!description.trim() || submittingIssue} loading={submittingIssue} style={modalStyles.btn}>
              {t('issues_raise_submit')}
            </Button>
          </View>
        }
      >
        <View style={{ alignItems: 'center', marginBottom: 16 }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <AlertCircle size={24} color="#d97706" />
          </View>
          <Text style={[modalStyles.title, { textAlign: 'center' }]}>{t('issues_raise_modal_title')}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', marginTop: 4 }}>{t('issues_raise_modal_subtitle')}</Text>
        </View>
        <Text style={modalStyles.label}>{t('issues_raise_site_label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {sites.map((s) => (
            <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md, backgroundColor: siteId === s.id ? colors.blue600 : colors.gray200 }}>
              <Text style={{ color: siteId === s.id ? '#fff' : colors.gray700, fontWeight: '500' }}>{s.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={modalStyles.label}>{t('issues_description')}</Text>
        <TextInput value={description} onChangeText={setDescription} placeholder={t('issues_raise_description_placeholder')} multiline numberOfLines={4} placeholderTextColor={colors.placeholder} style={[modalStyles.input, { minHeight: theme.scale(88) }]} />
              {imageUris.map((uri) => (
                <View key={uri} className="relative">
                  <Image source={{ uri }} className="rounded-lg bg-gray-200" style={{ width: thumbnailSize, height: thumbnailSize }} />
                  <TouchableOpacity onPress={() => removeImage(uri)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-white text-xs">×</Text>
                  </TouchableOpacity>
                </View>
              ))}
        <Text style={modalStyles.label}>{t('issues_raise_attach_images')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          <TouchableOpacity onPress={addImage} style={{ width: 64, height: 64, borderRadius: radius.md, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.gray100 }}>
            <Plus size={24} color={colors.textMuted} />
            <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{t('common_add')}</Text>
          </TouchableOpacity>
          {imageUris.map((uri) => (
            <View key={uri} style={{ position: 'relative' }}>
              <Image source={{ uri }} style={{ width: thumbnailSize, height: thumbnailSize, borderRadius: radius.md, backgroundColor: colors.gray200 }} />
              <TouchableOpacity onPress={() => removeImage(uri)} style={{ position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ef4444', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontSize: 12 }}>×</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ModalWithKeyboard>
    </View>
  );
}
