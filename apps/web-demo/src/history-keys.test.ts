import { describe, expect, it } from "vitest";

import { historyActionFromKey } from "./history-keys.js";

describe("historyActionFromKey", () => {
  it("maps ⌘/Ctrl+Z to undo and Shift+Z / Y to redo", () => {
    expect(
      historyActionFromKey({
        key: "z",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBe("undo");
    expect(
      historyActionFromKey({
        key: "Z",
        ctrlKey: true,
        metaKey: false,
        shiftKey: true,
      }),
    ).toBe("redo");
    expect(
      historyActionFromKey({
        key: "y",
        ctrlKey: true,
        metaKey: false,
        shiftKey: false,
      }),
    ).toBe("redo");
  });

  it("ignores plain keys and unmodified Z", () => {
    expect(
      historyActionFromKey({
        key: "z",
        metaKey: false,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
    expect(
      historyActionFromKey({
        key: "a",
        metaKey: true,
        ctrlKey: false,
        shiftKey: false,
      }),
    ).toBeNull();
  });
});
