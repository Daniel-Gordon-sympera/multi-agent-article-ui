/** `/app/scouts*` and `/app/batches*` — Scouts CRUD, run fan-out and batch lookup (contract §4.3, §4.5). */
import { http, HttpResponse } from "msw";
import type {
  Batch,
  BatchInput,
  BatchJob,
  BatchMembership,
  ScoutInput,
  ScoutWithRuns,
} from "@/api/types/bff";
import type { JobDetail } from "@/api/types/jobs";
import { db, nextMockId } from "@/mocks/db";
import { BATCH_ID, PROMPT_VERSION, SCOUT_IDS } from "@/mocks/fixtures/jobs";
import { readJson } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

interface StoredBatch extends Batch {
  job_ids: string[];
}

const batches = new Map<string, StoredBatch>();

/** The main job's batch (run 7 of "Orange County builders"). */
function seedBatches(): void {
  if (batches.size) return;
  const scout = db.scouts.find((s) => s.id === SCOUT_IDS.orangeBuilders);
  if (!scout?.last_run) return;
  batches.set(BATCH_ID, {
    id: BATCH_ID,
    scout_id: scout.id,
    scout_name: scout.name,
    run_number: 7,
    created_at: scout.last_run.created_at,
    jobs: scout.last_run.jobs.map((j, i) => ({
      position: i + 1,
      industry: j.industry,
      job_id: j.job_id,
      client_reference: `ui:${BATCH_ID}:${(j.industry ?? "0").toLowerCase().replace(/\s+/g, "-")}`,
      status: j.status,
      error: null,
    })),
    job_ids: scout.last_run.jobs.map((j) => j.job_id),
  });
}

