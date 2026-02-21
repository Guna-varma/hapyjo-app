import type { RefObject } from 'react';
import { captureRef } from 'react-native-view-shot';

export interface CaptureOptions {
  format?: 'jpg' | 'png';
  quality?: number;
  width?: number;
  height?: number;
}

const REF_WAIT_MS = 8000;
const REF_POLL_MS = 80;
const CAPTURE_RETRY_MS = 800;
const CAPTURE_RETRIES = 6;

/** Wait until viewRef.current is set (e.g. after overlay has rendered). */
function waitForRef(viewRef: RefObject<unknown>): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      if (viewRef.current) {
        resolve();
        return;
      }
      if (Date.now() - start >= REF_WAIT_MS) {
        reject(new Error('View ref not ready'));
        return;
      }
      setTimeout(check, REF_POLL_MS);
    };
    check();
  });
}

/** Defer to next paint so the overlay is drawn before capture. Longer delay on native for layout/paint. */
function afterNextPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setTimeout(resolve, 600));
      });
    });
  });
}

function captureOnce(viewRef: RefObject<unknown>, format: 'jpg' | 'png', quality: number): Promise<string> {
  if (!viewRef.current) throw new Error('View ref not ready');
  return captureRef(viewRef, { format, quality, result: 'tmpfile' as const });
}

/**
 * Capture a view ref (Image + GPS overlay) into a single image URI.
 * The view must contain only captureable content (e.g. Image + overlay). Do not pass a view that
 * contains CameraView or other native/GL views — view-shot cannot capture those.
 * Waits for ref to be ready and for the next paint.
 */
export async function mergeCapture(
  viewRef: RefObject<unknown>,
  options: CaptureOptions = {}
): Promise<string> {
  const { format = 'jpg', quality = 1 } = options;
  await waitForRef(viewRef);
  await afterNextPaint();
  if (!viewRef.current) {
    throw new Error('View ref not ready');
  }
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < CAPTURE_RETRIES; attempt++) {
    try {
      const uri = await captureOnce(viewRef, format, quality);
      if (uri) return uri;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < CAPTURE_RETRIES - 1) {
        await new Promise((r) => setTimeout(r, CAPTURE_RETRY_MS));
        await afterNextPaint();
      }
    }
  }
  throw new Error(
    lastError ? `Merge capture failed: ${lastError.message}` : 'Merge capture failed'
  );
}
