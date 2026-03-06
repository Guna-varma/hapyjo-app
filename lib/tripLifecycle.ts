/**
 * Trip (truck) and Task (machine) lifecycle – single source of truth for assigned trip/task status and transitions.
 *
 * Naming: TRIP_* for truck flows, TASK_* for machine flows.
 *
 * Enforces:
 * - Driver/Operator: execute only (start, pause, resume, complete → NEED_APPROVAL).
 * - Assistant Supervisor: verify only (NEED_APPROVAL → COMPLETED).
 * - System: ASSIGNED → PENDING (after 1 day), RESUMED → IN_PROGRESS (after 2 min).
 *
 * No role may skip stages (e.g. ASSIGNED → COMPLETED or STARTED → COMPLETED).
 */

/** Truck (trip) statuses */
export const TRIP_STATUS = [
  'TRIP_ASSIGNED',
  'TRIP_PENDING',
  'TRIP_STARTED',
  'TRIP_PAUSED',
  'TRIP_RESUMED',
  'TRIP_IN_PROGRESS',
  'TRIP_NEED_APPROVAL',
  'TRIP_COMPLETED',
] as const;

/** Machine (task) statuses */
export const TASK_STATUS = [
  'TASK_ASSIGNED',
  'TASK_PENDING',
  'TASK_STARTED',
  'TASK_PAUSED',
  'TASK_RESUMED',
  'TASK_IN_PROGRESS',
  'TASK_NEED_APPROVAL',
  'TASK_COMPLETED',
] as const;

export type TripStatus = (typeof TRIP_STATUS)[number];
export type TaskStatus = (typeof TASK_STATUS)[number];
export type AssignedTripStatus = TripStatus | TaskStatus;

/** All statuses (for DB check constraint and UI). */
export const ASSIGNED_TRIP_STATUS = [...TRIP_STATUS, ...TASK_STATUS] as const;

/** Role that can perform a status change (driver_truck + driver_machine = "driver" for trips/tasks). */
export type TripTransitionRole = 'driver' | 'assistant_supervisor' | 'system';

/** Phase without prefix – used for transition rules. */
type Phase =
  | 'ASSIGNED'
  | 'PENDING'
  | 'STARTED'
  | 'PAUSED'
  | 'RESUMED'
  | 'IN_PROGRESS'
  | 'NEED_APPROVAL'
  | 'COMPLETED';

function getPhase(s: AssignedTripStatus): Phase {
  if (s.startsWith('TRIP_')) return s.slice(5) as Phase;
  if (s.startsWith('TASK_')) return s.slice(5) as Phase;
  return s as Phase;
}

function samePrefix(a: AssignedTripStatus, b: AssignedTripStatus): boolean {
  const preA = a.startsWith('TRIP_') ? 'TRIP' : a.startsWith('TASK_') ? 'TASK' : '';
  const preB = b.startsWith('TRIP_') ? 'TRIP' : b.startsWith('TASK_') ? 'TASK' : '';
  return preA === preB && preA !== '';
}

function statusFromPhase(phase: Phase, prefix: 'TRIP' | 'TASK'): AssignedTripStatus {
  const s = `${prefix}_${phase}`;
  return s as AssignedTripStatus;
}

/** Allowed phase transitions per role. */
const DRIVER_PHASE_TRANSITIONS: Partial<Record<Phase, Phase[]>> = {
  ASSIGNED: ['STARTED'],
  STARTED: ['PAUSED'],
  PAUSED: ['RESUMED'],
  IN_PROGRESS: ['NEED_APPROVAL'],
};
const ASSISTANT_SUPERVISOR_PHASE_TRANSITIONS: Partial<Record<Phase, Phase[]>> = {
  NEED_APPROVAL: ['COMPLETED'],
};
const SYSTEM_PHASE_TRANSITIONS: Partial<Record<Phase, Phase[]>> = {
  ASSIGNED: ['PENDING'],
  RESUMED: ['IN_PROGRESS'],
};

/**
 * Returns true if the given role is allowed to change status from `fromStatus` to `toStatus`.
 * Both statuses must share the same prefix (TRIP_ or TASK_).
 */