function refreshStatuses(batch: StoredBatch): Batch {
  return {
    ...batch,
    jobs: batch.jobs.map((j) => ({
      ...j,
      status: db.jobs.find((job) => job.id === j.job_id)?.status ?? j.status,
    })),
  };
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function createJobRow(
  input: BatchInput,
  industry: string | null,
  clientReference: string,
  createdBy: string,
): JobDetail {
  const id = `0193${nextMockId().padStart(4, "0")}-bbbb-4ccc-8ddd-${Date.now().toString(16).padStart(12, "0").slice(-12)}`;
  const now = new Date().toISOString();
  return {
    id,
    kind: input.kind,
    input:
      input.kind === "location_industry"
        ? { location: input.location, industry: industry ?? undefined }
        : input.kind === "url"
          ? { url: input.url }
          : { seeds: input.seeds ?? [] },
    county: input.county,
    state_code: input.state_code,
    settings: {
      days: 30,
      sites: 5,
      site_timeout: 0,
      max_runtime: 18000,
      memory_mode: "full",
      reanalyze: false,
      ...input.settings,
    },
    prompt_version: PROMPT_VERSION,
    status: "queued",
    stop_reason: null,
    client_reference: clientReference,
    created_by: createdBy,
    created_at: now,
    started_at: null,
    deadline_at: null,
    finished_at: null,
    summary: null,
    sessions: [],
    progress: {
      job_id: id,
      seeds: 0,
      sections: 0,
      pages: 0,
      links: 0,
      articles: 0,
      summaries: 0,
      companies: 0,
      signals: 0,
      tasks_pending: 1,
      tasks_running: 0,
      tasks_dead: 0,
    },
    costs: [],
  };
}

function fanOut(input: BatchInput, scout: ScoutWithRuns | null, createdBy: string): Batch {
  const id = nextMockId("batch");
  const runNumber = scout ? scout.runs_count + 1 : null;
  const legs = input.kind === "location_industry" ? input.industries : [null];
  const jobs: BatchJob[] = [];
  const jobIds: string[] = [];
  legs.forEach((industry, index) => {
    const clientReference = `ui:${id}:${industry ? slug(industry) : "0"}`;
    const job = createJobRow(input, industry, clientReference, createdBy);
    db.jobs.unshift(job);
    jobIds.push(job.id);
    jobs.push({
      position: index + 1,
      industry,
      job_id: job.id,
      client_reference: clientReference,
      status: "queued",
      error: null,
    });
  });
  const batch: StoredBatch = {
    id,
    scout_id: scout?.id ?? null,
    scout_name: scout?.name ?? null,
    run_number: runNumber,
    created_at: new Date().toISOString(),
    jobs,
    job_ids: jobIds,
  };
  batches.set(id, batch);
  if (scout) {
    scout.runs_count += 1;
    scout.last_run = {
      batch_id: id,
      run_number: runNumber ?? 1,
      created_at: batch.created_at,
      jobs: jobs.map((j) => ({
        job_id: j.job_id!,
        industry: j.industry,
        status: "queued",
        signals: null,
      })),
    };
    scout.signals_last_run = null;
  }
  return refreshStatuses(batch);
}

export const scoutHandlers = [
  http.get("/app/scouts", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    seedBatches();
    return HttpResponse.json({ items: db.scouts.filter((s) => !s.archived_at) });
  }),

  http.post("/app/scouts", async ({ request }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<ScoutInput>(request);
    if (!body?.name || !body.county || !body.state_code)
      return problem(422, "validation_error", "name, county and state_code are required");
    const now = new Date().toISOString();
    const scout: ScoutWithRuns = {
      ...body,
      id: nextMockId("scout"),
      created_by: user.id,
      created_at: now,
      updated_at: now,
      archived_at: null,
      runs_count: 0,
      last_run: null,
      signals_last_run: null,
    };
    db.scouts.push(scout);
    return HttpResponse.json(scout, { status: 201 });
  }),

  http.get("/app/scouts/:id", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    return scout ? HttpResponse.json(scout) : notFound("Scout");
  }),

  http.patch("/app/scouts/:id", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    if (!scout) return notFound("Scout");
    Object.assign(scout, (await readJson<Partial<ScoutInput>>(request)) ?? {}, {
      updated_at: new Date().toISOString(),
    });
    return HttpResponse.json(scout);
  }),

  http.delete("/app/scouts/:id", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    if (!scout) return notFound("Scout");
    scout.archived_at = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/app/scouts/:id/run", ({ request, params }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    if (!scout) return notFound("Scout");
    const input: BatchInput = {
      kind: scout.kind,
      county: scout.county,
      state_code: scout.state_code,
      location: scout.location ?? undefined,
      url: scout.url ?? undefined,
      industries: scout.industries,
      settings: scout.settings,
      scout_id: scout.id,
    };
    return HttpResponse.json(fanOut(input, scout, user.name), { status: 201 });
  }),

  http.post("/app/batches", async ({ request }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<BatchInput>(request);
    if (!body?.kind || !body.county || !body.state_code)
      return problem(422, "validation_error", "kind, county and state_code are required");
    let scout: ScoutWithRuns | null = body.scout_id
      ? (db.scouts.find((s) => s.id === body.scout_id) ?? null)
      : null;
    if (!scout && body.save_as_scout?.name) {
      const now = new Date().toISOString();
      scout = {
        id: nextMockId("scout"),
        name: body.save_as_scout.name,
        kind: body.kind,
        county: body.county,
        state_code: body.state_code,
        location: body.location ?? null,
        url: body.url ?? null,
        industries: body.industries,
        source_mode: body.kind === "seeds" ? "seeds" : "finder",
        settings: body.settings,
        created_by: user.id,
        created_at: now,
        updated_at: now,
        archived_at: null,
        runs_count: 0,
        last_run: null,
        signals_last_run: null,
      };
      db.scouts.push(scout);
    }
    return HttpResponse.json(fanOut(body, scout, user.name), { status: 201 });
  }),

  http.get("/app/batches", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    seedBatches();
    const ids = (new URL(request.url).searchParams.get("job_ids") ?? "").split(",").filter(Boolean);
    const result: Record<string, BatchMembership> = {};
    for (const batch of batches.values()) {
      batch.job_ids.forEach((jobId, index) => {
        if (ids.includes(jobId)) {
          result[jobId] = {
            batch_id: batch.id,
            position: index + 1,
            size: batch.job_ids.length,
            scout_id: batch.scout_id,
            scout_name: batch.scout_name,
            run_number: batch.run_number,
          };
        }
      });
    }
    return HttpResponse.json({ batches: result });
  }),

  http.get("/app/batches/:id", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    seedBatches();
    const batch = batches.get(String(params.id));
    return batch ? HttpResponse.json(refreshStatuses(batch)) : notFound("Batch");
  }),
];

/** Test helper: forget created batches (fixtures are re-seeded lazily). */
export function resetMockBatches(): void {
  batches.clear();
}
