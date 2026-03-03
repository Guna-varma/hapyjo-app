import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Pressable, Keyboard, RefreshControl } from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { SiteCard } from '@/components/sites/SiteCard';
import { SiteDetailScreen } from '@/components/screens/SiteDetailScreen';
import { modalStyles } from '@/components/ui/modalStyles';
import { SkeletonList } from '@/components/ui/SkeletonLoader';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors } from '@/theme/tokens';
import { generateId } from '@/lib/id';
import { Plus } from 'lucide-react-native';

export function SitesScreen() {
  const { user } = useAuth();
  const { t } = useLocale();
  const theme = useResponsiveTheme();
  const { sites, updateSite, addSite, refetch, loading } = useMockAppStore();
  const { showToast } = useToast();
  const isHeadSupervisor = user?.role === 'head_supervisor';
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [allocateSiteId, setAllocateSiteId] = useState<string | null>(null);
  const [amountRwf, setAmountRwf] = useState('');
  const [detailSiteId, setDetailSiteId] = useState<string | null>(null);
  const [createSiteModalVisible, setCreateSiteModalVisible] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteBudget, setNewSiteBudget] = useState('');

  const handleAllocateBudget = () => {
    setAllocateSiteId(sites[0]?.id ?? null);
    setAmountRwf('');
    setBudgetModalVisible(true);
  };

  const handleConfirmBudget = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!allocateSiteId || isNaN(amount) || amount <= 0) {
      Alert.alert(t('sites_invalid_input_title'), t('sites_invalid_input'));
      return;
    }
    try {
      await updateSite(allocateSiteId, { budget: amount });
      setBudgetModalVisible(false);
      showToast(t('sites_toast_budget_updated'));
    } catch {
      Alert.alert(t('sites_error_title'), t('sites_budget_update_failed'));
    }
  };

  const selectedSite = detailSiteId ? sites.find((s) => s.id === detailSiteId) : null;

  const handleCreateSite = () => {
    setNewSiteName('');
    setNewSiteLocation('');
    setNewSiteBudget('');
    setCreateSiteModalVisible(true);
  };

  const handleConfirmCreateSite = async () => {
    const name = newSiteName.trim();
    const location = newSiteLocation.trim();
    if (!name || !location) {
      Alert.alert(t('sites_required_fields_title'), t('sites_required_fields'));
      return;
    }
    const budget = parseInt(newSiteBudget, 10) || 0;
    const id = generateId('site');
    try {
      await addSite({
        id,
        name,
        location,
        status: 'active',
        startDate: new Date().toISOString().slice(0, 10),
        budget: budget > 0 ? budget : 1000000,
        spent: 0,
        progress: 0,
      });
      setCreateSiteModalVisible(false);
      showToast(t('sites_toast_site_created'));
    } catch {
      Alert.alert(t('sites_error_title'), t('sites_create_failed'));
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  if (selectedSite) {
    return (
      <SiteDetailScreen
        site={selectedSite}
        onBack={() => setDetailSiteId(null)}
      />
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header
        title={t('sites_title')}
        subtitle={t('sites_subtitle')}
        rightAction={
          isHeadSupervisor ? (
            <TouchableOpacity
              onPress={handleAllocateBudget}
              className="bg-blue-600 rounded-lg px-4 py-2 flex-row items-center mr-2"
            >
              <Text className="text-white font-semibold">{t('sites_allocate_budget')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: theme.screenPadding, paddingBottom: theme.spacingXl, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />
        }
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
        {user?.role === 'head_supervisor' && (
          <TouchableOpacity onPress={handleCreateSite} className="mb-4">
            <Card className="bg-blue-50 border border-blue-200 border-dashed">
              <View className="flex-row items-center py-3">
                <View className="w-10 h-10 bg-blue-100 rounded-lg items-center justify-center mr-3">
                  <Plus size={20} color="#2563EB" />
                </View>
                <Text className="text-blue-700 font-semibold">{t('sites_create_new_site')}</Text>
              </View>
            </Card>
          </TouchableOpacity>
        )}

        <View className="mb-4">
          <Text className="text-lg font-bold text-gray-900 mb-3">{t('sites_all_sites')}</Text>
          {sites.map((site) => (
            <SiteCard key={site.id} site={site} onPress={() => setDetailSiteId(site.id)} />
          ))}
        </View>
          </>
        )}
      </ScrollView>

      <Modal visible={createSiteModalVisible} transparent animationType="slide">
        <Pressable style={modalStyles.overlay} onPress={() => setCreateSiteModalVisible(false)}>
          <Pressable style={modalStyles.sheet} onPress={(e) => e.stopPropagation()}>
            <Text style={modalStyles.title}>{t('sites_create_site_modal_title')}</Text>
            <Text style={modalStyles.label}>{t('sites_site_name')}</Text>
            <TextInput
              value={newSiteName}
              onChangeText={setNewSiteName}
              placeholder={t('sites_name_placeholder')}
              placeholderTextColor={colors.placeholder}
              style={[modalStyles.input, { marginBottom: 12 }]}
            />
            <Text style={modalStyles.label}>{t('sites_location')}</Text>
            <TextInput
              value={newSiteLocation}
              onChangeText={setNewSiteLocation}
              placeholder={t('sites_location_placeholder')}
              placeholderTextColor={colors.placeholder}
              style={[modalStyles.input, { marginBottom: 12 }]}
            />
            <Text style={modalStyles.label}>{t('sites_initial_budget_optional')}</Text>
            <TextInput
              value={newSiteBudget}
              onChangeText={setNewSiteBudget}
              placeholder={t('sites_budget_placeholder')}
              keyboardType="number-pad"
              placeholderTextColor={colors.placeholder}
              style={[modalStyles.input, { marginBottom: 16 }]}
            />
            <View style={modalStyles.footer}>
              <TouchableOpacity onPress={() => setCreateSiteModalVisible(false)} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                <Text style={modalStyles.btnTextSecondary}>{t('general_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmCreateSite} style={[modalStyles.btn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('sites_add_site')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={budgetModalVisible} transparent animationType="slide">
        <Pressable style={[modalStyles.overlayCenter]} onPress={() => setBudgetModalVisible(false)}>
          <Pressable style={modalStyles.sheetCenter} onPress={(e) => e.stopPropagation()}>
            <Text style={modalStyles.title}>{t('sites_allocate_budget_modal_title')}</Text>
            <Text style={modalStyles.label}>{t('sites_select_site')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {sites.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => setAllocateSiteId(s.id)}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: allocateSiteId === s.id ? colors.primary : colors.gray200 }}
                >
                  <Text style={{ color: allocateSiteId === s.id ? '#fff' : colors.text, fontWeight: '500' }}>{s.name}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={modalStyles.label}>{t('sites_amount_rwf')}</Text>
            <TextInput
              value={amountRwf}
              onChangeText={setAmountRwf}
              placeholder={t('sites_budget_placeholder')}
              keyboardType="number-pad"
              placeholderTextColor={colors.placeholder}
              style={[modalStyles.input, { marginBottom: 16 }]}
            />
            <View style={modalStyles.footer}>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                <Text style={modalStyles.btnTextSecondary}>{t('general_cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirmBudget} style={[modalStyles.btn, { backgroundColor: colors.primary }]}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('common_confirm')}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
