import { describe, expect, it } from "vitest";

import {
  bottomControlTarget,
  createBottomTabState,
  isBottomTabActive,
  selectBottomTab,
} from "./tabs.js";

describe("bottom tab switching", () => {
  it("defaults to aggregate", () => {
    expect(createBottomTabState()).toEqual({ active: "aggregate" });
  });

  it("switches active tab without mutating the previous state object", () => {
    const initial = createBottomTabState("aggregate");
    const next = selectBottomTab(initial, "notes");
    expect(next).toEqual({ active: "notes" });
    expect(initial).toEqual({ active: "aggregate" });
    expect(isBottomTabActive(next, "notes")).toBe(true);
    expect(isBottomTabActive(next, "aggregate")).toBe(false);
  });

  it("is idempotent when selecting the already-active tab", () => {
    const state = createBottomTabState("notes");
    expect(selectBottomTab(state, "notes")).toBe(state);
  });

  it("routes add controls to the active tab only", () => {
    expect(bottomControlTarget(createBottomTabState("aggregate"))).toBe(
      "aggregate",
    );
    expect(
      bottomControlTarget(selectBottomTab(createBottomTabState(), "notes")),
    ).toBe("notes");
  });
});
