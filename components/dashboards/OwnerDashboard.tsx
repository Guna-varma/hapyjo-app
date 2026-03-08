import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, TouchableWithoutFeedback, Keyboard, Pressable, StyleSheet, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { Card } from '@/components/ui/Card';
import { SiteCard } from '@/components/sites/SiteCard';
import { Header } from '@/components/ui/Header';
import { DashboardLayout } from '@/components/ui/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useMockAppStore } from '@/context/MockAppStoreContext';
import { formatAmount } from '@/lib/currency';
import type { DashboardNavProps } from '@/components/RoleBasedDashboard';
import { useLocale } from '@/context/LocaleContext';
import { canAccessTab } from '@/lib/rbac';
import { TrendingUp, Banknote, PieChart, Plus, FileText, Building2, Users, Globe, BarChart3, Truck, ClipboardCheck } from 'lucide-react-native';
import { DailyProductionChart } from '@/components/charts/DailyProductionChart';
import { colors, layout, form, radius } from '@/theme/tokens';
import { modalStyles } from '@/components/ui/modalStyles';
import { SiteTasksScreen } from '@/components/screens/SiteTasksScreen';
import { buildFinancialSummary } from '@/lib/financeSummary';

export function OwnerDashboard({ onNavigateTab }: DashboardNavProps) {
  const { t, locale, setLocale } = useLocale();
  const { user } = useAuth();
  const { sites, surveys, expenses, trips, machineSessions, assignedTrips, updateSite } = useMockAppStore();
  const ownerName = user?.name?.trim() || 'Owner';
  const [rateModalVisible, setRateModalVisible] = useState(false);
  const [rateSiteId, setRateSiteId] = useState<string | null>(null);
  const [rateInput, setRateInput] = useState('');
  const [rateSaving, setRateSaving] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [dateFrom] = useState('');
  const [dateTo] = useState('');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [tasksSiteId, setTasksSiteId] = useState<string | null>(null);

  const inRange = useMemo(() => {
    if (!dateFrom && !dateTo) return () => true;
    return (iso: string) => {
      const d = iso.slice(0, 10);
      if (dateFrom && d < dateFrom) return false;
      if (dateTo && d > dateTo) return false;
      return true;
    };
  }, [dateFrom, dateTo]);

  const productionSurveysInRange = useMemo(
    () => surveys.filter((s) => s.status === 'approved' && inRange(s.surveyDate)),
    [surveys, inRange]
  );
  const financialSummary = useMemo(
    () =>
      buildFinancialSummary({
        sites,
        surveys,
        expenses,
        dateRange: { from: dateFrom || undefined, to: dateTo || undefined },
      }),
    [sites, surveys, expenses, dateFrom, dateTo]
  );
  const siteFinancialRows = useMemo(
    () => financialSummary.sites.filter((site) => site.isKnownSite),
    [financialSummary.sites]
  );
  const dailyProductionData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of productionSurveysInRange) {
      const d = s.surveyDate.slice(0, 10);
      byDate.set(d, (byDate.get(d) ?? 0) + s.volumeM3);
    }
    return Array.from(byDate.entries())
      .map(([date, volumeM3]) => ({ date, volumeM3 }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [productionSurveysInRange]);
  const totalExcavationInRange = productionSurveysInRange.reduce((sum, s) => sum + s.volumeM3, 0);
  const topSitesByVolume = useMemo(() => {
    const siteVol: { siteId: string; volumeM3: number }[] = [];
    for (const site of sites) {
      const v = productionSurveysInRange.filter((s) => s.siteId === site.id).reduce((a, s) => a + s.volumeM3, 0);
      siteVol.push({ siteId: site.id, volumeM3: v });
    }
    return siteVol.filter((x) => x.volumeM3 > 0).sort((a, b) => b.volumeM3 - a.volumeM3).slice(0, 5);
  }, [sites, productionSurveysInRange]);
  const totalBudget = financialSummary.totals.totalBudgetRwf;
  const totalSpent = financialSummary.totals.expensesRwf;
  const remaining = financialSummary.totals.remainingBudgetRwf;
  const utilizationRate = financialSummary.totals.utilizationPct;
  const revenue = financialSummary.totals.revenueRwf;
  const totalCost = financialSummary.totals.expensesRwf;
  const totalFuelCost = financialSummary.totals.fuelExpensesRwf;
  const totalGeneralCost = financialSummary.totals.generalExpensesRwf;
  const profit = financialSummary.totals.profitRwf;

  const openRateModal = (siteId?: string) => {
    setRateError(null);
    if (siteId) {
      const site = sites.find((s) => s.id === siteId);
      setRateSiteId(siteId);
      setRateInput(String(site?.contractRateRwf ?? ''));
    } else {
      setRateSiteId(null);
      setRateInput('');
    }
    setRateModalVisible(true);
  };

  const closeRateModal = () => {
    if (!rateSaving) {
      setRateModalVisible(false);
      setRateSiteId(null);
      setRateInput('');
      setRateError(null);
    }
  };

  const saveContractRate = async () => {
    const r = parseInt(rateInput.trim(), 10);
    if (rateSiteId == null || isNaN(r) || r < 0) return;
    setRateError(null);
    setRateSaving(true);
    try {
      await updateSite(rateSiteId, { contractRateRwf: r });
      closeRateModal();
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      const isPermission = /policy|permission|row-level security|RLS|403/i.test(raw);
      const message = isPermission
        ? t('owner_contract_rate_save_failed') + ' ' + (t('owner_contract_rate_check_db') || 'Check that the database allows Owner to update sites.')
        : (raw || t('owner_contract_rate_save_failed'));
      setRateError(message);
    } finally {
      setRateSaving(false);
    }
  };

  const selectedSite = tasksSiteId ? sites.find((s) => s.id === tasksSiteId) ?? null : null;

  if (selectedSite) {
    return (
      <SiteTasksScreen
        initialSiteId={selectedSite.id}
        readOnly
        onBack={() => setTasksSiteId(null)}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <Header
        variant="dashboard"
        title={t('dashboard_owner_heading')}
        subtitle={t('dashboard_welcome_owner').replace('{name}', ownerName)}
        rightAction={
          sites.length > 0 ? (
            <TouchableOpacity
              onPress={() => openRateModal()}
              style={ownerStyles.headerBtn}
              activeOpacity={0.85}
            >
              <Plus size={20} color="#fff" style={{ marginRight: 6 }} />
              <Text style={ownerStyles.headerBtnText} numberOfLines={1}>{t('dashboard_set_contract_rate')}</Text>
            </TouchableOpacity>
          ) : null
        }
      />
      <DashboardLayout>
        {/* Quick actions – only navigate to tabs this role can access (Owner has no Sites tab) */}
        {onNavigateTab && user && (
          <Card style={[ownerStyles.quickCard, ownerStyles.cardSoft]}>
            <Text style={ownerStyles.quickTitle}>{t('dashboard_quick_actions')}</Text>
            <View style={ownerStyles.quickRow}>
              {canAccessTab(user.role, 'reports') && (
                <TouchableOpacity onPress={() => onNavigateTab('reports')} style={[ownerStyles.quickBtn, { backgroundColor: '#dbeafe' }]}>
                  <FileText size={18} color="#2563eb" />
                  <Text style={ownerStyles.quickBtnTextBlue}>{t('dashboard_generate_report')}</Text>
                </TouchableOpacity>
              )}
              {canAccessTab(user.role, 'sites') ? (
                <TouchableOpacity onPress={() => onNavigateTab('sites')} style={[ownerStyles.quickBtn, { backgroundColor: '#d1fae5' }]}>
                  <Building2 size={18} color="#059669" />
                  <Text style={ownerStyles.quickBtnTextGreen}>{t('dashboard_all_sites')}</Text>
                </TouchableOpacity>
              ) : canAccessTab(user.role, 'surveys') ? (
                <TouchableOpacity onPress={() => onNavigateTab('surveys')} style={[ownerStyles.quickBtn, { backgroundColor: '#d1fae5' }]}>
                  <ClipboardCheck size={18} color="#059669" />
                  <Text style={ownerStyles.quickBtnTextGreen}>{t('tab_surveys')}</Text>
                </TouchableOpacity>
              ) : null}
              {canAccessTab(user.role, 'users') && (
                <TouchableOpacity onPress={() => onNavigateTab('users')} style={[ownerStyles.quickBtn, { backgroundColor: '#ede9fe' }]}>
                  <Users size={18} color="#7c3aed" />
                  <Text style={ownerStyles.quickBtnTextPurple}>{t('dashboard_user_management')}</Text>
                </TouchableOpacity>
              )}
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
          <Card style={[ownerStyles.metricCard, ownerStyles.cardSoft]}>
            <View style={ownerStyles.metricContent}>
              <TrendingUp size={24} color="#10B981" />
              <Text style={ownerStyles.metricValue}>{formatAmount(revenue, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_revenue')}</Text>
            </View>
          </Card>
          <Card style={[ownerStyles.metricCard, ownerStyles.cardSoft]}>
            <View style={ownerStyles.metricContent}>
              <Banknote size={24} color="#8B5CF6" />
              <Text style={ownerStyles.metricValue}>{formatAmount(totalCost, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_total_cost')}</Text>
            </View>
          </Card>
          <Card style={[ownerStyles.metricCard, ownerStyles.cardSoft, profit >= 0 ? ownerStyles.metricCardGreen : ownerStyles.metricCardRed]}>
            <View style={ownerStyles.metricContent}>
              <PieChart size={24} color={profit >= 0 ? '#059669' : '#DC2626'} />
              <Text style={[ownerStyles.metricValue, profit < 0 && ownerStyles.metricValueNegative]}>{formatAmount(profit, true)}</Text>
              <Text style={ownerStyles.metricLabel}>{t('dashboard_profit')}</Text>
            </View>
          </Card>
        </View>

        {/* Excavation production – clear hierarchy, visible labels, soft card */}
        <View style={ownerStyles.productionSection}>
          <View style={ownerStyles.productionTitleRow}>
            <BarChart3 size={22} color={colors.primary} style={{ marginRight: 8 }} />
            <Text style={ownerStyles.productionTitle}>{t('dashboard_excavation_production')}</Text>
          </View>
          <Text style={ownerStyles.productionTotalLabel}>{t('dashboard_total_excavation_period')}</Text>
          <Text style={ownerStyles.productionTotalValue}>{totalExcavationInRange.toLocaleString('en-US', { maximumFractionDigits: 0 })} m³</Text>

          <View style={ownerStyles.productionDivider} />
          <Text style={ownerStyles.productionSubTitle}>{t('dashboard_daily_production')}</Text>
          <DailyProductionChart
            data={dailyProductionData}
            maxBars={14}
            emptyMessage={t('dashboard_no_production_data')}
            onPressDate={onNavigateTab ? (date) => onNavigateTab('surveys', { filterByDate: date }) : undefined}
          />

          {topSitesByVolume.length > 0 && (
            <>
              <View style={ownerStyles.productionDivider} />
              <Text style={ownerStyles.productionSubTitle}>{t('dashboard_top_sites_volume')}</Text>
              {topSitesByVolume.map(({ siteId, volumeM3 }) => {
                const site = sites.find((s) => s.id === siteId);
                const pct = totalExcavationInRange > 0 ? (volumeM3 / totalExcavationInRange) * 100 : 0;
                return (
                  <View key={siteId} style={ownerStyles.productionSiteRow}>
                    <Text style={ownerStyles.productionSiteName} numberOfLines={1}>{site?.name ?? siteId}</Text>
                    <View style={ownerStyles.productionBarWrap}>
                      <View style={[ownerStyles.productionBarFill, { width: `${pct}%` }]} />
                    </View>
                    <Text style={ownerStyles.productionSiteValue}>{volumeM3.toLocaleString('en-US', { maximumFractionDigits: 0 })} m³</Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {sites.length > 0 && (
          <Card style={[ownerStyles.contractCard, ownerStyles.cardSoft]}>
            <Text style={ownerStyles.contractLabel}>{t('dashboard_contract_rate_per_site')}</Text>
            {sites.map((site) => (
              <TouchableOpacity
                key={site.id}
                onPress={() => openRateModal(site.id)}
                style={ownerStyles.contractRow}
                activeOpacity={0.7}
              >
                <Text style={ownerStyles.contractSiteName}>{site.name}</Text>
                <Text style={ownerStyles.contractValue}>
                  {(site.contractRateRwf ?? 0) > 0 ? `${(site.contractRateRwf ?? 0).toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}
                </Text>
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {siteFinancialRows.length > 0 && (
          <Card style={[ownerStyles.financeCard, ownerStyles.cardSoft]}>
            <Text style={ownerStyles.sectionTitle}>{t('dashboard_allocation_per_site')}</Text>
            <View style={ownerStyles.financeTotalsRow}>
              <View style={ownerStyles.financeTotalsPill}>
                <Text style={ownerStyles.financeTotalsLabel}>{t('reports_total_expenses')}</Text>
                <Text style={ownerStyles.financeTotalsValue}>{formatAmount(totalCost, true)}</Text>
              </View>
              <View style={ownerStyles.financeTotalsPill}>
                <Text style={ownerStyles.financeTotalsLabel}>{t('expenses_category_fuel')}</Text>
                <Text style={ownerStyles.financeTotalsValue}>{formatAmount(totalFuelCost, true)}</Text>
              </View>
              <View style={ownerStyles.financeTotalsPill}>
                <Text style={ownerStyles.financeTotalsLabel}>{t('reports_expense_general')}</Text>
                <Text style={ownerStyles.financeTotalsValue}>{formatAmount(totalGeneralCost, true)}</Text>
              </View>
            </View>
            {siteFinancialRows.map((site) => (
              <View key={site.siteId} style={ownerStyles.financeSiteRow}>
                <View style={ownerStyles.financeSiteHeader}>
                  <View style={ownerStyles.financeSiteHeaderLeft}>
                    <Text style={ownerStyles.financeSiteName}>{site.siteName}</Text>
                    <Text style={ownerStyles.financeSiteLocation}>{site.location}</Text>
                  </View>
                  <View style={ownerStyles.financeProfitWrap}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('dashboard_profit')}</Text>
                    <Text style={[ownerStyles.financeSiteProfit, site.profitRwf < 0 && ownerStyles.financeSiteProfitNegative]}>
                      {formatAmount(site.profitRwf, true)}
                    </Text>
                  </View>
                </View>
                <View style={ownerStyles.financeGrid}>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('dashboard_work_volume_approved')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>{site.approvedVolumeM3.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m³</Text>
                  </View>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('reports_contract_rate_rwf_m3')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>
                      {site.contractRateRwf > 0 ? `${site.contractRateRwf.toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}
                    </Text>
                  </View>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('dashboard_revenue')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>{formatAmount(site.revenueRwf, true)}</Text>
                  </View>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('reports_total_expenses')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>{formatAmount(site.expensesRwf, true)}</Text>
                  </View>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('expenses_category_fuel')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>{formatAmount(site.fuelExpensesRwf, true)}</Text>
                  </View>
                  <View style={ownerStyles.financeGridItem}>
                    <Text style={ownerStyles.financeMetricLabel}>{t('site_card_progress')}</Text>
                    <Text style={ownerStyles.financeMetricValue}>{site.progressPct.toFixed(0)}%</Text>
                  </View>
                </View>
              </View>
            ))}
          </Card>
        )}

        {/* Fleet & trips – approved by assistant supervisor */}
        {(() => {
          const approvedTrips = assignedTrips.filter((a) => a.status === 'TRIP_COMPLETED');
          const approvedTasks = assignedTrips.filter((a) => a.status === 'TASK_COMPLETED');
          const completedTripsInRange = trips.filter((tr) => tr.status === 'completed' && inRange(tr.endTime ?? tr.startTime));
          const completedSessionsInRange = machineSessions.filter((m) => m.status === 'completed' && inRange(m.endTime ?? m.startTime));
          const totalFuel = completedTripsInRange.reduce((s, tr) => s + (tr.fuelConsumed ?? 0), 0) + completedSessionsInRange.reduce((s, m) => s + (m.fuelConsumed ?? 0), 0);
          const totalDistance = completedTripsInRange.reduce((s, tr) => s + (tr.distanceKm ?? 0), 0);
          const totalHours = completedSessionsInRange.reduce((s, m) => s + (m.durationHours ?? 0), 0);
          const hasFleet = approvedTrips.length > 0 || approvedTasks.length > 0;
          if (!hasFleet) return null;
          return (
            <Card style={[ownerStyles.contractCard, ownerStyles.cardSoft]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Truck size={20} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={ownerStyles.contractLabel}>{t('dashboard_fleet_trips_title')}</Text>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 8 }}>
                <Text style={ownerStyles.contractValue}>{t('dashboard_fleet_total_fuel')}: {totalFuel.toFixed(1)} L</Text>
                <Text style={ownerStyles.contractValue}>{t('dashboard_fleet_total_distance')}: {totalDistance.toFixed(0)} km</Text>
                <Text style={ownerStyles.contractValue}>{t('dashboard_fleet_total_hours')}: {totalHours.toFixed(1)} h</Text>
              </View>
              <Text style={[ownerStyles.contractSiteName, { fontSize: 12, color: colors.textSecondary }]}>{t('dashboard_fleet_approved_by_as')}</Text>
            </Card>
          );
        })()}

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
                    <SiteCard key={site.id} site={site} onPress={() => setTasksSiteId(site.id)} />
              ))}
            </View>
          </>
        ) : (
          <Card style={[ownerStyles.contractCard, ownerStyles.cardSoft]}>
            <Text style={ownerStyles.contractLabel}>{t('sites_loading')}</Text>
          </Card>
        )}
      </DashboardLayout>

      <Modal visible={rateModalVisible} transparent animationType="fade" statusBarTranslucent>
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={ownerStyles.rateModalOverlay}>
            <Pressable onPress={(e) => e.stopPropagation()} style={ownerStyles.rateModalSheet}>
              <KeyboardAvoidingView behavior="padding" style={ownerStyles.rateModalKAV}>
                <View style={ownerStyles.rateModalHeader}>
                  <Text style={ownerStyles.rateModalTitle}>{t('owner_contract_rate_title')}</Text>
                  <Text style={ownerStyles.rateModalSubtitle}>{t('owner_contract_rate_subtitle')}</Text>
                </View>

                {rateError ? (
                  <View style={ownerStyles.rateErrorBanner}>
                    <Text style={ownerStyles.rateErrorText}>{rateError}</Text>
                  </View>
                ) : null}

                <ScrollView
                  style={ownerStyles.rateModalScroll}
                  contentContainerStyle={ownerStyles.rateModalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={true}
                >
                  <Text style={ownerStyles.rateStepLabel}>{t('owner_contract_rate_select_site')}</Text>
                  <View style={ownerStyles.rateSiteGrid}>
                    {sites.map((site) => {
                      const isSelected = rateSiteId === site.id;
                      const currentRate = site.contractRateRwf ?? 0;
                      return (
                        <Pressable
                          key={site.id}
                          onPress={() => {
                            setRateSiteId(site.id);
                            setRateInput(currentRate ? String(currentRate) : '');
                            setRateError(null);
                          }}
                          style={[ownerStyles.rateSiteCard, isSelected && ownerStyles.rateSiteCardSelected]}
                        >
                          <Text style={[ownerStyles.rateSiteCardName, isSelected && ownerStyles.rateSiteCardNameSelected]} numberOfLines={1}>{site.name}</Text>
                          <Text style={ownerStyles.rateSiteCardRate}>
                            {currentRate > 0 ? `${currentRate.toLocaleString()} RWF/m³` : t('owner_contract_rate_not_set')}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {rateSiteId ? (
                    <>
                      <Text style={[ownerStyles.rateStepLabel, { marginTop: 20 }]}>{t('owner_contract_rate_placeholder')}</Text>
                      <View style={ownerStyles.rateInputWrap}>
                        <TextInput
                          value={rateInput}
                          onChangeText={(v) => { setRateInput(v.replace(/[^0-9]/g, '')); setRateError(null); }}
                          onFocus={() => { if (rateInput === '0') setRateInput(''); }}
                          placeholder="e.g. 500"
                          placeholderTextColor={colors.placeholder}
                          keyboardType="number-pad"
                          editable={!rateSaving}
                          style={ownerStyles.rateInput}
                        />
                        <Text style={ownerStyles.rateInputSuffix}>RWF / m³</Text>
                      </View>
                    </>
                  ) : (
                    <Text style={ownerStyles.rateHint}>{t('owner_contract_rate_select_first')}</Text>
                  )}
                </ScrollView>

                <View style={ownerStyles.rateModalFooter}>
                  <View style={ownerStyles.rateModalFooterLeft}>
                    {rateSiteId ? (
                      <TouchableOpacity
                        onPress={async () => {
                          if (rateSiteId && !rateSaving) {
                            setRateSaving(true);
                            try {
                              await updateSite(rateSiteId, { contractRateRwf: null });
                              setRateInput('');
                              setRateError(null);
                            } catch {
                              setRateError(t('owner_contract_rate_save_failed'));
                            } finally {
                              setRateSaving(false);
                            }
                          }
                        }}
                        disabled={rateSaving}
                        style={ownerStyles.rateClearInFooter}
                        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      >
                        <Text style={ownerStyles.rateClearInFooterText}>{t('owner_contract_rate_reset')}</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <View style={ownerStyles.rateModalFooterRight}>
                    <TouchableOpacity onPress={closeRateModal} disabled={rateSaving} style={[ownerStyles.rateModalBtn, ownerStyles.rateModalBtnCancel]}>
                      <Text style={ownerStyles.rateModalBtnCancelText}>{t('common_cancel')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={saveContractRate}
                      disabled={rateSiteId == null || rateInput.trim() === '' || isNaN(parseInt(rateInput.trim(), 10)) || parseInt(rateInput.trim(), 10) < 0 || rateSaving}
                      style={[ownerStyles.rateModalBtn, ownerStyles.rateModalBtnSave, (rateSiteId == null || rateInput.trim() === '' || rateSaving) && ownerStyles.rateModalBtnSaveDisabled]}
                    >
                      {rateSaving ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={ownerStyles.rateModalBtnSaveText}>{t('common_save')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
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

const headerButtonShadow = Platform.select({
  web: { boxShadow: '0 4px 8px rgba(37,99,235,0.25)' as const },
  default: {
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
})!;

const cardSoftShadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(15,23,42,0.04)' as const },
  default: { shadowOpacity: 0.04, elevation: 1 },
})!;

const modalSheetShadow = Platform.select({
  web: { boxShadow: '0 8px 24px rgba(0,0,0,0.15)' as const },
  default: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
})!;

const ownerStyles = StyleSheet.create({
  headerBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    ...headerButtonShadow,
  },
  headerBtnText: { color: '#fff', fontWeight: '700', fontSize: 15, letterSpacing: 0.2 },
  section: { marginBottom: layout.cardSpacingVertical },
  sectionLabel: { fontSize: form.labelFontSize, color: colors.textSecondary, marginBottom: layout.grid },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: layout.grid },
  dateRow: { flexDirection: 'row', gap: layout.grid },
  flex1: { flex: 1 },
  cardSoft: { borderColor: colors.gray200, ...cardSoftShadow },
  quickCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.gray50 },
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
  contractCard: { marginBottom: layout.cardSpacingVertical, backgroundColor: colors.gray50 },
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
  // Excavation production: soft card, clear hierarchy, visible labels
  productionSection: {
    marginBottom: layout.cardSpacingVertical,
    backgroundColor: colors.surface,
    borderRadius: layout.cardRadius,
    padding: layout.cardPadding + 4,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  productionTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  productionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  productionTotalLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
  productionTotalValue: { fontSize: 28, fontWeight: '700', color: colors.text, marginBottom: 4, letterSpacing: 0.5 },
  productionDivider: { height: 1, backgroundColor: colors.border, marginVertical: 14 },
  productionSubTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 8 },
  productionSiteRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  productionSiteName: { flex: 1, fontSize: 14, color: colors.text, fontWeight: '500' },
  productionBarWrap: { flex: 1, height: 10, backgroundColor: colors.gray100, borderRadius: 5, overflow: 'hidden', marginHorizontal: 10 },
  productionBarFill: { height: '100%', backgroundColor: colors.primary, borderRadius: 5 },
  productionSiteValue: { width: 64, fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'right' },
  contractRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  financeCard: {
    marginBottom: layout.cardSpacingVertical,
    backgroundColor: colors.gray50,
  },
  financeTotalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  financeTotalsPill: {
    flexGrow: 1,
    minWidth: 100,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  financeTotalsLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  financeTotalsValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '700',
  },
  financeSiteRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  financeSiteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  financeSiteHeaderLeft: {
    flex: 1,
    paddingRight: 8,
  },
  financeSiteName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  financeSiteLocation: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  financeProfitWrap: {
    alignItems: 'flex-end',
  },
  financeSiteProfit: {
    fontSize: 16,
    fontWeight: '700',
    color: '#059669',
  },
  financeSiteProfitNegative: {
    color: '#dc2626',
  },
  financeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 10,
    justifyContent: 'space-between',
  },
  financeGridItem: {
    width: '48%',
  },
  financeMetricLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  financeMetricValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: '600',
  },
  // Contract rate modal – lavish UI
  rateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
  },
  rateModalSheet: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    maxHeight: '90%',
    flex: 1,
    minHeight: 320,
    overflow: 'hidden',
    ...modalSheetShadow,
  },
  rateModalKAV: { flex: 1, maxHeight: '100%' },
  rateModalHeader: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.border },
  rateModalTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 2 },
  rateModalSubtitle: { fontSize: 13, color: colors.textSecondary },
  rateErrorBanner: { marginHorizontal: 24, marginTop: 12, padding: 12, backgroundColor: colors.dangerBg, borderRadius: radius.md },
  rateErrorText: { fontSize: 13, color: colors.dangerText, fontWeight: '500' },
  rateModalScroll: { flex: 1, paddingHorizontal: 24, paddingTop: 16 },
  rateModalScrollContent: { paddingBottom: 24 },
  rateStepLabel: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 10 },
  rateSiteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  rateSiteCard: {
    minWidth: '47%',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  rateSiteCardSelected: { borderColor: colors.primary, backgroundColor: colors.blue50 },
  rateSiteCardName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 4 },
  rateSiteCardNameSelected: { color: colors.primary },
  rateSiteCardRate: { fontSize: 12, color: colors.textSecondary },
  rateInputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, paddingHorizontal: 16, marginTop: 8 },
  rateInput: { flex: 1, paddingVertical: 16, fontSize: 18, fontWeight: '600', color: colors.text },
  rateInputSuffix: { fontSize: 14, color: colors.textSecondary, marginLeft: 8 },
  rateHint: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  rateModalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    minHeight: 56,
  },
  rateModalFooterLeft: { flex: 1, justifyContent: 'center' },
  rateModalFooterRight: { flexDirection: 'row', gap: 12, flexShrink: 0 },
  rateClearInFooter: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4 },
  rateClearInFooterText: { fontSize: 14, color: colors.textSecondary, fontWeight: '600', textDecorationLine: 'underline' },
  rateModalBtn: { minWidth: 110, minHeight: 48, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rateModalBtnCancel: { borderWidth: 2, borderColor: colors.primary },
  rateModalBtnCancelText: { color: colors.primary, fontWeight: '600', fontSize: 15 },
  rateModalBtnSave: { backgroundColor: colors.primary },
  rateModalBtnSaveDisabled: { backgroundColor: colors.border, opacity: 0.8 },
  rateModalBtnSaveText: { color: '#fff', fontWeight: '600', fontSize: 15 },
});
