/** What each optional pipeline capability (plan §8, B1–B4) unlocks in the console. */
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
    fallback: "The BFF merges the signals of the 20 most recent matching jobs (degraded mode).",
  },
  {
    name: "sources_stats",
    route: "GET /v1/sources/stats",
    pr: "B2",
    unlocks: "Per-domain precision (accepted ÷ candidates) on Data Sources.",
    fallback: "The precision column stays empty.",
  },
  {
    name: "cost_estimate",
    route: "GET /v1/stats/cost-estimate",
    pr: "B2",
    unlocks: "Cost estimate on the New run form from the API.",
    fallback: "The estimate is the median of recent jobs computed by the BFF.",
  },
  {
    name: "retry_dead",
    route: "POST /v1/jobs/{id}/retry-dead",
    pr: "B3",
    unlocks: "One call retries every dead task of a job.",
    fallback: "The BFF loops over the job's dead tasks and retries them one by one.",
  },
  {
    name: "tasks_global",
    route: "GET /v1/tasks",
    pr: "B3",
    unlocks: "Dead tasks, the queue tile and the Overview tile read from the global task list.",
    fallback: "Counts come from the 20 most recent jobs and the daily failures.",
  },
  {
    name: "jobs_industry_filter",
    route: "GET /v1/jobs?industry=",
    pr: "B3",
    unlocks: "Server-side industry filter on Jobs › Runs.",
    fallback: "The industry filter applies to the loaded page only.",
  },
  {
    name: "jobs_reference_filter",
    route: "GET /v1/jobs?client_reference_prefix=",
    pr: "B3",
    unlocks: "Batches and Scout runs looked up directly by client_reference prefix.",
    fallback: "Batch membership comes from the UI's own ui.batch_jobs table.",
  },
  {
    name: "api_keys_list",
    route: "GET /v1/api-keys",
    pr: "B4",
    unlocks: "Settings › API keys lists every key (names, roles, created, revoked).",
    fallback: "Only keys created in this browser are listed; revoking works by name.",
  },
];