export function canTransition(
  fromStatus: AssignedTripStatus,
  toStatus: AssignedTripStatus,
  role: TripTransitionRole
): boolean {
  if (fromStatus === toStatus) return false;
  if (!samePrefix(fromStatus, toStatus)) return false;

  const fromPhase = getPhase(fromStatus);
  const toPhase = getPhase(toStatus);
  const map =
    role === 'driver'
      ? DRIVER_PHASE_TRANSITIONS
      : role === 'assistant_supervisor'
        ? ASSISTANT_SUPERVISOR_PHASE_TRANSITIONS
        : SYSTEM_PHASE_TRANSITIONS;
  const allowed = map[fromPhase];
  return allowed != null && allowed.includes(toPhase);
}

/**
 * Resolve app role to trip/task transition role for drivers/operators.
 */
export function getTripTransitionRole(userRole: string): TripTransitionRole | null {
  if (userRole === 'driver_truck' || userRole === 'driver_machine') return 'driver';
  if (userRole === 'assistant_supervisor') return 'assistant_supervisor';
  return null;
}

/**
 * Human-readable label for each status (for UI). TRIP_* = "Trip ...", TASK_* = "Task ...".
 */
export const ASSIGNED_TRIP_STATUS_LABELS: Record<AssignedTripStatus, string> = {
  TRIP_ASSIGNED: 'Trip assigned',
  TRIP_PENDING: 'Trip pending',
  TRIP_STARTED: 'Trip started',
  TRIP_PAUSED: 'Trip paused',
  TRIP_RESUMED: 'Trip resumed',
  TRIP_IN_PROGRESS: 'Trip in progress',
  TRIP_NEED_APPROVAL: 'Trip need approval',
  TRIP_COMPLETED: 'Trip completed',
  TASK_ASSIGNED: 'Task assigned',
  TASK_PENDING: 'Task pending',
  TASK_STARTED: 'Task started',
  TASK_PAUSED: 'Task paused',
  TASK_RESUMED: 'Task resumed',
  TASK_IN_PROGRESS: 'Task in progress',
  TASK_NEED_APPROVAL: 'Task need approval',
  TASK_COMPLETED: 'Task completed',
};

/**
 * Recommended UI color per status (hex or theme key).
 */
export const ASSIGNED_TRIP_STATUS_COLORS: Record<AssignedTripStatus, string> = {
  TRIP_ASSIGNED: '#2563eb',
  TRIP_PENDING: '#64748b',
  TRIP_STARTED: '#16a34a',
  TRIP_PAUSED: '#ea580c',
  TRIP_RESUMED: '#16a34a',
  TRIP_IN_PROGRESS: '#7c3aed',
  TRIP_NEED_APPROVAL: '#ca8a04',
  TRIP_COMPLETED: '#6b7280',
  TASK_ASSIGNED: '#2563eb',
  TASK_PENDING: '#64748b',
  TASK_STARTED: '#16a34a',
  TASK_PAUSED: '#ea580c',
  TASK_RESUMED: '#16a34a',
  TASK_IN_PROGRESS: '#7c3aed',
  TASK_NEED_APPROVAL: '#ca8a04',
  TASK_COMPLETED: '#6b7280',
};

/**
 * Error message when transition is disallowed.
 */
export function getTransitionErrorMessage(
  fromStatus: AssignedTripStatus,
  toStatus: AssignedTripStatus,
  role: TripTransitionRole
): string {
  if (role === 'driver') {
    if (getPhase(toStatus) === 'COMPLETED')
      return 'Trip/task must be completed by your manager. You can only mark your work as done (Need approval).';
    if (getPhase(fromStatus) === 'ASSIGNED' && getPhase(toStatus) !== 'STARTED')
      return 'Trip/task must be started before it can be completed.';
  }
  if (role === 'assistant_supervisor') {
    if (getPhase(fromStatus) !== 'NEED_APPROVAL' && getPhase(toStatus) === 'COMPLETED')
      return 'You can only confirm after the driver has completed their work (Need approval).';
  }
  return 'This status change is not allowed.';
}

/**
 * Initial status for a new assignment by vehicle type.
 */
export function getInitialStatusForVehicleType(vehicleType: 'truck' | 'machine'): AssignedTripStatus {
  return vehicleType === 'truck' ? 'TRIP_ASSIGNED' : 'TASK_ASSIGNED';
}

