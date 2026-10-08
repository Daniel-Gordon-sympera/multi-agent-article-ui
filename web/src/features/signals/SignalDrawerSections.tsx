import { formatArticleDate } from "@/lib/articleDate";
/**
 * Body sections of the signal drawer (mockup §3.9 items 2–4): the Article (title link, meta,
 * main idea, Open article / Saved text / Summary record), the Company profile grid with the
 * "Across jobs" box and the Job section (link, Scout/run, status pill).
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, ExternalLink, FileText } from "lucide-react";
import { useState } from "react";
import { lookupBatches } from "@/api/bff";
import { qk } from "@/api/keys";
import { getArticle, getJob } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { JobDetail } from "@/api/types/jobs";
import { Button } from "@/components/Button";
import { DrawerSection } from "@/components/Drawer";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { RelativeTime } from "@/components/RelativeTime";
import { Skeleton } from "@/components/Skeleton";
import { StatusPill } from "@/components/StatusPill";
import {
  CompanyProfileDialog,
  SavedTextDialog,
  SummaryRecordDialog,
} from "@/features/signals/SignalDrawerDialogs";
import {
  acrossJobsCounts,
  companyStateFor,
  formatAcrossJobs,
  type DrawerJobContext,
} from "@/features/signals/signalDrawerData";
import {
  companyStatesFromError,
  useArticleSummaries,
  useCompanyProfile,
} from "@/features/signals/useSignalsQueries";
import { formatLocation, shortId } from "@/lib/format";
import type { SignalTableRow } from "./signalColumns";

function MetaDot() {
  return <span aria-hidden> · </span>;
}

export function ArticleSection({ row }: { row: SignalTableRow }) {
  const [dialog, setDialog] = useState<"text" | "record" | null>(null);
  const summaries = useArticleSummaries(row.article_id);
  const article = useQuery({
    queryKey: qk.v1.articles.detail(row.article_id),
    queryFn: () => getArticle(row.article_id),
    ...pollingOptions("static"),
  });
  const accepted = article.data?.accepted_at;
  const mainIdea = summaries.data?.items[0]?.main_idea?.trim();
  return (
    <DrawerSection title="Article">
      <div className="flex flex-col gap-1.5">
        <a
          href={row.url ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] font-semibold text-ink hover:text-brand-700 hover:underline"
        >
          {row.title}
        </a>
        <p className="text-[12px] text-muted">
          {row.source_domain}
          <MetaDot />
          published {formatArticleDate(row.date, row.date_precision)}
          {accepted ? (
            <>
              <MetaDot />
              accepted <RelativeTime value={accepted} mode="smart" tooltip={false} />
            </>
          ) : null}
          <MetaDot />
          article #{row.article_id}
        </p>
        <p className="text-[13px] text-ink-2">
          <span className="font-semibold text-ink">Main idea: </span>
          {summaries.isPending ? (
            <span
              className="inline-block h-3.5 w-48 animate-pulse rounded-tag bg-border/70 align-middle"
              aria-hidden
            />
          ) : (
            mainIdea || "—"
          )}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="secondary" size="sm">
          <a href={row.url ?? undefined} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden />
            Open article
          </a>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setDialog("text")}>
          <FileText aria-hidden />
          Saved text
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setDialog("record")}>
          Summary record
        </Button>
      </div>
      <SavedTextDialog
        articleId={row.article_id}
        title={row.title ?? "Article"}
        open={dialog === "text"}
        onOpenChange={(open) => setDialog(open ? "text" : null)}
      />
      <SummaryRecordDialog
        articleId={row.article_id}
        title={row.title ?? "Article"}
        open={dialog === "record"}
        onOpenChange={(open) => setDialog(open ? "record" : null)}
      />
    </DrawerSection>
  );
}

function pair(main: string | null | undefined, basis: string | null | undefined): string {
  const left = (main ?? "").trim() || "—";
  const right = (basis ?? "").trim();
  return right ? `${left} · ${right}` : left;
}

export function CompanyProfileSection({
  row,
  job,
}: {
  row: SignalTableRow;
  job?: DrawerJobContext | null;
}) {
  const [selectedState, setState] = useState<string>();
  const state = selectedState ?? companyStateFor(row, job);
  const [profileOpen, setProfileOpen] = useState(false);
  const profile = useCompanyProfile(
    row.company_key ?? undefined,
    state,
    job?.id ?? row.job_id ?? undefined,
  );
  const states = profile.isError ? companyStatesFromError(profile.error) : null;
  const flagsVersion = profile.data?.flags?.enrichment_version;
  const version = flagsVersion && flagsVersion !== row.enrichment_source ? flagsVersion : undefined;
  const items = [
    { label: "Org kind", value: pair(row.org_kind, row.org_kind_basis) },
    { label: "HQ scope", value: pair(row.hq_scope, formatLocation(row.hq_county, row.hq_state)) },
    { label: "Entity flag", value: row.entity_flag || "—" },
    { label: "Industry", value: pair(row.company_industry, row.company_sub_industry) },
    { label: "Revenue bin", value: pair(row.revenue_bin, row.revenue_basis) },
    { label: "Enrichment", value: pair(row.enrichment_source, version), mono: true },
  ];
  return (
    <DrawerSection title="Company profile">
      <KeyValueGrid items={items} />
      <div
        className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-border px-3 py-2.5 text-[13px] text-ink-2"
        data-testid="across-jobs"
      >
        {!row.company_key ? (
          <span className="text-muted">Company profile unavailable</span>
        ) : profile.isPending ? (
          <Skeleton className="h-3.5 w-48" />
        ) : states ? (
          <label className="flex flex-wrap items-center gap-2">
            This company key spans states — pick one:
            <select
              className="h-7 rounded-control border border-border-strong bg-surface px-2 text-[12px]"
              value={state ?? ""}
              onChange={(event) => setState(event.target.value || undefined)}
              aria-label="Company state"
            >
              <option value="">Choose…</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : profile.isError ? (
          <span className="text-muted">Company profile unavailable</span>
        ) : profile.data ? (
          <>
            <span>
              Across jobs:{" "}
              <strong className="font-semibold text-ink">
                {formatAcrossJobs(acrossJobsCounts(profile.data))}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-brand-600 hover:text-brand-700 hover:underline"
            >
              Open profile
              <ChevronRight size={13} strokeWidth={2.25} aria-hidden />
            </button>
          </>
        ) : null}
      </div>
      {profile.data ? (
        <CompanyProfileDialog
          profile={profile.data}
          open={profileOpen}
          onOpenChange={setProfileOpen}
        />
      ) : null}
    </DrawerSection>
  );
}

export function JobSection({ jobId, title }: { jobId: string; title: string }) {
  const job = useQuery<JobDetail>({
    queryKey: qk.v1.jobs.detail(jobId),
    queryFn: () => getJob(jobId),
    ...pollingOptions("calm"),
  });
  const batches = useQuery({
    queryKey: qk.app.batches([jobId]),
    queryFn: () => lookupBatches([jobId]),
    ...pollingOptions("static"),
  });
  const membership = batches.data?.batches[jobId];
  return (
    <DrawerSection title="Job">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            to="/jobs/$jobId"
            params={{ jobId }}
            className="truncate text-[14px] font-semibold text-ink hover:text-brand-700 hover:underline"
          >
            {title}
          </Link>
          <p className="text-[12px] text-muted">
            <span className="font-mono">{shortId(jobId)}</span>
            {membership?.scout_name ? (
              <>
                <MetaDot />
                Scout: {membership.scout_name}
                {membership.run_number ? <> · run {membership.run_number}</> : null}
              </>
            ) : null}
          </p>
        </div>
        {job.data ? <StatusPill entity="job" status={job.data.status} /> : null}
      </div>
    </DrawerSection>
  );
}
