/** Workers, daily stats, readiness, API keys, exports, `/app/system` and `/app/views`. */
import { http, HttpResponse } from "msw";
import type { ViewInput } from "@/api/types/bff";
import type { CreateExportInput } from "@/api/types/stats";
import { db, nextMockId } from "@/mocks/db";
import { NOW, daysAgo } from "@/mocks/fixtures/clock";
import { MOCK_CAPABILITIES } from "@/mocks/fixtures/users";
import { applyExactFilters, paginate, readJson, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { BFF_VERSION, PIPELINE_VERSION } from "./auth";

const exportsStore = new Map<
  string,
  {
    id: string;
    job_id: string | null;
    kind: string;
    scope: string;
    tables: string[];
    filters: Record<string, unknown>;
    artifact_sha: string | null;
    status: string;
    created_at: string;
    finished_at: string | null;
  }
>();

export const settingsHandlers = [
  http.get("/v1/workers", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["role"]);
    if (rejected) return rejected;
    const rows = applyExactFilters(db.workers, url, ["role"]).map((w) => {
      const age = Math.max(0, (Date.now() - new Date(w.last_seen).getTime()) / 1000);
      return { ...w, heartbeat_age_seconds: Math.round(age), live: age < 180 };
    });
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
      checks: { database: "ok", migrations: "ok", pipeline_api: "ok" },
    }),
  ),
  http.get("/healthz", () => HttpResponse.json({ status: "ok" })),

  http.get("/app/system", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({
      bff: {
        version: BFF_VERSION,
        migrations_head: "0001_ui_schema",
        started_at: daysAgo(1, 22, 10),
      },
      pipeline: {
        url_host: "api:8000",
        ready: true,
        checks: { database: "ok", artifact_store: "ok · RustFS", migrations: "head 0003" },
        version: PIPELINE_VERSION,
        prompt_version: "2026.10",
      },
      capabilities: MOCK_CAPABILITIES,
      model_prices: null,
    });
  }),

  http.get("/v1/api-keys", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    // Today's backend has no list route (capability api_keys_list = false).
    return problem(404, "not_proxied", "GET /v1/api-keys is not available");
  }),

  http.post("/v1/api-keys", async ({ request }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const body = await readJson<{ name: string; role: "operator" | "reader" }>(request);
    if (!body?.name || !body.role)
      return problem(422, "validation_error", "name and role are required");
    if (db.apiKeys.some((k) => k.name === body.name))
      return problem(409, "api_key_exists", "An API key with this name exists");
    const key = {
      id: db.apiKeys.length + 1,
      name: body.name,
      role: body.role,
      created_at: NOW.toISOString(),
    };
    db.apiKeys.push(key);
    return HttpResponse.json(
      { ...key, key: `sk_${body.role}_${nextMockId()}_mock` },
      { status: 201 },
    );
  }),

  http.delete("/v1/api-keys/:name", ({ request, params }) => {
    const { error } = guard(request, { minRole: "admin" });
    if (error) return error;
    const index = db.apiKeys.findIndex((k) => k.name === params.name);
    if (index < 0) return notFound("API key");
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
    const record = {
      id,
      job_id: body.job_id ?? null,
      kind: body.kind ?? "csv",
      scope: body.scope,
      tables: body.tables,
      filters: body.filters ?? {},
      artifact_sha: null as string | null,
      status: "queued",
      created_at: NOW.toISOString(),
      finished_at: null as string | null,
    };
    exportsStore.set(id, record);
    setTimeout(() => {
      record.status = "completed";
      record.artifact_sha = `sha-${id}`;
      record.finished_at = new Date().toISOString();
    }, 2500);
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
    return HttpResponse.json({
      ...record,
      download_url: record.artifact_sha ? `/v1/artifacts/export/${record.artifact_sha}` : null,
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
