import React, {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useState,
  useEffect,
  useRef,
} from "react";
import { AppState, type AppStateStatus } from "react-native";
import type {
  Site,
  Vehicle,
  Expense,
  Trip,
  MachineSession,
  Survey,
  Issue,
  WorkPhoto,
  SiteAssignment,
  User,
  DriverVehicleAssignment,
  AssignedTrip,
  Task,
  SiteTask,
  Operation,
  Report,
  Notification,
  BudgetAllocation,
} from "@/types";
import { supabase } from "@/lib/supabase";
import {
  siteFromRow,
  vehicleFromRow,
  expenseFromRow,
  tripFromRow,
  machineSessionFromRow,
  surveyFromRow,
  issueFromRow,
  workPhotoFromRow,
  workPhotoToRow,
  siteAssignmentFromRow,
  driverVehicleAssignmentFromRow,
  taskFromRow,
  operationFromRow,
  reportFromRow,
  profileFromRow,
  notificationFromRow,
  budgetAllocationFromRow,
  budgetAllocationToRow,
  siteToRow,
  vehicleToRow,
  expenseToRow,
  tripToRow,
  tripUpdatePayload,
  machineSessionToRow,
  surveyToRow,
  issueToRow,
  taskToRow,
  siteTaskFromRow,
  siteTaskToRow,
  reportToRow,
  profileToRow,
  notificationToRow,
  assignedTripFromRow,
  assignedTripToRow,
} from "@/lib/supabaseMappers";
import { useAuth } from "@/context/AuthContext";
import {
  loadOfflineQueue,
  saveOfflineQueue,
  appendToOfflineQueue,
  type QueuedItem,
} from "@/lib/offlineQueue";
import { generateId } from "@/lib/id";
import {
  buildNotificationRows,
  buildNotificationRowForUser,
  getScenario,
} from "@/lib/notificationScenarios";
import { showSystemNotificationWithData } from "@/lib/localNotifications";
import { deleteIssueImagesFromStorage } from "@/lib/issueImageStorage";
import { getTripTransitionRole, assertValidTransition } from "@/lib/tripLifecycle";
import { safeDbWrite, getDbErrorMessage } from "@/lib/safeDbWrite";

export interface MockAppStoreState {
  sites: Site[];
  vehicles: Vehicle[];
  expenses: Expense[];
  trips: Trip[];
  machineSessions: MachineSession[];
  surveys: Survey[];
  issues: Issue[];
  workPhotos: WorkPhoto[];
  siteAssignments: SiteAssignment[];
  users: User[];
  driverVehicleAssignments: DriverVehicleAssignment[];
  assignedTrips: AssignedTrip[];
  budgetAllocations: BudgetAllocation[];
  contractRateRwf: number;
  tasks: Task[];
  siteTasks: SiteTask[];
  operations: Operation[];
  reports: Report[];
  notifications: Notification[];
}

type SetSites = (sites: Site[] | ((prev: Site[]) => Site[])) => void;
type SetVehicles = (v: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => void;
type SetExpenses = (e: Expense[] | ((prev: Expense[]) => Expense[])) => void;
type SetTrips = (t: Trip[] | ((prev: Trip[]) => Trip[])) => void;
type SetMachineSessions = (
  m: MachineSession[] | ((prev: MachineSession[]) => MachineSession[])
) => void;
type SetSurveys = (s: Survey[] | ((prev: Survey[]) => Survey[])) => void;
type SetIssues = (i: Issue[] | ((prev: Issue[]) => Issue[])) => void;
type SetSiteAssignments = (
  a: SiteAssignment[] | ((prev: SiteAssignment[]) => SiteAssignment[])
) => void;
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
  setWorkPhotos: (
    w: WorkPhoto[] | ((prev: WorkPhoto[]) => WorkPhoto[])
  ) => void;
  setSiteAssignments: SetSiteAssignments;
  setContractRateRwf: SetContractRateRwf;

  updateSite: (id: string, patch: Partial<Site>) => Promise<void>;
  addVehicle: (vehicle: Vehicle) => Promise<void>;
  updateVehicle: (id: string, patch: Partial<Vehicle>) => Promise<void>;
  addExpense: (expense: Expense) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  addTrip: (trip: Trip) => Promise<void>;
  updateTrip: (id: string, patch: Partial<Trip>) => Promise<void>;
  addMachineSession: (session: MachineSession) => Promise<void>;
  updateMachineSession: (
    id: string,
    patch: Partial<MachineSession>
  ) => Promise<void>;
  addSurvey: (survey: Survey) => Promise<void>;
  updateSurvey: (id: string, patch: Partial<Survey>) => Promise<void>;
  addIssue: (issue: Issue) => Promise<void>;
  updateIssue: (id: string, patch: Partial<Issue>) => Promise<void>;
  addWorkPhoto: (
    photo: Omit<WorkPhoto, "id" | "createdAt" | "siteName" | "uploadedByName">
  ) => Promise<WorkPhoto>;
  setSiteAssignment: (
    siteId: string,
    assignment: Partial<SiteAssignment> & { role: string }
  ) => Promise<void>;
  removeSiteAssignment: (siteId: string, userId: string) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  createUserByOwner: (params: {
    email: string;
    name: string;
    phone?: string;
    role: import("@/types").UserRole;
    site_id?: string;
  }) => Promise<{ user_id: string; email: string; temporary_password: string }>;
  resetUserPassword: (
    userId: string
  ) => Promise<{ email: string | undefined; temporary_password: string }>;
  updateUser: (id: string, patch: Partial<User>) => Promise<void>;
  /** Refetch from DB. Pass true to bypass throttle (e.g. after end trip so UI updates immediately). */
  refetch: (force?: boolean) => Promise<void>;
  /** Import website-only vehicles (Umugwaneza) into the app. Returns count synced. */
  syncFromWebsiteVehicles: () => Promise<{ syncedCount: number }>;
  addSite: (site: Site) => Promise<void>;
  addBudgetAllocation: (
    siteId: string,
    amountRwf: number,
    allocatedById?: string
  ) => Promise<void>;
  setDriverVehicleAssignment: (
    siteId: string,
    driverId: string,
    vehicleIds: string[]
  ) => Promise<void>;
  addAssignedTrip: (trip: AssignedTrip) => Promise<void>;
  updateAssignedTripStatus: (
    id: string,
    toStatus: AssignedTrip["status"]
  ) => Promise<void>;
  updateAssignedTrip: (id: string, patch: Partial<Pick<AssignedTrip, "notes">>) => Promise<void>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<void>;
  updateSiteTask: (id: string, patch: Partial<SiteTask>) => Promise<void>;
  addReport: (report: Report) => Promise<void>;
  updateReport: (id: string, patch: Partial<Report>) => Promise<void>;
  notifications: Notification[];
  addNotification: (
    n: Omit<Notification, "createdAt" | "read">
  ) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  /** Hard-delete all notifications for current user's role (clear all). */
  clearAllNotifications: () => Promise<void>;
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
  workPhotos: [],
  siteAssignments: [],
  users: [],
  driverVehicleAssignments: [],
  assignedTrips: [],
  budgetAllocations: [],
  contractRateRwf: defaultContractRate,
  tasks: [],
  siteTasks: [],
  operations: [],
  reports: [],
  notifications: [],
};

