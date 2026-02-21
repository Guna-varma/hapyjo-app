/**
 * Format date as IST (India Standard Time) for GPS stamp.
 * e.g. "Tuesday, 17/02/2026 09:26 PM GMT +05:30"
 */

export function formatIstTimestamp(date: Date = new Date()): string {
  try {
    const d = date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    const t = date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
    return `${d}, ${t} GMT +05:30`;
  } catch {
    return date.toISOString();
  }
}

export function formatIstTimestampShort(date: Date = new Date()): string {
  try {
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}
