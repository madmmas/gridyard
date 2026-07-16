import { describe, expect, it } from "vitest";

import {
  LOAN_REVIEW_PERMISSIONS,
  resolvePermissions,
} from "@gridyard/workspace-runtime";

import {
  tryColumnResizeDrag,
  tryResetSharedColumnWidths,
} from "./layout-resize-chrome.js";

describe("tryColumnResizeDrag", () => {
  const widths = [100, 90, 84];

  it("allows alex to resize", () => {
    const alex = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "alex",
    });
    const result = tryColumnResizeDrag(alex, widths, 0, 20);
    expect(result).toEqual({ ok: true, widths: [120, 90, 84] });
  });

  it("blocks blair (no resize permission)", () => {
    const blair = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "blair",
    });
    const result = tryColumnResizeDrag(blair, widths, 0, 20);
    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected denial");
    }
    expect(result.message).toMatch(/resize/i);
  });

  it("allows casey to resize when canResize is still true", () => {
    const casey = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "casey",
    });
    expect(casey.layout.canResize).toBe(true);
    expect(tryColumnResizeDrag(casey, widths, 0, 10)).toEqual({
      ok: true,
      widths: [110, 90, 84],
    });
  });
});

describe("tryResetSharedColumnWidths", () => {
  const defaults = [168, 90, 84, 90];

  it("allows alex (shared-layout admin)", () => {
    const alex = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
      userId: "alex",
    });
    expect(tryResetSharedColumnWidths(alex, defaults)).toEqual({
      ok: true,
      widths: defaults,
    });
  });

  it("denies blair and casey", () => {
    for (const userId of ["blair", "casey"] as const) {
      const effective = resolvePermissions(LOAN_REVIEW_PERMISSIONS, {
        userId,
      });
      const result = tryResetSharedColumnWidths(effective, defaults);
      expect(result.ok).toBe(false);
      if (result.ok) {
        throw new Error(`expected denial for ${userId}`);
      }
      expect(result.message).toMatch(/shared layout/i);
    }
  });
});
