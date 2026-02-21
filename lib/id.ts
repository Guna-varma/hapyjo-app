/**
 * Production-safe unique ID generator.
 * Uses crypto.randomUUID() when available; fallback for older environments.
 * No dummy or mock IDs – use for trips, expenses, surveys, issues, vehicles, sites, machine sessions.
 */
function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Generate a unique ID with optional prefix for the entity type (e.g. 't' for trip). */
export function generateId(prefix?: string): string {
  const uuid = randomUUID().replace(/-/g, '').slice(0, 12);
  return prefix ? `${prefix}_${uuid}` : uuid;
}
