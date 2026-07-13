declare module "./wasm-pkg/gridyard_wasm.js" {
  export class Grid {
    set_cell(row: number, col: number, input: string): void;
    get_cell(row: number, col: number): unknown;
    free(): void;
  }

  export function create_grid(): Grid;

  export default function init(moduleOrPath?: unknown): Promise<unknown>;
}
