import type {
  User,
  Site,
  Vehicle,
  Expense,
  Trip,
  MachineSession,
  Survey,
  Issue,
  WorkPhoto,
  SiteAssignment,
  DriverVehicleAssignment,
  AssignedTrip,
  Task,
  SiteTask,
  Operation,
  Report,
  Notification,
  BudgetAllocation,
} from '@/types';

/** DB row (snake_case) → App (camelCase) */

/** Normalize Postgres array column: can be string[] or Postgres text representation like "{id1,id2}". Returns trimmed, non-empty ids only. */
function toStringArray(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.map((x) => String(x).trim()).filter(Boolean);
  }
  const s = String(value).trim();
  if (!s || s === '{}') return [];
  if (s.startsWith('{') && s.endsWith('}')) {
    const inner = s.slice(1, -1);
    return inner ? inner.split(',').map((x) => String(x).replace(/^"|"$/g, '').trim()).filter(Boolean) : [];
  }
  return [s];
}

export function profileFromRow(row: Record<string, unknown>): User {
  return {
    id: String(row.id),
    name: String(row.name),
    email: String(row.email),
    role: row.role as User['role'],
    siteAccess: (row.site_access as string[]) ?? [],
    phone: row.phone != null ? String(row.phone) : undefined,
    profileImage: row.profile_image != null ? String(row.profile_image) : undefined,
    active: Boolean(row.active),
    lastLat: row.last_lat != null ? Number(row.last_lat) : undefined,
    lastLon: row.last_lon != null ? Number(row.last_lon) : undefined,
    locationUpdatedAt: row.location_updated_at != null ? String(row.location_updated_at) : undefined,
  };
}

export function siteFromRow(row: Record<string, unknown>): Site {
  return {
    id: String(row.id),
    name: String(row.name),
    location: String(row.location),
    status: row.status as Site['status'],
    startDate: row.start_date != null ? String(row.start_date) : '',
    expectedEndDate: row.expected_end_date != null ? String(row.expected_end_date) : undefined,
    actualCompletedAt: row.actual_completed_at != null ? String(row.actual_completed_at) : undefined,
    budget: Number(row.budget ?? 0),
    spent: Number(row.spent ?? 0),
    progress: Number(row.progress ?? 0),
    manager: row.manager != null ? String(row.manager) : undefined,
    assistantSupervisorId: row.assistant_supervisor_id != null ? String(row.assistant_supervisor_id) : undefined,
    surveyorId: row.surveyor_id != null ? String(row.surveyor_id) : undefined,
    driverIds: toStringArray(row.driver_ids),
    vehicleIds: toStringArray(row.vehicle_ids),
    contractRateRwf: row.contract_rate_rwf != null ? Number(row.contract_rate_rwf) : undefined,
    totalExcavatedM3: row.total_excavated_m3 != null ? Number(row.total_excavated_m3) : undefined,
  };
}

export function vehicleFromRow(row: Record<string, unknown>): Vehicle {
  return {
    id: String(row.id),
    siteId: row.site_id != null && row.site_id !== '' ? String(row.site_id) : undefined,
    type: row.type as Vehicle['type'],
    vehicleNumberOrId: String(row.vehicle_number_or_id),
    mileageKmPerLitre: row.mileage_km_per_litre != null ? Number(row.mileage_km_per_litre) : undefined,
    hoursPerLitre: row.hours_per_litre != null ? Number(row.hours_per_litre) : undefined,
    capacityTons: row.capacity_tons != null ? Number(row.capacity_tons) : undefined,
    tankCapacityLitre: Number(row.tank_capacity_litre ?? 0),
    fuelBalanceLitre: Number(row.fuel_balance_litre ?? 0),
    idealConsumptionRange: row.ideal_consumption_range != null ? String(row.ideal_consumption_range) : undefined,
    healthInputs: row.health_inputs != null ? String(row.health_inputs) : undefined,
    idealWorkingRange: row.ideal_working_range != null ? String(row.ideal_working_range) : undefined,
    status: (row.status as Vehicle['status']) ?? 'active',
  };
}

