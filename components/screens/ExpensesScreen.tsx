import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Alert,
  Keyboard,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import {
  Header,
  ScreenContainer,
  ListCard,
  FormModal,
  Input,
  FilterChips,
  Select,
  EmptyState,
  DatePickerField,
  InfoButton,
} from '@/components/ui';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { generateId } from '@/lib/id';
import { formatAmount, formatPerUnit } from '@/lib/currency';
import type { ExpenseCategory } from '@/types';
import { Banknote, Fuel, Trash2 } from 'lucide-react-native';
import { colors, layout, form, spacing } from '@/theme/tokens';

/** Categories shown in Add expense (RWF) dropdown only — excludes 'fuel' (set automatically for fuel entries). */
const GENERAL_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'maintenance',
  'spare_parts',
  'operator_wages',
  'labour_cost',
  'machine_rental',
  'vehicle_rental',
  'tools_equipment',
  'food_allowance',
  'office_expense',
  'other',
];

export function ExpensesScreen() {
  const PAGE_SIZE = 10;
  const { t } = useLocale();
  const { sites, vehicles, expenses, addExpense, deleteExpense, refetch } = useMockAppStore();
  const { showToast } = useToast();
  const [generalModalVisible, setGeneralModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fuelModalVisible, setFuelModalVisible] = useState(false);
  const [submittingGeneral, setSubmittingGeneral] = useState(false);
  const [submittingFuel, setSubmittingFuel] = useState(false);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | ''>('');
  const [amountRwf, setAmountRwf] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [fuelSiteId, setFuelSiteId] = useState(sites[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');
  const [filterSiteId, setFilterSiteId] = useState<string>('');
  const [expenseTypeFilter, setExpenseTypeFilter] = useState<'all' | 'general' | 'fuel'>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const siteVehicles = vehicles.filter((v) => v.siteId === fuelSiteId);
  const fuelCost = (parseFloat(litres) || 0) * (parseFloat(costPerLitre) || 0);

  const submitGeneral = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!siteId || !siteId.trim()) {
      showToast(t('expenses_site_required'));
      return;
    }
    if (!expenseCategory || !GENERAL_EXPENSE_CATEGORIES.includes(expenseCategory as ExpenseCategory)) {
      showToast(t('expenses_category_required'));
      return;
    }
    if (isNaN(amount) || amount <= 0 || !description.trim()) return;
    const site = sites.find((s) => s.id === siteId);
    if (!site) {
      showToast(t('expenses_site_required'));
      return;
    }
    setSubmittingGeneral(true);
    try {
      await addExpense({
        id: generateId('e'),
        siteId,
        amountRwf: amount,
        description: description.trim(),
        date,
        type: 'general',
        expenseCategory: expenseCategory as ExpenseCategory,
        createdAt: new Date().toISOString(),
      });
      setGeneralModalVisible(false);
      setAmountRwf('');
      setExpenseCategory('');
      setDescription('');
      showToast(t('expenses_toast_added'));
    } catch {
      Alert.alert(t('alert_error'), t('expenses_add_failed'));
    } finally {
      setSubmittingGeneral(false);
    }
  };

  const submitFuel = async () => {
    const l = parseFloat(litres);
    const cpl = parseFloat(costPerLitre);
    if (!fuelSiteId || !fuelSiteId.trim()) {
      showToast(t('expenses_site_required'));
      return;
    }
    if (!vehicleId || isNaN(l) || l <= 0 || isNaN(cpl) || cpl <= 0) return;
    const site = sites.find((s) => s.id === fuelSiteId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!site || !vehicle) {
      showToast(t('expenses_site_required'));
      return;
    }
    const totalCost = Math.round(l * cpl);
    setSubmittingFuel(true);
    try {
      await addExpense({
        id: generateId('e'),
        siteId: fuelSiteId,
        amountRwf: totalCost,
        description: `Fuel ${vehicle.vehicleNumberOrId}`,
        date: new Date().toISOString().slice(0, 10),
        type: 'fuel',
        expenseCategory: 'fuel',
        vehicleId,
        litres: l,
        costPerLitre: cpl,
        fuelCost: totalCost,
        createdAt: new Date().toISOString(),
      });
      setFuelModalVisible(false);
      setLitres('');
      setCostPerLitre('');
      setVehicleId('');
      showToast(t('expenses_toast_fuel_added'));
    } catch {
      Alert.alert(t('alert_error'), t('expenses_fuel_failed'));
    } finally {
      setSubmittingFuel(false);
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

  const getSiteName = (id: string) => sites.find((s) => s.id === id)?.name ?? id;
  const getExpenseCategoryLabel = (cat: ExpenseCategory | undefined | null): string =>
    cat ? t(`expenses_category_${cat}` as 'expenses_category_maintenance') : '';

  const openGeneral = () => {
    setSiteId(sites[0]?.id ?? '');
    setExpenseCategory(GENERAL_EXPENSE_CATEGORIES[0]);
    setAmountRwf('');
    setDescription('');
    setDate(new Date().toISOString().slice(0, 10));
    setGeneralModalVisible(true);
  };

  const openFuel = () => {
    setFuelSiteId(sites[0]?.id ?? '');
    setVehicleId(siteVehicles[0]?.id ?? '');
    setLitres('');
    setCostPerLitre('');
    setFuelModalVisible(true);
  };

  const handleDeleteExpense = (e: { id: string; description: string; amountRwf: number }) => {
    Alert.alert(
      t('expenses_delete_confirm'),
      `${e.description}\n${formatAmount(e.amountRwf)}`,
      [
        { text: t('common_cancel'), style: 'cancel' },
        {
          text: t('expenses_delete_button'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpense(e.id);
              showToast(t('expenses_deleted'));
            } catch {
              Alert.alert(t('alert_error'), t('expenses_delete_failed'));
            }
          },
        },
      ]
    );
  };

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const filterSiteOptions = [{ value: '', label: t('expenses_filter_all_sites') }, ...siteOptions];
  const filteredExpenses = useMemo(() => {
    const bySite = filterSiteId ? expenses.filter((e) => e.siteId === filterSiteId) : expenses;
    if (expenseTypeFilter === 'all') return bySite;
    return bySite.filter((e) => e.type === expenseTypeFilter);
  }, [expenses, filterSiteId, expenseTypeFilter]);

  const sortedExpenses = useMemo(
    () =>
      [...filteredExpenses].sort(
        (a, b) =>
          new Date(b.createdAt ?? b.date).getTime() - new Date(a.createdAt ?? a.date).getTime()
      ),
    [filteredExpenses]
  );

  const totalPages = Math.max(1, Math.ceil(sortedExpenses.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIdx = (safeCurrentPage - 1) * PAGE_SIZE;
  const pagedExpenses = sortedExpenses.slice(startIdx, startIdx + PAGE_SIZE);

  const summary = useMemo(() => {
    const fuel = filteredExpenses
      .filter((e) => e.type === 'fuel')
      .reduce((s, e) => s + Number(e.fuelCost ?? e.amountRwf ?? 0), 0);
    const site = filteredExpenses
      .filter((e) => e.type !== 'fuel')
      .reduce((s, e) => s + Number(e.amountRwf ?? 0), 0);
    return {
      site,
      fuel,
      total: site + fuel,
    };
  }, [filteredExpenses]);

  const truckOptions = siteVehicles
    .filter((v) => v.type === 'truck')
    .map((v) => ({ value: v.id, label: v.vehicleNumberOrId }));
  const machineOptions = siteVehicles
    .filter((v) => v.type === 'machine')
    .map((v) => ({ value: v.id, label: v.vehicleNumberOrId }));

  return (
    <View style={styles.screen}>
      <Header
        title={t('expenses_title')}
        subtitle={t('expenses_subtitle_full')}
        rightAction={null}
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
      >
        <View style={styles.actionsRow}>
          <Pressable onPress={openGeneral} style={styles.primaryBtn}>
            <Banknote size={24} color={colors.surface} />
            <Text style={styles.primaryBtnText}>{t('expenses_add_expense')}</Text>
          </Pressable>
          <Pressable onPress={openFuel} style={styles.secondaryBtn}>
            <Fuel size={24} color={colors.surface} />
            <Text style={styles.primaryBtnText}>{t('expenses_add_fuel')}</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>{t('expenses_filter_by_site')}</Text>
        <FilterChips
          options={filterSiteOptions}
          value={filterSiteId}
          onChange={(v) => {
            setFilterSiteId(v);
            setCurrentPage(1);
          }}
          scroll={false}
        />
        <Select
          label="Expense Type"
          placeholder="All"
          value={expenseTypeFilter}
          onChange={(v) => {
            const next = (v as 'all' | 'general' | 'fuel') || 'all';
            setExpenseTypeFilter(next);
            setCurrentPage(1);
          }}
          options={[
            { value: 'all', label: 'All' },
            { value: 'general', label: 'Site Expenses' },
            { value: 'fuel', label: 'Fuel Expenses' },
          ]}
        />

        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Site Expenses</Text>
            <Text style={styles.summaryValue}>{formatAmount(summary.site)}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Fuel Expenses</Text>
            <Text style={styles.summaryValue}>{formatAmount(summary.fuel)}</Text>
          </View>
        </View>
        <View style={styles.summaryTotalCard}>
          <Text style={styles.summaryTotalLabel}>Overall Expenses (Site + Fuel)</Text>
          <Text style={styles.summaryTotalValue}>{formatAmount(summary.total)}</Text>
        </View>

        <Text style={styles.sectionTitle}>{t('expenses_recent')}</Text>
        {pagedExpenses.length === 0 ? (
          <EmptyState title={t('expenses_empty')} message={t('expenses_empty_message')} />
        ) : (
          pagedExpenses.map((e) => (
              <ListCard
                key={e.id}
                title={e.description}
                meta={`${getSiteName(e.siteId)} · ${e.date}${e.expenseCategory ? ` · ${getExpenseCategoryLabel(e.expenseCategory)}` : ''}${e.type === 'fuel' && e.litres != null ? ` · ${e.litres} L @ ${e.costPerLitre} ${formatPerUnit('L')}` : ''}`}
                right={
                  <View style={styles.expenseRowRight}>
                    <Text style={styles.listAmount}>{formatAmount(e.amountRwf)}</Text>
                    <Pressable
                      onPress={() => handleDeleteExpense(e)}
                      style={styles.deleteExpenseBtn}
                      hitSlop={8}
                      accessibilityLabel={t('expenses_delete_button')}
                    >
                      <Trash2 size={20} color={colors.error} />
                    </Pressable>
                  </View>
                }
              />
            ))
        )}
        <View style={styles.paginationRow}>
          <Pressable
            onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={safeCurrentPage <= 1}
            style={[styles.pageBtn, safeCurrentPage <= 1 && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Previous</Text>
          </Pressable>
          <Text style={styles.pageText}>Page {safeCurrentPage} / {totalPages}</Text>
          <Pressable
            onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={safeCurrentPage >= totalPages}
            style={[styles.pageBtn, safeCurrentPage >= totalPages && styles.pageBtnDisabled]}
          >
            <Text style={styles.pageBtnText}>Next</Text>
          </Pressable>
        </View>
      </ScreenContainer>

      <FormModal
        visible={generalModalVisible}
        onClose={() => setGeneralModalVisible(false)}
        title={t('expenses_add_expense_rwf')}
        primaryLabel={t('common_submit')}
        onPrimary={submitGeneral}
        secondaryLabel={t('common_cancel')}
        submitting={submittingGeneral}
      >
        <Text style={styles.modalLabel}>{t('expenses_site_star')}</Text>
        <FilterChips options={siteOptions} value={siteId} onChange={setSiteId} scroll={false} />
        <Select
          label={t('expenses_type_of_expense')}
          placeholder={t('expenses_type_placeholder')}
          options={GENERAL_EXPENSE_CATEGORIES.map((c) => ({
            value: c,
            label: t(`expenses_category_${c}` as const),
          }))}
          value={expenseCategory}
          onChange={(v) => setExpenseCategory(v as ExpenseCategory)}
        />
        <View style={styles.labelRow}>
          <Text style={styles.modalLabel}>Amount (RWF) *</Text>
          <InfoButton
            title={t('expenses_amount_label')}
            message={t('expenses_amount_info')}
            size={16}
          />
        </View>
        <Input
          value={amountRwf}
          onChangeText={setAmountRwf}
          onFocus={() => { if (amountRwf === '0') setAmountRwf(''); }}
          placeholder={t('expenses_amount_placeholder')}
          keyboardType="number-pad"
        />
        <Input
          label={t('expenses_description_star')}
          value={description}
          onChangeText={setDescription}
          placeholder={t('expenses_description_placeholder')}
        />
        <DatePickerField
          label={t('expenses_date_label')}
          value={date}
          onValueChange={setDate}
          placeholder={t('expenses_date_placeholder')}
        />
      </FormModal>

      <FormModal
        visible={fuelModalVisible}
        onClose={() => setFuelModalVisible(false)}
        title={t('expenses_add_fuel')}
        primaryLabel={t('common_submit')}
        onPrimary={submitFuel}
        secondaryLabel={t('common_cancel')}
        submitting={submittingFuel}
      >
        <Text style={styles.modalLabel}>{t('tab_sites')}</Text>
        <FilterChips
          options={siteOptions}
          value={fuelSiteId}
          onChange={(id) => {
            setFuelSiteId(id);
            const vs = vehicles.filter((v) => v.siteId === id);
            setVehicleId(vs[0]?.id ?? '');
          }}
          scroll={false}
        />
        <Text style={styles.modalLabel}>{t('expenses_vehicle_star')}</Text>
        <Text style={styles.vehicleHint}>{t('expenses_vehicle_type_hint')}</Text>
        {truckOptions.length > 0 && (
          <>
            <Text style={styles.vehicleSectionLabel}>{t('site_vehicle_type_truck')}</Text>
            <FilterChips options={truckOptions} value={vehicleId} onChange={setVehicleId} scroll={false} />
          </>
        )}
        {machineOptions.length > 0 && (
          <>
            <Text style={styles.vehicleSectionLabel}>{t('site_vehicle_type_machine')}</Text>
            <FilterChips options={machineOptions} value={vehicleId} onChange={setVehicleId} scroll={false} />
          </>
        )}
        {vehicleId && (() => {
          const sel = siteVehicles.find((x) => x.id === vehicleId);
          if (!sel) return null;
          const approxL = sel.fuelBalanceLitre ?? 0;
          const truckKm = sel.type === 'truck' && (sel.mileageKmPerLitre ?? 0) > 0 ? approxL * (sel.mileageKmPerLitre ?? 0) : null;
          const machineHrs = sel.type === 'machine' && (sel.hoursPerLitre ?? 0) > 0 ? approxL / (sel.hoursPerLitre ?? 0) : null;
          return (
            <View style={styles.approxFuelBlock}>
              <Text style={styles.approxFuelLabel}>{t('expenses_approx_fuel_available')}: {approxL.toFixed(1)} L</Text>
              {truckKm != null && (
                <Text style={styles.approxFuelDerived}>
                  {t('expenses_approx_km_truck').replace('{km}', truckKm.toFixed(0))}
                </Text>
              )}
              {machineHrs != null && (
                <Text style={styles.approxFuelDerived}>
                  {t('expenses_approx_hours_machine').replace('{hours}', machineHrs.toFixed(1))}
                </Text>
              )}
            </View>
          );
        })()}
        <Input
          label={t('expenses_litres_star')}
          value={litres}
          onChangeText={setLitres}
          onFocus={() => { if (litres === '0') setLitres(''); }}
          placeholder={t('expenses_fuel_placeholder')}
          keyboardType="decimal-pad"
        />
        <Input
          label={t('expenses_cost_per_litre')}
          value={costPerLitre}
          onChangeText={setCostPerLitre}
          onFocus={() => { if (costPerLitre === '0') setCostPerLitre(''); }}
          placeholder={t('expenses_cost_placeholder')}
          keyboardType="decimal-pad"
        />
        <Text style={styles.fuelCost}>
          {t('expenses_fuel_cost_equals')} ={' '}
          {fuelCost > 0 ? formatAmount(fuelCost) : formatAmount(0)}
        </Text>
      </FormModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: layout.cardSpacingVertical,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: form.inputRadius,
    padding: layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouchHeight,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: colors.gray700,
    borderRadius: form.inputRadius,
    padding: layout.cardPadding,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: layout.minTouchHeight,
  },
  primaryBtnText: {
    color: colors.surface,
    fontWeight: '600',
    marginLeft: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: layout.grid,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  summaryTotalCard: {
    backgroundColor: colors.blue50,
    borderRadius: layout.cardRadius,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryTotalLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  summaryTotalValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  paginationRow: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pageBtn: {
    backgroundColor: colors.primary,
    borderRadius: layout.cardRadius,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pageBtnDisabled: {
    opacity: 0.45,
  },
  pageBtnText: {
    color: colors.surface,
    fontWeight: '600',
  },
  pageText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  listAmount: {
    fontWeight: '600',
    color: colors.text,
  },
  expenseRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteExpenseBtn: {
    padding: spacing.xs,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  vehicleHint: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    fontStyle: 'italic',
  },
  vehicleSectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  approxFuelBlock: {
    backgroundColor: colors.gray100,
    borderRadius: layout.cardRadius,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  approxFuelLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  approxFuelNote: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  approxFuelDerived: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fuelCost: {
    fontSize: form.labelFontSize,
    color: colors.textSecondary,
    marginBottom: layout.cardPadding,
  },
});
