/**
 * Types for the wasm-pack output under `src/wasm-pkg/`.
 *
 * That directory is gitignored (generated locally / by `build:wasm`), so CI
 * typecheck needs this ambient declaration. Relative `declare module "./…"`
 * names are not matched by TypeScript — use a wildcard instead.
 */
declare module "*gridyard_wasm.js" {
  export class Grid {
    set_cell(row: number, col: number, input: string): void;
    get_cell(row: number, col: number): unknown;
    get_input(row: number, col: number): string;
    undo(): boolean;
    redo(): boolean;
    can_undo(): boolean;
    can_redo(): boolean;
    clear_history(): void;
    free(): void;
  }

  export function create_grid(): Grid;

  export default function init(moduleOrPath?: unknown): Promise<unknown>;
}