export function expenseFromRow(row: Record<string, unknown>): Expense {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    amountRwf: Number(row.amount_rwf ?? 0),
    description: String(row.description),
    date: row.date != null ? String(row.date) : '',
    type: row.type as Expense['type'],
    expenseCategory: row.expense_category != null && row.expense_category !== '' ? (row.expense_category as Expense['expenseCategory']) : undefined,
    vehicleId: row.vehicle_id != null ? String(row.vehicle_id) : undefined,
    litres: row.litres != null ? Number(row.litres) : undefined,
    costPerLitre: row.cost_per_litre != null ? Number(row.cost_per_litre) : undefined,
    fuelCost: row.fuel_cost != null ? Number(row.fuel_cost) : undefined,
    createdAt: row.created_at != null ? String(row.created_at) : '',
  };
}

export function tripFromRow(row: Record<string, unknown>): Trip {
  return {
    id: String(row.id),
    vehicleId: String(row.vehicle_id),
    driverId: String(row.driver_id),
    siteId: String(row.site_id),
    startTime: String(row.start_time),
    endTime: row.end_time != null ? String(row.end_time) : undefined,
    startLat: row.start_lat != null ? Number(row.start_lat) : undefined,
    startLon: row.start_lon != null ? Number(row.start_lon) : undefined,
    endLat: row.end_lat != null ? Number(row.end_lat) : undefined,
    endLon: row.end_lon != null ? Number(row.end_lon) : undefined,
    currentLat: row.current_lat != null ? Number(row.current_lat) : undefined,
    currentLon: row.current_lon != null ? Number(row.current_lon) : undefined,
    locationUpdatedAt: row.location_updated_at != null ? String(row.location_updated_at) : undefined,
    distanceKm: Number(row.distance_km ?? 0),
    loadQuantity: row.load_quantity != null ? String(row.load_quantity) : undefined,
    status: row.status as Trip['status'],
    fuelFilledAtStart: row.fuel_filled_at_start != null ? Number(row.fuel_filled_at_start) : undefined,
    fuelConsumed: row.fuel_consumed != null ? Number(row.fuel_consumed) : undefined,
    startPhotoUri: row.start_photo_uri != null ? String(row.start_photo_uri) : undefined,
    photoUri: row.photo_uri != null ? String(row.photo_uri) : undefined,
    createdAt: row.created_at != null ? String(row.created_at) : '',
  };
}

export function machineSessionFromRow(row: Record<string, unknown>): MachineSession {
  return {
    id: String(row.id),
    vehicleId: String(row.vehicle_id),
    driverId: String(row.driver_id),
    siteId: String(row.site_id),
    startTime: String(row.start_time),
    endTime: row.end_time != null ? String(row.end_time) : undefined,
    durationHours: row.duration_hours != null ? Number(row.duration_hours) : undefined,
    fuelConsumed: row.fuel_consumed != null ? Number(row.fuel_consumed) : undefined,
    status: row.status as MachineSession['status'],
    createdAt: row.created_at != null ? String(row.created_at) : '',
  };
}

export function surveyFromRow(row: Record<string, unknown>): Survey {
  const surveyDate = row.survey_date != null ? String(row.survey_date) : '';
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    surveyDate: surveyDate.slice(0, 10),
    volumeM3: row.volume_m3 != null ? Number(row.volume_m3) : 0,
    status: (row.status as Survey['status']) ?? 'approval_pending',
    surveyorId: String(row.surveyor_id),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    approvedById: row.approved_by_id != null ? String(row.approved_by_id) : undefined,
    approvedAt: row.approved_at != null ? String(row.approved_at) : undefined,
    revisionOf: row.revision_of != null ? String(row.revision_of) : undefined,
    notes: row.notes != null ? String(row.notes) : undefined,
  };
}

export function workPhotoFromRow(row: Record<string, unknown>): WorkPhoto {
  return {
    id: String(row.id),
    photoUrl: String(row.photo_url),
    thumbnailUrl: String(row.thumbnail_url),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    siteId: String(row.site_id),
    projectId: row.project_id != null ? String(row.project_id) : undefined,
    uploadedBy: String(row.uploaded_by),
    userRole: String(row.user_role),
    createdAt: row.created_at != null ? String(row.created_at) : '',
  };
}

