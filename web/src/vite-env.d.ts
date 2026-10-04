/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" starts the MSW worker before rendering (`pnpm dev:mock`, `pnpm preview:mock`). */
  readonly VITE_API_MOCK?: string;
  /** Dev-server proxy target for /app, /v1, /healthz, /readyz. */
  readonly VITE_BFF_URL?: string;
}
