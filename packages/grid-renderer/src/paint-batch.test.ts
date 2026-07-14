import { describe, expect, it, vi } from "vitest";

import { createPaintScheduler } from "./paint-batch.js";

describe("createPaintScheduler", () => {
  it("coalesces multiple schedules for one region into a single paint", () => {
    const frames: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi.fn((cb: FrameRequestCallback): number => {
      frames.push(cb);
      return frames.length;
    });
    const cancelAnimationFrame = vi.fn();
    const scheduler = createPaintScheduler({
      requestAnimationFrame,
      cancelAnimationFrame,
    });

    const paint = vi.fn();
    scheduler.schedule("main", paint);
    scheduler.schedule("main", paint);
    scheduler.schedule("main", paint);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(paint).not.toHaveBeenCalled();
    expect(scheduler.isPending()).toBe(true);

    frames[0]?.(16);
    expect(paint).toHaveBeenCalledTimes(1);
    expect(scheduler.isPending()).toBe(false);
  });

  it("runs one paint per region when several regions dirty in one tick", () => {
    const frames: FrameRequestCallback[] = [];
    const scheduler = createPaintScheduler({
      requestAnimationFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelAnimationFrame: vi.fn(),
    });

    const mainPaint = vi.fn();
    const bottomPaint = vi.fn();
    scheduler.schedule("main", mainPaint);
    scheduler.schedule("bottom", bottomPaint);
    scheduler.schedule("main", mainPaint);

    expect(frames).toHaveLength(1);
    frames[0]?.(16);

    expect(mainPaint).toHaveBeenCalledTimes(1);
    expect(bottomPaint).toHaveBeenCalledTimes(1);
  });

  it("uses the last paint fn so the batched paint sees final values", () => {
    const frames: FrameRequestCallback[] = [];
    const scheduler = createPaintScheduler({
      requestAnimationFrame: (cb) => {
        frames.push(cb);
        return frames.length;
      },
      cancelAnimationFrame: vi.fn(),
    });

    const seen: string[] = [];
    scheduler.schedule("main", () => {
      seen.push("stale");
    });
    scheduler.schedule("main", () => {
      seen.push("final");
    });

    frames[0]?.(16);
    expect(seen).toEqual(["final"]);
  });

  it("cancel drops the pending frame without painting", () => {
    const frames: FrameRequestCallback[] = [];
    const cancelAnimationFrame = vi.fn();
    const scheduler = createPaintScheduler({
      requestAnimationFrame: (cb) => {
        frames.push(cb);
        return 7;
      },
      cancelAnimationFrame,
    });

    const paint = vi.fn();
    scheduler.schedule("main", paint);
    scheduler.cancel();

    expect(cancelAnimationFrame).toHaveBeenCalledWith(7);
    expect(scheduler.isPending()).toBe(false);
    frames[0]?.(16);
    // flush was cancelled — even if a stale callback fires, map was cleared;
    // but cancel removes the handle so we don't expect paint from cancel path.
    // Actually after cancel, if someone calls the old rAF callback... our flush
    // clears handle first. cancel clears pending so if old cb somehow runs...
    // Wait - cancel cancels the frame so cb shouldn't run. But if we invoke
    // frames[0] manually, handle is null but flush still works if it was the
    // registered cb. Looking at our flush - cancel clears pending, so:
    expect(paint).not.toHaveBeenCalled();
  });
});
