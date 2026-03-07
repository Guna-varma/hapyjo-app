export type UserRole =
  | 'admin'
  | 'owner'
  | 'head_supervisor'
  | 'accountant'
  | 'assistant_supervisor'
  | 'surveyor'
  | 'driver_truck'
  | 'driver_machine';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  siteAccess?: string[];
  phone?: string;
  profileImage?: string;
  active: boolean;
  /** Last known position (drivers); updated on login/screen focus when not on a trip */
  lastLat?: number;
  lastLon?: number;
  locationUpdatedAt?: string;
}

export type VehicleType = 'truck' | 'machine';

/** active = available for use; inactive = soft-deleted (no hard delete for head_sup/supervisor). Allocated is derived from driver_vehicle_assignments. */
export type VehicleStatus = 'active' | 'inactive';

/** Fuel model: km_per_l = truck (fuel_rate = km/L), l_per_hour = machine (fuel_rate = L/hr). */
export type VehicleFuelMode = 'km_per_l' | 'l_per_hour';

export interface Vehicle {
  id: string;
  /** Optional. Omitted = free vehicle (not assigned to any site). */
  siteId?: string;
  type: VehicleType;
  vehicleNumberOrId: string;
  mileageKmPerLitre?: number;
  /** Machine only: hours per litre (hr/L) — operating hours per litre of fuel. */
  hoursPerLitre?: number;
  /** Trip fuel calculation: km_per_l (truck) or l_per_hour (machine). */
  fuelMode?: VehicleFuelMode | null;
  /** Truck: km per litre. Machine: litres per hour. */
  fuelRate?: number | null;
  /** Truck only: load capacity in tons (for rental/customer info). */
  capacityTons?: number;
  tankCapacityLitre: number;
  fuelBalanceLitre: number;
  idealConsumptionRange?: string;
  /** Trucks: health inputs for fuel prediction / efficiency monitoring */
  healthInputs?: string;
  /** Machines: ideal working range */
  idealWorkingRange?: string;
  /** active | inactive; default active. Head/supervisor cannot hard delete. */
  status?: VehicleStatus;
}

export interface Site {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'completed';
  startDate: string;
  /** Expected end date (target); Head Supervisor can edit. */
  expectedEndDate?: string;
  /** Set when status becomes 'completed' (actual completion time). */
  actualCompletedAt?: string;
  budget: number;
  spent: number;
  progress: number;
  manager?: string;
  assistantSupervisorId?: string;
  surveyorId?: string;
  driverIds?: string[];
  vehicleIds?: string[];
  /** When updating, pass null to clear the rate. */
  contractRateRwf?: number | null;
  /** Running total of approved survey volume (maintained by DB trigger). Use for fast progress. */
  totalExcavatedM3?: number;
}

/** One row per budget allocation (additive). Total site budget = sum of allocations. */
export interface BudgetAllocation {
  id: string;
  siteId: string;
  amountRwf: number;
  allocatedAt: string;
  allocatedById?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  siteId: string;
  siteName: string;
  assignedTo: string[];
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  progress: number;
  createdAt: string;
  updatedAt: string;
  photos?: string[];
}

export type SiteTaskStatus = 'not_started' | 'started' | 'in_progress' | 'completed';

