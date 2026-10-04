/**
 * SignalDrawer — mockup §3.9: header (company + org tag; signal + materiality + "County, ST ·
 * Industry · date"), Evidence (verbatim blockquote, checks, role, confidence meter), Article,
 * Company profile, Job; footer Copy link · Export row · Previous/Next within the loaded rows.
 * URL-bound through `?detail=<mention id>`; Escape, scrim and focus trap come from `Drawer`.
 */
import { useNavigate } from "@tanstack/react-router";
import { Download, Link2 } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Button } from "@/components/Button";
import { copyToClipboard } from "@/components/CopyButton";
import { Drawer, DrawerSection } from "@/components/Drawer";
import { EmptyState } from "@/components/EmptyState";
import { EvidenceQuote } from "@/components/EvidenceQuote";
import { MaterialityPill } from "@/components/MaterialityPill";
import { Meter } from "@/components/Meter";
import { Skeleton } from "@/components/Skeleton";
import { Tag } from "@/components/Tag";
import { toast } from "@/components/ui/sonner";
import {
  ArticleSection,
  CompanyProfileSection,
  JobSection,
} from "@/features/signals/SignalDrawerSections";
import { signalTitle } from "@/features/signals/signalCatalog";
import {
  confidenceLabel,
  drawerLocationLine,
  evidenceChecks,
  type DrawerJobContext,
} from "@/features/signals/signalDrawerData";
import { signalRowFilename, signalRowsToCsv } from "@/features/signals/signalExport";
import { downloadText } from "@/lib/csv";
import { formatLocation, formatShortDate, formatScore } from "@/lib/format";
import { detailParam, signalEvidence, type SignalTableRow } from "./signalColumns";

export interface SignalDrawerProps {
  /** The loaded rows: the drawer finds its row here and steps through them. */
  rows: readonly SignalTableRow[];
  /** `?detail=` of the URL; the drawer is open while it is set. */
  detailId: string | number | undefined;
  /** Rows still loading (deep link before the first page arrived). */
  loading?: boolean;
  /** On the job tab: the job the rows belong to (the rows carry no job columns there). */
  job?: (DrawerJobContext & { id: string }) | null;
}

type AnySearch = Record<string, unknown>;

export function SignalDrawer({ rows, detailId, loading = false, job }: SignalDrawerProps) {
  const navigate = useNavigate();
  const index = useMemo(
    () => (detailId === undefined ? -1 : rows.findIndex((r) => String(r.id) === String(detailId))),
    [detailId, rows],
  );
  const row = index >= 0 ? rows[index] : undefined;

  const goTo = useCallback(
    (target: SignalTableRow | undefined) => {
      if (!target) return;
      void navigate({
        to: ".",
        search: (previous: AnySearch) => ({ ...previous, detail: detailParam(target.id) }),
        replace: true,
      } as never);
    },
    [navigate],
  );
  const previous = index > 0 ? rows[index - 1] : undefined;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : undefined;

  const jobContext: DrawerJobContext | null = job
    ? job
    : row
      ? { county: row.county, stateCode: row.state_code, industry: row.job_industry }
      : null;
  const jobId = job?.id ?? row?.job_id;
  const jobTitle = jobContext
    ? [formatLocation(jobContext.county, jobContext.stateCode), jobContext.industry]
        .filter((part) => part && part !== "—")
        .join(" · ")
    : "";

  const copyLink = async () => {
    const ok = await copyToClipboard(window.location.href);
    if (ok) toast.success("Link copied");
    else toast.error("Could not copy the link");
  };
  const exportRow = () => {
    if (!row) return;
    downloadText(signalRowFilename(row), signalRowsToCsv([row]));
  };

  return (
    <Drawer
      searchKey="detail"
      ariaLabel="Signal details"
      title={row ? row.company : loading ? "Loading signal…" : "Signal not loaded"}
      titleAside={row?.org_kind ? <Tag>{row.org_kind}</Tag> : undefined}
      subtitle={
        row ? (
          <>
            <span className="font-semibold">
              {row.signal_title?.trim() || signalTitle(row.signal)}
            </span>
            <MaterialityPill materiality={row.materiality} />
            <span className="text-[12px] text-muted">
              {drawerLocationLine(row, job)} · {formatShortDate(row.date)}
            </span>
          </>
        ) : undefined
      }
      footer={
        row ? (
          <>
            <Button variant="secondary" size="sm" onClick={() => void copyLink()}>
              <Link2 aria-hidden />
              Copy link
            </Button>
            <Button variant="secondary" size="sm" onClick={exportRow}>
              <Download aria-hidden />
              Export row
            </Button>
          </>
        ) : undefined
      }
      onPrevious={previous ? () => goTo(previous) : undefined}
      onNext={next ? () => goTo(next) : undefined}
    >
      {row ? (
        <>
          <DrawerSection title="Evidence">
            <EvidenceQuote
              quote={signalEvidence(row)}
              cite={row.url}
              meta={[`quote #${row.signal_quote_id ?? row.quote_id}`]}
              checks={evidenceChecks(row.checks)}
            />
            <p className="-mt-1 text-[12px] text-muted">role: {row.role || "—"}</p>
            <div className="flex items-center gap-3 text-[13px] text-ink-2">
              <span>Confidence</span>
              <Meter
                value={Number(row.confidence_score)}
                width={140}
                ariaLabel={`Confidence ${formatScore(row.confidence_score)}`}
                label={confidenceLabel(row)}
              />
            </div>
          </DrawerSection>
          <ArticleSection key={`article-${row.id}`} row={row} />
          <CompanyProfileSection key={`company-${row.id}`} row={row} job={jobContext} />
          {jobId ? <JobSection key={`job-${row.id}`} jobId={jobId} title={jobTitle} /> : null}
        </>
      ) : loading ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : (
        <EmptyState
          variant="plain"
          title="This signal is not in the loaded rows"
          description="It may belong to another page or be excluded by the current filters. Close the drawer, adjust the filters or page, and open it again."
        />
      )}
    </Drawer>
  );
}