export function workPhotoToRow(w: Partial<WorkPhoto>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (w.id != null) row.id = w.id;
  if (w.photoUrl != null) row.photo_url = w.photoUrl;
  if (w.thumbnailUrl != null) row.thumbnail_url = w.thumbnailUrl;
  if (w.latitude != null) row.latitude = w.latitude;
  if (w.longitude != null) row.longitude = w.longitude;
  if (w.siteId != null) row.site_id = w.siteId;
  if (w.projectId !== undefined) row.project_id = w.projectId ?? null;
  if (w.uploadedBy != null) row.uploaded_by = w.uploadedBy;
  if (w.userRole != null) row.user_role = w.userRole;
  return row;
}

export function issueFromRow(row: Record<string, unknown>): Issue {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    siteName: row.site_name != null ? String(row.site_name) : undefined,
    raisedById: String(row.raised_by_id),
    createdByRole: row.created_by_role != null ? String(row.created_by_role) : undefined,
    description: String(row.description),
    imageUris: (row.image_uris as string[]) ?? [],
    status: row.status as Issue['status'],
    createdAt: row.created_at != null ? String(row.created_at) : '',
    resolvedBy: row.resolved_by != null ? String(row.resolved_by) : undefined,
    resolvedAt: row.resolved_at != null ? String(row.resolved_at) : undefined,
  };
}

export function siteAssignmentFromRow(row: Record<string, unknown>): SiteAssignment {
  return {
    siteId: String(row.site_id),
    userId: String(row.user_id),
    role: String(row.role),
    vehicleIds: toStringArray(row.vehicle_ids),
  };
}

export function driverVehicleAssignmentFromRow(row: Record<string, unknown>): DriverVehicleAssignment {
  return {
    siteId: String(row.site_id),
    driverId: String(row.driver_id),
    vehicleIds: toStringArray(row.vehicle_ids),
  };
}

function parsePauseSegments(value: unknown): { startedAt: string; endedAt: string }[] {
  if (value == null) return [];
  if (!Array.isArray(value)) return [];
  return value
    .filter((x): x is { started_at?: string; ended_at?: string } => x != null && typeof x === 'object')
    .map((x) => ({ startedAt: String(x.started_at ?? ''), endedAt: String(x.ended_at ?? '') }))
    .filter((s) => s.startedAt && s.endedAt);
}

export function assignedTripFromRow(row: Record<string, unknown>): AssignedTrip {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    vehicleId: String(row.vehicle_id),
    driverId: String(row.driver_id),
    vehicleType: row.vehicle_type as AssignedTrip['vehicleType'],
    taskType: row.task_type != null ? String(row.task_type) : null,
    status: row.status as AssignedTrip['status'],
    notes: row.notes != null ? String(row.notes) : null,
    createdBy: String(row.created_by),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    startedAt: row.started_at != null ? String(row.started_at) : null,
    pausedAt: row.paused_at != null ? String(row.paused_at) : null,
    resumedAt: row.resumed_at != null ? String(row.resumed_at) : null,
    pauseSegments: parsePauseSegments(row.pause_segments),
    completedAt: row.completed_at != null ? String(row.completed_at) : null,
    completedBy: row.completed_by != null ? String(row.completed_by) : null,
  };
}

export function assignedTripToRow(a: Partial<AssignedTrip>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (a.id != null) row.id = a.id;
  if (a.siteId != null) row.site_id = a.siteId;
  if (a.vehicleId != null) row.vehicle_id = a.vehicleId;
  if (a.driverId != null) row.driver_id = a.driverId;
  if (a.vehicleType != null) row.vehicle_type = a.vehicleType;
  if (a.taskType !== undefined) row.task_type = a.taskType ?? null;
  if (a.status != null) row.status = a.status;
  if (a.notes !== undefined) row.notes = a.notes ?? null;
  if (a.createdBy != null) row.created_by = a.createdBy;
  if (a.createdAt != null) row.created_at = a.createdAt;
  if (a.startedAt !== undefined) row.started_at = a.startedAt ?? null;
  if (a.pausedAt !== undefined) row.paused_at = a.pausedAt ?? null;
  if (a.resumedAt !== undefined) row.resumed_at = a.resumedAt ?? null;
  if (a.pauseSegments !== undefined) {
    row.pause_segments = a.pauseSegments.map((s) => ({ started_at: s.startedAt, ended_at: s.endedAt }));
  }
  if (a.completedAt !== undefined) row.completed_at = a.completedAt ?? null;
  if (a.completedBy !== undefined) row.completed_by = a.completedBy ?? null;
  return row;
}

