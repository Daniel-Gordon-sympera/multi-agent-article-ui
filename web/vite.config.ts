import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { fileURLToPath, URL } from "node:url";

const bffUrl = process.env.VITE_BFF_URL ?? "http://localhost:8080";

/** Paths the BFF owns; everything else is the SPA. */
const proxiedPrefixes = ["/app", "/v1", "/healthz", "/readyz"];

export default defineConfig({
  plugins: [
    // Route paths and ignore patterns live in tsr.config.json (shared with `pnpm gen:routes`).
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
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
    port: 4173,
    strictPort: true,
  },
  build: {
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
});