const MockAppStoreContext = createContext<MockAppStoreContextValue | null>(
  null
);

function useSupabaseStore(): MockAppStoreContextValue {
  const { user: authUser } = useAuth();
  const [state, setState] = useState<MockAppStoreState>(emptyState);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const currentUserRoleRef = useRef<string | null>(null);
  const lastRefetchAtRef = useRef<number>(0);
  const REFETCH_THROTTLE_MS = 30000;

  const refetch = useCallback(async (force?: boolean) => {
    if (!authUser) {
      setState(emptyState);
      setLoading(false);
      return;
    }
    const now = Date.now();
    if (!force && now - lastRefetchAtRef.current < REFETCH_THROTTLE_MS) {
      return;
    }
    lastRefetchAtRef.current = now;
    setLoading(true);
    try {
      // Flush offline queue when we have network (refetch implies we're trying to sync)
      const queue = await loadOfflineQueue();
      let remaining: QueuedItem[] = [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        if (item.type === "expense") {
          const row = expenseToRow(item.payload as Partial<Expense>);
          const { error } = await supabase.from("expenses").insert(row);
          if (error) remaining.push(item);
        } else {
          const row = tripToRow(item.payload as Partial<Trip>);
          const { error } = await supabase.from("trips").insert(row);
          if (error) remaining.push(item);
        }
      }
      await saveOfflineQueue(remaining);

      const [
        sitesRes,
        vehiclesRes,
        expensesRes,
        tripsRes,
        machineSessionsRes,
        surveysRes,
        issuesRes,
        workPhotosRes,
        siteAssignmentsRes,
        driverVehicleAssignmentsRes,
        tasksRes,
        siteTasksRes,
        operationsRes,
        reportsRes,
        profilesRes,
        budgetAllocationsRes,
      ] = await Promise.all([
        supabase.from("sites").select("*"),
        supabase.from("vehicles").select("*"),
        supabase.from("expenses").select("*"),
        supabase.from("trips").select("*"),
        supabase.from("machine_sessions").select("*"),
        supabase
          .from("surveys")
          .select(
            "id, site_id, survey_date, volume_m3, status, surveyor_id, created_at, approved_by_id, approved_at, revision_of, notes"
          )
          .order("survey_date", { ascending: false })
          .limit(200),
        supabase.from("issues").select("*"),
        supabase
          .from("work_photos")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase.from("site_assignments").select("*"),
        supabase.from("driver_vehicle_assignments").select("*"),
        supabase.from("tasks").select("*"),
        supabase
          .from("site_tasks")
          .select("*")
          .order("task_name", { ascending: true }),
        supabase.from("operations").select("*"),
        supabase.from("reports").select("*"),
        supabase.from("profiles").select("*"),
        supabase
          .from("site_budget_allocations")
          .select("*")
          .order("allocated_at", { ascending: true }),
      ]);

      let budgetAllocations: BudgetAllocation[] = [];
      if (!budgetAllocationsRes.error) {
        budgetAllocations = (budgetAllocationsRes.data ?? []).map((r) =>
          budgetAllocationFromRow(r as Record<string, unknown>)
        );
      }

      let assignedTrips: AssignedTrip[] = [];

      const sites = (sitesRes.data ?? []).map((r) =>
        siteFromRow(r as Record<string, unknown>)
      );
      const vehicles = (vehiclesRes.data ?? []).map((r) =>
        vehicleFromRow(r as Record<string, unknown>)
      );
      const expenses = (expensesRes.data ?? []).map((r) =>
        expenseFromRow(r as Record<string, unknown>)
      );
      const trips = (tripsRes.data ?? []).map((r) =>
        tripFromRow(r as Record<string, unknown>)
      );
      const machineSessions = (machineSessionsRes.data ?? []).map((r) =>
        machineSessionFromRow(r as Record<string, unknown>)
      );
      const surveys = (surveysRes.data ?? []).map((r) =>
        surveyFromRow(r as Record<string, unknown>)
      );
      const issues = (issuesRes.data ?? []).map((r) =>
        issueFromRow(r as Record<string, unknown>)
      );
      const workPhotos = (workPhotosRes.data ?? []).map((r) =>
        workPhotoFromRow(r as Record<string, unknown>)
      );
      const siteAssignments = (siteAssignmentsRes.data ?? []).map((r) =>
        siteAssignmentFromRow(r as Record<string, unknown>)
      );
      const driverVehicleAssignments = (
        driverVehicleAssignmentsRes.data ?? []
      ).map((r) =>
        driverVehicleAssignmentFromRow(r as Record<string, unknown>)
      );
      const tasks = (tasksRes.data ?? []).map((r) =>
        taskFromRow(r as Record<string, unknown>)
      );
      const siteTasks = (siteTasksRes.data ?? []).map((r) =>
        siteTaskFromRow(r as Record<string, unknown>)
      );
      const operations = (operationsRes.data ?? []).map((r) =>
        operationFromRow(r as Record<string, unknown>)
      );
      const reports = (reportsRes.data ?? []).map((r) =>
        reportFromRow(r as Record<string, unknown>)
      );
      // Include all profiles so Assistant Supervisor can see full team info
      const profileRows = (profilesRes.data ?? []) as Record<string, unknown>[];
      const users = profileRows.map((r) => profileFromRow(r));
      const userSiteMap = new Map<string, string[]>();
      siteAssignments.forEach((a) => {
        const arr = userSiteMap.get(a.userId) ?? [];
        if (!arr.includes(a.siteId)) arr.push(a.siteId);
        userSiteMap.set(a.userId, arr);
      });
      users.forEach((u) => {
        u.siteAccess = userSiteMap.get(u.id) ?? u.siteAccess ?? [];
      });

      const contractRateRwf =
        sites.length > 0 && sites[0].contractRateRwf != null
          ? sites[0].contractRateRwf
          : defaultContractRate;

      let notifications: Notification[] = [];
      const currentUserRole = users.find((u) => u.id === authUser.id)?.role;
      if (currentUserRole) {
        try {
          const notifRes = await supabase
            .from("notifications")
            .select(
              "id, target_role, title, body, created_at, read, link_id, link_type"
            )
            .eq("target_role", currentUserRole)
            .order("created_at", { ascending: false })
            .limit(50);
          notifications = (notifRes.data ?? []).map((r) =>
            notificationFromRow(r as Record<string, unknown>)
          );
        } catch {
          // Table may not exist until migration 20250223100000_notifications is run
        }
      }

      setState({
        sites,
        vehicles,
        expenses,
        trips,
        machineSessions,
        surveys,
        issues,
        workPhotos,
        siteAssignments,
        users,
        driverVehicleAssignments,
        assignedTrips,
        budgetAllocations,
        contractRateRwf,
        tasks,
        siteTasks,
        operations,
        reports,
        notifications,
      });

      // Load assigned_trips in background (lightweight, non-blocking) so the app stays responsive
      void supabase
        .from("assigned_trips")
        .select(
          "id, site_id, vehicle_id, driver_id, vehicle_type, task_type, status, notes, created_by, created_at, started_at, paused_at, resumed_at, pause_segments, completed_at, completed_by"
        )
        .order("created_at", { ascending: false })
        .limit(150)
        .then(
          (assignedTripsRes) => {
            if (!assignedTripsRes.error && assignedTripsRes.data) {
              const loaded = (
                assignedTripsRes.data as Record<string, unknown>[]
              ).map((r) => assignedTripFromRow(r));
              setState((prev) => ({ ...prev, assignedTrips: loaded }));
            }
          },
          () => {
            /* table may not exist or RLS; keep assignedTrips as [] */
          }
        );
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  }, [authUser]);

  const refetchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const REFETCH_DEBOUNCE_MS = 300;
  const refetchDebounced = useCallback(() => {
    if (refetchDebounceRef.current) {
      clearTimeout(refetchDebounceRef.current);
      refetchDebounceRef.current = null;
    }
    refetchDebounceRef.current = setTimeout(() => {
      refetchDebounceRef.current = null;
      refetch();
    }, REFETCH_DEBOUNCE_MS);
  }, [refetch]);

  const initialFetchDoneRef = useRef(false);
  useEffect(() => {
    if (!authUser?.id) {
      initialFetchDoneRef.current = false;
      return;
    }
    if (initialFetchDoneRef.current) return;
    initialFetchDoneRef.current = true;
    refetch();
  }, [authUser?.id, refetch]);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") refetchDebounced();
      }
    );
    return () => subscription.remove();
  }, [refetchDebounced]);

  // Keep current user role in a ref so realtime INSERT handler can show system notification with no latency
  useEffect(() => {
    const role = state.users.find((u) => u.id === authUser?.id)?.role ?? null;
    currentUserRoleRef.current = role;
  }, [authUser?.id, state.users]);

  useEffect(() => {
    if (!authUser) return;
    const onRefetch = () => refetchDebounced();
    const channel = supabase
      .channel("app-store-realtime")
      // Event filtering: INSERT + UPDATE only (no DELETE) to reduce realtime traffic as tables grow
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sites" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "sites" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "vehicles" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "vehicles" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "expenses" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "expenses" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trips" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "trips" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "machine_sessions" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "machine_sessions" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "surveys" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "surveys" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "issues" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "issues" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "site_assignments" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "site_assignments" },
        onRefetch
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "driver_vehicle_assignments",
        },
        onRefetch
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_vehicle_assignments",
        },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "assigned_trips" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "assigned_trips" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "tasks" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "tasks" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "operations" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "operations" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "reports" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "reports" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "gps_photos" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "gps_photos" },
        onRefetch
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: {
          new: {
            target_role?: string;
            title?: string;
            body?: string;
            link_id?: string;
            link_type?: string;
            id?: string;
          };
        }) => {
          const record = payload?.new;
          if (record?.title && record?.body) {
            const role = currentUserRoleRef.current;
            if (role && record.target_role === role) {
              showSystemNotificationWithData(
                String(record.title),
                String(record.body),
                {
                  linkId: record.link_id,
                  linkType: record.link_type,
                  notificationId: record.id,
                }
              );
            }
          }
          onRefetch();
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (refetchDebounceRef.current) {
        clearTimeout(refetchDebounceRef.current);
        refetchDebounceRef.current = null;
      }
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [authUser, refetchDebounced]);

  const setSites: SetSites = useCallback((arg) => {
    setState((prev) => ({
      ...prev,
      sites: typeof arg === "function" ? arg(prev.sites) : arg,
    }));
  }, []);
  const setVehicles = useCallback(
    (arg: Vehicle[] | ((prev: Vehicle[]) => Vehicle[])) => {
      setState((prev) => ({
        ...prev,
        vehicles: typeof arg === "function" ? arg(prev.vehicles) : arg,
      }));
    },
    []
  );
  const setExpenses = useCallback(
    (arg: Expense[] | ((prev: Expense[]) => Expense[])) => {
      setState((prev) => ({
        ...prev,
        expenses: typeof arg === "function" ? arg(prev.expenses) : arg,
      }));
    },
    []
  );
  const setTrips = useCallback((arg: Trip[] | ((prev: Trip[]) => Trip[])) => {
    setState((prev) => ({
      ...prev,
      trips: typeof arg === "function" ? arg(prev.trips) : arg,
    }));
  }, []);
  const setMachineSessions = useCallback(
    (
      arg: MachineSession[] | ((prev: MachineSession[]) => MachineSession[])
    ) => {
      setState((prev) => ({
        ...prev,
        machineSessions:
          typeof arg === "function" ? arg(prev.machineSessions) : arg,
      }));
    },
    []
  );
  const setSurveys = useCallback(
    (arg: Survey[] | ((prev: Survey[]) => Survey[])) => {
      setState((prev) => ({
        ...prev,
        surveys: typeof arg === "function" ? arg(prev.surveys) : arg,
      }));
    },
    []
  );
  const setIssues = useCallback(
    (arg: Issue[] | ((prev: Issue[]) => Issue[])) => {
      setState((prev) => ({
        ...prev,
        issues: typeof arg === "function" ? arg(prev.issues) : arg,
      }));
    },
    []
  );
  const setWorkPhotos = useCallback(
    (arg: WorkPhoto[] | ((prev: WorkPhoto[]) => WorkPhoto[])) => {
      setState((prev) => ({
        ...prev,
        workPhotos: typeof arg === "function" ? arg(prev.workPhotos) : arg,
      }));
    },
    []
  );
  const setSiteAssignments = useCallback(
    (
      arg: SiteAssignment[] | ((prev: SiteAssignment[]) => SiteAssignment[])
    ) => {
      setState((prev) => ({
        ...prev,
        siteAssignments:
          typeof arg === "function" ? arg(prev.siteAssignments) : arg,
      }));
    },
    []
  );
  const setContractRateRwf = useCallback((value: number) => {
    setState((prev) => {
      const next = { ...prev, contractRateRwf: value };
      if (prev.sites.length > 0) {
        next.sites = prev.sites.map((s, i) =>
          i === 0 ? { ...s, contractRateRwf: value } : s
        );
        supabase
          .from("sites")
          .update({ contract_rate_rwf: value })
          .eq("id", prev.sites[0].id)
          .then(() => {});
      }
      return next;
    });
  }, []);

  const updateSite = useCallback(
    async (id: string, patch: Partial<Site>) => {
      const site = state.sites.find((s) => s.id === id);
      const nextPatch = { ...patch };
      if (patch.status === "completed" && site && !site.actualCompletedAt) {
        nextPatch.actualCompletedAt = new Date().toISOString();
      }
      const row = siteToRow(nextPatch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from("sites").update(row).eq("id", id);
      if (error) throw error;
      await refetch();
    },
    [refetch, state.sites]
  );

  const addSite = useCallback(
    async (site: Site) => {
      const row = siteToRow(site);
      const { error } = await supabase.from("sites").insert(row);
      if (error) throw error;
      if (site.budget > 0) {
        const allocRow = budgetAllocationToRow({
          siteId: site.id,
          amountRwf: site.budget,
          allocatedAt: new Date().toISOString(),
          allocatedById: authUser?.id ?? undefined,
        });
        const { error: allocError } = await supabase
          .from("site_budget_allocations")
          .insert(allocRow);
        if (allocError) {
          throw new Error(
            allocError.message ||
              "Site was created but initial budget could not be recorded. Please use Allocate budget to add it."
          );
        }
      }
      const siteRows = buildNotificationRows(
        "site_added",
        { ...site, name: site.name, location: site.location },
        () => generateId("n")
      );
      for (const r of siteRows) await supabase.from("notifications").insert(r);
      refetch().catch(() => {});
    },
    [refetch, authUser?.id]
  );

  const addBudgetAllocation = useCallback(
    async (siteId: string, amountRwf: number, allocatedById?: string) => {
      const allocRow = budgetAllocationToRow({
        siteId,
        amountRwf,
        allocatedAt: new Date().toISOString(),
        allocatedById: allocatedById ?? authUser?.id,
      });
      const { error: insertErr } = await supabase
        .from("site_budget_allocations")
        .insert(allocRow);
      if (insertErr) throw insertErr;
      const site = state.sites.find((s) => s.id === siteId);
      const newBudget = (site?.budget ?? 0) + amountRwf;
      const { error: updateErr } = await supabase
        .from("sites")
        .update({ budget: newBudget })
        .eq("id", siteId);
      if (updateErr) throw updateErr;
      await refetch();
    },
    [refetch, authUser?.id, state.sites]
  );

  const syncFromWebsiteVehicles = useCallback(async (): Promise<{
    syncedCount: number;
  }> => {
    const { data, error } = await supabase.rpc("sync_website_vehicles_to_app");
    if (error) {
      const msg = error.message || "";
      if (/stack depth|recursion|limit exceeded/i.test(msg)) {
        throw new Error(
          "Unable to sync vehicles right now (database recursion limit). Ask your admin to run the vehicles sync fix migration in Supabase, then try again."
        );
      }
      throw error;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const syncedCount = row?.synced_count ?? 0;
    await refetch();
    return { syncedCount };
  }, [refetch]);

  const addVehicle = useCallback(
    async (vehicle: Vehicle) => {
      const row = vehicleToRow(vehicle);
      const { error } = await supabase.from("vehicles").insert(row);
      if (error) {
        const msg = error.message || "";
        if (/stack depth|recursion|limit exceeded/i.test(msg)) {
          throw new Error(
            "Unable to save vehicle right now. Please try again."
          );
        }
        throw error;
      }
      const siteName = vehicle.siteId
        ? state.sites.find((s) => s.id === vehicle.siteId)?.name
        : undefined;
      const vehicleRows = buildNotificationRows(
        "vehicle_added",
        { ...vehicle, siteName, type: vehicle.type },
        () => generateId("n")
      );
      for (const r of vehicleRows)
        await supabase.from("notifications").insert(r);
      await refetch();
    },
    [refetch, state.sites]
  );

  const updateVehicle = useCallback(
    async (id: string, patch: Partial<Vehicle>) => {
      const trimmedId = String(id ?? "").trim();
      if (!trimmedId) throw new Error("Vehicle id is required.");
      const norm = (x: string) =>
        String(x ?? "")
          .trim()
          .toLowerCase();
      const current = state.vehicles.find(
        (v) => norm(v.id) === norm(trimmedId)
      );
      if (!current)
        throw new Error("Vehicle not found. Please refresh and try again.");
      const merged: Vehicle = { ...current, ...patch };
      const { vehicleNumberOrId: _omit, ...patchOnly } = patch;
      const row = vehicleToRow(patchOnly);
      if (Object.keys(row).length === 0) return;
      const { data: updatedRows, error } = await supabase
        .from("vehicles")
        .update(row)
        .eq("id", trimmedId)
        .select();
      if (error) {
        const msg = error.message || "";
        if (/stack depth|recursion|limit exceeded/i.test(msg)) {
          throw new Error(
            "Unable to save vehicle right now. Please try again."
          );
        }
        throw new Error(msg || "Failed to save vehicle. Please try again.");
      }
      const updated =
        updatedRows && updatedRows.length > 0
          ? vehicleFromRow(updatedRows[0] as Record<string, unknown>)
          : merged;
      setState((prev) => ({
        ...prev,
        vehicles: prev.vehicles.map((v) =>
          norm(v.id) === norm(trimmedId) ? updated : v
        ),
      }));
      const siteName = state.sites.find(
        (s) => s.id === (patch.siteId ?? updated.siteId)
      )?.name;
      const vehicleNumberOrId =
        patch.vehicleNumberOrId ?? updated.vehicleNumberOrId;
      const vehicleRows = buildNotificationRows(
        "vehicle_updated",
        { id: trimmedId, vehicleNumberOrId, siteName },
        () => generateId("n")
      );
      for (const r of vehicleRows)
        await supabase.from("notifications").insert(r);
    },
    [state.vehicles, state.sites]
  );

  const addExpense = useCallback(
    async (expense: Expense) => {
      const siteId =
        expense.siteId != null ? String(expense.siteId).trim() : "";
      if (!siteId)
        throw new Error(
          "Site location is required for every expense (general and fuel)."
        );
      const row = expenseToRow(expense);
      if (!row.site_id)
        throw new Error("Site location is required for every expense.");
      const { error } = await supabase.from("expenses").insert(row);
      if (error) {
        await appendToOfflineQueue({
          type: "expense",
          payload: expense as unknown as Record<string, unknown>,
        });
        setState((prev) => ({
          ...prev,
          expenses: [...prev.expenses, expense],
        }));
        return;
      }
      const siteName = state.sites.find((s) => s.id === expense.siteId)?.name;
      const expenseRows = buildNotificationRows(
        "expense_added",
        { ...expense, siteName },
        () => generateId("n")
      );
      for (const r of expenseRows)
        await supabase.from("notifications").insert(r);
      await refetch();
    },
    [refetch, state.sites]
  );

  const deleteExpense = useCallback(async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) throw new Error(error.message || "Failed to delete expense.");
    setState((prev) => ({
      ...prev,
      expenses: prev.expenses.filter((e) => e.id !== id),
    }));
  }, []);

  const addTrip = useCallback(
    async (trip: Trip) => {
      const row = tripToRow(trip);
      const result = await safeDbWrite(
        async () => {
          const { error } = await supabase.from("trips").insert(row);
          if (error) throw error;
        },
        { retryOnceOnNetwork: true }
      );
      if (!result.ok) {
        throw new Error(getDbErrorMessage(result.error, result.error.message));
      }
      if (trip.status === "in_progress") {
        const siteName = state.sites.find((s) => s.id === trip.siteId)?.name;
        const vehicleNumberOrId = state.vehicles.find(
          (v) => v.id === trip.vehicleId
        )?.vehicleNumberOrId;
        const driverName = state.users.find(
          (u) => u.id === trip.driverId
        )?.name;
        const tripStartedRows = buildNotificationRows(
          "trip_started",
          { ...trip, siteName, vehicleNumberOrId, driverName },
          () => generateId("n")
        );
        for (const r of tripStartedRows)
          await supabase.from("notifications").insert(r);
      } else if (trip.status === "completed") {
        const siteName = state.sites.find((s) => s.id === trip.siteId)?.name;
        const vehicleNumberOrId = state.vehicles.find(
          (v) => v.id === trip.vehicleId
        )?.vehicleNumberOrId;
        const tripRows = buildNotificationRows(
          "trip_completed",
          { ...trip, siteName, vehicleNumberOrId },
          () => generateId("n")
        );
        for (const r of tripRows)
          await supabase.from("notifications").insert(r);
      }
      await refetch();
    },
    [refetch, state.sites, state.vehicles, state.users]
  );

  const updateTrip = useCallback(
    async (id: string, patch: Partial<Trip>) => {
      const row = tripUpdatePayload(patch);
      if (Object.keys(row).length === 0) return;
      const result = await safeDbWrite(
        async () => {
          const { error } = await supabase.from("trips").update(row).eq("id", id);
          if (error) throw error;
        },
        { retryOnceOnNetwork: true }
      );
      if (!result.ok) {
        throw new Error(getDbErrorMessage(result.error, result.error.message));
      }
      const trip = state.trips.find((t) => t.id === id);
      if (trip) {
        const siteName = state.sites.find((s) => s.id === trip.siteId)?.name;
        const vehicleNumberOrId = state.vehicles.find(
          (v) => v.id === trip.vehicleId
        )?.vehicleNumberOrId;
        const driverName = state.users.find(
          (u) => u.id === trip.driverId
        )?.name;
        if (patch.status === "in_progress") {
          const tripStartedRows = buildNotificationRows(
            "trip_started",
            { ...trip, ...patch, siteName, vehicleNumberOrId, driverName },
            () => generateId("n")
          );
          for (const r of tripStartedRows)
            await supabase.from("notifications").insert(r);
        } else if (patch.status === "completed") {
          const tripRows = buildNotificationRows(
            "trip_completed",
            { ...trip, ...patch, siteName, vehicleNumberOrId },
            () => generateId("n")
          );
          for (const r of tripRows)
            await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [refetch, state.trips, state.sites, state.vehicles, state.users]
  );

  const addMachineSession = useCallback(
    async (session: MachineSession) => {
      const row = machineSessionToRow(session);
      const { error } = await supabase.from("machine_sessions").insert(row);
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === session.siteId)?.name;
      const vehicleNumberOrId = state.vehicles.find(
        (v) => v.id === session.vehicleId
      )?.vehicleNumberOrId;
      if (session.status === "in_progress") {
        const startedRows = buildNotificationRows(
          "machine_session_started",
          { ...session, siteName, vehicleNumberOrId },
          () => generateId("n")
        );
        for (const r of startedRows)
          await supabase.from("notifications").insert(r);
      } else if (session.status === "completed") {
        const sessionRows = buildNotificationRows(
          "machine_session_completed",
          { ...session, siteName },
          () => generateId("n")
        );
        for (const r of sessionRows)
          await supabase.from("notifications").insert(r);
      }
      await refetch();
    },
    [refetch, state.sites, state.vehicles]
  );

  const updateMachineSession = useCallback(
    async (id: string, patch: Partial<MachineSession>) => {
      const row = machineSessionToRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase
        .from("machine_sessions")
        .update(row)
        .eq("id", id);
      if (error) throw error;
      if (patch.status === "completed") {
        const session = state.machineSessions.find((m) => m.id === id);
        if (session) {
          const siteName = state.sites.find(
            (s) => s.id === session.siteId
          )?.name;
          const sessionRows = buildNotificationRows(
            "machine_session_completed",
            { ...session, ...patch, siteName },
            () => generateId("n")
          );
          for (const r of sessionRows)
            await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [refetch, state.machineSessions, state.sites]
  );

  const addSurvey = useCallback(
    async (survey: Survey) => {
      const row = surveyToRow(survey);
      const { error } = await supabase.from("surveys").insert(row);
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === survey.siteId)?.name;
      const surveyRows = buildNotificationRows(
        "survey_submitted",
        { ...survey, siteName },
        () => generateId("n")
      );
      for (const r of surveyRows)
        await supabase.from("notifications").insert(r);
      setSurveys((prev) => [survey, ...prev]);
      refetch().catch(() => {});
    },
    [refetch, state.sites, setSurveys]
  );

  const updateSurvey = useCallback(
    async (id: string, patch: Partial<Survey>) => {
      const row = surveyToRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from("surveys").update(row).eq("id", id);
      if (error) throw error;
      if (patch.status === "approved") {
        const survey = state.surveys.find((s) => s.id === id);
        if (survey) {
          const siteName = state.sites.find(
            (s) => s.id === survey.siteId
          )?.name;
          const approvedRows = buildNotificationRows(
            "survey_approved",
            { ...survey, ...patch, siteName },
            () => generateId("n")
          );
          for (const r of approvedRows)
            await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [refetch, state.surveys, state.sites]
  );

  const addIssue = useCallback(
    async (issue: Issue) => {
      const role = state.users.find((u) => u.id === authUser?.id)?.role;
      const allowedRoles = [
        "assistant_supervisor",
        "driver_truck",
        "driver_machine",
      ];
      if (!role || !allowedRoles.includes(role)) {
        throw new Error(
          "Only Assistant Supervisor, Driver, or Operator can create issues."
        );
      }
      const issueWithRole: Issue = {
        ...issue,
        status: "open",
        createdByRole: role,
      };
      const row = issueToRow(issueWithRole);
      const { error } = await supabase.from("issues").insert(row);
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === issue.siteId)?.name;
      const rows = buildNotificationRows(
        "issue_raised",
        { ...issueWithRole, siteName },
        () => generateId("n")
      );
      for (const r of rows) {
        await supabase.from("notifications").insert(r);
      }
      await refetch();
    },
    [refetch, state.sites, state.users, authUser?.id]
  );

  const updateIssue = useCallback(
    async (id: string, patch: Partial<Issue>) => {
      const role = state.users.find((u) => u.id === authUser?.id)?.role;
      if (patch.status === "resolved") {
        if (role !== "head_supervisor" && role !== "owner") {
          throw new Error("Only Head Supervisor or Owner can resolve issues.");
        }
        const issue = state.issues.find((i) => i.id === id);
        if (issue?.imageUris?.length) {
          await deleteIssueImagesFromStorage(issue.imageUris);
        }
      }
      const payload: Partial<Issue> = { ...patch };
      if (patch.status === "resolved") {
        payload.imageUris = [];
        payload.resolvedBy = authUser?.id ?? undefined;
        payload.resolvedAt = new Date().toISOString();
      }
      const row = issueToRow(payload);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from("issues").update(row).eq("id", id);
      if (error) throw error;
      if (patch.status === "resolved" || patch.status === "acknowledged") {
        const issue = state.issues.find((i) => i.id === id);
        if (issue) {
          const siteName = state.sites.find((s) => s.id === issue.siteId)?.name;
          const resolvedRows = buildNotificationRows(
            "issue_resolved",
            { ...issue, ...patch, siteName },
            () => generateId("n")
          );
          for (const r of resolvedRows)
            await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [refetch, state.issues, state.sites, state.users, authUser?.id]
  );

  const addWorkPhoto = useCallback(
    async (
      photo: Omit<WorkPhoto, "id" | "createdAt" | "siteName" | "uploadedByName">
    ) => {
      const row = workPhotoToRow(photo);
      const result = await safeDbWrite(
        async () => {
          const { data, error } = await supabase
            .from("work_photos")
            .insert(row)
            .select()
            .single();
          if (error) throw error;
          return workPhotoFromRow((data ?? photo) as Record<string, unknown>);
        },
        { retryOnceOnNetwork: true }
      );
      if (!result.ok) {
        throw new Error(getDbErrorMessage(result.error, result.error.message));
      }
      await refetch();
      return result.data!;
    },
    [refetch]
  );

  const setSiteAssignment = useCallback(
    async (
      siteId: string,
      assignment: Partial<SiteAssignment> & { role: string }
    ) => {
      const userId = assignment.userId ?? "";
      if (!userId) return;
      const row = {
        site_id: siteId,
        user_id: userId,
        role: assignment.role,
        vehicle_ids: assignment.vehicleIds ?? [],
      };
      const { error } = await supabase
        .from("site_assignments")
        .upsert(row, { onConflict: "site_id,user_id" });
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === siteId)?.name;
      const siteRows = buildNotificationRows(
        "site_assignment",
        { siteId, siteName, role: assignment.role },
        () => generateId("n")
      );
      for (const r of siteRows) await supabase.from("notifications").insert(r);
      await refetch();
    },
    [refetch, state.sites]
  );

  const removeSiteAssignment = useCallback(
    async (siteId: string, userId: string) => {
      const { error } = await supabase
        .from("site_assignments")
        .delete()
        .eq("site_id", siteId)
        .eq("user_id", userId);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const addUser = useCallback(
    async (newUser: User) => {
      const row = { id: newUser.id, ...profileToRow(newUser) };
      const { error } = await supabase
        .from("profiles")
        .upsert(row, { onConflict: "id" });
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const createUserByOwner = useCallback(
    async (params: {
      email: string;
      name: string;
      phone?: string;
      role: import("@/types").UserRole;
      site_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke(
        "create_user_by_owner",
        {
          body: {
            email: params.email.trim().toLowerCase(),
            name: params.name.trim(),
            phone: params.phone?.trim() || null,
            role: params.role,
            site_id: params.site_id || null,
          },
        }
      );
      if (error) throw error;
      const result = data as {
        user_id?: string;
        email?: string;
        temporary_password?: string;
        error?: string;
      };
      if (result?.error) throw new Error(result.error);
      if (!result?.user_id || !result?.temporary_password)
        throw new Error("Invalid response from server");
      const userRows = buildNotificationRows(
        "user_created",
        { user_id: result.user_id, name: params.name, role: params.role },
        () => generateId("n")
      );
      for (const r of userRows) await supabase.from("notifications").insert(r);
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
      const { data, error } = await supabase.functions.invoke(
        "reset_user_password",
        {
          body: { user_id: userId },
        }
      );
      if (error) throw error;
      const result = data as {
        email?: string;
        temporary_password?: string;
        error?: string;
      };
      if (result?.error) throw new Error(result.error);
      if (!result?.temporary_password)
        throw new Error("Invalid response from server");
      await refetch();
      return {
        email: result.email,
        temporary_password: result.temporary_password,
      };
    },
    [refetch]
  );

  const updateUser = useCallback(async (id: string, patch: Partial<User>) => {
    const row = profileToRow(patch);
    if (Object.keys(row).length === 0) return;
    const { error } = await supabase.from("profiles").update(row).eq("id", id);
    if (error) throw error;
    setState((prev) => ({
      ...prev,
      users: prev.users.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    }));
  }, []);

  const setDriverVehicleAssignment = useCallback(
    async (siteId: string, driverId: string, vehicleIds: string[]) => {
      const row = {
        site_id: siteId,
        driver_id: driverId,
        vehicle_ids: vehicleIds,
      };
      const { error } = await supabase
        .from("driver_vehicle_assignments")
        .upsert(row, { onConflict: "site_id,driver_id" });
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === siteId)?.name;
      const driverRows = buildNotificationRows(
        "driver_vehicle_assignment",
        { siteId, siteName, vehicleIds },
        () => generateId("n")
      );
      for (const r of driverRows)
        await supabase.from("notifications").insert(r);
      if (driverId && vehicleIds.length > 0) {
        const driver = state.users.find((u) => u.id === driverId);
        const vehicleLabels = vehicleIds
          .map(
            (vid) =>
              state.vehicles.find((v) => v.id === vid)?.vehicleNumberOrId ?? vid
          )
          .join(", ");
        const firstVehicle = state.vehicles.find((v) => v.id === vehicleIds[0]);
        const vehicleType =
          firstVehicle?.type === "machine" ? "Machine" : "Truck";
        const body = `You are allocated to ${vehicleLabels} (${vehicleType}) under ${
          siteName ?? "this site"
        }.`;
        const personalRow = buildNotificationRowForUser(
          driver?.role ?? "driver_truck",
          driverId,
          "Allocated to vehicle",
          body,
          () => generateId("n"),
          siteId,
          "site"
        );
        await supabase.from("notifications").insert(personalRow);
      }
      await refetch();
    },
    [refetch, state.sites, state.users, state.vehicles]
  );

  const addAssignedTrip = useCallback(
    async (trip: AssignedTrip) => {
      const row = assignedTripToRow(trip);
      const { error } = await supabase.from("assigned_trips").insert(row);
      if (error) throw error;
      const siteName = state.sites.find((s) => s.id === trip.siteId)?.name;
      const vehicleNumberOrId = state.vehicles.find(
        (v) => v.id === trip.vehicleId
      )?.vehicleNumberOrId;
      const scenario = getScenario("trip_assigned");
      const title = scenario.getTitle({
        ...trip,
        siteName,
        vehicleNumberOrId,
        vehicleType: trip.vehicleType,
      });
      const body = scenario.getBody({
        ...trip,
        siteName,
        vehicleNumberOrId,
        vehicleType: trip.vehicleType,
      });
      const driver = state.users.find((u) => u.id === trip.driverId);
      const targetRole =
        trip.vehicleType === "truck" ? "driver_truck" : "driver_machine";
      const personalRow = buildNotificationRowForUser(
        targetRole,
        trip.driverId,
        title,
        body,
        () => generateId("n"),
        trip.id,
        "assigned_trip"
      );
      await supabase.from("notifications").insert(personalRow);
      await refetch();
    },
    [refetch, state.sites, state.users, state.vehicles]
  );

  const updateAssignedTripStatus = useCallback(
    async (id: string, toStatus: AssignedTrip["status"]) => {
      const current = state.assignedTrips.find((t) => t.id === id);
      if (!current) throw new Error("Assigned trip not found.");
      const currentUser = state.users.find((u) => u.id === authUser?.id);
      const role = currentUser ? getTripTransitionRole(currentUser.role) : null;
      if (role == null)
        throw new Error("You are not allowed to change this trip status.");
      assertValidTransition(current.status, toStatus, role);
      const patch: Partial<AssignedTrip> = { status: toStatus };
      const now = new Date().toISOString();
      if (toStatus === "TRIP_STARTED" || toStatus === "TASK_STARTED")
        patch.startedAt = now;
      if (toStatus === "TRIP_PAUSED" || toStatus === "TASK_PAUSED") {
        patch.pausedAt = now;
        const prev = current.pauseSegments ?? [];
        patch.pauseSegments = [
          ...prev,
          { startedAt: now, endedAt: now },
        ];
      }
      if (toStatus === "TRIP_RESUMED" || toStatus === "TASK_RESUMED") {
        patch.resumedAt = now;
        const prev = current.pauseSegments ?? [];
        const last = prev[prev.length - 1];
        const closed = last
          ? { startedAt: last.startedAt, endedAt: now }
          : { startedAt: current.pausedAt ?? now, endedAt: now };
        patch.pauseSegments = [...prev.slice(0, -1), closed];
      }
      if (
        toStatus === "TRIP_NEED_APPROVAL" ||
        toStatus === "TASK_NEED_APPROVAL"
      ) {
        // no extra fields
      }
      if (toStatus === "TRIP_COMPLETED" || toStatus === "TASK_COMPLETED") {
        patch.completedAt = now;
        patch.completedBy = authUser?.id ?? undefined;
      }
      const row = assignedTripToRow(patch);
      delete (row as Record<string, unknown>).id;
      delete (row as Record<string, unknown>).site_id;
      delete (row as Record<string, unknown>).vehicle_id;
      delete (row as Record<string, unknown>).driver_id;
      delete (row as Record<string, unknown>).created_by;
      delete (row as Record<string, unknown>).created_at;
      const result = await safeDbWrite(
        async () => {
          const { error } = await supabase
            .from("assigned_trips")
            .update(row)
            .eq("id", id);
          if (error) throw error;
        },
        { retryOnceOnNetwork: true }
      );
      if (!result.ok) {
        throw new Error(getDbErrorMessage(result.error, result.error.message));
      }
      if (
        toStatus === "TRIP_NEED_APPROVAL" ||
        toStatus === "TASK_NEED_APPROVAL"
      ) {
        const site = state.sites.find((s) => s.id === current.siteId);
        const asId = site?.assistantSupervisorId;
        const siteName = site?.name;
        const vehicleNumberOrId = state.vehicles.find(
          (v) => v.id === current.vehicleId
        )?.vehicleNumberOrId;
        const driverName = state.users.find(
          (u) => u.id === current.driverId
        )?.name;
        const scenario = getScenario("trip_need_approval");
        const title = scenario.getTitle({
          ...current,
          siteName,
          vehicleNumberOrId,
          driverName,
          vehicleType: current.vehicleType,
        });
        const body = scenario.getBody({
          ...current,
          siteName,
          vehicleNumberOrId,
          driverName,
          vehicleType: current.vehicleType,
        });
        if (asId) {
          const asRow = buildNotificationRowForUser(
            "assistant_supervisor",
            asId,
            title,
            body,
            () => generateId("n"),
            id,
            "assigned_trip"
          );
          await supabase.from("notifications").insert(asRow);
        } else {
          const rows = buildNotificationRows(
            "trip_need_approval",
            {
              ...current,
              siteName,
              vehicleNumberOrId,
              driverName,
              vehicleType: current.vehicleType,
            },
            () => generateId("n")
          );
          for (const r of rows) await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [
      authUser?.id,
      refetch,
      state.assignedTrips,
      state.sites,
      state.users,
      state.vehicles,
    ]
  );

  const updateAssignedTrip = useCallback(
    async (id: string, patch: Partial<Pick<AssignedTrip, "notes">>) => {
      const row = assignedTripToRow(patch);
      delete (row as Record<string, unknown>).id;
      delete (row as Record<string, unknown>).site_id;
      delete (row as Record<string, unknown>).vehicle_id;
      delete (row as Record<string, unknown>).driver_id;
      delete (row as Record<string, unknown>).created_by;
      delete (row as Record<string, unknown>).created_at;
      delete (row as Record<string, unknown>).status;
      delete (row as Record<string, unknown>).started_at;
      delete (row as Record<string, unknown>).paused_at;
      delete (row as Record<string, unknown>).resumed_at;
      delete (row as Record<string, unknown>).pause_segments;
      delete (row as Record<string, unknown>).completed_at;
      delete (row as Record<string, unknown>).completed_by;
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase
        .from("assigned_trips")
        .update(row)
        .eq("id", id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const updateTask = useCallback(
    async (id: string, patch: Partial<Task>) => {
      const row = taskToRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from("tasks").update(row).eq("id", id);
      if (error) throw error;
      const task = state.tasks.find((t) => t.id === id);
      if (task) {
        const siteName = state.sites.find(
          (s) => s.id === (patch.siteId ?? task.siteId)
        )?.name;
        const merged = { ...task, ...patch, siteName };
        if (patch.status === "in_progress") {
          const taskAssignedRows = buildNotificationRows(
            "task_assigned",
            merged,
            () => generateId("n")
          );
          for (const r of taskAssignedRows)
            await supabase.from("notifications").insert(r);
        } else if (patch.status === "completed") {
          const taskRows = buildNotificationRows("task_completed", merged, () =>
            generateId("n")
          );
          for (const r of taskRows)
            await supabase.from("notifications").insert(r);
        } else if (
          patch.assignedTo !== undefined &&
          Array.isArray(patch.assignedTo) &&
          patch.assignedTo.length > 0
        ) {
          const taskAssignedRows = buildNotificationRows(
            "task_assigned",
            merged,
            () => generateId("n")
          );
          for (const r of taskAssignedRows)
            await supabase.from("notifications").insert(r);
        }
      }
      await refetch();
    },
    [refetch, state.tasks, state.sites]
  );

  const updateSiteTask = useCallback(
    async (id: string, patch: Partial<SiteTask>) => {
      const row = siteTaskToRow(patch);
      if (Object.keys(row).length === 0) return;
      const { data, error } = await supabase
        .from("site_tasks")
        .update(row)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error(
          "Update had no effect. Make sure this site is assigned to you (Assistant Supervisor) in Site settings."
        );
      }
      const task = state.siteTasks.find((t) => t.id === id);
      if (task) {
        const site = state.sites.find((s) => s.id === task.siteId);
        const payload = {
          id: task.id,
          siteId: task.siteId,
          taskName: patch.taskName ?? task.taskName,
          siteName: site?.name,
          status: patch.status ?? task.status,
        };
        if (patch.status === "completed") {
          const notifRows = buildNotificationRows(
            "site_task_completed",
            payload,
            () => generateId("n")
          );
          for (const r of notifRows) {
            supabase
              .from("notifications")
              .insert(r)
              .then(() => {});
          }
        }
      }
      refetch().catch(() => {});
    },
    [refetch, state.siteTasks, state.sites]
  );

  const addReport = useCallback(
    async (report: Report) => {
      const row = reportToRow(report);
      const { error } = await supabase.from("reports").insert(row);
      if (error) throw error;
      const reportRows = buildNotificationRows(
        "report_generated",
        { ...report },
        () => generateId("n")
      );
      for (const r of reportRows)
        await supabase.from("notifications").insert(r);
      await refetch();
    },
    [refetch]
  );

  const updateReport = useCallback(
    async (id: string, patch: Partial<Report>) => {
      const row = reportToRow(patch);
      if (Object.keys(row).length === 0) return;
      const { error } = await supabase.from("reports").update(row).eq("id", id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const addNotification = useCallback(
    async (n: Omit<Notification, "createdAt" | "read">) => {
      const row = notificationToRow({ ...n, read: false });
      const { error } = await supabase.from("notifications").insert(row);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const markNotificationRead = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id);
      if (error) throw error;
      await refetch();
    },
    [refetch]
  );

  const clearAllNotifications = useCallback(async () => {
    const role = state.users.find((u) => u.id === authUser?.id)?.role;
    if (!role) return;
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("target_role", role);
    if (error) throw error;
    await refetch();
  }, [authUser?.id, state.users, refetch]);

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
      setWorkPhotos,
      setSiteAssignments,
      setContractRateRwf,
      updateSite,
      addVehicle,
      updateVehicle,
      addExpense,
      deleteExpense,
      addTrip,
      updateTrip,
      addMachineSession,
      updateMachineSession,
      addSurvey,
      updateSurvey,
      addIssue,
      updateIssue,
      addWorkPhoto,
      setSiteAssignment,
      removeSiteAssignment,
      addUser,
      createUserByOwner,
      resetUserPassword,
      updateUser,
      refetch,
      syncFromWebsiteVehicles,
      addSite,
      addBudgetAllocation,
      setDriverVehicleAssignment,
      addAssignedTrip,
      updateAssignedTripStatus,
      updateAssignedTrip,
      updateTask,
      updateSiteTask,
      addReport,
      updateReport,
      addNotification,
      markNotificationRead,
      clearAllNotifications,
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
      setWorkPhotos,
      setSiteAssignments,
      setContractRateRwf,
      updateSite,
      addVehicle,
      updateVehicle,
      addExpense,
      deleteExpense,
      addTrip,
      updateTrip,
      addMachineSession,
      updateMachineSession,
      addSurvey,
      updateSurvey,
      addIssue,
      updateIssue,
      addWorkPhoto,
      setSiteAssignment,
      removeSiteAssignment,
      addUser,
      createUserByOwner,
      resetUserPassword,
      updateUser,
      refetch,
      syncFromWebsiteVehicles,
      addSite,
      addBudgetAllocation,
      setDriverVehicleAssignment,
      addAssignedTrip,
      updateAssignedTripStatus,
      updateAssignedTrip,
      updateTask,
      updateSiteTask,
      addReport,
      updateReport,
      addNotification,
      markNotificationRead,
      clearAllNotifications,
    ]
  );

  return value;
}

export function MockAppStoreProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const value = useSupabaseStore();
  return (
    <MockAppStoreContext.Provider value={value}>
      {children}
    </MockAppStoreContext.Provider>
  );
}

export function useMockAppStore(): MockAppStoreContextValue {
  const ctx = useContext(MockAppStoreContext);
  if (!ctx)
    throw new Error("useMockAppStore must be used within MockAppStoreProvider");
  return ctx;
}