/**
 * Next status for driver: ASSIGNED→STARTED, STARTED→PAUSED, PAUSED→RESUMED, IN_PROGRESS→NEED_APPROVAL.
 * Returns the same prefix (TRIP_ or TASK_) as current status.
 */
export function getNextDriverStatus(current: AssignedTripStatus): AssignedTripStatus | null {
  const phase = getPhase(current);
  const prefix = current.startsWith('TRIP_') ? 'TRIP' : current.startsWith('TASK_') ? 'TASK' : null;
  if (!prefix) return null;
  const next: Phase | null =
    phase === 'ASSIGNED' ? 'STARTED'
    : phase === 'STARTED' ? 'PAUSED'
    : phase === 'PAUSED' ? 'RESUMED'
    : phase === 'IN_PROGRESS' ? 'NEED_APPROVAL'
    : null;
  return next != null ? statusFromPhase(next, prefix as 'TRIP' | 'TASK') : null;
}

/**
 * Assistant Supervisor: NEED_APPROVAL → COMPLETED (same prefix).
 */
export function getCompletedStatus(current: AssignedTripStatus): AssignedTripStatus | null {
  if (getPhase(current) !== 'NEED_APPROVAL') return null;
  const prefix = current.startsWith('TRIP_') ? 'TRIP' : current.startsWith('TASK_') ? 'TASK' : null;
  return prefix != null ? statusFromPhase('COMPLETED', prefix as 'TRIP' | 'TASK') : null;
}

/** Pause segment for duration calculation (assignment-level only; do not create new trip on pause/resume). */
export type PauseSegment = { startedAt: string; endedAt: string };

/**
 * Check if the driver can end this trip (trip in progress, assignment in an endable state, user owns both).
 */
export function canEndTrip(
  trip: { id: string; driverId: string; status: string },
  assignment: { driverId: string; status: AssignedTripStatus } | null,
  userId: string
): boolean {
  if (trip.driverId !== userId || trip.status !== 'in_progress') return false;
  if (!assignment || assignment.driverId !== userId) return true;
  const phase = getPhase(assignment.status);
  return phase === 'STARTED' || phase === 'PAUSED' || phase === 'RESUMED' || phase === 'IN_PROGRESS';
}

/**
 * Check if the driver can start a trip (no other in-progress trip, assignment in ASSIGNED/PENDING).
 */
export function canStartTrip(
  assignment: { driverId: string; status: AssignedTripStatus } | null,
  userId: string,
  hasOtherActiveTrip: boolean
): boolean {
  if (hasOtherActiveTrip) return false;
  if (!assignment) return true;
  if (assignment.driverId !== userId) return false;
  const phase = getPhase(assignment.status);
  return phase === 'ASSIGNED' || phase === 'PENDING';
}

/**
 * Assert valid transition; throws with getTransitionErrorMessage if invalid.
 */
export function assertValidTransition(
  fromStatus: AssignedTripStatus,
  toStatus: AssignedTripStatus,
  role: TripTransitionRole
): void {
  if (!canTransition(fromStatus, toStatus, role)) {
    throw new Error(getTransitionErrorMessage(fromStatus, toStatus, role));
  }
}

/**
 * Effective trip duration in hours: (endTime - startTime) minus total_pause_time.
 * total_pause_time is derived from pauseSegments; do not rely on frontend timers.
 * Use for trips: pass trip.startTime, trip.endTime, and optional pauseSegments from AssignedTrip.
 * Recalculate server-side when needed for reports/fuel.
 */
export function getEffectiveDurationHours(
  startTime: string,
  endTime: string | undefined,
  pauseSegments?: PauseSegment[] | null
): number {
  if (!endTime || !startTime) return 0;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  let pauseMs = 0;
  if (pauseSegments && pauseSegments.length > 0) {
    for (const seg of pauseSegments) {
      if (seg.startedAt && seg.endedAt) {
        pauseMs += new Date(seg.endedAt).getTime() - new Date(seg.startedAt).getTime();
      }
    }
  }
  const totalMs = Math.max(0, end - start - pauseMs);
  return totalMs / (1000 * 60 * 60);
}
