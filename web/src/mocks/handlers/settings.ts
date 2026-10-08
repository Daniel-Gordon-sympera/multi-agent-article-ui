/** Workers, daily stats, readiness, API keys, exports, `/app/system*` and `/app/views`. */
import { http, HttpResponse } from "msw";
import type { SystemInfo, ViewInput } from "@/api/types/bff";
import type { DeadByCategory, QueueSummary } from "@/api/types/overview";
import type { CreateExportInput, ExportRecord } from "@/api/types/stats";
import { db, nextMockId } from "@/mocks/db";
import { NOW, dateDaysAgo } from "@/mocks/fixtures/clock";
import {
  BFF_STARTED_AT,
  MAINTENANCE_SCHEDULE,
  PIPELINE_CHECKS,
  SYSTEM_NOTES,
} from "@/mocks/fixtures/settings";
import { MOCK_CAPABILITIES } from "@/mocks/fixtures/users";
import { liveWorkerRow } from "@/mocks/fixtures/workers";
import { applyExactFilters, paginate, readJson, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { BFF_VERSION, PIPELINE_VERSION } from "./auth";

/** Exports progress one step per poll: queued → running → completed (contract §1 shapes). */
interface StoredExport extends ExportRecord {
  polls: number;
}
const exportsStore = new Map<string, StoredExport>();
const TERMINAL_JOBS = new Set(["completed", "partial", "failed", "cancelled"]);

export function buildQueueSummary(): QueueSummary {
  const recent = db.jobs.filter((job) => !TERMINAL_JOBS.has(job.status)).slice(0, 20);
  return {
    queued: recent.reduce((sum, job) => sum + job.progress.tasks_pending, 0),
    running: recent.reduce((sum, job) => sum + job.progress.tasks_running, 0),
    failed: null,
    dead: recent.reduce((sum, job) => sum + job.progress.tasks_dead, 0),
    basis: "recent_jobs",
    jobs_scanned: recent.length,
  };
}

export function buildDeadByCategory(days: number): DeadByCategory {
  const since = dateDaysAgo(days - 1);
  const totals = new Map<string, number>();
  for (const row of db.dailyStats) {
    if (row.day < since) continue;
    for (const [category, count] of Object.entries(row.failures)) {
      totals.set(category, (totals.get(category) ?? 0) + count);
    }
  }
  const ordered = [...totals.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const largest = ordered[0]?.[1] ?? 0;
  return {
    days,
    since,
    total: ordered.reduce((sum, [, count]) => sum + count, 0),
    items: ordered.map(([category, count]) => ({
      category,
      count,
      pct: largest ? Math.round((count / largest) * 100) : 0,
    })),
  };
}

export function buildSystemInfo(): SystemInfo {
  const newest = [...db.jobs].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    bff: { version: BFF_VERSION, migrations_head: "0001_ui_schema", started_at: BFF_STARTED_AT },
    pipeline: {
      url_host: "api:8000",
      ready: true,
      checks: PIPELINE_CHECKS,
      version: PIPELINE_VERSION,
      prompt_version: newest?.prompt_version ?? null,
    },
    capabilities: { ...MOCK_CAPABILITIES, probe_error: null },
    capabilities_probed_at: NOW.toISOString(),
    model_prices: null,
    notes: SYSTEM_NOTES,
  };
}

export const settingsHandlers = [
  http.get("/v1/workers", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["role"]);
    if (rejected) return rejected;
    const now = new Date();
    const rows = applyExactFilters(db.workers, url, ["role"]).map((w) => liveWorkerRow(w, now));
    return HttpResponse.json(paginate(rows, url, (w) => w.instance_id));
  }),

  http.get("/v1/stats/daily", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["created_after"]);
    if (rejected) return rejected;
    let rows = [...db.dailyStats].sort((a, b) => b.day.localeCompare(a.day));
    const after = url.searchParams.get("created_after");
    if (after) rows = rows.filter((r) => r.day >= after.slice(0, 10));
    return HttpResponse.json(paginate(rows, url, (r) => r.day));
  }),

  http.get("/readyz", () =>
    HttpResponse.json({
      status: "ready",
      checks: { database: true, migrations: true, pipeline_api: true },
    }),
  ),
  http.get("/healthz", () => HttpResponse.json({ status: "ok" })),

  http.get("/app/system", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json(buildSystemInfo());
  }),

  http.get("/app/system/queue", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json(buildQueueSummary());
  }),

  http.get("/app/system/dead-by-category", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const days = Number(new URL(request.url).searchParams.get("days") ?? 7);
    if (!Number.isInteger(days) || days < 1 || days > 90)
      return problem(422, "validation_error", "days must be 1..90");
    return HttpResponse.json(buildDeadByCategory(days));
  }),

  http.get("/app/system/maintenance", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json(MAINTENANCE_SCHEDULE);
  }),

  http.get("/v1/api-keys", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json(paginate(db.apiKeys, new URL(request.url), (row) => row.id));
  }),

  http.post("/v1/api-keys", async ({ request }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const body = await readJson<{ name: string; role: "operator" | "reader" }>(request);
    if (!body?.name || !body.role)
      return problem(422, "validation_error", "name and role are required");
    if (!/^[A-Za-z0-9_.-]+$/.test(body.name))
      return problem(422, "validation_error", "name may only use letters, digits, _ . -");
    if (db.apiKeys.some((k) => k.name === body.name))
      return problem(409, "key_name_exists", "This API key name already exists");
    const key = {
      id: db.apiKeys.length + 1,
      name: body.name,
      role: body.role,
      created_at: new Date().toISOString(),
    };
    db.apiKeys.push(key);
    return HttpResponse.json(
      { ...key, key: `sympera_${body.role}_${nextMockId()}_mock_secret` },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  }),

  http.delete("/v1/api-keys/:name", ({ request, params }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const index = db.apiKeys.findIndex((k) => k.name === params.name);
    if (index < 0) return problem(404, "key_not_found", "The API key name does not exist.");
    db.apiKeys.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/v1/exports", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<CreateExportInput>(request);
    if (!body?.scope || !body.tables?.length)
      return problem(422, "validation_error", "scope and tables are required");
    const id = nextMockId("exp");
    exportsStore.set(id, {
      id,
      job_id: body.job_id ?? null,
      kind: body.kind ?? "csv",
      scope: body.scope,
      tables: body.tables,
      filters: body.filters ?? {},
      artifact_sha: null,
      download_expired: false,
      download_url: null,
      status: "queued",
      created_at: new Date().toISOString(),
      finished_at: null,
      polls: 0,
    });
    return HttpResponse.json(
      { export_id: id, status: "queued", links: { self: `/v1/exports/${id}` } },
      { status: 202 },
    );
  }),

  http.get("/v1/exports/:exportId", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const record = exportsStore.get(String(params.exportId));
    if (!record) return notFound("Export");
    record.polls += 1;
    if (record.status === "queued" && record.polls >= 1) record.status = "running";
    if (record.status === "running" && record.polls >= 3) {
      record.status = "completed";
      record.artifact_sha = `sha-${record.id}`;
      record.finished_at = new Date().toISOString();
    }
    const { polls: _polls, ...row } = record;
    return HttpResponse.json({
      ...row,
      download_url: row.artifact_sha ? `/v1/artifacts/export/${row.artifact_sha}` : null,
      download_expired: false,
    });
  }),

  http.get("/v1/artifacts/:kind/:sha", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    return new HttpResponse(`mock ${String(params.kind)} artifact ${String(params.sha)}`, {
      headers: { "Content-Type": "text/plain" },
    });
  }),

  http.get("/app/views", ({ request }) => {
    const { user, error } = guard(request);
    if (error) return error;
    const route = new URL(request.url).searchParams.get("route");
    const rows = db.views.filter(
      (v) => (v.user_id === user.id || v.shared) && (!route || v.route === route),
    );
    return HttpResponse.json({ items: rows, next_cursor: null });
  }),

  http.post("/app/views", async ({ request }) => {
    const { user, error } = guard(request);
    if (error) return error;
    const body = await readJson<ViewInput>(request);
    if (!body?.name || !body.route)
      return problem(422, "validation_error", "name and route are required");
    const view = {
      id: nextMockId("view"),
      user_id: user.id,
      name: body.name,
      route: body.route,
      search: body.search ?? {},
      columns: body.columns ?? null,
      shared: body.shared ?? false,
      created_at: new Date().toISOString(),
    };
    db.views.push(view);
    return HttpResponse.json(view, { status: 201 });
  }),

  http.patch("/app/views/:id", async ({ request, params }) => {
    const { user, error } = guard(request);
    if (error) return error;
    const view = db.views.find((v) => v.id === params.id);
    if (!view) return notFound("View");
    if (view.user_id !== user.id && user.role !== "admin")
      return problem(403, "forbidden", "Not your view");
    Object.assign(view, (await readJson<Partial<ViewInput>>(request)) ?? {});
    return HttpResponse.json(view);
  }),

  http.delete("/app/views/:id", ({ request, params }) => {
    const { user, error } = guard(request);
    if (error) return error;
    const index = db.views.findIndex((v) => v.id === params.id);
    if (index < 0) return notFound("View");
    if (db.views[index]!.user_id !== user.id && user.role !== "admin")
      return problem(403, "forbidden", "Not your view");
    db.views.splice(index, 1);
    return new HttpResponse(null, { status: 204 });
  }),
];
