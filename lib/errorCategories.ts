/**
 * Categorized errors for fleet app — never show "GPS Error" for DB/network failures.
 */

export type ErrorCategory =
  | 'location'
  | 'network'
  | 'permission'
  | 'server'
  | 'validation';

export interface CategorizedError {
  category: ErrorCategory;
  message: string;
  original?: unknown;
}

const LOCATION_PATTERNS = [
  /location|gps|position|coordinates|latitude|longitude|geolocation/i,
  /timeout.*(try again|position)/i,
  /could not get current position/i,
  /invalid gps/i,
];

const NETWORK_PATTERNS = [
  /network|fetch|connection|offline|failed to fetch/i,
  /ECONNABORTED|ETIMEDOUT|ENOTFOUND|ERR_NETWORK/i,
];

const PERMISSION_PATTERNS = [
  /permission|denied|forbidden|unauthorized/i,
  /row level security|policy|rls/i,
  /23505.*unique/i,
];

const SERVER_PATTERNS = [
  /supabase|postgres|pgrst|500|502|503/i,
  /violates.*constraint|foreign key|not null/i,
];

/**
 * Classify an error into a category and return a user-facing message key or message.
 */
export function categorizeError(error: unknown): CategorizedError {
  const msg =
    error instanceof Error ? error.message : String(error ?? 'Unknown error');
  const lower = msg.toLowerCase();

  if (LOCATION_PATTERNS.some((p) => p.test(msg))) {
    return {
      category: 'location',
      message: msg,
      original: error,
    };
  }
  if (PERMISSION_PATTERNS.some((p) => p.test(msg))) {
    return {
      category: 'permission',
      message: msg,
      original: error,
    };
  }
  if (NETWORK_PATTERNS.some((p) => p.test(msg))) {
    return {
      category: 'network',
      message: msg,
      original: error,
    };
  }
  if (SERVER_PATTERNS.some((p) => p.test(msg))) {
    return {
      category: 'server',
      message: msg,
      original: error,
    };
  }
  if (
    /invalid|required|must be|validation|check constraint/i.test(msg)
  ) {
    return {
      category: 'validation',
      message: msg,
      original: error,
    };
  }

  return {
    category: 'server',
    message: msg,
    original: error,
  };
}

/** Alert title key per category (for use with t()). */
export const ERROR_CATEGORY_TITLE_KEYS: Record<ErrorCategory, string> = {
  location: 'error_title_location',
  network: 'error_title_network',
  permission: 'error_title_permission',
  server: 'error_title_server',
  validation: 'error_title_validation',
};