export function taskFromRow(row: Record<string, unknown>): Task {
  return {
    id: String(row.id),
    title: String(row.title),
    description: String(row.description),
    siteId: String(row.site_id),
    siteName: row.site_name != null ? String(row.site_name) : '',
    assignedTo: (row.assigned_to as string[]) ?? [],
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    dueDate: row.due_date != null ? String(row.due_date) : '',
    progress: Number(row.progress ?? 0),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    updatedAt: row.updated_at != null ? String(row.updated_at) : '',
    photos: (row.photos as string[]) ?? [],
  };
}

export function siteTaskFromRow(row: Record<string, unknown>): SiteTask {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    taskName: String(row.task_name),
    weight: Number(row.weight ?? 0),
    status: String(row.status) as SiteTask['status'],
    progress: Number(row.progress ?? 0),
    notes: row.notes != null ? String(row.notes) : null,
    updatedBy: row.updated_by != null ? String(row.updated_by) : null,
    updatedAt: row.updated_at != null ? String(row.updated_at) : '',
  };
}

export function operationFromRow(row: Record<string, unknown>): Operation {
  return {
    id: String(row.id),
    name: String(row.name),
    siteId: String(row.site_id),
    siteName: row.site_name != null ? String(row.site_name) : '',
    type: String(row.type),
    status: row.status as Operation['status'],
    budget: Number(row.budget ?? 0),
    spent: Number(row.spent ?? 0),
    startDate: row.start_date != null ? String(row.start_date) : '',
    endDate: row.end_date != null ? String(row.end_date) : undefined,
    crew: (row.crew as string[]) ?? [],
  };
}

export function reportFromRow(row: Record<string, unknown>): Report {
  return {
    id: String(row.id),
    title: String(row.title),
    type: row.type as Report['type'],
    generatedDate: row.generated_date != null ? String(row.generated_date) : '',
    period: String(row.period),
    data: row.data ?? {},
  };
}

export function notificationFromRow(row: Record<string, unknown>): Notification {
  return {
    id: String(row.id),
    targetRole: String(row.target_role),
    title: String(row.title),
    body: String(row.body),
    createdAt: row.created_at != null ? String(row.created_at) : '',
    read: Boolean(row.read),
    linkId: row.link_id != null ? String(row.link_id) : undefined,
    linkType: row.link_type != null ? String(row.link_type) : undefined,
  };
}

/** App (camelCase) → DB row (snake_case) for insert/update */

export function profileToRow(u: Partial<User>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (u.name != null) row.name = u.name;
  if (u.email != null) row.email = u.email;
  if (u.role != null) row.role = u.role;
  if (u.siteAccess != null) row.site_access = u.siteAccess;
  if (u.phone !== undefined) row.phone = u.phone;
  if (u.profileImage !== undefined) row.profile_image = u.profileImage;
  if (u.active !== undefined) row.active = u.active;
  if (u.lastLat !== undefined) row.last_lat = u.lastLat ?? null;
  if (u.lastLon !== undefined) row.last_lon = u.lastLon ?? null;
  if (u.locationUpdatedAt !== undefined) row.location_updated_at = u.locationUpdatedAt ?? null;
  return row;
}

