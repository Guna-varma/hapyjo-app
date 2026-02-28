import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  Pressable,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { Card } from '@/components/ui/Card';
import { Header } from '@/components/ui/Header';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useLocale } from '@/context/LocaleContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { useToast } from '@/context/ToastContext';
import { generateId } from '@/lib/id';
import { formatAmount, formatPerUnit } from '@/lib/currency';
import { Banknote, Fuel } from 'lucide-react-native';
import { InfoButton } from '@/components/ui/InfoButton';
import { colors, layout, form } from '@/theme/tokens';
import { modalStyles } from '@/components/ui/modalStyles';

export function ExpensesScreen() {
  const { t } = useLocale();
  const { sites, vehicles, expenses, addExpense, refetch } = useMockAppStore();
  const { showToast } = useToast();
  const [generalModalVisible, setGeneralModalVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fuelModalVisible, setFuelModalVisible] = useState(false);

  const [siteId, setSiteId] = useState(sites[0]?.id ?? '');
  const [amountRwf, setAmountRwf] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const [fuelSiteId, setFuelSiteId] = useState(sites[0]?.id ?? '');
  const [vehicleId, setVehicleId] = useState('');
  const [litres, setLitres] = useState('');
  const [costPerLitre, setCostPerLitre] = useState('');

  const siteVehicles = vehicles.filter((v) => v.siteId === fuelSiteId);
  const fuelCost =
    (parseFloat(litres) || 0) * (parseFloat(costPerLitre) || 0);

  const submitGeneral = async () => {
    const amount = parseInt(amountRwf, 10);
    if (!siteId || isNaN(amount) || amount <= 0 || !description.trim()) return;
    const site = sites.find((s) => s.id === siteId);
    if (!site) return;
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

  const chip = (selected: boolean) => ({
    paddingHorizontal: form.inputPadding,
    paddingVertical: 8,
    borderRadius: form.inputRadius,
    backgroundColor: selected ? colors.primary : colors.gray200,
    minHeight: layout.minTouchHeight,
    justifyContent: 'center' as const,
  });

  return (
    <View style={expStyles.screen}>
      <Header title={t('expenses_title')} subtitle={t('expenses_subtitle_full')} rightAction={null} />
      <DashboardLayout
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => Keyboard.dismiss()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} />}
      >
        <View style={expStyles.actionsRow}>
          <TouchableOpacity
            onPress={() => {
              setSiteId(sites[0]?.id ?? '');
              setAmountRwf('');
              setDescription('');
              setDate(new Date().toISOString().slice(0, 10));
              setGeneralModalVisible(true);
            }}
            style={expStyles.primaryBtn}
          >
            <Banknote size={24} color="#fff" />
            <Text style={expStyles.primaryBtnText}>{t('expenses_add_expense')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setFuelSiteId(sites[0]?.id ?? '');
              setVehicleId(siteVehicles[0]?.id ?? '');
              setLitres('');
              setCostPerLitre('');
              setFuelModalVisible(true);
            }}
            style={expStyles.secondaryBtn}
          >
            <Fuel size={24} color="#fff" />
            <Text style={expStyles.primaryBtnText}>{t('expenses_add_fuel')}</Text>
          </TouchableOpacity>
        </View>

        <Text style={expStyles.sectionTitle}>{t('expenses_recent')}</Text>
        {expenses.slice(-20).reverse().map((e) => (
          <Card key={e.id} style={expStyles.listCard}>
            <View style={expStyles.listRow}>
              <View>
                <Text style={expStyles.listTitle}>{e.description}</Text>
                <Text style={expStyles.listMeta}>{getSiteName(e.siteId)} · {e.date}</Text>
                {e.type === 'fuel' && e.litres != null && (
                  <Text style={expStyles.listMeta}>{e.litres} L @ {e.costPerLitre} {formatPerUnit('L')}</Text>
                )}
              </View>
              <Text style={expStyles.listAmount}>{formatAmount(e.amountRwf)}</Text>
            </View>
          </Card>
        ))}
        {expenses.length === 0 && <Text style={expStyles.empty}>{t('expenses_empty')}</Text>}
      </DashboardLayout>

      <Modal visible={generalModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
              <Pressable onPress={(e) => e.stopPropagation()} style={modalStyles.sheet}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={modalStyles.title}>{t('expenses_add_expense_rwf')}</Text>
                  <Text style={modalStyles.label}>{t('expenses_site_star')}</Text>
                  <View style={expStyles.chipRow}>
                    {sites.map((s) => (
                      <Pressable key={s.id} onPress={() => setSiteId(s.id)} style={chip(siteId === s.id)}>
                        <Text style={[expStyles.chipText, siteId === s.id && expStyles.chipTextSelected]}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={expStyles.labelRow}>
                    <Text style={modalStyles.label}>Amount (RWF) *</Text>
                    <InfoButton title={t('expenses_amount_label')} message={t('expenses_amount_info')} size={16} />
                  </View>
                  <TextInput value={amountRwf} onChangeText={setAmountRwf} placeholder={t('expenses_amount_placeholder')} keyboardType="number-pad" style={modalStyles.input} placeholderTextColor={colors.placeholder} />
                  <Text style={modalStyles.label}>{t('expenses_description_star')}</Text>
                  <TextInput value={description} onChangeText={setDescription} placeholder={t('expenses_description_placeholder')} style={modalStyles.input} placeholderTextColor={colors.placeholder} />
                  <DatePickerField label={t('expenses_date_label')} value={date} onValueChange={setDate} placeholder={t('expenses_date_placeholder')} />
                  <View style={modalStyles.footer}>
                    <TouchableOpacity onPress={() => setGeneralModalVisible(false)} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                      <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={submitGeneral} style={[modalStyles.btn, expStyles.submitBtn]}>
                      <Text style={expStyles.submitBtnText}>{t('common_submit')}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={fuelModalVisible} transparent animationType="slide">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlay}>
            <KeyboardAvoidingView behavior="padding" style={{ width: '100%' }}>
              <Pressable onPress={(e) => e.stopPropagation()} style={modalStyles.sheet}>
                <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={modalStyles.title}>{t('expenses_add_fuel')}</Text>
                  <Text style={modalStyles.label}>{t('tab_sites')}</Text>
                  <View style={expStyles.chipRow}>
                    {sites.map((s) => (
                      <Pressable key={s.id} onPress={() => { setFuelSiteId(s.id); setVehicleId(vehicles.filter((v) => v.siteId === s.id)[0]?.id ?? ''); }} style={chip(fuelSiteId === s.id)}>
                        <Text style={[expStyles.chipText, fuelSiteId === s.id && expStyles.chipTextSelected]}>{s.name}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={modalStyles.label}>{t('expenses_vehicle_star')}</Text>
                  <View style={expStyles.chipRow}>
                    {siteVehicles.map((v) => (
                      <Pressable key={v.id} onPress={() => setVehicleId(v.id)} style={chip(vehicleId === v.id)}>
                        <Text style={[expStyles.chipText, vehicleId === v.id && expStyles.chipTextSelected]}>{v.vehicleNumberOrId}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={modalStyles.label}>{t('expenses_litres_star')}</Text>
                  <TextInput value={litres} onChangeText={setLitres} placeholder={t('expenses_fuel_placeholder')} keyboardType="decimal-pad" style={modalStyles.input} placeholderTextColor={colors.placeholder} />
                  <Text style={modalStyles.label}>{t('expenses_cost_per_litre')}</Text>
                  <TextInput value={costPerLitre} onChangeText={setCostPerLitre} placeholder={t('expenses_cost_placeholder')} keyboardType="decimal-pad" style={modalStyles.input} placeholderTextColor={colors.placeholder} />
                  <Text style={expStyles.fuelCost}>{t('expenses_fuel_cost_equals')} = {fuelCost > 0 ? formatAmount(fuelCost) : formatAmount(0)}</Text>
                  <View style={modalStyles.footer}>
                    <TouchableOpacity onPress={() => setFuelModalVisible(false)} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                      <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={submitFuel} style={[modalStyles.btn, expStyles.submitBtn]}>
                      <Text style={expStyles.submitBtnText}>{t('common_submit')}</Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Pressable>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const expStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  actionsRow: { flexDirection: 'row', gap: 12, marginBottom: layout.cardSpacingVertical },
  primaryBtn: { flex: 1, backgroundColor: colors.primary, borderRadius: form.inputRadius, padding: layout.cardPadding, flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouchHeight },
  secondaryBtn: { flex: 1, backgroundColor: colors.gray700, borderRadius: form.inputRadius, padding: layout.cardPadding, flexDirection: 'row', alignItems: 'center', minHeight: layout.minTouchHeight },
  primaryBtnText: { color: '#fff', fontWeight: '600', marginLeft: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  listCard: { marginBottom: layout.grid },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  listTitle: { fontWeight: '600', color: colors.text },
  listMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  listAmount: { fontWeight: '600', color: colors.text },
  empty: { color: colors.textMuted, paddingVertical: layout.cardPadding },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalKAV: { width: '100%' },
  modalSheet: { backgroundColor: colors.surface, borderTopLeftRadius: layout.cardRadius, borderTopRightRadius: layout.cardRadius, padding: layout.cardPadding, maxHeight: '85%' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chipText: { color: colors.text, fontWeight: '500', fontSize: form.labelFontSize },
  chipTextSelected: { color: '#fff' },
  labelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  submitBtn: { backgroundColor: colors.primary },
  submitBtnText: { color: '#fff', fontWeight: '600' },
  fuelCost: { fontSize: form.labelFontSize, color: colors.textSecondary, marginBottom: layout.cardPadding },
});
