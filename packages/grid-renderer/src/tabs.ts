/** Which tab is visible inside the bottom region. */
export type BottomTabId = "aggregate" | "notes";

/** Bottom-region tab chrome state (display only — not layout size). */
export interface BottomTabState {
  active: BottomTabId;
}

/**
 * Creates tab state. Defaults to Aggregate (workspace schema default).
 */
export function createBottomTabState(
  initial: BottomTabId = "aggregate",
): BottomTabState {
  return { active: initial };
}

/**
 * Switches the active bottom tab without changing region geometry.
 * Idempotent when `tab` is already active.
 */
export function selectBottomTab(
  state: BottomTabState,
  tab: BottomTabId,
): BottomTabState {
  if (state.active === tab) {
    return state;
  }
  return { active: tab };
}

/** Returns true when `tab` is the currently visible bottom tab. */
export function isBottomTabActive(
  state: BottomTabState,
  tab: BottomTabId,
): boolean {
  return state.active === tab;
}

/**
 * Target for a bottom-region add-row / add-column control: the active tab,
 * never the whole workspace.
 */
export function bottomControlTarget(
  state: BottomTabState,
): BottomTabId {
  return state.active;
}