export function siteToRow(s: Partial<Site>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.id != null) row.id = s.id;
  if (s.name != null) row.name = s.name;
  if (s.location != null) row.location = s.location;
  if (s.status != null) row.status = s.status;
  if (s.startDate != null) row.start_date = s.startDate;
  if (s.expectedEndDate !== undefined) row.expected_end_date = s.expectedEndDate ?? null;
  if (s.actualCompletedAt !== undefined) row.actual_completed_at = s.actualCompletedAt ?? null;
  if (s.budget != null) row.budget = s.budget;
  if (s.spent != null) row.spent = s.spent;
  if (s.progress != null) row.progress = s.progress;
  if (s.manager !== undefined) row.manager = s.manager;
  if (s.assistantSupervisorId !== undefined) row.assistant_supervisor_id = s.assistantSupervisorId;
  if (s.surveyorId !== undefined) row.surveyor_id = s.surveyorId;
  if (s.driverIds != null) row.driver_ids = s.driverIds;
  if (s.vehicleIds != null) row.vehicle_ids = s.vehicleIds;
  if (s.contractRateRwf !== undefined) row.contract_rate_rwf = s.contractRateRwf ?? null;
  return row;
}

export function budgetAllocationFromRow(row: Record<string, unknown>): BudgetAllocation {
  return {
    id: String(row.id),
    siteId: String(row.site_id),
    amountRwf: Number(row.amount_rwf ?? 0),
    allocatedAt: row.allocated_at != null ? String(row.allocated_at) : '',
    allocatedById: row.allocated_by != null ? String(row.allocated_by) : undefined,
  };
}

export function budgetAllocationToRow(b: Partial<BudgetAllocation>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (b.id != null) row.id = b.id;
  if (b.siteId != null) row.site_id = b.siteId;
  if (b.amountRwf != null) row.amount_rwf = b.amountRwf;
  if (b.allocatedAt != null) row.allocated_at = b.allocatedAt;
  if (b.allocatedById !== undefined) row.allocated_by = b.allocatedById ?? null;
  return row;
}

export function vehicleToRow(v: Partial<Vehicle>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (v.id != null) row.id = v.id;
  if (v.siteId !== undefined) row.site_id = (v.siteId != null && v.siteId !== '') ? v.siteId : null;
  if (v.type != null) row.type = v.type;
  if (v.vehicleNumberOrId != null) row.vehicle_number_or_id = v.vehicleNumberOrId;
  if (v.mileageKmPerLitre !== undefined) row.mileage_km_per_litre = v.mileageKmPerLitre;
  if (v.hoursPerLitre !== undefined) row.hours_per_litre = v.hoursPerLitre;
  if (v.tankCapacityLitre !== undefined) row.tank_capacity_litre = Number(v.tankCapacityLitre);
  if (v.fuelBalanceLitre !== undefined) row.fuel_balance_litre = Number(v.fuelBalanceLitre);
  if (v.idealConsumptionRange !== undefined) row.ideal_consumption_range = v.idealConsumptionRange;
  if (v.healthInputs !== undefined) row.health_inputs = v.healthInputs;
  if (v.idealWorkingRange !== undefined) row.ideal_working_range = v.idealWorkingRange;
  if (v.capacityTons !== undefined) row.capacity_tons = v.capacityTons;
  if (v.status !== undefined) row.status = v.status;
  return row;
}

export function expenseToRow(e: Partial<Expense>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (e.id != null) row.id = e.id;
  if (e.siteId != null) row.site_id = e.siteId;
  if (e.amountRwf != null) row.amount_rwf = e.amountRwf;
  if (e.description != null) row.description = e.description;
  if (e.date != null) row.date = e.date;
  if (e.type != null) row.type = e.type;
  if (e.expenseCategory !== undefined && e.expenseCategory != null) row.expense_category = e.expenseCategory;
  if (e.vehicleId !== undefined) row.vehicle_id = e.vehicleId;
  if (e.litres !== undefined) row.litres = e.litres;
  if (e.costPerLitre !== undefined) row.cost_per_litre = e.costPerLitre;
  if (e.fuelCost !== undefined) row.fuel_cost = e.fuelCost;
  return row;
}

