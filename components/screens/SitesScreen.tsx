import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Keyboard,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import {
  Header,
  ScreenContainer,
  FormModal,
  Input,
  FilterChips,
  EmptyState,
  SkeletonList,
} from '@/components/ui';
import { SiteCard } from '@/components/sites/SiteCard';
import { SiteDetailScreen } from '@/components/screens/SiteDetailScreen';
import { useAuth } from '@/context/AuthContext';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { useResponsiveTheme } from '@/theme/responsive';
import { colors, radius, spacing } from '@/theme/tokens';
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
  const [allocateSiteId, setAllocateSiteId] = useState(sites[0]?.id ?? '');
  const [amountRwf, setAmountRwf] = useState('');
  const [detailSiteId, setDetailSiteId] = useState<string | null>(null);
  const [createSiteModalVisible, setCreateSiteModalVisible] = useState(false);
  const [submittingCreate, setSubmittingCreate] = useState(false);
  const [submittingBudget, setSubmittingBudget] = useState(false);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteLocation, setNewSiteLocation] = useState('');
  const [newSiteBudget, setNewSiteBudget] = useState('');

  const handleAllocateBudget = () => {
    setAllocateSiteId(sites[0]?.id ?? '');
    setAmountRwf('');
    setBudgetModalVisible(true);
  };

  const handleConfirmBudget = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!allocateSiteId || isNaN(amount) || amount <= 0) {
      Alert.alert(t('sites_invalid_input_title'), t('sites_invalid_input'));
      return;
    }
    setSubmittingBudget(true);
    try {
      await updateSite(allocateSiteId, { budget: amount });
      setBudgetModalVisible(false);
      showToast(t('sites_toast_budget_updated'));
    } catch {
      Alert.alert(t('sites_error_title'), t('sites_budget_update_failed'));
    } finally {
      setSubmittingBudget(false);
    }
  };

  const selectedSite = detailSiteId
    ? sites.find((s) => s.id === detailSiteId)
    : null;

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
    setSubmittingCreate(true);
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
    } finally {
      setSubmittingCreate(false);
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

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));

  if (selectedSite) {
    return (
      <SiteDetailScreen
        site={selectedSite}
        onBack={() => setDetailSiteId(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        title={t('sites_title')}
        subtitle={t('sites_subtitle')}
        rightAction={
          isHeadSupervisor ? (
            <Pressable onPress={handleAllocateBudget} style={styles.allocateBtn}>
              <Text style={styles.allocateBtnText}>
                {t('sites_allocate_budget')}
              </Text>
            </Pressable>
          ) : null
        }
      />
      <ScreenContainer
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={{ paddingBottom: theme.spacingXl, flexGrow: 1 }}
      >
        {loading ? (
          <SkeletonList count={5} />
        ) : (
          <>
            {user?.role === 'head_supervisor' && (
              <Pressable onPress={handleCreateSite} style={styles.createCard}>
                <View style={styles.createCardInner}>
                  <View style={styles.createIconWrap}>
                    <Plus size={20} color={colors.primary} />
                  </View>
                  <Text style={styles.createCardText}>
                    {t('sites_create_new_site')}
                  </Text>
                </View>
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>{t('sites_all_sites')}</Text>
            {sites.length === 0 ? (
              <EmptyState title={t('sites_no_sites')} message={t('sites_no_sites_message')} />
            ) : (
              sites.map((site) => (
                <SiteCard
                  key={site.id}
                  site={site}
                  onPress={() => setDetailSiteId(site.id)}
                />
              ))
            )}
          </>
        )}
      </ScreenContainer>

      <FormModal
        visible={createSiteModalVisible}
        onClose={() => setCreateSiteModalVisible(false)}
        title={t('sites_create_site_modal_title')}
        primaryLabel={t('sites_add_site')}
        onPrimary={handleConfirmCreateSite}
        secondaryLabel={t('general_cancel')}
        submitting={submittingCreate}
      >
        <Input
          label={t('sites_site_name')}
          value={newSiteName}
          onChangeText={setNewSiteName}
          placeholder={t('sites_name_placeholder')}
        />
        <Input
          label={t('sites_location')}
          value={newSiteLocation}
          onChangeText={setNewSiteLocation}
          placeholder={t('sites_location_placeholder')}
        />
        <Input
          label={t('sites_initial_budget_optional')}
          value={newSiteBudget}
          onChangeText={setNewSiteBudget}
          placeholder={t('sites_budget_placeholder')}
          keyboardType="number-pad"
        />
      </FormModal>

      <FormModal
        visible={budgetModalVisible}
        onClose={() => setBudgetModalVisible(false)}
        title={t('sites_allocate_budget_modal_title')}
        primaryLabel={t('common_confirm')}
        onPrimary={handleConfirmBudget}
        secondaryLabel={t('general_cancel')}
        submitting={submittingBudget}
      >
        <Text style={styles.modalLabel}>{t('sites_select_site')}</Text>
        <FilterChips
          options={siteOptions}
          value={allocateSiteId}
          onChange={setAllocateSiteId}
          scroll={false}
        />
        <View style={styles.chipMargin} />
        <Input
          label={t('sites_amount_rwf')}
          value={amountRwf}
          onChangeText={setAmountRwf}
          placeholder={t('sites_budget_placeholder')}
          keyboardType="number-pad"
        />
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  allocateBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 40,
    justifyContent: 'center',
  },
  allocateBtnText: {
    color: colors.surface,
    fontWeight: '600',
  },
  createCard: {
    marginBottom: spacing.lg,
    backgroundColor: colors.blue50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  createCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  createIconWrap: {
    width: 40,
    height: 40,
    backgroundColor: colors.blue50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  createCardText: {
    color: colors.primary,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  chipMargin: { height: spacing.sm },
});
