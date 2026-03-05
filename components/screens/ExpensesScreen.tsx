import React, { useState } from 'react';
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
  EmptyState,
  DatePickerField,
  InfoButton,
} from '@/components/ui';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { generateId } from '@/lib/id';
import { formatAmount, formatPerUnit } from '@/lib/currency';
import { Banknote, Fuel } from 'lucide-react-native';
import { colors, layout, form, spacing } from '@/theme/tokens';

export function ExpensesScreen() {
  const { t } = useLocale();
  const { sites, vehicles, expenses, addExpense, refetch } = useMockAppStore();
  const { showToast } = useToast();
  const [generalModalVisible, setGeneralModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fuelModalVisible, setFuelModalVisible] = useState(false);
  const [submittingGeneral, setSubmittingGeneral] = useState(false);
  const [submittingFuel, setSubmittingFuel] = useState(false);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [amountRwf, setAmountRwf] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [fuelSiteId, setFuelSiteId] = useState(sites[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');

  const siteVehicles = vehicles.filter((v) => v.siteId === fuelSiteId);
  const fuelCost = (parseFloat(litres) || 0) * (parseFloat(costPerLitre) || 0);

  const submitGeneral = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!siteId || isNaN(amount) || amount <= 0 || !description.trim()) return;
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
    setSubmittingGeneral(true);
    try {
      await addExpense({
        id: generateId('e'),
        siteId,
        amountRwf: amount,
        description: description.trim(),
        date,
        type: 'general',
        createdAt: new Date().toISOString(),
      });
      setGeneralModalVisible(false);
      setAmountRwf('');
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
    if (!fuelSiteId || !vehicleId || isNaN(l) || l <= 0 || isNaN(cpl) || cpl <= 0) return;
    const site = sites.find((s) => s.id === fuelSiteId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);
    if (!site || !vehicle) return;
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

  const openGeneral = () => {
    setSiteId(sites[0]?.id ?? '');
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

  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name }));
  const vehicleOptions = siteVehicles.map((v) => ({
    value: v.id,
    label: v.vehicleNumberOrId,
  }));

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

        <Text style={styles.sectionTitle}>{t('expenses_recent')}</Text>
        {expenses.length === 0 ? (
          <EmptyState title={t('expenses_empty')} message={t('expenses_empty_message')} />
        ) : (
          expenses
            .slice(-20)
            .reverse()
            .map((e) => (
              <ListCard
                key={e.id}
                title={e.description}
                meta={`${getSiteName(e.siteId)} · ${e.date}${e.type === 'fuel' && e.litres != null ? ` · ${e.litres} L @ ${e.costPerLitre} ${formatPerUnit('L')}` : ''}`}
                right={
                  <Text style={styles.listAmount}>{formatAmount(e.amountRwf)}</Text>
                }
              />
            ))
        )}
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
        <FilterChips
          options={vehicleOptions}
          value={vehicleId}
          onChange={setVehicleId}
          scroll={false}
        />
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
  listAmount: {
    fontWeight: '600',
    color: colors.text,
  },
  modalLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
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