export function tripToRow(t: Partial<Trip>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.id != null) row.id = t.id;
  if (t.vehicleId != null) row.vehicle_id = t.vehicleId;
  if (t.driverId != null) row.driver_id = t.driverId;
  if (t.siteId != null) row.site_id = t.siteId;
  if (t.startTime != null) row.start_time = t.startTime;
  if (t.endTime !== undefined) row.end_time = t.endTime;
  if (t.startLat !== undefined) row.start_lat = t.startLat;
  if (t.startLon !== undefined) row.start_lon = t.startLon;
  if (t.endLat !== undefined) row.end_lat = t.endLat;
  if (t.endLon !== undefined) row.end_lon = t.endLon;
  if (t.currentLat !== undefined) row.current_lat = t.currentLat ?? null;
  if (t.currentLon !== undefined) row.current_lon = t.currentLon ?? null;
  if (t.locationUpdatedAt !== undefined) row.location_updated_at = t.locationUpdatedAt ?? null;
  if (t.distanceKm != null) row.distance_km = t.distanceKm;
  if (t.loadQuantity !== undefined) row.load_quantity = t.loadQuantity ?? null;
  if (t.status != null) row.status = t.status;
  if (t.fuelFilledAtStart !== undefined) row.fuel_filled_at_start = t.fuelFilledAtStart ?? null;
  if (t.fuelConsumed !== undefined) row.fuel_consumed = t.fuelConsumed ?? null;
  if (t.startPhotoUri !== undefined) row.start_photo_uri = t.startPhotoUri ?? null;
  if (t.photoUri !== undefined) row.photo_uri = t.photoUri ?? null;
  return row;
}

/**
 * Remove undefined values from a row so PostgREST never receives undefined (avoids 400 Bad Request).
 * Also removes `id` when doing UPDATE so we don't try to change the primary key.
 */
