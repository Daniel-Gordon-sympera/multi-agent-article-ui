/**
 * Per-job signals/companies/flags, the company profile and the cross-job read of `/app/signals`
 * (degraded mode, like today's BFF: merged from the recent jobs, offset cursor).
 */
import { http, HttpResponse } from "msw";
import type { CrossJobSignalRow } from "@/api/types/signals";
import { db } from "@/mocks/db";
import { MAIN_JOB_ID } from "@/mocks/fixtures/jobs";
import { signalJobId } from "@/mocks/fixtures/signals";
import { applyExactFilters, paginate, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";
import { findJob } from "./jobs";

function mainJobSignals() {
  return db.signals.filter((s) => signalJobId(s) === MAIN_JOB_ID);
}

function crossJobRows(): CrossJobSignalRow[] {
  return db.signals.map((s) => {
    const jobId = signalJobId(s);
    const job = db.jobs.find((j) => j.id === jobId);
    return {
      ...s,
      job_id: jobId,
      county: job?.county ?? "Orange",
      state_code: job?.state_code ?? "FL",
      job_industry: typeof job?.input.industry === "string" ? job.input.industry : null,
      job_created_at: job?.created_at ?? s.date,
    };
  });
}

export const signalHandlers = [
  http.get("/v1/jobs/:jobId/signals", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const job = findJob(params.jobId);
    if (!job) return notFound("Job");
    const url = new URL(request.url);
    const filters = ["signal", "materiality", "company_key", "hq_scope", "org_kind"];
    const rejected = rejectUnknownFilters(url, filters);
    if (rejected) return rejected;
    const rows = job.id === MAIN_JOB_ID ? mainJobSignals() : [];
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
      rows = rows.filter((r) => r.company_industry.toLowerCase() === industry.toLowerCase());
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
      paginate(applyExactFilters(rows, url, filters), url, (r) => r.company_id),
    );
  }),

  http.get("/v1/companies/:companyKey", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const key = String(params.companyKey);
    const mentions = db.results.mentions.filter((m) => m.company_key === key);
    const first = mentions[0] ?? db.signals.find((s) => s.company_key === key);
    if (!first) return notFound("Company");
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const states = [
      ...new Set(db.signals.filter((s) => s.company_key === key).map((s) => s.hq_state || "FL")),
    ];
    if (!state && states.length > 1)
      return problem(409, "company_state_required", "The company key spans states", { states });
    const flag = db.results.flags.find((f) => f.company_key === key) ?? null;
    const signals = db.signals.filter((s) => s.company_key === key);
    return HttpResponse.json({
      id: first.company_id,
      company_key: key,
      state_code: state ?? first.hq_state ?? "FL",
      name: first.company,
      first_seen: first.date,
      last_seen: first.date,
      flags: flag,
      mentions: { items: mentions.length ? mentions : signals, next_cursor: null },
      signals: { items: signals, next_cursor: null },
      articles: {
        items: [
          ...new Map(
            signals.map((s) => [
              s.article_id,
              {
                id: s.article_id,
                canonical_url: s.url,
                domain: s.source_domain,
                title: s.title,
                published_date: s.date,
              },
            ]),
          ).values(),
        ],
        next_cursor: null,
      },
    });
  }),

  http.get("/v1/articles/:articleId", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const article = db.results.articles.find((a) => String(a.id) === String(params.articleId));
    if (!article) return notFound("Article");
    const url = new URL(request.url);
    if (url.searchParams.get("include") === "text") {
      if (article.id === 71352)
        return problem(410, "artifact_expired", "The saved text has expired");
      return new HttpResponse(`${article.title}\n\nSaved article text (mock).`, {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    return HttpResponse.json(article);
  }),

  http.get("/v1/articles/:articleId/summaries", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["include", "prompt_version"]);
    if (rejected) return rejected;
    const rows = db.results.summaries.filter(
      (s) => String(s.article_id) === String(params.articleId),
    );
    return HttpResponse.json(
      paginate(applyExactFilters(rows, url, ["prompt_version"]), url, (r) => r.id),
    );
  }),

  http.get("/app/signals", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    let rows = crossJobRows();
    const exact: Array<[string, (r: CrossJobSignalRow) => string]> = [
      ["signal", (r) => r.signal ?? ""],
      ["materiality", (r) => r.materiality ?? ""],
      ["company_key", (r) => r.company_key],
      ["hq_scope", (r) => r.hq_scope],
      ["org_kind", (r) => r.org_kind],
      ["industry", (r) => r.company_industry],
      ["job_industry", (r) => r.job_industry ?? ""],
      ["state", (r) => r.state_code],
      ["county", (r) => r.county],
      ["revenue_bin", (r) => r.revenue_bin],
      ["job_id", (r) => r.job_id],
    ];
    for (const [key, pick] of exact) {
      const value = url.searchParams.get(key);
      if (value) rows = rows.filter((r) => pick(r).toLowerCase() === value.toLowerCase());
    }
    const dateAfter = url.searchParams.get("date_after");
    if (dateAfter) rows = rows.filter((r) => r.date >= dateAfter);
    const dateBefore = url.searchParams.get("date_before");
    if (dateBefore) rows = rows.filter((r) => r.date <= dateBefore);
    const q = url.searchParams.get("q")?.toLowerCase();
    if (q)
      rows = rows.filter((r) =>
        [r.company, r.evidence, r.signal ?? "", r.source_domain].some((v) =>
          v.toLowerCase().includes(q),
        ),
      );
    rows.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const limit = Math.min(200, Number(url.searchParams.get("limit") ?? 50) || 50);
    const offset = Number(atobSafe(url.searchParams.get("after")) ?? 0) || 0;
    const page = rows.slice(offset, offset + limit);
    return HttpResponse.json({
      items: page,
      next_cursor: offset + limit < rows.length ? btoa(String(offset + limit)) : null,
      degraded: true,
      scanned_jobs: Math.min(20, db.jobs.length),
      truncated: false,
    });
  }),

  http.get("/app/signals/export.csv", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const rows = crossJobRows();
    const header =
      "id,company,signal,materiality,date,source_domain,job_id,county,state,job_industry";
    const body = rows.map((r) =>
      [
        r.id,
        r.company,
        r.signal,
        r.materiality,
        r.date,
        r.source_domain,
        r.job_id,
        r.county,
        r.state_code,
        r.job_industry,
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(","),
    );
    return new HttpResponse([header, ...body].join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="signals.csv"',
      },
    });
  }),
];

function atobSafe(value: string | null): string | null {
  if (!value) return null;
  try {
    return atob(value);
  } catch {
    return null;
  }
}