/** Weighted task used to calculate a site's overall progress. */
export interface SiteTask {
  id: string;
  siteId: string;
  taskName: string;
  /** Weight percentage (1..100). Sum of a site's weights should equal 100. */
  weight: number;
  status: SiteTaskStatus;
  /** Integer percent: 0..100. (0 only allowed when status = not_started; completed forces 100.) */
  progress: number;
  notes?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

/** Lightweight survey: only result stored (no files). */
export interface Survey {
  id: string;
  siteId: string;
  surveyDate: string; // ISO date YYYY-MM-DD
  volumeM3: number;
  status: 'approval_pending' | 'approved' | 'rejected';
  surveyorId: string;
  createdAt: string;
  approvedById?: string | null;
  approvedAt?: string | null;
  revisionOf?: string;
  notes?: string | null;
}

export type ExpenseType = 'general' | 'fuel';

/** Type of expense: fuel (set automatically for fuel entries) or one of the general categories. */
export type ExpenseCategory =
  | 'fuel'
  | 'maintenance'
  | 'spare_parts'
  | 'operator_wages'
  | 'labour_cost'
  | 'machine_rental'
  | 'vehicle_rental'
  | 'tools_equipment'
  | 'food_allowance'
  | 'office_expense'
  | 'other';

export interface Expense {
  id: string;
  siteId: string;
  amountRwf: number;
  description: string;
  date: string;
  type: ExpenseType;
  /** Type of expense: 'fuel' for fuel entries, or one of the general categories. */
  expenseCategory?: ExpenseCategory | null;
  vehicleId?: string;
  litres?: number;
  costPerLitre?: number;
  fuelCost?: number;
  createdAt: string;
}

export interface Trip {
  id: string;
  assignedTripId?: string | null;
  vehicleId: string;
  driverId: string;
  siteId: string;
  startTime: string;
  endTime?: string;
  startLat?: number;
  startLon?: number;
  endLat?: number;
  endLon?: number;
  /** Real-time: current driver position during in_progress trip */
  currentLat?: number | null;
  currentLon?: number | null;
  locationUpdatedAt?: string | null;
  distanceKm: number;
  loadQuantity?: string;
  status: 'in_progress' | 'completed';
  fuelFilledAtStart?: number;
  fuelConsumed?: number;
  /** Start trip proof photo URL (speedometer). Set on trip start. */
  startPhotoUri?: string;
  /** End trip proof photo URL. Set on trip end (replaces any temporary use of photo_uri at start). */
  photoUri?: string;
  createdAt: string;
}

export interface MachineSession {
  id: string;
  vehicleId: string;
  driverId: string;
  siteId: string;
  startTime: string;
  endTime?: string;
  durationHours?: number;
  fuelConsumed?: number;
  status: 'in_progress' | 'completed';
  createdAt: string;
}

/** Status for assigned trips (trucks: TRIP_*, machines: TASK_*). See lib/tripLifecycle. */
export type AssignedTripStatus =
  | 'TRIP_ASSIGNED' | 'TRIP_PENDING' | 'TRIP_STARTED' | 'TRIP_PAUSED' | 'TRIP_RESUMED' | 'TRIP_IN_PROGRESS' | 'TRIP_NEED_APPROVAL' | 'TRIP_COMPLETED'
  | 'TASK_ASSIGNED' | 'TASK_PENDING' | 'TASK_STARTED' | 'TASK_PAUSED' | 'TASK_RESUMED' | 'TASK_IN_PROGRESS' | 'TASK_NEED_APPROVAL' | 'TASK_COMPLETED';

/** Assigned trip (truck) or task (machine) with lifecycle status. */
export interface AssignedTrip {
  id: string;
  siteId: string;
  vehicleId: string;
  driverId: string;
  vehicleType: 'truck' | 'machine';
  taskType?: string | null;
  status: AssignedTripStatus;
  notes?: string | null;
  createdBy: string;
  createdAt: string;
  startedAt?: string | null;
  pausedAt?: string | null;
  resumedAt?: string | null;
  /** Array of { startedAt, endedAt } for each pause segment (for duration calc). */
  pauseSegments?: { startedAt: string; endedAt: string }[];
  completedAt?: string | null;
  completedBy?: string | null;
  /** Start: photo URL (compressed ~50KB), GPS, timestamp stored in startedAt */
  startPhotoUrl?: string | null;
  endPhotoUrl?: string | null;
  startGpsLat?: number | null;
  startGpsLng?: number | null;
  endGpsLat?: number | null;
  endGpsLng?: number | null;
  /** Supervisor-entered: truck = odometer km, machine = hour meter */
  startReading?: number | null;
  endReading?: number | null;
  /** Calculated after supervisor entry: truck distance km, machine hours */
  distanceKm?: number | null;
  hoursUsed?: number | null;
  fuelUsedL?: number | null;
  /** When driver ended trip (status = NEED_APPROVAL) */
  endedAt?: string | null;
}

export interface Issue {
  id: string;
  siteId: string;
  siteName?: string;
  raisedById: string;
  /** Role of the creator (assistant_supervisor, driver_truck, driver_machine). */
  createdByRole?: string;
  description: string;
  /** Storage paths in bucket issue-images (e.g. issue/<issueId>/file.jpg). Deleted when issue is resolved. */
  imageUris: string[];
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
  /** Set when status = resolved. */
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface SiteAssignment {
  siteId: string;
  userId: string;
  role: string;
  vehicleIds?: string[];
}

/** Assistant Supervisor: which driver (truck) or operator (machine) is assigned to which vehicle(s) at a site */
export interface DriverVehicleAssignment {
  siteId: string;
  driverId: string;
  vehicleIds: string[];
}

export interface Operation {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  type: string;
  status: 'planned' | 'ongoing' | 'completed';
  budget: number;
  spent: number;
  startDate: string;
  endDate?: string;
  crew: string[];
}

export interface Report {
  id: string;
  title: string;
  type: 'financial' | 'operations' | 'site_performance';
  generatedDate: string;
  period: string;
  data: any;
}

export interface WorkPhoto {
  id: string;
  photoUrl: string;
  thumbnailUrl: string;
  latitude: number;
  longitude: number;
  siteId: string;
  siteName?: string;
  projectId?: string;
  uploadedBy: string;
  uploadedByName?: string;
  userRole: string;
  createdAt: string;
}

export interface Notification {
  id: string;
  targetRole: string;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  linkId?: string;
  linkType?: string;
}
