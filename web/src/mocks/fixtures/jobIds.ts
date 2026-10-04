/** Stable fixture ids (mockup-spec §4.1) and the cost-by-stage rows of the main job. */
import type { JobCost } from "@/api/types/jobs";

export const MAIN_JOB_ID = "0192f1c2-7e0a-4c1b-9d33-5a1e8b2f0c41";
export const JOB_IDS = {
  orangeConstruction: MAIN_JOB_ID,
  orangeManufacturing: "0192f1c3-7e0a-4c1b-9d33-5a1e8b2f0c42",
  orangeWholesale: "0192f1c4-7e0a-4c1b-9d33-5a1e8b2f0c43",
  jeffersonConstruction: "0192f0aa-3b1d-4f5e-8a6c-7d2e9f1a0b11",
  harrisManufacturingQueued: "0192ef10-5c2e-4a7b-9d8f-1e3a5b7c9d22",
  maricopaRetail: "0192ee55-8d3f-4b6a-a1c2-3e4f5a6b7c33",
  fultonWholesale: "0192ea31-9e4a-4c7b-b2d3-4f5a6b7c8d44",
  cookUtilities: "0192e8c0-af5b-4d8c-83e4-5a6b7c8d9e55",
  harrisManufacturingEarlier: "0192d9b4-b06c-4e9d-94f5-6b7c8d9e0f66",
} as const;

export const BATCH_ID = "7b1f3c9e-2d4a-4e6b-8c0d-1f2a3b4c5d6e";
export const SCOUT_IDS = {
  orangeBuilders: "a1b2c3d4-0001-4a00-8000-000000000001",
  denverConstruction: "a1b2c3d4-0002-4a00-8000-000000000002",
  houstonManufacturing: "a1b2c3d4-0003-4a00-8000-000000000003",
  phoenixRetail: "a1b2c3d4-0004-4a00-8000-000000000004",
  atlantaWholesale: "a1b2c3d4-0005-4a00-8000-000000000005",
} as const;

export const PROMPT_VERSION = "2026.10";

export const cost = (
  id: string,
  stage: string,
  calls: number,
  tokens: number,
  usd: number,
): JobCost => ({
  job_id: id,
  stage,
  calls,
  input_tokens: Math.round(tokens * 0.82),
  output_tokens: tokens - Math.round(tokens * 0.82),
  total_tokens: tokens,
  cost_usd: usd,
  known_cost_usd: usd,
  unpriced_calls: 0,
  unknown_usage_calls: 0,
});

/** Cost by stage of the main job (mockup §4.1): $3.12 · 1.6M tokens. */

export const MAIN_JOB_COSTS: JobCost[] = [
  cost(MAIN_JOB_ID, "classification", 145, 612_000, 1.21),
  cost(MAIN_JOB_ID, "summary", 62, 540_000, 1.04),
  cost(MAIN_JOB_ID, "company_pass", 31, 231_000, 0.46),
  cost(MAIN_JOB_ID, "sections_agent", 5, 164_000, 0.28),
  cost(MAIN_JOB_ID, "finder_classify", 12, 46_000, 0.08),
  cost(MAIN_JOB_ID, "ranker", 7, 25_000, 0.05),
];
