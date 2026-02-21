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
}

export type VehicleType = 'truck' | 'machine';

export interface Vehicle {
  id: string;
  siteId: string;
  type: VehicleType;
  vehicleNumberOrId: string;
  mileageKmPerLitre?: number;
  hoursPerLitre?: number;
  tankCapacityLitre: number;
  fuelBalanceLitre: number;
  idealConsumptionRange?: string;
  /** Trucks: health inputs for fuel prediction / efficiency monitoring */
  healthInputs?: string;
  /** Machines: ideal working range */
  idealWorkingRange?: string;
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
  contractRateRwf?: number;
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

/** Assistant Supervisor: which driver is assigned to which vehicle(s) at a site */
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
