/**
 * `/app/scouts*` and `/app/batches*` — Scouts CRUD, run fan-out and batch lookup (contract
 * §4.3, §4.5). A fan-out creates real rows in `db.jobs` (so Runs lists them) and a batch in
 * `db.batches`; seed batches compose their seeds from the active `db.sources`.
 */
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
import { addMockJob, db, nextMockId } from "@/mocks/db";
import { PROMPT_VERSION } from "@/mocks/fixtures/jobs";
import { slugIndustry, type MockBatch } from "@/mocks/fixtures/scouts";
import { readJson } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

const JOBS_BATCHES = 10;

function refreshStatuses(batch: MockBatch): Batch {
  const { job_ids: _ids, ...rest } = batch;
  return {
    ...rest,
    jobs: batch.jobs.map((leg) => ({
      ...leg,
      status: db.jobs.find((job) => job.id === leg.job_id)?.status ?? leg.status,
    })),
  };
}

function normaliseCounty(value: string): string {
  return value
    .trim()
    .replace(/\s+county$/i, "")
    .toLowerCase();
}

/** Active sources of the county/state (+ any of the industries; sources without industries match). */
export function seedsFor(input: Pick<BatchInput, "county" | "state_code" | "industries">) {
  const county = normaliseCounty(input.county);
  const wanted = input.industries.map((i) => i.toLowerCase());
  return db.sources
    .filter(
      (source) =>
        source.status === "active" &&
        normaliseCounty(source.county) === county &&
        source.state_code.toUpperCase() === input.state_code.toUpperCase() &&
        (wanted.length === 0 ||
          source.industries.length === 0 ||
          source.industries.some((i) => wanted.includes(i.toLowerCase()))),
    )
    .map((source) => ({ title: source.name, url: source.url }));
}

function createJobRow(
  input: BatchInput,
  industry: string | null,
  seeds: Array<{ title: string; url: string }>,
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
          : { seeds },
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
      seeds: seeds.length,
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
  const seeds = input.kind === "seeds" ? (input.seeds?.length ? input.seeds : seedsFor(input)) : [];
  const jobs: BatchJob[] = [];
  const jobIds: string[] = [];
  legs.forEach((industry, index) => {
    const clientReference = `ui:${id}:${industry ? slugIndustry(industry) : "0"}`;
    const job = createJobRow(input, industry, seeds, clientReference, createdBy);
    addMockJob(job);
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
  const batch: MockBatch = {
    id,
    scout_id: scout?.id ?? null,
    scout_name: scout?.name ?? null,
    run_number: runNumber,
    created_at: new Date().toISOString(),
    jobs,
    job_ids: jobIds,
  };
  db.batches.unshift(batch);
  if (scout) {
    scout.runs_count += 1;
    scout.last_run = {
      batch_id: id,
      run_number: runNumber ?? 1,
      created_at: batch.created_at,
      jobs: jobs.map((leg) => ({
        job_id: leg.job_id!,
        industry: leg.industry,
        status: "queued",
        signals: null,
      })),
    };
    scout.signals_last_run = null;
  }
  return refreshStatuses(batch);
}

function nameTaken(name: string, exceptId?: string): boolean {
  return db.scouts.some((s) => s.name === name && s.id !== exceptId);
}

export const scoutHandlers = [
  http.get("/app/scouts", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const archived = new URL(request.url).searchParams.get("archived") === "true";
    const items = db.scouts.filter((s) => archived || !s.archived_at);
    return HttpResponse.json({ items });
  }),

  http.post("/app/scouts", async ({ request }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<ScoutInput>(request);
    if (!body?.name || !body.county || !body.state_code)
      return problem(422, "validation_error", "name, county and state_code are required");
    if (nameTaken(body.name))
      return problem(409, "scout_exists", "A Scout with this name already exists.");
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

  http.get("/app/scouts/:id/jobs", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    if (!scout) return notFound("Scout");
    const jobIds = db.batches
      .filter((batch) => batch.scout_id === scout.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, JOBS_BATCHES)
      .flatMap((batch) => batch.job_ids);
    const items = jobIds
      .map((jobId) => db.jobs.find((job) => job.id === jobId))
      .filter((job): job is JobDetail => job !== undefined);
    return HttpResponse.json({ items });
  }),

  http.patch("/app/scouts/:id", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const scout = db.scouts.find((s) => s.id === params.id);
    if (!scout) return notFound("Scout");
    const patch = (await readJson<Partial<ScoutInput>>(request)) ?? {};
    if (patch.name && nameTaken(patch.name, scout.id))
      return problem(409, "scout_exists", "A Scout with this name already exists.");
    Object.assign(scout, patch, { updated_at: new Date().toISOString() });
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
    if (scout.archived_at) return problem(409, "scout_archived", "This Scout is archived.");
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
    if (input.kind === "seeds" && seedsFor(input).length === 0)
      return problem(422, "no_active_sources", "No active sources match this county.");
    return HttpResponse.json(fanOut(input, scout, user.name), { status: 201 });
  }),

  http.post("/app/batches", async ({ request }) => {
    const { user, error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<BatchInput>(request);
    if (!body?.kind || !body.county || !body.state_code)
      return problem(422, "validation_error", "kind, county and state_code are required");
    if (body.kind === "seeds" && !body.seeds?.length && seedsFor(body).length === 0)
      return problem(422, "no_active_sources", "No active sources match this county.");
    let scout: ScoutWithRuns | null = body.scout_id
      ? (db.scouts.find((s) => s.id === body.scout_id) ?? null)
      : null;
    if (!scout && body.save_as_scout?.name) {
      if (nameTaken(body.save_as_scout.name))
        return problem(409, "scout_exists", "A Scout with this name already exists.");
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
    const ids = (new URL(request.url).searchParams.get("job_ids") ?? "").split(",").filter(Boolean);
    const result: Record<string, BatchMembership> = {};
    for (const batch of db.batches) {
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
    const batch = db.batches.find((b) => b.id === String(params.id));
    return batch ? HttpResponse.json(refreshStatuses(batch)) : notFound("Batch");
  }),
];
