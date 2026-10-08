/**
 * Derived result rows of the main job: articles, summaries, company mentions (139 companies) and
 * flags — generated from the signal fixtures so the counts match the progress counters
 * (40 articles · 31 summaries · 139 companies · 24 signals). Sections, finder rows and events
 * live in `resultsOps.ts`.
 */
import type { ArticleRow } from "@/api/types/articles";
import type { FlagRow } from "@/api/types/companies";
import type { CompanyMentionRow, SignalRow } from "@/api/types/signals";
import type { SiteRun } from "@/api/types/siteRuns";
import type { SummaryRow } from "@/api/types/summaries";
import { addSeconds, dateDaysAgo, minutesAgo } from "./clock";
import { MAIN_JOB_ID, PROMPT_VERSION } from "./jobs";

const jobStart = minutesAgo(29);

export function buildArticles(signals: SignalRow[], siteRuns: SiteRun[]): ArticleRow[] {
  const byId = new Map<number, ArticleRow>();
  const runFor = (domain: string) => siteRuns.find((r) => r.domain === domain) ?? siteRuns[0]!;
  for (const s of signals) {
    if (byId.has(s.article_id)) continue;
    const run = runFor(s.source_domain ?? "");
    byId.set(s.article_id, {
      id: s.article_id,
      canonical_url: s.url ?? "",
      domain: s.source_domain ?? "",
      title: s.title ?? "Article",
      published_date: s.date ?? "",
      access_profile: "public",
      date_precision: "day",
      date_source: "page",
      date_policy_version: "1",
      snapshot_id: 500_000 + s.article_id,
      text_sha: `sha-${s.article_id}`,
      html_sha: `html-${s.article_id}`,
      first_seen: addSeconds(jobStart, 600 + (s.article_id % 900)),
      site_run_id: run.id,
      article_key: s.article_key,
      link_key: `lnk_${s.article_id}`,
      origin: "fetched",
      accepted_at: addSeconds(jobStart, 660 + (s.article_id % 900)),
    });
  }
  const titles = [
    "County approves new industrial park phase",
    "Developer files plans for mixed-use project",
    "Local contractor lands school expansion",
    "Permits jump for warehouse construction",
    "Road widening project enters bidding",
    "New hospital wing tops out",
    "Aerospace supplier adds production line",
    "Downtown garage replacement approved",
  ];
  let id = 71380;
  while (byId.size < 40) {
    const run = siteRuns[id % siteRuns.length]!;
    const title = `${titles[id % titles.length]} (${id})`;
    byId.set(id, {
      id,
      canonical_url: `https://${run.domain}/story/${id}`,
      domain: run.domain,
      title,
      published_date: dateDaysAgo(1 + (id % 14)),
      access_profile: "public",
      date_precision: "day",
      date_source: "page",
      date_policy_version: "1",
      snapshot_id: 500_000 + id,
      text_sha: `sha-${id}`,
      html_sha: `html-${id}`,
      first_seen: addSeconds(jobStart, 700 + (id % 800)),
      site_run_id: run.id,
      article_key: `art_${id}`,
      link_key: `lnk_${id}`,
      origin: id % 7 === 0 ? "memory" : "fetched",
      accepted_at: addSeconds(jobStart, 760 + (id % 800)),
    });
    id += 1;
  }
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export function buildSummaries(articles: ArticleRow[], signals: SignalRow[]): SummaryRow[] {
  return articles.slice(0, 31).map((a, i) => {
    const signal = signals.find((s) => s.article_id === a.id);
    return {
      id: 5000 + i,
      article_id: a.id,
      prompt_version: PROMPT_VERSION,
      model: "deepseek-v4-pro",
      first_job_id: MAIN_JOB_ID,
      task_id: 48902 + i,
      main_idea: signal
        ? `${signal.company}: ${signal.evidence}`
        : `${a.title} — the article reports on local construction activity in Orange County.`,
      snippet: a.title,
      focus_topics: ["construction", "orange county"],
      industry: signal?.company_industry ?? "Construction",
      sub_industry: signal?.company_sub_industry ?? "Nonresidential building",
      article_signal: signal?.signal ?? null,
      article_materiality: signal?.materiality ?? null,
      kept_count: signal ? 3 : 2,
      sponsored: false,
      is_list_page: false,
      warnings: [],
      input_tokens: 8_200 + i * 37,
      output_tokens: 1_100 + i * 9,
      created_at: a.accepted_at,
      url: a.canonical_url,
      title: a.title,
      date: a.published_date,
      source_domain: a.domain,
      article_key: a.article_key,
    };
  });
}

const FILLER_COMPANIES = [
  "Metro Orlando Chamber",
  "Orange County Public Schools",
  "Valencia College",
  "Universal Orlando",
  "Lockheed Martin",
  "Siemens Energy",
  "Tavistock Development",
  "Unicorp National Developments",
  "Brasfield & Gorrie",
  "Balfour Beatty",
  "Hensel Phelps",
  "PCL Construction",
  "Darden Restaurants",
  "AdventHealth",
  "Orlando Health",
  "Tupperware Brands",
  "Greater Orlando Aviation Authority",
  "LYNX",
  "OUC",
  "Duke Energy Florida",
];

export function buildCompanyMentions(
  signals: SignalRow[],
  summaries: SummaryRow[],
): CompanyMentionRow[] {
  const rows: CompanyMentionRow[] = [...signals];
  let id = 9500;
  let companyId = 3500;
  while (rows.length < 139) {
    const summary = summaries[id % summaries.length]!;
    const name = `${FILLER_COMPANIES[id % FILLER_COMPANIES.length]}${id % 40 >= FILLER_COMPANIES.length ? ` ${Math.floor(id / 40)}` : ""}`;
    rows.push({
      ...signals[0]!,
      id,
      summary_id: summary.id,
      article_id: summary.article_id,
      company_id: companyId,
      number_company: 2,
      name_as_written: name,
      entity_type: "company",
      role: "mentioned",
      quote_id: 1,
      evidence: `${name} is mentioned in passing.`,
      confidence_score: 0.72,
      confidence_level: "medium",
      checks: ["name_grounded"],
      signal: null,
      signal_title: null,
      materiality: null,
      connection: null,
      signal_quote_id: null,
      signal_evidence: null,
      url: summary.url,
      title: summary.title,
      date: summary.date,
      source_domain: summary.source_domain,
      article_key: summary.article_key,
      company_key: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      company: name,
      confidence: "medium",
      org_kind: id % 9 === 0 ? "gov" : id % 11 === 0 ? "nonprofit" : "business",
      hq_scope: id % 5 === 0 ? "national" : id % 3 === 0 ? "state" : "local",
      entity_flag: id % 5 === 0 ? "nationwide" : id % 3 === 0 ? "state" : "local",
      hq_county: id % 5 === 0 ? "" : "Orange",
      hq_state: id % 5 === 0 ? "" : "FL",
      scope_place: id % 5 === 0 ? "" : "Orlando",
      company_industry:
        id % 4 === 0
          ? "Construction"
          : id % 4 === 1
            ? "Real Estate"
            : id % 4 === 2
              ? "Manufacturing"
              : "unknown",
      company_sub_industry: id % 4 === 3 ? "unknown" : "General",
      revenue_bin:
        id % 6 === 0
          ? "unknown"
          : id % 6 === 1
            ? "$1M-$10M"
            : id % 6 === 2
              ? "$10M-$20M"
              : id % 6 === 3
                ? ">$500M"
                : "$50M-$100M",
      revenue_basis: id % 6 === 0 ? "none" : "size cue",
      revenue_confidence: id % 6 === 0 ? 0 : 0.6,
    });
    id += 1;
    companyId += 1;
  }
  return rows;
}

export function buildFlags(mentions: CompanyMentionRow[]): FlagRow[] {
  const seen = new Map<number, FlagRow>();
  for (const m of mentions) {
    if (seen.has(m.company_id)) continue;
    seen.set(m.company_id, {
      job_id: MAIN_JOB_ID,
      company_id: m.company_id,
      state_code: "FL",
      enrichment_version: "rules_v1",
      authoritative: false,
      org_kind: m.org_kind,
      org_kind_basis: m.org_kind_basis,
      hq_county: m.hq_county,
      hq_state: m.hq_state,
      scope_place: m.scope_place,
      scope_basis: m.scope_basis,
      company_industry: m.company_industry,
      company_sub_industry: m.company_sub_industry,
      industry_basis: m.industry_basis,
      revenue_bin: m.revenue_bin,
      revenue_basis: m.revenue_basis,
      revenue_confidence: m.revenue_confidence,
      enrichment_source: m.enrichment_source,
      place_hints: m.scope_place ? [{ place: m.scope_place }] : [],
      size_cues: [],
      warnings: [],
      evidence_articles: 1,
      known_count: 3,
      updated_at: addSeconds(jobStart, 1500),
      hq_scope: m.hq_scope,
      entity_flag: m.entity_flag,
      company_name: m.company,
      company_key: m.company_key,
      articles: 1,
    });
  }
  return [...seen.values()];
}

export { buildEvents, buildFinderSources, buildRanking, buildSections } from "./resultsOps";