export function stripUndefinedAndId<T extends Record<string, unknown>>(
  row: T,
  options: { omitId?: boolean } = {}
): Record<string, unknown> {
  const { omitId = true } = options;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (omitId && k === 'id') continue;
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

/** Allowed columns for trips UPDATE (PostgREST can 400 on unknown or wrong-type columns). */
const TRIPS_UPDATE_KEYS = new Set([
  'end_time', 'start_lat', 'start_lon', 'end_lat', 'end_lon',
  'current_lat', 'current_lon', 'location_updated_at', 'distance_km',
  'load_quantity', 'status', 'fuel_filled_at_start', 'fuel_consumed', 'photo_uri',
]);

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Build a safe trip UPDATE payload: only allowed keys, numeric columns as numbers, no undefined.
 * Use this for PATCH /trips to avoid 400 Bad Request.
 */
export function tripUpdatePayload(patch: Partial<Trip>): Record<string, unknown> {
  const row = tripToRow(patch);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === 'id') continue;
    if (v === undefined) continue;
    if (!TRIPS_UPDATE_KEYS.has(k)) continue;
    if (['start_lat', 'start_lon', 'end_lat', 'end_lon', 'current_lat', 'current_lon', 'distance_km', 'fuel_filled_at_start', 'fuel_consumed'].includes(k)) {
      const n = toNum(v);
      if (n !== null) out[k] = n;
      else if (v === null) out[k] = null;
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function machineSessionToRow(m: Partial<MachineSession>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (m.id != null) row.id = m.id;
  if (m.vehicleId != null) row.vehicle_id = m.vehicleId;
  if (m.driverId != null) row.driver_id = m.driverId;
  if (m.siteId != null) row.site_id = m.siteId;
  if (m.startTime != null) row.start_time = m.startTime;
  if (m.endTime !== undefined) row.end_time = m.endTime;
  if (m.durationHours !== undefined) row.duration_hours = m.durationHours;
  if (m.fuelConsumed !== undefined) row.fuel_consumed = m.fuelConsumed;
  if (m.status != null) row.status = m.status;
  return row;
}

export function surveyToRow(s: Partial<Survey>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (s.id != null) row.id = s.id;
  if (s.siteId != null) row.site_id = s.siteId;
  if (s.surveyDate != null) row.survey_date = s.surveyDate;
  if (s.volumeM3 !== undefined) row.volume_m3 = s.volumeM3;
  if (s.status != null) row.status = s.status;
  if (s.surveyorId != null) row.surveyor_id = s.surveyorId;
  if (s.approvedById !== undefined) row.approved_by_id = s.approvedById;
  if (s.approvedAt !== undefined) row.approved_at = s.approvedAt;
  if (s.revisionOf !== undefined) row.revision_of = s.revisionOf ?? null;
  if (s.notes !== undefined) row.notes = s.notes ?? null;
  return row;
}

export function issueToRow(i: Partial<Issue>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (i.id != null) row.id = i.id;
  if (i.siteId != null) row.site_id = i.siteId;
  if (i.siteName !== undefined) row.site_name = i.siteName;
  if (i.raisedById != null) row.raised_by_id = i.raisedById;
  if (i.createdByRole !== undefined) row.created_by_role = i.createdByRole;
  if (i.description != null) row.description = i.description;
  if (i.imageUris != null) row.image_uris = i.imageUris;
  if (i.status != null) row.status = i.status;
  if (i.resolvedBy !== undefined) row.resolved_by = i.resolvedBy || null;
  if (i.resolvedAt !== undefined) row.resolved_at = i.resolvedAt || null;
  return row;
}

export function taskToRow(t: Partial<Task>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.id != null) row.id = t.id;
  if (t.title != null) row.title = t.title;
  if (t.description != null) row.description = t.description;
  if (t.siteId != null) row.site_id = t.siteId;
  if (t.siteName !== undefined) row.site_name = t.siteName;
  if (t.assignedTo != null) row.assigned_to = t.assignedTo;
  if (t.status != null) row.status = t.status;
  if (t.priority != null) row.priority = t.priority;
  if (t.dueDate != null) row.due_date = t.dueDate;
  if (t.progress != null) row.progress = t.progress;
  if (t.updatedAt !== undefined) row.updated_at = t.updatedAt;
  if (t.photos != null) row.photos = t.photos;
  return row;
}

export function siteTaskToRow(t: Partial<SiteTask>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (t.id != null) row.id = t.id;
  if (t.siteId != null) row.site_id = t.siteId;
  if (t.taskName != null) row.task_name = t.taskName;
  if (t.weight != null) row.weight = t.weight;
  if (t.status != null) row.status = t.status;
  if (t.progress != null) row.progress = t.progress;
  if (t.notes !== undefined) row.notes = t.notes ?? null;
  if (t.updatedBy !== undefined) row.updated_by = t.updatedBy ?? null;
  if (t.updatedAt !== undefined) row.updated_at = t.updatedAt ?? null;
  return row;
}

export function operationToRow(o: Partial<Operation>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (o.id != null) row.id = o.id;
  if (o.name != null) row.name = o.name;
  if (o.siteId != null) row.site_id = o.siteId;
  if (o.siteName !== undefined) row.site_name = o.siteName;
  if (o.type != null) row.type = o.type;
  if (o.status != null) row.status = o.status;
  if (o.budget != null) row.budget = o.budget;
  if (o.spent != null) row.spent = o.spent;
  if (o.startDate != null) row.start_date = o.startDate;
  if (o.endDate !== undefined) row.end_date = o.endDate;
  if (o.crew != null) row.crew = o.crew;
  return row;
}

export function reportToRow(r: Partial<Report>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (r.id != null) row.id = r.id;
  if (r.title != null) row.title = r.title;
  if (r.type != null) row.type = r.type;
  if (r.generatedDate != null) row.generated_date = r.generatedDate;
  if (r.period != null) row.period = r.period;
  if (r.data !== undefined) row.data = r.data;
  return row;
}

export function notificationToRow(n: Partial<Notification>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if (n.id != null) row.id = n.id;
  if (n.targetRole != null) row.target_role = n.targetRole;
  if (n.title != null) row.title = n.title;
  if (n.body != null) row.body = n.body;
  if (n.createdAt != null) row.created_at = n.createdAt;
  if (n.read !== undefined) row.read = n.read;
  if (n.linkId !== undefined) row.link_id = n.linkId;
  if (n.linkType !== undefined) row.link_type = n.linkType;
  return row;
}
