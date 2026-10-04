/** `/app/sources*` — curated sources, suggestions, promote/dismiss, CSV import (contract §4.3). */
import { http, HttpResponse } from "msw";
import type {
  DismissSuggestionInput,
  PromoteSuggestionInput,
  Source,
  SourceInput,
} from "@/api/types/bff";
import { db, nextMockId } from "@/mocks/db";
import { applyExactFilters, paginate, readJson, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

function stats() {
  const active = db.sources.filter((s) => s.status === "active");
  const ratios = active
    .map((s) => s.precision?.ratio)
    .filter((r): r is number => typeof r === "number")
    .sort((a, b) => a - b);
  return {
    active: active.length,
    promoted: active.filter((s) => s.origin === "finder").length,
    removed: db.sources.filter((s) => s.status === "removed").length,
    counties: new Set(active.map((s) => `${s.county}|${s.state_code}`)).size,
    median_precision: ratios.length ? ratios[Math.floor(ratios.length / 2)]! : null,
  };
}

export const sourceHandlers = [
  http.get("/app/sources", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "active";
    let rows = db.sources.filter((s) => status === "all" || s.status === status);
    const county = url.searchParams.get("county");
    if (county) rows = rows.filter((s) => s.county.toLowerCase() === county.toLowerCase());
    const state = url.searchParams.get("state");
    if (state) rows = rows.filter((s) => s.state_code.toLowerCase() === state.toLowerCase());
    const industry = url.searchParams.get("industry");
    if (industry)
      rows = rows.filter((s) =>
        s.industries.some((i) => i.toLowerCase() === industry.toLowerCase()),
      );
    const origin = url.searchParams.get("origin");
    if (origin) rows = rows.filter((s) => s.origin === origin);
    const q = url.searchParams.get("q")?.toLowerCase();
    if (q)
      rows = rows.filter(
        (s) => s.name.toLowerCase().includes(q) || s.domain.toLowerCase().includes(q),
      );
    return HttpResponse.json({ items: rows, stats: stats() });
  }),

  http.post("/app/sources", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<SourceInput>(request);
    if (!body?.name || !body.url || !body.county || !body.state_code)
      return problem(422, "validation_error", "name, url, county and state_code are required");
    const domain = body.domain ?? domainOf(body.url);
    if (
      db.sources.some(
        (s) => s.domain === domain && s.county === body.county && s.state_code === body.state_code,
      )
    ) {
      return problem(409, "source_exists", "This domain is already listed for the county");
    }
    const source: Source = {
      id: nextMockId("src"),
      name: body.name,
      domain,
      url: body.url,
      county: body.county,
      state_code: body.state_code,
      industries: body.industries ?? [],
      origin: "manual",
      finder: null,
      status: "active",
      created_at: new Date().toISOString(),
      removed_at: null,
      precision: null,
    };
    db.sources.unshift(source);
    return HttpResponse.json(source, { status: 201 });
  }),

  http.patch("/app/sources/:id", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const source = db.sources.find((s) => s.id === params.id);
    if (!source) return notFound("Source");
    Object.assign(source, (await readJson<Partial<SourceInput>>(request)) ?? {});
    return HttpResponse.json(source);
  }),

  http.delete("/app/sources/:id", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const source = db.sources.find((s) => s.id === params.id);
    if (!source) return notFound("Source");
    source.status = "removed";
    source.removed_at = new Date().toISOString();
    return new HttpResponse(null, { status: 204 });
  }),

  http.post("/app/sources/:id/restore", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const source = db.sources.find((s) => s.id === params.id);
    if (!source) return notFound("Source");
    source.status = "active";
    source.removed_at = null;
    return HttpResponse.json(source);
  }),

  http.post("/app/sources/import", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return problem(422, "validation_error", "A CSV file is required");
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const skipped: Array<{ row: number; reason: string }> = [];
    let imported = 0;
    lines.slice(1).forEach((line, index) => {
      const [name, url, county, state, industries] = line.split(",").map((v) => v.trim());
      if (!name || !url || !county || !state) {
        skipped.push({ row: index + 2, reason: "missing name, url, county or state" });
        return;
      }
      const domain = domainOf(url);
      if (
        db.sources.some((s) => s.domain === domain && s.county === county && s.state_code === state)
      ) {
        skipped.push({ row: index + 2, reason: "already listed" });
        return;
      }
      db.sources.unshift({
        id: nextMockId("src"),
        name,
        domain,
        url,
        county,
        state_code: state,
        industries: (industries ?? "")
          .split(";")
          .map((i) => i.trim())
          .filter(Boolean),
        origin: "csv",
        finder: null,
        status: "active",
        created_at: new Date().toISOString(),
        removed_at: null,
        precision: null,
      });
      imported += 1;
    });
    return HttpResponse.json({ imported, skipped });
  }),

  http.get("/app/sources/suggestions", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const listed = new Set(db.sources.map((s) => `${s.domain}|${s.county}|${s.state_code}`));
    let rows = db.suggestions.filter(
      (s) =>
        !listed.has(`${s.domain}|${s.county}|${s.state_code}`) &&
        !db.dismissed.has(`${s.domain}|${s.county}|${s.state_code}`),
    );
    const county = url.searchParams.get("county");
    if (county) rows = rows.filter((s) => s.county.toLowerCase() === county.toLowerCase());
    const state = url.searchParams.get("state");
    if (state) rows = rows.filter((s) => s.state_code.toLowerCase() === state.toLowerCase());
    const limit = Number(url.searchParams.get("limit") ?? 50) || 50;
    return HttpResponse.json({ items: rows.slice(0, limit) });
  }),

  http.post("/app/sources/promote", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<PromoteSuggestionInput>(request);
    const suggestion = body?.suggestion;
    if (!suggestion?.domain) return problem(422, "validation_error", "suggestion is required");
    const source: Source = {
      id: nextMockId("src"),
      name: body?.name ?? suggestion.name ?? suggestion.domain,
      domain: suggestion.domain,
      url: suggestion.url,
      county: suggestion.county,
      state_code: suggestion.state_code,
      industries: body?.industries ?? (suggestion.industry ? [suggestion.industry] : []),
      origin: "finder",
      finder: {
        tier: suggestion.tier ?? null,
        verdict: suggestion.verdict,
        reason: suggestion.reason,
        judged_at: suggestion.judged_at,
        rank: suggestion.rank ?? null,
        job_id: suggestion.job_id ?? null,
      },
      status: "active",
      created_at: new Date().toISOString(),
      removed_at: null,
      precision: null,
    };
    db.sources.unshift(source);
    return HttpResponse.json(source, { status: 201 });
  }),

  http.post("/app/sources/dismiss", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<DismissSuggestionInput>(request);
    if (!body?.domain) return problem(422, "validation_error", "domain is required");
    db.dismissed.add(`${body.domain}|${body.county}|${body.state_code}`);
    return new HttpResponse(null, { status: 204 });
  }),

  /** `GET /v1/finder/memory` — the judged-domain memory, derived from the suggestion fixtures. */
  http.get("/v1/finder/memory", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, [
      "location",
      "industry",
      "domain",
      "verdict",
      "created_after",
    ]);
    if (rejected) return rejected;
    const rows = db.suggestions.map((s) => ({
      location_key: `${s.county.toLowerCase()} county, ${s.state_code.toLowerCase()}`,
      industry_key: (s.industry ?? "").toLowerCase(),
      domain: s.domain,
      verdict: s.verdict,
      name: s.name ?? null,
      url: s.url,
      coverage: "local",
      relevance: s.tier === "high" ? "high" : "medium",
      reason: s.reason,
      tier: s.tier ?? null,
      judged_at: s.judged_at,
      search_id: "9c8b7a6d-0001-4c00-a000-000000000201",
      job_id: s.job_id ?? null,
      source_order: s.rank ?? null,
    }));
    const filtered = applyExactFilters(rows, url, ["domain", "verdict"]);
    return HttpResponse.json(
      paginate(filtered, url, (r) => `${r.location_key}|${r.industry_key}|${r.domain}`),
    );
  }),

  http.get("/v1/urls", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["domain", "classification", "created_after"]);
    if (rejected) return rejected;
    return HttpResponse.json({ items: [], next_cursor: null });
  }),
];
