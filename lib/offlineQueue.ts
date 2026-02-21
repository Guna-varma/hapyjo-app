/**
 * Offline queue for trip and expense inserts.
 * Persisted to app document directory; flushed when refetch runs (network available).
 * Expo Go compatible (expo-file-system only).
 */

import { documentDirectory, readAsStringAsync, writeAsStringAsync } from 'expo-file-system/legacy';

const QUEUE_FILENAME = 'hapyjo_offline_queue.json';

export type QueuedExpense = { type: 'expense'; payload: Record<string, unknown> };
export type QueuedTrip = { type: 'trip'; payload: Record<string, unknown> };
export type QueuedItem = QueuedExpense | QueuedTrip;

async function queuePath(): Promise<string> {
  const dir = documentDirectory ?? '';
  if (!dir) return '';
  return `${dir}${QUEUE_FILENAME}`;
}

export async function loadOfflineQueue(): Promise<QueuedItem[]> {
  try {
    const path = await queuePath();
    if (!path) return [];
    const raw = await readAsStringAsync(path, { encoding: 'utf8' });
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is QueuedItem =>
        x != null &&
        typeof x === 'object' &&
        'type' in x &&
        'payload' in x &&
        ((x as QueuedItem).type === 'expense' || (x as QueuedItem).type === 'trip')
    );
  } catch {
    return [];
  }
}

export async function saveOfflineQueue(items: QueuedItem[]): Promise<void> {
  try {
    const path = await queuePath();
    if (!path) return;
    await writeAsStringAsync(path, JSON.stringify(items), { encoding: 'utf8' });
  } catch {
    // ignore
  }
}

export async function appendToOfflineQueue(item: QueuedItem): Promise<void> {
  const items = await loadOfflineQueue();
  items.push(item);
  await saveOfflineQueue(items);
}

export async function removeFromOfflineQueueAtIndex(index: number): Promise<void> {
  const items = await loadOfflineQueue();
  if (index < 0 || index >= items.length) return;
  items.splice(index, 1);
  await saveOfflineQueue(items);
}
