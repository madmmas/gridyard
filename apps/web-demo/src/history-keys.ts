/** Undo/redo gesture inferred from a keyboard event (⌘/Ctrl+Z / Shift+Z / Y). */
export type HistoryAction = "undo" | "redo";

/**
 * Returns the history action for a modifier+key chord, or `null` if the
 * event is not an undo/redo shortcut.
 */
export function historyActionFromKey(event: {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}): HistoryAction | null {
  if (!(event.metaKey || event.ctrlKey)) {
    return null;
  }
  const key = event.key.toLowerCase();
  if (key === "z") {
    return event.shiftKey ? "redo" : "undo";
  }
  if (key === "y") {
    return "redo";
  }
  return null;
}
