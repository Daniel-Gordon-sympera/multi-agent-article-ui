/**
 * Per-job signals/companies/flags and the global `/app/signals` read, summary and CSV. The
 * drawer's detail reads live in `signalsDetail.ts`.
 */
import { http, HttpResponse } from "msw";
import type { CrossJobSignalRow } from "@/api/types/signals";
import { signalRowsToCsv } from "@/features/signals/signalExport";
import { db } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { signalJobId } from "@/mocks/fixtures/signals";
import { applyExactFilters, paginate, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { findJob } from "./jobs";
import { crossJobRow, everySignalRow, signalDetailHandlers } from "./signalsDetail";

const EXACT_FILTERS: Array<[string, (r: CrossJobSignalRow) => string]> = [
  ["signal", (r) => r.signal ?? ""],
  ["materiality", (r) => r.materiality ?? ""],
  ["company_key", (r) => r.company_key ?? ""],
  ["hq_scope", (r) => r.hq_scope ?? ""],
  ["org_kind", (r) => r.org_kind ?? ""],
  ["industry", (r) => r.company_industry ?? ""],
  ["job_industry", (r) => r.job_industry ?? ""],
  ["state", (r) => r.state_code],
  ["county", (r) => r.county],
  ["revenue_bin", (r) => r.revenue_bin ?? ""],
  ["job_id", (r) => r.job_id],
];
const ALL_FILTERS = [
  ...EXACT_FILTERS.map(([key]) => key),
  "batch_id",
  "date_after",
  "date_before",
  "q",
];

function filteredCrossJobRows(url: URL): CrossJobSignalRow[] | Response {
  const rejected = rejectUnknownFilters(url, ALL_FILTERS);
  if (rejected) return rejected;
  let rows = everySignalRow().map(crossJobRow);
  for (const [key, pick] of EXACT_FILTERS) {
    const value = url.searchParams.get(key);
    if (value) rows = rows.filter((r) => pick(r).toLowerCase() === value.toLowerCase());
  }
  const batchId = url.searchParams.get("batch_id");
  if (batchId) {
    const jobIds = new Set(
      db.jobs.filter((j) => j.client_reference?.startsWith(`ui:${batchId}:`)).map((j) => j.id),
    );
    rows = rows.filter((r) => jobIds.has(r.job_id));
  }
  const dateAfter = url.searchParams.get("date_after");
  if (dateAfter) rows = rows.filter((r) => r.date != null && r.date >= dateAfter);
  const dateBefore = url.searchParams.get("date_before");
  if (dateBefore) rows = rows.filter((r) => r.date != null && r.date <= dateBefore);
  const q = url.searchParams.get("q")?.toLowerCase();
  if (q)
    rows = rows.filter((r) =>
      [r.company, r.evidence, r.signal ?? "", r.signal_title ?? "", r.source_domain].some((v) =>
        (v ?? "").toLowerCase().includes(q),
      ),
    );
  rows.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.id - a.id);
  return rows;
}

function atobSafe(value: string | null): string | null {
  if (!value) return null;
  try {
    return atob(value);
  } catch {
    return null;
  }
}

export const signalHandlers = [
  http.get("/v1/jobs/:jobId/signals", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const url = new URL(request.url);
    const filters = ["id", "signal", "materiality", "company_key", "hq_scope", "org_kind"];
    const rejected = rejectUnknownFilters(url, filters);
    if (rejected) return rejected;
    const rows = everySignalRow().filter((row) => signalJobId(row) === job.id);
    return HttpResponse.json(paginate(applyExactFilters(rows, url, filters), url, (r) => r.id));
  }),

  http.get("/v1/jobs/:jobId/companies", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["company_key", "org_kind", "hq_scope", "industry"]);
    if (rejected) return rejected;
    let rows = job.id === MAIN_JOB_ID ? db.results.mentions : [];
    rows = applyExactFilters(rows, url, ["company_key", "org_kind", "hq_scope"]);
    const industry = url.searchParams.get("industry");
    if (industry)
      rows = rows.filter(
        (r) => (r.company_industry ?? "").toLowerCase() === industry.toLowerCase(),
      );
    return HttpResponse.json(paginate(rows, url, (r) => r.id));
  }),

  http.get("/v1/jobs/:jobId/flags", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const url = new URL(request.url);
    const filters = ["org_kind", "hq_scope", "revenue_bin"];
    const rejected = rejectUnknownFilters(url, filters);
    if (rejected) return rejected;
    const rows = job.id === MAIN_JOB_ID ? db.results.flags : [];
    return HttpResponse.json(
      paginate(applyExactFilters(rows, url, filters), url, (r) => r.company_id ?? 0),
    );
  }),

  http.get("/app/signals", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 50);
    if (!Number.isFinite(limitRaw) || limitRaw < 1 || limitRaw > 200)
      return problem(422, "validation_error", "limit must be between 1 and 200");
    const rows = filteredCrossJobRows(url);
    if (rows instanceof Response) return rows;
    const limit = Math.floor(limitRaw);
    const offset = Number(atobSafe(url.searchParams.get("after")) ?? 0) || 0;
    const page = rows.slice(offset, offset + limit);
    return HttpResponse.json({
      items: page,
      next_cursor: offset + limit < rows.length ? btoa(String(offset + limit)) : null,
    });
  }),

  http.get("/app/signals/summary", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const rows = filteredCrossJobRows(new URL(request.url));
    if (rows instanceof Response) return rows;
    const byMateriality = { high: 0, medium: 0, low: 0 };
    const bySignal = new Map<string, { title: string; count: number }>();
    for (const row of rows) {
      const level = (row.materiality ?? "").toLowerCase();
      if (level === "high" || level === "medium" || level === "low") byMateriality[level] += 1;
      if (row.signal) {
        const entry = bySignal.get(row.signal) ?? {
          title: row.signal_title ?? row.signal,
          count: 0,
        };
        entry.count += 1;
        bySignal.set(row.signal, entry);
      }
    }
    const top = [...bySignal.entries()].sort(
      (a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]),
    )[0];
    return HttpResponse.json({
      signals: rows.length,
      companies: new Set(rows.map((r) => r.company_key)).size,
      jobs: new Set(rows.map((r) => r.job_id)).size,
      by_materiality: byMateriality,
      top_signal: top ? { key: top[0], title: top[1].title, count: top[1].count } : null,
    });
  }),

  http.get("/app/signals/export.csv", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const rows = filteredCrossJobRows(new URL(request.url));
    if (rows instanceof Response) return rows;
    return new HttpResponse(signalRowsToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="signals.csv"',
      },
    });
  }),

  ...signalDetailHandlers,
];
