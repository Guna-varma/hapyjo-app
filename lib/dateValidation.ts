/**
 * Site date validation: YYYY-MM-DD format only, and end date must be after start date.
 */

const YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

/** Returns true if s is exactly YYYY-MM-DD and a valid calendar date. */
export function isValidDateFormat(s: string): boolean {
  if (!s || typeof s !== 'string') return false;
  const trimmed = s.trim();
  if (!YYYY_MM_DD.test(trimmed)) return false;
  const [y, m, day] = trimmed.split('-').map(Number);
  if (m < 1 || m > 12 || day < 1 || day > 31) return false;
  const d = new Date(y, m - 1, day);
  return d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day;
}

/**
 * Validates start and optional end date for a site.
 * - Both must be YYYY-MM-DD if provided.
 * - If both provided, end date must be strictly after start date.
 */
export function validateSiteDates(
  startDate: string,
  expectedEndDate?: string | null
): { valid: true } | { valid: false; errorKey: 'site_date_format_invalid' | 'site_end_date_after_start' } {
  const start = (startDate ?? '').trim();
  const end = (expectedEndDate ?? '').trim();

  if (start && !isValidDateFormat(start)) {
    return { valid: false, errorKey: 'site_date_format_invalid' };
  }
  if (end && !isValidDateFormat(end)) {
    return { valid: false, errorKey: 'site_date_format_invalid' };
  }

  if (start && end) {
    const startTime = new Date(start + 'T12:00:00').getTime();
    const endTime = new Date(end + 'T12:00:00').getTime();
    if (endTime <= startTime) {
      return { valid: false, errorKey: 'site_end_date_after_start' };
    }
  }

  return { valid: true };
}

/**
 * For real-time UI: returns which error (if any) applies to start vs end field.
 * Use with t(errorKey) for the message.
 */
export function getDateFieldErrorKeys(
  startDate: string,
  expectedEndDate?: string | null
): { startErrorKey?: 'site_date_format_invalid'; endErrorKey?: 'site_date_format_invalid' | 'site_end_date_after_start' } {
  const start = (startDate ?? '').trim();
  const end = (expectedEndDate ?? '').trim();
  const result: { startErrorKey?: 'site_date_format_invalid'; endErrorKey?: 'site_date_format_invalid' | 'site_end_date_after_start' } = {};
  if (start && !isValidDateFormat(start)) {
    result.startErrorKey = 'site_date_format_invalid';
  }
  if (end && !isValidDateFormat(end)) {
    result.endErrorKey = 'site_date_format_invalid';
    return result;
  }
  if (start && end) {
    const startTime = new Date(start + 'T12:00:00').getTime();
    const endTime = new Date(end + 'T12:00:00').getTime();
    if (endTime <= startTime) {
      result.endErrorKey = 'site_end_date_after_start';
    }
  }
  return result;
}
