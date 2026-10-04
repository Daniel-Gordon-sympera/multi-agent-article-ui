/**
 * The drawer's detail reads: `/v1/companies/{key}` (profile across jobs), `/v1/articles/{id}`
 * (+ the saved text stream, `410` when expired) and `/v1/articles/{id}/summaries`
 * (+ `include=record`). Rows of every job are known here, not only the main job's.
 */
import { http, HttpResponse } from "msw";
import type { CrossJobSignalRow, SignalRow } from "@/api/types/signals";
import type { SummaryRow } from "@/api/types/summaries";
import { db } from "@/mocks/db";
import { addSeconds, minutesAgo } from "@/mocks/fixtures/clock";
import {
  EXPIRED_ARTICLE_IDS,
  articleTextFor,
  drawnMainIdea,
  summaryRecordFor,
  summaryRowFor,
} from "@/mocks/fixtures/signalDetails";
import { allSignalRows, signalJobId } from "@/mocks/fixtures/signals";
import { applyExactFilters, paginate, rejectUnknownFilters } from "@/mocks/lib/paging";
import { notFound, problem } from "@/mocks/lib/problem";
import { guard } from "@/mocks/lib/session";

/** A signal row with the job columns of `GET /app/signals` (contract §4.4). */
export function crossJobRow(row: SignalRow): CrossJobSignalRow {
  const jobId = signalJobId(row);
  const job = db.jobs.find((j) => j.id === jobId);
  return {
    ...row,
    job_id: jobId,
    county: job?.county ?? "Orange",
    state_code: job?.state_code ?? "FL",
    job_industry: typeof job?.input.industry === "string" ? job.input.industry : null,
    job_created_at: job?.created_at ?? row.date,
  };
}

export function everySignalRow(): SignalRow[] {
  return allSignalRows(db.signals);
}

function rowsOfArticle(articleId: string | readonly string[] | undefined): SignalRow[] {
  const id = Number(String(articleId));
  return everySignalRow().filter((row) => row.article_id === id);
}

function articleFromRows(rows: SignalRow[]) {
  const first = rows[0]!;
  const seen = addSeconds(minutesAgo(29), 600 + (first.article_id % 900));
  return {
    id: first.article_id,
    canonical_url: first.url,
    domain: first.source_domain,
    title: first.title,
    published_date: first.date,
    snapshot_id: 500_000 + first.article_id,
    text_sha: EXPIRED_ARTICLE_IDS.has(first.article_id) ? null : `sha-${first.article_id}`,
    html_sha: `html-${first.article_id}`,
    first_seen: seen,
    accepted_at: addSeconds(seen, 60),
  };
}

export const signalDetailHandlers = [
  http.get("/v1/companies/:companyKey", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const key = String(params.companyKey);
    const signals = everySignalRow().filter((row) => row.company_key === key);
    const fillerMentions = db.results.mentions.filter(
      (m) => m.company_key === key && !signals.some((s) => s.id === m.id),
    );
    const first = signals[0] ?? fillerMentions[0];
    if (!first) return notFound("Company");
    const url = new URL(request.url);
    const state = url.searchParams.get("state");
    const states = [...new Set([...signals, ...fillerMentions].map((s) => s.hq_state || "FL"))];
    if (!state && states.length > 1)
      return problem(409, "company_state_required", "The company key spans states", { states });
    const flag = db.results.flags.find((f) => f.company_key === key) ?? null;
    const mentions = [...signals, ...fillerMentions].map(crossJobRow);
    const articles = [
      ...new Map(
        mentions.map((s) => [
          s.article_id,
          {
            id: s.article_id,
            canonical_url: s.url,
            domain: s.source_domain,
            title: s.title,
            published_date: s.date,
            job_id: s.job_id,
          },
        ]),
      ).values(),
    ];
    return HttpResponse.json({
      id: first.company_id,
      company_key: key,
      state_code: state ?? first.hq_state ?? "FL",
      name: first.company,
      first_seen: [...mentions].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? first.date,
      last_seen: [...mentions].sort((a, b) => b.date.localeCompare(a.date))[0]?.date ?? first.date,
      flags: flag,
      mentions: { items: mentions, next_cursor: null },
      signals: { items: signals.map(crossJobRow), next_cursor: null },
      articles: { items: articles, next_cursor: null },
    });
  }),

  http.get("/v1/articles/:articleId", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const stored = db.results.articles.find((a) => String(a.id) === String(params.articleId));
    const rows = rowsOfArticle(params.articleId);
    if (!stored && rows.length === 0) return notFound("Article");
    const article = stored ?? articleFromRows(rows);
    const url = new URL(request.url);
    if (url.searchParams.get("include") === "text") {
      if (EXPIRED_ARTICLE_IDS.has(Number(article.id)))
        return problem(410, "artifact_expired", "The saved text of this article has expired");
      const text = rows.length
        ? articleTextFor(rows)
        : `${article.title}\n\nSaved article text (mock) for ${article.domain}.`;
      return new HttpResponse(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }
    return HttpResponse.json({
      ...article,
      text_expired: EXPIRED_ARTICLE_IDS.has(Number(article.id)),
    });
  }),

  http.get("/v1/articles/:articleId/summaries", ({ request, params }) => {
    const { error } = guard(request);
    if (error) return error;
    const url = new URL(request.url);
    const rejected = rejectUnknownFilters(url, ["include", "prompt_version"]);
    if (rejected) return rejected;
    const stored = db.results.summaries.filter(
      (s) => String(s.article_id) === String(params.articleId),
    );
    const rows = rowsOfArticle(params.articleId);
    let summaries: SummaryRow[] = stored.length
      ? stored.map((summary) => ({
          ...summary,
          main_idea: drawnMainIdea(summary.article_id) ?? summary.main_idea,
        }))
      : rows.length
        ? [summaryRowFor(rows, signalJobId(rows[0]!))]
        : [];
    if (url.searchParams.get("include") === "record") {
      summaries = summaries.map((summary) => ({
        ...summary,
        record: summaryRecordFor(rows.length ? rows : (db.signals.slice(0, 1) as SignalRow[])),
      }));
    }
    return HttpResponse.json(
      paginate(applyExactFilters(summaries, url, ["prompt_version"]), url, (r) => r.id),
    );
  }),
];
