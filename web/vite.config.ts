import { readFileSync, rmSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";

function devBffUrl(): string {
  if (process.env.VITE_BFF_URL) return process.env.VITE_BFF_URL;
  const selected = process.env.PLATFORM_ENV_FILE;
  const path =
    selected ?? fileURLToPath(new URL("../../multi-agent-article/.env.platform", import.meta.url));
  try {
    // Read this server-only proxy setting without loading backend secrets into Vite's env.
    return parseEnv(readFileSync(path, "utf8")).VITE_BFF_URL ?? "http://localhost:8080";
  } catch (error) {
    if (!selected && error instanceof Error && "code" in error && error.code === "ENOENT") {
      return "http://localhost:8080";
    }
    throw error;
  }
}

const bffUrl = devBffUrl();

/** Paths the BFF owns; everything else is the SPA. */
const proxiedPrefixes = ["/app", "/v1", "/healthz", "/readyz"];

/** The MSW worker lives in `public/` for `dev:mock`; a real build must not ship it. */
function dropMockWorker(mode: string): Plugin {
  return {
    name: "scout-drop-mock-worker",
    apply: "build",
    closeBundle() {
      if (mode === "mock") return;
      rmSync(fileURLToPath(new URL("./dist/mockServiceWorker.js", import.meta.url)), {
        force: true,
      });
    },
  };
}

export default defineConfig(({ mode }) => ({
  envDir: false,
  plugins: [
    // Route paths and ignore patterns live in tsr.config.json (shared with `pnpm gen:routes`).
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    dropMockWorker(mode),
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: Object.fromEntries(
      proxiedPrefixes.map((prefix) => [prefix, { target: bffUrl, changeOrigin: false }]),
    ),
  },
  preview: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    // Fonts stay separate files: the BFF's Content-Security-Policy allows only
    // `font-src 'self'`, so an inlined `data:` font would be refused at runtime.
    assetsInlineLimit: (filePath) =>
      /\.(woff2?|ttf|otf|eot)$/i.test(filePath) ? false : undefined,
    sourcemap: false,
    target: "es2022",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules/")) return undefined;
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return "vendor-react";
          if (id.includes("node_modules/@tanstack/")) return "vendor-tanstack";
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          return undefined;
        },
      },
    },
  },
}));
