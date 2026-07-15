/**
 * Demo glue: map a DOM scroll host onto grid-renderer viewport paint inputs.
 */

/** Viewport window derived from a scrollable host element. */
export interface ScrollHostPaintViewport {
  scrollTop: number;
  height: number;
}

/**
 * Reads `scrollTop` / `clientHeight` from a scroll host for `paintStaticGrid`'s
 * `viewport` option. Height is at least 1 so a collapsed host does not paint
 * with a zero-sized canvas.
 */
export function paintViewportFromScrollHost(
  host: Pick<HTMLElement, "scrollTop" | "clientHeight">,
): ScrollHostPaintViewport {
  return {
    scrollTop: Math.max(0, host.scrollTop),
    height: Math.max(1, host.clientHeight),
  };
}

/**
 * Sizes the inner spacer so the host can scroll the full content extent
 * while the canvas stays sticky to the visible window.
 */
export function sizeScrollSpacer(
  spacer: HTMLElement,
  totalWidth: number,
  totalHeight: number,
): void {
  spacer.style.width = `${String(Math.max(0, totalWidth))}px`;
  spacer.style.height = `${String(Math.max(0, totalHeight))}px`;
}
