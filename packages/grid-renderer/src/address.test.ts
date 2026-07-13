import { describe, expect, it } from "vitest";

import { colIndexToLetters, rowIndexToLabel } from "./address.js";

describe("colIndexToLetters", () => {
  it.each([
    [0, "A"],
    [1, "B"],
    [25, "Z"],
    [26, "AA"],
    [27, "AB"],
    [701, "ZZ"],
    [702, "AAA"],
  ] as const)("maps %i → %s", (index, letters) => {
    expect(colIndexToLetters(index)).toBe(letters);
  });

  it("rejects negative indexes", () => {
    expect(() => colIndexToLetters(-1)).toThrow(RangeError);
  });
});

describe("rowIndexToLabel", () => {
  it("uses one-based labels", () => {
    expect(rowIndexToLabel(0)).toBe("1");
    expect(rowIndexToLabel(9)).toBe("10");
  });

  it("rejects negative indexes", () => {
    expect(() => rowIndexToLabel(-1)).toThrow(RangeError);
  });
});
