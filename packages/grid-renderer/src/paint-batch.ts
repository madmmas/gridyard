/**
 * Schedules paint callbacks to coalesce onto the next animation frame.
 *
 * Multiple `schedule(regionId, paint)` calls within the same tick coalesce
 * to one paint per region per frame. The last paint fn registered for a
 * region wins — so cascading cell updates see the final values, not an
 * intermediate state. Does not touch graph recalc; only paint timing.
 */
export interface PaintScheduler {
  /** Queue a paint for `regionId`; coalesces until the next rAF. */
  schedule(regionId: string, paint: () => void): void;
  /** Cancel a pending frame and drop queued regions (e.g. on teardown). */
  cancel(): void;
  /** True while a frame is scheduled but has not yet run. */
  isPending(): boolean;
}

export interface CreatePaintSchedulerOptions {
  /**
   * Animation-frame scheduler. Defaults to `globalThis.requestAnimationFrame`
   * when available; falls back to `setTimeout(…, 0)` in non-DOM test hosts.
   */
  requestAnimationFrame?: (callback: FrameRequestCallback) => number;
  cancelAnimationFrame?: (handle: number) => void;
}

type FrameHandle = number;

/**
 * Creates a per-region rAF paint coalescer.
 *
 * Typical use: after an edit that dirties N dependent cells, call
 * `schedule("main", () => paintStaticGrid(...))` once per dirty region —
 * even if invoked N times, only one paint runs next frame.
 */
export function createPaintScheduler(
  options: CreatePaintSchedulerOptions = {},
): PaintScheduler {
  const requestFrame =
    options.requestAnimationFrame ?? defaultRequestAnimationFrame;
  const cancelFrame =
    options.cancelAnimationFrame ?? defaultCancelAnimationFrame;

  const pending = new Map<string, () => void>();
  let handle: FrameHandle | null = null;

  function flush(): void {
    handle = null;
    const jobs = [...pending.entries()];
    pending.clear();
    for (const [, paint] of jobs) {
      paint();
    }
  }

  return {
    schedule(regionId: string, paint: () => void): void {
      pending.set(regionId, paint);
      if (handle !== null) {
        return;
      }
      handle = requestFrame(() => {
        flush();
      });
    },
    cancel(): void {
      if (handle !== null) {
        cancelFrame(handle);
        handle = null;
      }
      pending.clear();
    },
    isPending(): boolean {
      return handle !== null;
    },
  };
}

function defaultRequestAnimationFrame(callback: FrameRequestCallback): number {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }
  return globalThis.setTimeout(() => {
    callback(0);
  }, 0) as unknown as number;
}

function defaultCancelAnimationFrame(handle: number): void {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(handle);
    return;
  }
  globalThis.clearTimeout(handle);
}
