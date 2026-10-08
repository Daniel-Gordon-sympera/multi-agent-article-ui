/**
 * Detail payloads behind the signal drawer: saved article text samples, summary records
 * (`?include=record`) and the "main idea" of an article, all derived from the signal rows so
 * every job's signals open a complete drawer in mock mode.
 */
import type { SignalRow } from "@/api/types/signals";
import type { SummaryRow } from "@/api/types/summaries";
import { addSeconds, minutesAgo } from "./clock";
import { PROMPT_VERSION } from "./jobIds";

/** Articles whose saved text has been purged by the artifact retention (`410`). */
export const EXPIRED_ARTICLE_IDS: ReadonlySet<number> = new Set([71352, 71351]);

/** The drawer's "Main idea" line (mockup §3.9) for the Lakeview article; others derive. */
const MAIN_IDEAS: Record<number, string> = {
  71334:
    "Orange County commissioners approved the final site plan for a 310,000 sq ft logistics center on Kirkman Road; construction starts in November.",
  71341:
    "Central Florida Concrete's third batching plant in Apopka is expected to add 40 jobs when it opens in the spring.",
  71345:
    "Osceola Steel Fabricators is recruiting welders and fitters as structural steel orders from theme-park expansions pile up.",
};

/** The hand-written main idea of an article when the mockup draws one (drawer parity). */
export function drawnMainIdea(articleId: number): string | undefined {
  return MAIN_IDEAS[articleId];
}

export function mainIdeaFor(row: SignalRow): string {
  return (
    MAIN_IDEAS[row.article_id] ??
    `${row.title}: ${row.evidence.replace(/\.$/, "")}; the article covers the ${(row.company_industry ?? "unknown").toLowerCase()} sector in the ${row.scope_place} area.`
  );
}

/** A few plausible paragraphs around the verbatim evidence, as the pipeline would have saved. */
export function articleTextFor(rows: SignalRow[]): string {
  const first = rows[0]!;
  const quotes = rows.map((row) => row.evidence);
  const paragraphs = [
    (first.title ?? "Article").toUpperCase(),
    `${first.scope_place} — ${first.evidence}`,
    ...quotes.slice(1),
    `The announcement follows a year of steady activity in the ${(first.company_industry ?? "unknown").toLowerCase()} sector across ${first.hq_state}, local officials said, with permits and hiring both ahead of last year.`,
    `Company representatives said more details would be shared at a community meeting next month. "We are committed to this area," a spokesperson said.`,
    `This article was saved by the pipeline from ${first.source_domain} on ${first.date}.`,
  ];
  return paragraphs.join("\n\n");
}

/** The analysis record the `summaries` row carries with `?include=record`. */
export function summaryRecordFor(rows: SignalRow[]): Record<string, unknown> {
  const first = rows[0]!;
  return {
    prompt_version: PROMPT_VERSION,
    model: "deepseek-v4-pro",
    main_idea: mainIdeaFor(first),
    snippet: first.title,
    industry: first.company_industry,
    sub_industry: first.company_sub_industry,
    focus_topics: [
      (first.company_industry ?? "unknown").toLowerCase(),
      (first.scope_place ?? "unknown").toLowerCase(),
    ],
    quotes: rows.map((row) => ({ id: row.quote_id, text: row.evidence, verbatim: true })),
    companies: rows.map((row) => ({
      number_company: row.number_company,
      name_as_written: row.name_as_written,
      entity_type: row.entity_type,
      role: row.role,
      quote_id: row.quote_id,
      confidence_score: Number(row.confidence_score),
      confidence_level: row.confidence_level,
      checks: [...row.checks],
      signal: row.signal,
      signal_title: row.signal_title,
      materiality: row.materiality,
      connection: row.connection,
    })),
    sponsored: false,
    is_list_page: false,
    warnings: [],
  };
}

/** A `SummaryRow` for an article that only exists as signal rows (other jobs). */
export function summaryRowFor(rows: SignalRow[], jobId: string): SummaryRow {
  const first = rows[0]!;
  const created = addSeconds(minutesAgo(29), 600 + (first.article_id % 900));
  return {
    id: first.summary_id,
    article_id: first.article_id,
    prompt_version: PROMPT_VERSION,
    model: "deepseek-v4-pro",
    first_job_id: jobId,
    task_id: 48_000 + (first.summary_id % 1000),
    main_idea: mainIdeaFor(first),
    snippet: first.title,
    focus_topics: [(first.company_industry ?? "unknown").toLowerCase()],
    industry: first.company_industry,
    sub_industry: first.company_sub_industry,
    article_signal: first.signal,
    article_materiality: first.materiality,
    kept_count: rows.length,
    sponsored: false,
    is_list_page: false,
    warnings: [],
    input_tokens: 7_900 + (first.article_id % 500),
    output_tokens: 1_050 + (first.article_id % 90),
    created_at: created,
    url: first.url,
    title: first.title,
    date: first.date,
    source_domain: first.source_domain,
    article_key: first.article_key,
  };
}
