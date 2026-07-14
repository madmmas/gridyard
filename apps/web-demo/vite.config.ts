import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const wasmJs = path.join(rootDir, "src/wasm-pkg/gridyard_wasm.js");

/**
 * Lets `vite build` succeed in CI without wasm-pack by stubbing the
 * module when `src/wasm-pkg` has not been generated yet.
 */
function optionalWasmPkg(): Plugin {
  return {
    name: "optional-wasm-pkg",
    resolveId(id) {
      if (
        id === "./wasm-pkg/gridyard_wasm.js" ||
        id.endsWith("/wasm-pkg/gridyard_wasm.js")
      ) {
        if (!fs.existsSync(wasmJs)) {
          return "\0virtual:gridyard-wasm-stub";
        }
      }
      return null;
    },
    load(id) {
      if (id !== "\0virtual:gridyard-wasm-stub") {
        return null;
      }
      return `
        export default async function init() {
          throw new Error("WASM package missing — run: npm run build:wasm --workspace=web-demo");
        }
        export function create_grid() {
          throw new Error("WASM package missing — run: npm run build:wasm --workspace=web-demo");
        }
        export function create_workspace() {
          throw new Error("WASM package missing — run: npm run build:wasm --workspace=web-demo");
        }
      `;
    },
  };
}

const mockApiProxy = {
  "/loans": { target: "http://127.0.0.1:4000", changeOrigin: true },
  "/employees": { target: "http://127.0.0.1:4000", changeOrigin: true },
  "/invoices": { target: "http://127.0.0.1:4000", changeOrigin: true },
} as const;

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [optionalWasmPkg()],
  server: {
    port: 5173,
    proxy: { ...mockApiProxy },
  },
  preview: {
    port: 5173,
    proxy: { ...mockApiProxy },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  assetsInclude: ["**/*.wasm"],
});
