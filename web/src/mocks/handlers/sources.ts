/**
 * `/app/sources*` — curated sources, suggestions, promote/dismiss, CSV import (contract §4.3).
 * Stats start from the mockup's tile numbers and follow the mutations; the fixture precision
 * stands in for the pipeline's `sources_stats` capability.
 */
import { http, HttpResponse } from "msw";
import type {
  DismissSuggestionInput,
  PromoteSuggestionInput,
  Source,
  SourceInput,
} from "@/api/types/bff";
import { db, nextMockId } from "@/mocks/db";
import { SOURCE_STATS_BASELINE, buildSourceFixtures } from "@/mocks/fixtures/sources";
import { applyExactFilters, paginate, readJson, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { normaliseStateCode } from "@/features/sources/usStates";

const MAX_UPLOAD_BYTES = 1_048_576;
const MAX_ROWS = 2_000;

export function domainOf(url: string): string {
  try {
    return new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return (
      url
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        ?.toLowerCase() ?? url
    );
  }
}

function normaliseCounty(value: string): string {
  return value.trim().replace(/\s+county$/i, "");
}

const keyOf = (domain: string, county: string, state: string) =>
  `${domain}|${normaliseCounty(county).toLowerCase()}|${state.toUpperCase()}`;

function isListed(domain: string, county: string, state: string): boolean {
  const key = keyOf(domain, county, state);
  return db.sources.some((s) => keyOf(s.domain, s.county, s.state_code) === key);
}

/** Baseline tile numbers moved by the difference between the current rows and the fixtures. */
function stats() {
  const fixtures = buildSourceFixtures();
  const count = (rows: Source[], predicate: (s: Source) => boolean) =>
    rows.filter(predicate).length;
  const active = (s: Source) => s.status === "active";
  const promoted = (s: Source) => s.status === "active" && s.origin === "finder";
  const removed = (s: Source) => s.status === "removed";
  const counties = (rows: Source[]) =>
    new Set(rows.filter(active).map((s) => keyOf("", s.county, s.state_code))).size;
  const ratios = db.sources
    .filter(active)
    .map((s) => s.precision?.ratio)
    .filter((r): r is number => typeof r === "number")
    .sort((a, b) => a - b);
  return {
    active: SOURCE_STATS_BASELINE.active + count(db.sources, active) - count(fixtures, active),
    promoted:
      SOURCE_STATS_BASELINE.promoted + count(db.sources, promoted) - count(fixtures, promoted),
    removed: SOURCE_STATS_BASELINE.removed + count(db.sources, removed) - count(fixtures, removed),
    counties: SOURCE_STATS_BASELINE.counties + counties(db.sources) - counties(fixtures),
    median_precision: ratios.length ? ratios[Math.floor(ratios.length / 2)]! : null,
  };
}

function newSource(
  input: Pick<Source, "name" | "url" | "county" | "state_code" | "industries" | "origin"> &
    Partial<Pick<Source, "finder">>,
): Source {
  return {
    id: nextMockId("src"),
    name: input.name,
    domain: domainOf(input.url),
    url: input.url,
    county: normaliseCounty(input.county),
    state_code: input.state_code.toUpperCase(),
    industries: input.industries,
    origin: input.origin,
    finder: input.finder ?? null,
    status: "active",
    created_at: new Date().toISOString(),
    removed_at: null,
    precision: null,
  };
}

function isUpload(value: unknown): value is Pick<File, "size" | "text"> {
  return (
    typeof value === "object" &&
    value !== null &&
    "size" in value &&
    "text" in value &&
    typeof (value as { text: unknown }).text === "function"
  );
}

/** Minimal RFC 4180 line split: quoted cells may contain commas. */
function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export const sourceHandlers = [
  http.get("/app/sources", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "active";
    let rows = db.sources.filter((s) => status === "all" || s.status === status);
    const county = url.searchParams.get("county");
    if (county)
      rows = rows.filter(
        (s) => normaliseCounty(s.county).toLowerCase() === normaliseCounty(county).toLowerCase(),
      );
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
    const state = normaliseStateCode(body.state_code);
    if (!state) return problem(422, "validation_error", "Unknown state");
    if (isListed(domainOf(body.url), body.county, state))
      return problem(409, "source_exists", "This domain is already listed for the county");
    const source = newSource({
      ...body,
      state_code: state,
      industries: body.industries ?? [],
      origin: "manual",
    });
    db.sources.unshift(source);
    return HttpResponse.json(source, { status: 201 });
  }),

  http.patch("/app/sources/:id", async ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const source = db.sources.find((s) => s.id === params.id);
    if (!source) return notFound("Source");
    const patch = (await readJson<Partial<SourceInput>>(request)) ?? {};
    const next = {
      ...source,
      ...patch,
      state_code: normaliseStateCode(patch.state_code ?? source.state_code) ?? source.state_code,
      domain: patch.url ? domainOf(patch.url) : source.domain,
    };
    const clash = db.sources.some(
      (s) =>
        s.id !== source.id &&
        keyOf(s.domain, s.county, s.state_code) ===
          keyOf(next.domain, next.county, next.state_code),
    );
    if (clash) return problem(409, "source_exists", "This domain is already listed for the county");
    Object.assign(source, next, { county: normaliseCounty(next.county) });
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
    // jsdom's File and Node's File are different realms in Vitest: duck-type the upload.
    if (!isUpload(file)) return problem(422, "validation_error", "A CSV file is required");
    if (file.size > MAX_UPLOAD_BYTES)
      return problem(413, "file_too_large", "The CSV must be 1 MB or smaller.");
    const lines = (await file.text()).split(/\r?\n/).filter((line) => line.trim());
    const header = splitCsvLine(lines[0] ?? "").map((h) => h.toLowerCase());
    const column = (name: string) => header.indexOf(name);
    if (["name", "url", "county", "state"].some((name) => column(name) < 0))
      return problem(422, "invalid_csv", "The header must contain name, url, county, state.");
    if (lines.length - 1 > MAX_ROWS)
      return problem(422, "too_many_rows", `The CSV may contain at most ${MAX_ROWS} rows.`);
    const skipped: Array<{ row: number; reason: string }> = [];
    const seen = new Set<string>();
    let imported = 0;
    lines.slice(1).forEach((line, index) => {
      const row = index + 2;
      const cells = splitCsvLine(line);
      const cell = (name: string) => cells[column(name)] ?? "";
      const [name, url, county] = [cell("name"), cell("url"), cell("county")];
      const state = normaliseStateCode(cell("state"));
      if (!name) return skipped.push({ row, reason: "missing name" });
      if (!/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}/i.test(url))
        return skipped.push({ row, reason: "invalid url" });
      if (!county) return skipped.push({ row, reason: "missing county" });
      if (!state) return skipped.push({ row, reason: `unknown state '${cell("state")}'` });
      const key = keyOf(domainOf(url), county, state);
      if (seen.has(key)) return skipped.push({ row, reason: "duplicate of an earlier row" });
      seen.add(key);
      if (isListed(domainOf(url), county, state))
        return skipped.push({ row, reason: "already listed for this county and state" });
      const industries = (column("industries") >= 0 ? cell("industries") : "")
        .split(";")
        .map((i) => i.trim())
        .filter(Boolean);
      db.sources.unshift(
        newSource({ name, url, county, state_code: state, industries, origin: "csv" }),
      );
      imported += 1;
      return undefined;
    });
    return HttpResponse.json({ imported, skipped });
  }),

  http.get("/app/sources/suggestions", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    let rows = db.suggestions.filter(
      (s) =>
        !isListed(s.domain, s.county, s.state_code) &&
        !db.dismissed.has(keyOf(s.domain, s.county, s.state_code)),
    );
    const county = url.searchParams.get("county");
    if (county)
      rows = rows.filter(
        (s) => normaliseCounty(s.county).toLowerCase() === normaliseCounty(county).toLowerCase(),
      );
    const state = url.searchParams.get("state");
    if (state) rows = rows.filter((s) => s.state_code.toLowerCase() === state.toLowerCase());
    const industry = url.searchParams.get("industry");
    if (industry) rows = rows.filter((s) => s.industry?.toLowerCase() === industry.toLowerCase());
    const limit = Number(url.searchParams.get("limit") ?? 50) || 50;
    return HttpResponse.json({ items: rows.slice(0, limit) });
  }),

  http.post("/app/sources/promote", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<PromoteSuggestionInput>(request);
    const suggestion = body?.suggestion;
    if (!suggestion?.domain || !suggestion.county || !suggestion.state_code)
      return problem(422, "validation_error", "suggestion is required");
    if (isListed(suggestion.domain, suggestion.county, suggestion.state_code))
      return problem(409, "source_exists", "This domain is already listed for the county");
    const source = newSource({
      name: body?.name ?? suggestion.name ?? suggestion.domain,
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
    });
    db.sources.unshift(source);
    return HttpResponse.json(source, { status: 201 });
  }),

  http.post("/app/sources/dismiss", async ({ request }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const body = await readJson<DismissSuggestionInput>(request);
    if (!body?.domain || !body.county || !body.state_code)
      return problem(422, "validation_error", "domain, county and state_code are required");
    db.dismissed.add(keyOf(body.domain, body.county, body.state_code));
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
