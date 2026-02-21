import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { generateId } from '@/lib/id';
import { AlertCircle, Plus, MapPin, Calendar } from 'lucide-react-native';

export function IssuesScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, issues, addIssue, loading } = useMockAppStore();
  const canRaise = user?.role === 'driver_truck' || user?.role === 'driver_machine' || user?.role === 'assistant_supervisor';
  const canViewAll = user?.role === 'head_supervisor' || user?.role === 'owner';
  const thumbnailSize = theme.scaleMin(64);
  const modalMaxHeight = theme.height * theme.modalMaxHeightRatio;

  const [raiseModalVisible, setRaiseModalVisible] = useState(false);
  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [description, setDescription] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string | null>(null);
  const [imageUris, setImageUris] = useState<string[]>([]);

  const filteredIssues = filterSiteId ? issues.filter((i) => i.siteId === filterSiteId) : issues;
  const myIssues = !canViewAll ? issues.filter((i) => i.raisedById === user?.id) : undefined;
  const listIssues = canViewAll ? filteredIssues : myIssues ?? [];

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const statusVariant = { open: 'warning' as const, acknowledged: 'info' as const, resolved: 'success' as const };

  const addImage = async () => {
    try {
      const { launchImageLibraryAsync } = await import('expo-image-picker');
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true });
      if (!result.canceled && result.assets?.length) {
        setImageUris((prev) => [...prev, ...result.assets!.map((a) => a.uri)]);
      }
    } catch (_) {}
  };

  const removeImage = (uri: string) => setImageUris((prev) => prev.filter((u) => u !== uri));

  const submitIssue = () => {
    if (!description.trim() || !siteId || !user?.id) return;
    const site = sites.find((s) => s.id === siteId);
    addIssue({
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
    Alert.alert(t('issues_raise_success_title'), t('issues_raise_success_message'), [{ text: t('common_ok') }]);
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title="Issues"
        subtitle={canViewAll ? 'View and manage issues' : 'Raise an issue'}
        rightAction={
          canRaise ? (
            <TouchableOpacity
              onPress={() => { setSiteId(sites[0]?.id ?? ''); setDescription(''); setImageUris([]); setRaiseModalVisible(true); }}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center"
            >
              <Plus size={18} color="#fff" />
              <Text className="text-white font-semibold ml-1">Raise issue</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView className="flex-1" contentContainerStyle={{ padding: theme.screenPadding }}>
        {loading ? (
          <View className="py-12 items-center">
            <ActivityIndicator size="large" color="#2563eb" />
            <Text className="text-gray-600 mt-3">Loading issues...</Text>
          </View>
        ) : (
          <>
        {canViewAll && sites.length > 1 && (
          <View className="flex-row flex-wrap gap-2 mb-4">
            <Pressable
              onPress={() => setFilterSiteId(null)}
              className={`px-3 py-2 rounded-lg ${filterSiteId === null ? 'bg-blue-600' : 'bg-gray-200'}`}
            >
              <Text className={filterSiteId === null ? 'text-white font-medium' : 'text-gray-700'}>All</Text>
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

        <Text className="text-lg font-bold text-gray-900 mb-2">{canViewAll ? 'All issues' : 'My issues'}</Text>
        {listIssues.length === 0 && (
          <Text className="text-gray-500 py-4">{canViewAll ? 'No issues reported.' : 'You have not raised any issues.'}</Text>
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
              <Text className="text-xs text-gray-500 mt-1">{issue.imageUris.length} image(s) attached</Text>
            )}
          </Card>
        ))}
          </>
        )}
      </ScrollView>

      <Modal visible={raiseModalVisible} transparent animationType="slide">
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-white rounded-t-2xl p-6 pb-8" style={{ maxHeight: modalMaxHeight }}>
            <View className="items-center mb-4">
              <View className="w-12 h-12 rounded-full bg-amber-100 items-center justify-center mb-2">
                <AlertCircle size={24} color="#d97706" />
              </View>
              <Text className="text-xl font-bold text-gray-900 text-center">{t('issues_raise_modal_title')}</Text>
              <Text className="text-sm text-gray-600 text-center mt-1">{t('issues_raise_modal_subtitle')}</Text>
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">{t('issues_raise_site_label')}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setSiteId(s.id)}
                  className={`px-3 py-2 rounded-lg ${siteId === s.id ? 'bg-blue-600' : 'bg-gray-200'}`}
                >
                  <Text className={siteId === s.id ? 'text-white font-medium' : 'text-gray-700'}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">Description</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder={t('issues_raise_description_placeholder')}
              multiline
              numberOfLines={4}
              className="border border-gray-300 rounded-lg px-3 py-2 mb-3 bg-white text-gray-900"
              style={{ minHeight: theme.scale(88) }}
            />
            <Text className="text-sm font-medium text-gray-700 mb-1">{t('issues_raise_attach_images')}</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              <TouchableOpacity onPress={addImage} className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50">
                <Plus size={24} color="#6B7280" />
                <Text className="text-xs text-gray-500 mt-0.5">Add</Text>
              </TouchableOpacity>
              {imageUris.map((uri) => (
                <View key={uri} className="relative">
                  <Image source={{ uri }} className="rounded-lg bg-gray-200" style={{ width: thumbnailSize, height: thumbnailSize }} />
                  <TouchableOpacity onPress={() => removeImage(uri)} className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 items-center justify-center">
                    <Text className="text-white text-xs">×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setRaiseModalVisible(false)} className="flex-1 py-3 rounded-lg bg-gray-200 items-center">
                <Text className="font-semibold text-gray-700">{t('common_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitIssue}
                disabled={!description.trim()}
                className={`flex-1 py-3 rounded-lg items-center ${description.trim() ? 'bg-blue-600' : 'bg-gray-300'}`}
              >
                <Text className={`font-semibold ${description.trim() ? 'text-white' : 'text-gray-500'}`}>{t('issues_raise_submit')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
