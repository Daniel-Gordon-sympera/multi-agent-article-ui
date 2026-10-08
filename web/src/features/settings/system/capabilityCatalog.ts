/** Required pipeline capabilities checked by contract version 1. */
import type { CapabilityName } from "@/api/types/bff";

export interface CapabilityDescription {
  name: CapabilityName;
  route: string;
  pr: "B1" | "B2" | "B3" | "B4";
  unlocks: string;
  fallback: string;
}

export const CAPABILITY_CATALOG: CapabilityDescription[] = [
  {
    name: "signals_global",
    route: "GET /v1/signals",
    pr: "B1",
    unlocks: "Cross-job signals explorer served by the API with full pagination.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "sources_stats",
    route: "GET /v1/sources/stats",
    pr: "B2",
    unlocks: "Article acceptance rate (accepted ÷ measured candidates) on Data Sources.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "cost_estimate",
    route: "GET /v1/stats/cost-estimate",
    pr: "B2",
    unlocks: "Cost estimate on the New run form from the API.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "retry_dead",
    route: "POST /v1/jobs/{id}/retry-dead",
    pr: "B3",
    unlocks: "One call retries every dead task of a job.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "tasks_global",
    route: "GET /v1/tasks",
    pr: "B3",
    unlocks: "Dead tasks, the queue tile and the Overview tile read from the global task list.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "jobs_industry_filter",
    route: "GET /v1/jobs?industry=",
    pr: "B3",
    unlocks: "Server-side industry filter on Jobs › Runs.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "jobs_reference_filter",
    route: "GET /v1/jobs?client_reference_prefix=",
    pr: "B3",
    unlocks: "Batches and Scout runs looked up directly by client_reference prefix.",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
  {
    name: "api_keys_list",
    route: "GET /v1/api-keys",
    pr: "B4",
    unlocks: "Settings › API keys lists every key (names, roles, created, revoked).",
    fallback: "Unavailable until a compatible pipeline API is running.",
  },
];
