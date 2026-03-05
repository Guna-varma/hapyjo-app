import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Pressable, StyleSheet } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { DatePickerField } from '@/components/ui/DatePickerField';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { formatAmount } from '@/lib/currency';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { useLocale } from '@/context/LocaleContext';
import { TrendingUp, Banknote, PieChart, Settings, FileText, Building2, Users, Globe } from 'lucide-react-native';
import { colors, layout, form } from '@/theme/tokens';
import { modalStyles } from '@/components/ui/modalStyles';

export function OwnerDashboard({ onNavigateTab }: DashboardNavProps) {
  const { t, locale, setLocale } = useLocale();
  const { sites, surveys, expenses, updateSite } = useMockAppStore();
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rateSiteId, setRateSiteId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);

  const inRange = useMemo(() => {
    if (!dateFrom && !dateTo) return () => true;
    return (iso: string) => {
      const d = iso.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
  }, [dateFrom, dateTo]);

  const surveysInRange = useMemo(
    () => surveys.filter((s) => s.status === 'approved' && s.workVolume != null && inRange(s.createdAt)),
    [surveys, inRange]
  );
  const expensesInRange = useMemo(() => expenses.filter((e) => !e.date || inRange(e.date)), [expenses, inRange]);

  const totalBudget = sites.reduce((sum, site) => sum + (site.budget ?? 0), 0);
  const totalSpent = sites.reduce((sum, site) => sum + (site.spent ?? 0), 0);
  const remaining = Math.max(0, totalBudget - totalSpent);
  const utilizationRate = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
  const revenue = sites.reduce((sum, site) => {
    const siteVolume = surveysInRange.filter((s) => s.siteId === site.id).reduce((v, s) => v + (s.workVolume ?? 0), 0);
    return sum + siteVolume * (site.contractRateRwf ?? 0);
  }, 0);
  const totalCost = expensesInRange.reduce((sum, e) => sum + e.amountRwf, 0);
  const profit = revenue - totalCost;

  const hasUnsetContractRates = sites.some((site) => (site.contractRateRwf ?? 0) <= 0);

  const openRateModal = (siteId: string) => {
    const site = sites.find((s) => s.id === siteId);
    setRateSiteId(siteId);
    setRateInput(String(site?.contractRateRwf ?? ''));
    setRateModalVisible(true);
  };

  const saveContractRate = async () => {
    const r = parseInt(rateInput, 10);
    if (rateSiteId != null && !isNaN(r) && r >= 0) {
      await updateSite(rateSiteId, { contractRateRwf: r });
      setRateModalVisible(false);
      setRateSiteId(null);
    }
  };

  return (
    <View style={styles.screen}>
      <Header
        title={t('dashboard_owner_title')}
        subtitle={t('dashboard_owner_subtitle')}
        rightAction={
          sites.length > 0 && hasUnsetContractRates ? (
            <TouchableOpacity
              onPress={() => {
                setRateSiteId(null);
                setRateInput('');
                setRateModalVisible(true);
              }}
              style={ownerStyles.headerBtn}
            >
              <Settings size={18} color="#fff" />
              <Text style={ownerStyles.headerBtnText}>{t('dashboard_set_contract_rate')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <DashboardLayout>
        {/* Date filter */}
        <View style={ownerStyles.section}>
          <Text style={ownerStyles.sectionLabel}>{t('dashboard_filter_date')}</Text>
          <View style={ownerStyles.dateRow}>
            <View style={ownerStyles.flex1}>
              <DatePickerField
                label={t('dashboard_from')}
                value={dateFrom}
                onValueChange={setDateFrom}
                placeholder={t('dashboard_start_date')}
              />
            </View>
            <View style={ownerStyles.flex1}>
              <DatePickerField
                label={t('dashboard_to')}
                value={dateTo}
                onValueChange={setDateTo}
                placeholder={t('dashboard_end_date')}
              />
            </View>
          </View>
        </View>

        {/* Quick actions */}
        {onNavigateTab && (
          <Card style={ownerStyles.quickCard}>
            <Text style={ownerStyles.quickTitle}>{t('dashboard_quick_actions')}</Text>
            <View style={ownerStyles.quickRow}>
              <TouchableOpacity onPress={() => onNavigateTab('reports')} style={[ownerStyles.quickBtn, { backgroundColor: '#dbeafe' }]}>
                <FileText size={18} color="#2563eb" />
                <Text style={ownerStyles.quickBtnTextBlue}>{t('dashboard_generate_report')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('sites')} style={[ownerStyles.quickBtn, { backgroundColor: '#d1fae5' }]}>
                <Building2 size={18} color="#059669" />
                <Text style={ownerStyles.quickBtnTextGreen}>{t('dashboard_all_sites')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onNavigateTab('users')} style={[ownerStyles.quickBtn, { backgroundColor: '#ede9fe' }]}>
                <Users size={18} color="#7c3aed" />
                <Text style={ownerStyles.quickBtnTextPurple}>{t('dashboard_user_management')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLanguageModalVisible(true)} style={[ownerStyles.quickBtn, { backgroundColor: '#fef3c7' }]}>
                <Globe size={18} color="#b45309" />
                <Text style={ownerStyles.quickBtnTextAmber}>{t('dashboard_language')}</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        {/* Financial Summary hero – Total Budget = sum of site budgets (set in Sites) */}
        <Card style={ownerStyles.heroCard}>
          <View style={ownerStyles.heroContent}>
            <Text style={ownerStyles.heroLabel}>{t('dashboard_total_investment')}</Text>
            <Text style={ownerStyles.heroHint}>{t('dashboard_total_budget_hint')}</Text>
            <Text style={ownerStyles.heroValue}>{formatAmount(totalBudget, true)}</Text>
            <View style={ownerStyles.heroRow}>
              <View>
                <Text style={ownerStyles.heroSmall}>{t('dashboard_spent')}</Text>
                <Text style={ownerStyles.heroNum}>{formatAmount(totalSpent, true)}</Text>
              </View>
              <View>
                <Text style={ownerStyles.heroSmall}>{t('dashboard_remaining')}</Text>
                <Text style={ownerStyles.heroNum}>{formatAmount(remaining, true)}</Text>
              </View>
              <View>
                <Text style={ownerStyles.heroSmall}>{t('dashboard_utilization')}</Text>
                <Text style={ownerStyles.heroNum}>{(utilizationRate ?? 0).toFixed(0)}%</Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Metric cards: flexBasis 48%, space-between */}
        <View style={ownerStyles.metricRow}>
          <Card style={ownerStyles.metricCard}>
            <View style={ownerStyles.metricContent}>
              <TrendingUp size={24} color="#10B981" />
              <Text style={ownerStyles.metricValue}>{formatAmount(revenue, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_revenue')}</Text>
            </View>
          </Card>
          <Card style={ownerStyles.metricCard}>
            <View style={ownerStyles.metricContent}>
              <Banknote size={24} color="#8B5CF6" />
              <Text style={ownerStyles.metricValue}>{formatAmount(totalCost, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_total_cost')}</Text>
            </View>
          </Card>
          <Card style={[ownerStyles.metricCard, profit >= 0 ? ownerStyles.metricCardGreen : ownerStyles.metricCardRed]}>
            <View style={ownerStyles.metricContent}>
              <PieChart size={24} color={profit >= 0 ? '#059669' : '#DC2626'} />
              <Text style={[ownerStyles.metricValue, profit < 0 && ownerStyles.metricValueNegative]}>{formatAmount(profit, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_profit')}</Text>
            </View>
          </Card>
        </View>

        {sites.length > 0 && (
          <Card style={ownerStyles.contractCard}>
            <Text style={ownerStyles.contractLabel}>{t('dashboard_contract_rate_per_site')}</Text>
            {sites.map((site) => (
              <TouchableOpacity
                key={site.id}
                onPress={() => openRateModal(site.id)}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingVertical: 8,
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                }}
              >
                <Text style={ownerStyles.contractSiteName}>{site.name}</Text>
                <Text style={ownerStyles.contractValue}>{(site.contractRateRwf ?? 0).toLocaleString()} RWF/m³</Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {sites.length > 0 ? (
          <>
            <View style={ownerStyles.metricRow}>
              <Card style={ownerStyles.metricCard}>
                <View style={ownerStyles.metricContent}>
                  <TrendingUp size={28} color="#10B981" />
                  <Text style={ownerStyles.metricValueLarge}>{sites.filter((s) => s.status === 'active').length}</Text>
                  <Text style={ownerStyles.metricLabel}>{t('dashboard_active_sites')}</Text>
                </View>
              </Card>
              <Card style={ownerStyles.metricCard}>
                <View style={ownerStyles.metricContent}>
                  <PieChart size={28} color="#8B5CF6" />
                  <Text style={ownerStyles.metricValueLarge}>
                    {sites.length ? (sites.reduce((sum, s) => sum + s.progress, 0) / sites.length).toFixed(0) : 0}%
                  </Text>
                  <Text style={ownerStyles.metricLabel}>{t('dashboard_avg_progress')}</Text>
                </View>
              </Card>
            </View>

            <View style={ownerStyles.section}>
              <Text style={ownerStyles.sectionTitle}>{t('dashboard_site_performance')}</Text>
              {sites.map((site) => (
                <SiteCard key={site.id} site={site} />
              ))}
            </View>
          </>
        ) : (
          <Card style={ownerStyles.contractCard}>
            <Text style={ownerStyles.contractLabel}>{t('sites_loading')}</Text>
          </Card>
        )}
      </DashboardLayout>

      <Modal visible={rateModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={modalStyles.overlayCenter}>
            <Pressable onPress={(e) => e.stopPropagation()} style={modalStyles.sheetCenter}>
              <KeyboardAvoidingView behavior="padding">
                <Text style={modalStyles.title}>
                  {rateSiteId ? `${t('owner_contract_rate_for_site')}: ${sites.find((s) => s.id === rateSiteId)?.name ?? ''}` : t('owner_contract_rate_title')}
                </Text>
                {!rateSiteId && (
                  <>
                    <Text style={modalStyles.label}>{t('owner_contract_rate_select_site')}</Text>
                    {sites.map((site) => (
                      <TouchableOpacity
                        key={site.id}
                        onPress={() => {
                          setRateSiteId(site.id);
                          setRateInput(String(site.contractRateRwf ?? ''));
                        }}
                        style={{ paddingVertical: 8 }}
                      >
                        <Text style={ownerStyles.contractSiteName}>{site.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                <Text style={[modalStyles.label, { marginTop: 12 }]}>{t('owner_contract_rate_placeholder')}</Text>
                <TextInput
                  value={rateInput}
                  onChangeText={setRateInput}
                  onFocus={() => { if (rateInput === '0') setRateInput(''); }}
                  placeholder="e.g. 500"
                  keyboardType="number-pad"
                  style={modalStyles.input}
                  placeholderTextColor={colors.placeholder}
                />
                {rateSiteId && (
                  <TouchableOpacity
                    onPress={async () => {
                      if (rateSiteId) {
                        await updateSite(rateSiteId, { contractRateRwf: null });
                        setRateInput('');
                      }
                    }}
                    style={{ marginTop: 8 }}
                  >
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {t('owner_contract_rate_reset')}
                    </Text>
                  </TouchableOpacity>
                )}
                <View style={modalStyles.footer}>
                  <TouchableOpacity onPress={() => setRateModalVisible(false)} style={[modalStyles.btn, modalStyles.btnSecondary]}>
                    <Text style={modalStyles.btnTextSecondary}>{t('common_cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={saveContractRate}
                    disabled={rateSiteId == null || rateInput.trim() === '' || isNaN(parseInt(rateInput, 10)) || parseInt(rateInput, 10) < 0}
                    style={[
                      modalStyles.btn,
                      {
                        backgroundColor:
                          rateSiteId == null || rateInput.trim() === '' || isNaN(parseInt(rateInput, 10)) || parseInt(rateInput, 10) < 0
                            ? colors.border
                            : colors.primary,
                      },
                    ]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 15 }}>{t('common_save')}</Text>
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal visible={languageModalVisible} transparent animationType="fade">
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={ownerStyles.modalOverlay}>
            <Pressable onPress={(e) => e.stopPropagation()} style={ownerStyles.modalSheetCenter}>
              <Text style={modalStyles.title}>{t('settings_language')}</Text>
              <TouchableOpacity
                onPress={() => { setLocale('en'); setLanguageModalVisible(false); }}
                style={[ownerStyles.langBtn, locale === 'en' && ownerStyles.langBtnActive]}
              >
                <Text style={locale === 'en' ? ownerStyles.langBtnTextActive : ownerStyles.langBtnText}>{t('settings_language_english')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { setLocale('rn'); setLanguageModalVisible(false); }}
                style={[ownerStyles.langBtn, locale === 'rn' && ownerStyles.langBtnActive]}
              >
                <Text style={locale === 'rn' ? ownerStyles.langBtnTextActive : ownerStyles.langBtnText}>{t('settings_language_kinyarwanda')}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLanguageModalVisible(false)} style={ownerStyles.langCancel}>
                <Text style={ownerStyles.langCancelText}>{t('common_cancel')}</Text>
              </TouchableOpacity>
            </Pressable>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
});

const ownerStyles = StyleSheet.create({
  headerBtn: { backgroundColor: colors.primary, borderRadius: layout.cardRadius, paddingHorizontal: layout.cardPadding, paddingVertical: layout.grid, flexDirection: 'row', alignItems: 'center' },
  headerBtnText: { color: '#fff', fontWeight: '600', marginLeft: 4 },
  section: { marginBottom: layout.cardSpacingVertical },
  sectionLabel: { fontSize: form.labelFontSize, color: colors.textSecondary, marginBottom: layout.grid },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  dateRow: { flexDirection: 'row', gap: layout.grid },
  flex1: { flex: 1 },
  quickCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.gray100 },
  quickTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: layout.grid },
  quickBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: form.inputRadius },
  quickBtnTextBlue: { color: '#1e40af', fontWeight: '500', marginLeft: 8 },
  quickBtnTextGreen: { color: '#166534', fontWeight: '500', marginLeft: 8 },
  quickBtnTextPurple: { color: '#5b21b6', fontWeight: '500', marginLeft: 8 },
  quickBtnTextAmber: { color: '#92400e', fontWeight: '500', marginLeft: 8 },
  heroCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.blue600 },
  heroContent: { paddingVertical: layout.grid },
  heroLabel: { color: 'rgba(255,255,255,0.9)', fontSize: 14, marginBottom: 2 },
  heroHint: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginBottom: layout.grid },
  heroValue: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: layout.cardPadding },
  heroRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: layout.grid, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.3)' },
  heroSmall: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  heroNum: { color: '#fff', fontSize: 18, fontWeight: '600' },
  metricRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: layout.cardSpacingVertical },
  metricCard: { flexBasis: '48%', marginBottom: layout.cardSpacingVertical },
  metricCardGreen: { backgroundColor: '#ecfdf5' },
  metricCardRed: { backgroundColor: '#fef2f2' },
  metricContent: { alignItems: 'center', paddingVertical: layout.grid },
  metricValue: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 4 },
  metricValueLarge: { fontSize: 20, fontWeight: '700', color: colors.text, marginTop: 8 },
  metricValueNegative: { color: '#b91c1c' },
  metricLabel: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  contractCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.gray100 },
  contractLabel: { fontSize: 14, color: colors.textSecondary },
  contractSiteName: { fontSize: 14, fontWeight: '600', color: colors.text },
  contractValue: { fontSize: 20, fontWeight: '700', color: colors.text },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', paddingHorizontal: layout.cardPadding },
  modalKAV: { width: '100%' },
  modalSheet: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, padding: layout.cardPadding, maxHeight: '80%' },
  modalSheetCenter: { backgroundColor: colors.surface, borderRadius: layout.cardRadius, padding: layout.cardPadding },
  btnPrimaryText: { color: '#fff', fontWeight: '600' },
  langBtn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: form.inputRadius, marginBottom: 8, backgroundColor: colors.gray100 },
  langBtnActive: { backgroundColor: colors.primary },
  langBtnText: { color: colors.text, fontWeight: '600' },
  langBtnTextActive: { color: '#fff', fontWeight: '600' },
  langCancel: { marginTop: 16, paddingVertical: 8, alignItems: 'center' },
  langCancelText: { color: colors.textSecondary, fontWeight: '500' },
});
