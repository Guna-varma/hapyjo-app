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

export interface Vehicle {
  id: string;
  /** Optional. Omitted = free vehicle (not assigned to any site). */
  siteId?: string;
  type: VehicleType;
  vehicleNumberOrId: string;
  mileageKmPerLitre?: number;
  /** Machine only: fuel consumption in L/hour (Lt/hour). */
  hoursPerLitre?: number;
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

export interface Survey {
  id: string;
  type: string;
  siteId: string;
  siteName: string;
  surveyorId: string;
  measurements: Record<string, any>;
  location?: {
    latitude: number;
    longitude: number;
  };
  photos?: string[];
  status: 'draft' | 'submitted' | 'approved';
  createdAt: string;
  beforeFileContent?: string;
  afterFileContent?: string;
  workVolume?: number;
  approvedById?: string;
  approvedAt?: string;
}

export type ExpenseType = 'general' | 'fuel';

export interface Expense {
  id: string;
  siteId: string;
  amountRwf: number;
  description: string;
  date: string;
  type: ExpenseType;
  vehicleId?: string;
  litres?: number;
  costPerLitre?: number;
  fuelCost?: number;
  createdAt: string;
}

export interface Trip {
  id: string;
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
  currentLat?: number;
  currentLon?: number;
  locationUpdatedAt?: string;
  distanceKm: number;
  loadQuantity?: string;
  status: 'in_progress' | 'completed';
  fuelFilledAtStart?: number;
  fuelConsumed?: number;
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

export interface Issue {
  id: string;
  siteId: string;
  siteName?: string;
  raisedById: string;
  description: string;
  imageUris: string[];
  status: 'open' | 'acknowledged' | 'resolved';
  createdAt: string;
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
