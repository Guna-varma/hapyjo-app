import React, { createContext, useContext, useCallback, useMemo, useState, useEffect, useRef } from 'react';
import type {
  Site,
  Vehicle,
  Expense,
  Trip,
  MachineSession,
  Survey,
  Issue,
  SiteAssignment,
  User,
  DriverVehicleAssignment,
  Task,
  Operation,
  Report,
} from '@/types';
import { supabase } from '@/lib/supabase';
import {
  siteFromRow,
  vehicleFromRow,
  expenseFromRow,
  tripFromRow,
  machineSessionFromRow,
  surveyFromRow,
  issueFromRow,
  siteAssignmentFromRow,
  driverVehicleAssignmentFromRow,
  taskFromRow,
  operationFromRow,
  reportFromRow,
  profileFromRow,
  siteToRow,
  vehicleToRow,
  expenseToRow,
  tripToRow,
  machineSessionToRow,
  surveyToRow,
  issueToRow,
  taskToRow,
  operationToRow,
  reportToRow,
  profileToRow,
} from '@/lib/supabaseMappers';
import { useAuth } from '@/context/AuthContext';
import {
  loadOfflineQueue,
  saveOfflineQueue,
  appendToOfflineQueue,
  type QueuedItem,
} from '@/lib/offlineQueue';

export interface MockAppStoreState {
  sites: Site[];
  vehicles: Vehicle[];
  expenses: Expense[];
  trips: Trip[];
  machineSessions: MachineSession[];
  surveys: Survey[];
  issues: Issue[];
  siteAssignments: SiteAssignment[];
  users: User[];
  driverVehicleAssignments: DriverVehicleAssignment[];
  contractRateRwf: number;
  tasks: Task[];
  operations: Operation[];
  reports: Report[];
}

