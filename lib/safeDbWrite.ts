/**
 * Safe DB write layer: try/catch, retry once on network failure, structured error types.
 * Use for trip lifecycle writes (trips, assigned_trips, work_photos) to avoid silent failures.
 */

import type { PostgrestError } from '@supabase/supabase-js';

export type DbErrorKind = 'network' | 'rls' | 'permission' | 'schema' | 'constraint' | 'unknown';

export interface DbWriteError {
  kind: DbErrorKind;
  message: string;
  code?: string;
  details?: string;
  original?: unknown;
}

export interface DbWriteResult<T = void> {
  ok: true;
  data?: T;
}

export interface DbWriteFailure {
  ok: false;
  error: DbWriteError;
}

export type DbWriteOutcome<T = void> = DbWriteResult<T> | DbWriteFailure;

function isNetworkError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  if (/fetch|network|connection|ECONNABORTED|ETIMEDOUT|ERR_NETWORK|offline/i.test(msg)) return true;
  if (error && typeof (error as { code?: string }).code === 'string') {
    const code = (error as { code: string }).code;
    if (code === 'PGRST301' || code === 'PGRST302') return true;
  }
  return false;
}

function parseSupabaseError(error: PostgrestError): DbWriteError {
  const code = error?.code;
  const msg = error?.message ?? 'Database error';
  const details = error?.details ?? undefined;

  if (code === '42501' || /policy|row level security|permission denied/i.test(msg)) {
    return { kind: 'rls', message: msg, code, details, original: error };
  }
  if (code === '23503' || /foreign key/i.test(msg)) {
    return { kind: 'constraint', message: msg, code, details, original: error };
  }
  if (code === '23505' || /unique constraint|duplicate key/i.test(msg)) {
    return { kind: 'constraint', message: msg, code, details, original: error };
  }
  if (code === '23502' || /not null violation/i.test(msg)) {
    return { kind: 'schema', message: msg, code, details, original: error };
  }
  if (code === '42P01' || /relation.*does not exist/i.test(msg)) {
    return { kind: 'schema', message: msg, code, details, original: error };
  }
  if (code === 'PGRST301' || code === 'PGRST302' || /JWT|auth/i.test(msg)) {
    return { kind: 'permission', message: msg, code, details, original: error };
  }

  return { kind: 'unknown', message: msg, code, details, original: error };
}

function toDbError(error: unknown): DbWriteError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
    return parseSupabaseError(error as PostgrestError);
  }
  const msg = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  if (isNetworkError(error)) {
    return { kind: 'network', message: msg, original: error };
  }
  return { kind: 'unknown', message: msg, original: error };
}

/**
 * Execute a DB write with optional single retry on network failure.
 * Returns { ok: true } or { ok: false, error: DbWriteError }.
 */
export async function safeDbWrite<T = void>(
  fn: () => Promise<T>,
  options: { retryOnceOnNetwork?: boolean } = {}
): Promise<DbWriteOutcome<T>> {
  const { retryOnceOnNetwork = true } = options;

  try {
    const data = await fn();
    return { ok: true, data };
  } catch (first) {
    const err = toDbError(first);
    if (retryOnceOnNetwork && err.kind === 'network') {
      try {
        const data = await fn();
        return { ok: true, data };
      } catch (second) {
        return { ok: false, error: toDbError(second) };
      }
    }
    return { ok: false, error: err };
  }
}

/** Get a user-facing message for a DbWriteError (for alerts). */
export function getDbErrorMessage(error: DbWriteError, fallback: string): string {
  switch (error.kind) {
    case 'network':
      return fallback || 'Network error. Please check your connection and try again.';
    case 'rls':
    case 'permission':
      return fallback || 'You do not have permission to perform this action.';
    case 'schema':
    case 'constraint':
      return fallback || 'Data validation failed. Please try again.';
    default:
      return fallback || error.message || 'Something went wrong. Please try again.';
  }
}
