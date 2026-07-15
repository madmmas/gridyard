import { describe, expect, it } from "vitest";

import {
  paintViewportFromScrollHost,
  sizeScrollSpacer,
} from "./scroll-host.js";

describe("paintViewportFromScrollHost", () => {
  it("maps host scroll metrics into a paint viewport", () => {
    expect(
      paintViewportFromScrollHost({ scrollTop: 120, clientHeight: 360 }),
    ).toEqual({ scrollTop: 120, height: 360 });
  });

  it("clamps negative scroll and zero height", () => {
    expect(
      paintViewportFromScrollHost({ scrollTop: -40, clientHeight: 0 }),
    ).toEqual({ scrollTop: 0, height: 1 });
  });
});

describe("sizeScrollSpacer", () => {
  it("writes content pixel sizes onto the spacer element", () => {
    const spacer = { style: { width: "", height: "" } };
    sizeScrollSpacer(spacer as HTMLElement, 640, 12_000);
    expect(spacer.style.width).toBe("640px");
    expect(spacer.style.height).toBe("12000px");
  });

  it("clamps negative extents to zero", () => {
    const spacer = { style: { width: "", height: "" } };
    sizeScrollSpacer(spacer as HTMLElement, -1, -5);
    expect(spacer.style.width).toBe("0px");
    expect(spacer.style.height).toBe("0px");
  });
});