type SetSites = (sites: Site[] | ((prev: Site[]) => Site[])) => void;
type SetVehicles = (v: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
type SetExpenses = (e: Expense[] | ((prev: Expense[]) => Expense[])) => void;
type SetTrips = (t: Trip[] | ((prev: Trip[]) => Trip[])) => void;
type SetMachineSessions = (m: MachineSession[] | ((prev: MachineSession[]) => MachineSession[])) => void;
type SetSurveys = (s: Survey[] | ((prev: Survey[]) => Survey[])) => void;
type SetIssues = (i: Issue[] | ((prev: Issue[]) => Issue[])) => void;
type SetSiteAssignments = (a: SiteAssignment[] | ((prev: SiteAssignment[]) => SiteAssignment[])) => void;
type SetContractRateRwf = (value: number) => void;

export interface MockAppStoreContextValue extends MockAppStoreState {
  loading: boolean;
  setSites: SetSites;
  setVehicles: SetVehicles;
  setExpenses: SetExpenses;
  setTrips: SetTrips;
  setMachineSessions: SetMachineSessions;
  setSurveys: SetSurveys;
  setIssues: SetIssues;
  setSiteAssignments: SetSiteAssignments;
  setContractRateRwf: SetContractRateRwf;

  updateSite: (id: string, patch: Partial<Site>) => Promise<void>;
  addVehicle: (vehicle: Vehicle) => Promise<void>;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>;
  addMachineSession: (session: MachineSession) => Promise<void>;
  updateMachineSession: (id: string, patch: Partial<MachineSession>) => Promise<void>;
  addSurvey: (survey: Survey) => Promise<void>;
  updateSurvey: (id: string, patch: Partial<Survey>) => Promise<void>;
  addIssue: (issue: Issue) => Promise<void>;
  updateIssue: (id: string, patch: Partial<Issue>) => Promise<void>;
  setSiteAssignment: (siteId: string, assignment: Partial<SiteAssignment> & { role: string }) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  createUserByOwner: (params: {
    email: string;
    name: string;
    phone?: string;
    role: import('@/types').UserRole;
    site_id?: string;
  }) => Promise<{ user_id: string; email: string; temporary_password: string }>;
  resetUserPassword: (userId: string) => Promise<{ email: string | undefined; temporary_password: string }>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  refetch: () => Promise<void>;
  addSite: (site: Site) => Promise<void>;
  setDriverVehicleAssignment: (siteId: string, driverId: string, vehicleIds: string[]) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  addReport: (report: Report) => Promise<void>;
}

const defaultContractRate = 500;

const emptyState: MockAppStoreState = {
  sites: [],
  vehicles: [],
  expenses: [],
  trips: [],
  machineSessions: [],
  surveys: [],
  issues: [],
  siteAssignments: [],
  users: [],
  driverVehicleAssignments: [],
  contractRateRwf: defaultContractRate,
  tasks: [],
  operations: [],
  reports: [],
};

const MockAppStoreContext = createContext<MockAppStoreContextValue | null>(null);

function useSupabaseStore(): MockAppStoreContextValue {
  const { user: authUser } = useAuth();
  const [state, setState] = useState<MockAppStoreState>(emptyState);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const refetch = useCallback(async () => {
    if (!authUser) {
      setState(emptyState);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Flush offline queue when we have network (refetch implies we're trying to sync)
      const queue = await loadOfflineQueue();
      let remaining: QueuedItem[] = [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item.type === 'expense') {
          const row = expenseToRow(item.payload as Partial<Expense>);
          const { error } = await supabase.from('expenses').insert(row);
          if (error) remaining.push(item);
        } else {
          const row = tripToRow(item.payload as Partial<Trip>);
          const { error } = await supabase.from('trips').insert(row);
          if (error) remaining.push(item);
        }
      }
      await saveOfflineQueue(remaining);

      const [sitesRes, vehiclesRes, expensesRes, tripsRes, machineSessionsRes, surveysRes, issuesRes, siteAssignmentsRes, driverVehicleAssignmentsRes, tasksRes, operationsRes, reportsRes, profilesRes] = await Promise.all([
        supabase.from('sites').select('*'),
        supabase.from('vehicles').select('*'),
        supabase.from('expenses').select('*'),
        supabase.from('trips').select('*'),
        supabase.from('machine_sessions').select('*'),
        supabase.from('surveys').select('*'),
        supabase.from('issues').select('*'),
        supabase.from('site_assignments').select('*'),
        supabase.from('driver_vehicle_assignments').select('*'),
        supabase.from('tasks').select('*'),
        supabase.from('operations').select('*'),
        supabase.from('reports').select('*'),
        supabase.from('profiles').select('*'),
      ]);

      const sites = (sitesRes.data ?? []).map((r) => siteFromRow(r as Record<string, unknown>));
      const vehicles = (vehiclesRes.data ?? []).map((r) => vehicleFromRow(r as Record<string, unknown>));
      const expenses = (expensesRes.data ?? []).map((r) => expenseFromRow(r as Record<string, unknown>));
      const trips = (tripsRes.data ?? []).map((r) => tripFromRow(r as Record<string, unknown>));
      const machineSessions = (machineSessionsRes.data ?? []).map((r) => machineSessionFromRow(r as Record<string, unknown>));
      const surveys = (surveysRes.data ?? []).map((r) => surveyFromRow(r as Record<string, unknown>));
      const issues = (issuesRes.data ?? []).map((r) => issueFromRow(r as Record<string, unknown>));
      const siteAssignments = (siteAssignmentsRes.data ?? []).map((r) => siteAssignmentFromRow(r as Record<string, unknown>));
      const driverVehicleAssignments = (driverVehicleAssignmentsRes.data ?? []).map((r) => driverVehicleAssignmentFromRow(r as Record<string, unknown>));
      const tasks = (tasksRes.data ?? []).map((r) => taskFromRow(r as Record<string, unknown>));
      const operations = (operationsRes.data ?? []).map((r) => operationFromRow(r as Record<string, unknown>));
      const reports = (reportsRes.data ?? []).map((r) => reportFromRow(r as Record<string, unknown>));
      const users = (profilesRes.data ?? []).map((r) => profileFromRow(r as Record<string, unknown>));
      const userSiteMap = new Map<string, string[]>();
      siteAssignments.forEach((a) => {
        const arr = userSiteMap.get(a.userId) ?? [];
        if (!arr.includes(a.siteId)) arr.push(a.siteId);
        userSiteMap.set(a.userId, arr);
      });
      users.forEach((u) => {
        u.siteAccess = userSiteMap.get(u.id) ?? u.siteAccess ?? [];
      });

      const contractRateRwf = sites.length > 0 && sites[0].contractRateRwf != null ? sites[0].contractRateRwf : defaultContractRate;

      setState({
        sites,
        vehicles,
        expenses,
        trips,
        machineSessions,
        surveys,
        issues,
        siteAssignments,
        users,
        driverVehicleAssignments,
        contractRateRwf,
        tasks,
        operations,
        reports,
      });
    } catch (_e) {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  }, [authUser?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!authUser) return;
    const channel = supabase
      .channel('app-store-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sites' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'machine_sessions' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'surveys' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_assignments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'driver_vehicle_assignments' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'operations' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => refetch())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gps_photos' }, () => refetch())
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [authUser?.id, refetch]);

  const setSites: SetSites = useCallback((arg) => {
    setState((prev) => ({ ...prev, sites: typeof arg === 'function' ? arg(prev.sites) : arg }));
  }, []);
  const setVehicles = useCallback((arg: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => {
    setState((prev) => ({ ...prev, vehicles: typeof arg === 'function' ? arg(prev.vehicles) : arg }));
  }, []);
  const setExpenses = useCallback((arg: Expense[] | ((prev: Expense[]) => Expense[])) => {
    setState((prev) => ({ ...prev, expenses: typeof arg === 'function' ? arg(prev.expenses) : arg }));
  }, []);
  const setTrips = useCallback((arg: Trip[] | ((prev: Trip[]) => Trip[])) => {
    setState((prev) => ({ ...prev, trips: typeof arg === 'function' ? arg(prev.trips) : arg }));
  }, []);
  const setMachineSessions = useCallback((arg: MachineSession[] | ((prev: MachineSession[]) => MachineSession[])) => {
    setState((prev) => ({ ...prev, machineSessions: typeof arg === 'function' ? arg(prev.machineSessions) : arg }));
  }, []);
  const setSurveys = useCallback((arg: Survey[] | ((prev: Survey[]) => Survey[])) => {
    setState((prev) => ({ ...prev, surveys: typeof arg === 'function' ? arg(prev.surveys) : arg }));
  }, []);
  const setIssues = useCallback((arg: Issue[] | ((prev: Issue[]) => Issue[])) => {
    setState((prev) => ({ ...prev, issues: typeof arg === 'function' ? arg(prev.issues) : arg }));
  }, []);
  const setSiteAssignments = useCallback((arg: SiteAssignment[] | ((prev: SiteAssignment[]) => SiteAssignment[])) => {
    setState((prev) => ({ ...prev, siteAssignments: typeof arg === 'function' ? arg(prev.siteAssignments) : arg }));
  }, []);
  const setContractRateRwf = useCallback((value: number) => {
    setState((prev) => {
      const next = { ...prev, contractRateRwf: value };
      if (prev.sites.length > 0) {
        next.sites = prev.sites.map((s, i) => (i === 0 ? { ...s, contractRateRwf: value } : s));
        supabase.from('sites').update({ contract_rate_rwf: value }).eq('id', prev.sites[0].id).then(() => {});
      }
      return next;
    });
  }, []);

  const updateSite = useCallback(async (id: string, patch: Partial<Site>) => {
    const row = siteToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('sites').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addSite = useCallback(async (site: Site) => {
    const row = siteToRow(site);
    const { error } = await supabase.from('sites').insert(row);
    if (error) throw error;
  }, []);

  const addVehicle = useCallback(async (vehicle: Vehicle) => {
    const row = vehicleToRow(vehicle);
    const { error } = await supabase.from('vehicles').insert(row);
    if (error) throw error;
  }, []);

  const updateVehicle = useCallback(async (id: string, patch: Partial<Vehicle>) => {
    const row = vehicleToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('vehicles').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addExpense = useCallback(async (expense: Expense) => {
    const row = expenseToRow(expense);
    const { error } = await supabase.from('expenses').insert(row);
    if (error) {
      await appendToOfflineQueue({ type: 'expense', payload: expense as unknown as Record<string, unknown> });
      setState((prev) => ({ ...prev, expenses: [...prev.expenses, expense] }));
      return;
    }
  }, []);

  const addTrip = useCallback(async (trip: Trip) => {
    const row = tripToRow(trip);
    const { error } = await supabase.from('trips').insert(row);
    if (error) {
      await appendToOfflineQueue({ type: 'trip', payload: trip as unknown as Record<string, unknown> });
      setState((prev) => ({ ...prev, trips: [...prev.trips, trip] }));
      return;
    }
  }, []);

  const updateTrip = useCallback(async (id: string, patch: Partial<Trip>) => {
    const row = tripToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('trips').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addMachineSession = useCallback(async (session: MachineSession) => {
    const row = machineSessionToRow(session);
    const { error } = await supabase.from('machine_sessions').insert(row);
    if (error) throw error;
  }, []);

  const updateMachineSession = useCallback(async (id: string, patch: Partial<MachineSession>) => {
    const row = machineSessionToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('machine_sessions').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addSurvey = useCallback(async (survey: Survey) => {
    const row = surveyToRow(survey);
    const { error } = await supabase.from('surveys').insert(row);
    if (error) throw error;
  }, []);

  const updateSurvey = useCallback(async (id: string, patch: Partial<Survey>) => {
    const row = surveyToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('surveys').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addIssue = useCallback(async (issue: Issue) => {
    const row = issueToRow(issue);
    const { error } = await supabase.from('issues').insert(row);
    if (error) throw error;
  }, []);

  const updateIssue = useCallback(async (id: string, patch: Partial<Issue>) => {
    const row = issueToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('issues').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const setSiteAssignment = useCallback(async (siteId: string, assignment: Partial<SiteAssignment> & { role: string }) => {
    const userId = assignment.userId ?? '';
    if (!userId) return;
    const row = { site_id: siteId, user_id: userId, role: assignment.role, vehicle_ids: assignment.vehicleIds ?? [] };
    const { error } = await supabase.from('site_assignments').upsert(row, { onConflict: 'site_id,user_id' });
    if (error) throw error;
  }, []);

  const addUser = useCallback(async (newUser: User) => {
    const row = { id: newUser.id, ...profileToRow(newUser) };
    const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
    if (error) throw error;
  }, []);

  const createUserByOwner = useCallback(
    async (params: {
      email: string;
      name: string;
      phone?: string;
      role: import('@/types').UserRole;
      site_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create_user_by_owner', {
        body: {
          email: params.email.trim().toLowerCase(),
          name: params.name.trim(),
          phone: params.phone?.trim() || null,
          role: params.role,
          site_id: params.site_id || null,
        },
      });
      if (error) throw error;
      const result = data as { user_id?: string; email?: string; temporary_password?: string; error?: string };
      if (result?.error) throw new Error(result.error);
      if (!result?.user_id || !result?.temporary_password) throw new Error('Invalid response from server');
      await refetch();
      return {
        user_id: result.user_id,
        email: result.email ?? params.email,
        temporary_password: result.temporary_password,
      };
    },
    [refetch]
  );

  const resetUserPassword = useCallback(
    async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('reset_user_password', {
        body: { user_id: userId },
      });
      if (error) throw error;
      const result = data as { email?: string; temporary_password?: string; error?: string };
      if (result?.error) throw new Error(result.error);
      if (!result?.temporary_password) throw new Error('Invalid response from server');
      return {
        email: result.email,
        temporary_password: result.temporary_password,
      };
    },
    []
  );

  const updateUser = useCallback(async (id: string, patch: Partial<User>) => {
    const row = profileToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('profiles').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const setDriverVehicleAssignment = useCallback(async (siteId: string, driverId: string, vehicleIds: string[]) => {
    const row = { site_id: siteId, driver_id: driverId, vehicle_ids: vehicleIds };
    const { error } = await supabase.from('driver_vehicle_assignments').upsert(row, { onConflict: 'site_id,driver_id' });
    if (error) throw error;
  }, []);

  const updateTask = useCallback(async (id: string, patch: Partial<Task>) => {
    const row = taskToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from('tasks').update(row).eq('id', id);
    if (error) throw error;
  }, []);

  const addReport = useCallback(async (report: Report) => {
    const row = reportToRow(report);
    const { error } = await supabase.from('reports').insert(row);
    if (error) throw error;
  }, []);

  const value = useMemo<MockAppStoreContextValue>(
    () => ({
      ...state,
      loading,
      setSites,
      setVehicles,
      setExpenses,
      setTrips,
      setMachineSessions,
      setSurveys,
      setIssues,
      setSiteAssignments,
      setContractRateRwf,
      updateSite,
      addVehicle,
      updateVehicle,
      addExpense,
      addTrip,
      updateTrip,
      addMachineSession,
      updateMachineSession,
      addSurvey,
      updateSurvey,
      addIssue,
      updateIssue,
      setSiteAssignment,
      addUser,
      createUserByOwner,
      resetUserPassword,
      updateUser,
      refetch,
      addSite,
      setDriverVehicleAssignment,
      updateTask,
      addReport,
    }),
    [
      state,
      loading,
      setSites,
      setVehicles,
      setExpenses,
      setTrips,
      setMachineSessions,
      setSurveys,
      setIssues,
      setSiteAssignments,
      setContractRateRwf,
      updateSite,
      addVehicle,
      updateVehicle,
      addExpense,
      addTrip,
      updateTrip,
      addMachineSession,
      updateMachineSession,
      addSurvey,
      updateSurvey,
      addIssue,
      updateIssue,
      setSiteAssignment,
      addUser,
      createUserByOwner,
      resetUserPassword,
      updateUser,
      refetch,
      addSite,
      setDriverVehicleAssignment,
      updateTask,
      addReport,
    ]
  );

  return value;
}

export function MockAppStoreProvider({ children }: { children: React.ReactNode }) {
  const value = useSupabaseStore();
  return (
    <MockAppStoreContext.Provider value={value}>
      {children}
    </MockAppStoreContext.Provider>
  );
}

export function useMockAppStore(): MockAppStoreContextValue {
  const ctx = useContext(MockAppStoreContext);
  if (!ctx) throw new Error('useMockAppStore must be used within MockAppStoreProvider');
  return ctx;
}
