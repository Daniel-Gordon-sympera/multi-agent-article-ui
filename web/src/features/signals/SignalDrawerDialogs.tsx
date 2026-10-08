/**
 * Dialogs opened from the signal drawer (mockup §3.9): the saved article text (streamed from
 * `/v1/articles/{id}?include=text`, `410` → "expired"), the analysis record
 * (`/v1/articles/{id}/summaries?include=record`) and the company profile across jobs.
 */
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { CompanyProfile, CompanyProfileMention } from "@/api/types/companies";
import { ErrorState } from "@/components/ErrorState";
import { MaterialityPill } from "@/components/MaterialityPill";
import { NoteBanner } from "@/components/NoteBanner";
import { Skeleton } from "@/components/Skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { streamArticleText } from "@/features/signals/articleText";
import { signalTitle } from "@/features/signals/signalCatalog";
import { useArticleSummaryRecord } from "@/features/signals/useSignalsQueries";
import { shortId } from "@/lib/format";
import { formatArticleDate } from "@/lib/articleDate";

interface ArticleDialogProps {
  articleId: number;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type StreamState =
  | { status: "loading"; text: string }
  | { status: "done"; text: string }
  | { status: "expired" }
  | { status: "error"; message: string };

/** Mounted only while the dialog is open, so every opening starts a fresh stream. */
function SavedTextBody({ articleId }: { articleId: number }) {
  const [state, setState] = useState<StreamState>({ status: "loading", text: "" });

  useEffect(() => {
    const controller = new AbortController();
    let text = "";
    streamArticleText(
      articleId,
      (chunk) => {
        text += chunk;
        setState({ status: "loading", text });
      },
      controller.signal,
    )
      .then((outcome) =>
        setState(outcome === "expired" ? { status: "expired" } : { status: "done", text }),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "The saved text could not be loaded.",
        });
      });
    return () => controller.abort();
  }, [articleId]);

  if (state.status === "expired") {
    return (
      <NoteBanner tone="warn">
        The saved text of this article has expired (410): the artifact retention removed it. Open
        the original article instead.
      </NoteBanner>
    );
  }
  if (state.status === "error") {
    return <ErrorState variant="banner" description={state.message} title="Could not load" />;
  }
  return (
    <pre
      className="max-h-[60vh] overflow-auto rounded-banner border border-border bg-surface-2 p-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-ink"
      aria-busy={state.status === "loading" || undefined}
    >
      {state.text || (state.status === "loading" ? "Loading saved text…" : "(empty)")}
    </pre>
  );
}

export function SavedTextDialog({ articleId, title, open, onOpenChange }: ArticleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Saved text</DialogTitle>
          <DialogDescription>
            {title} · article #{articleId}
          </DialogDescription>
        </DialogHeader>
        {open ? <SavedTextBody articleId={articleId} /> : null}
      </DialogContent>
    </Dialog>
  );
}

export function SummaryRecordDialog({ articleId, title, open, onOpenChange }: ArticleDialogProps) {
  const query = useArticleSummaryRecord(articleId, open);
  const first = query.data?.items[0];
  const record = first?.record ?? first;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[720px]">
        <DialogHeader>
          <DialogTitle>Summary record</DialogTitle>
          <DialogDescription>
            {title} · the analysis record saved with the summary
            {first?.prompt_version ? ` · prompt ${first.prompt_version}` : ""}
          </DialogDescription>
        </DialogHeader>
        {query.isPending ? (
          <div className="flex flex-col gap-2" aria-busy="true">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : query.isError ? (
          <ErrorState variant="banner" error={query.error} onRetry={() => void query.refetch()} />
        ) : !record ? (
          <p className="text-[13px] text-muted">No summary has been saved for this article yet.</p>
        ) : (
          <pre className="max-h-[60vh] overflow-auto rounded-banner border border-border bg-surface-2 p-4 font-mono text-[12px] leading-relaxed text-ink">
            {JSON.stringify(record, null, 2)}
          </pre>
        )}
      </DialogContent>
    </Dialog>
  );
}

export interface CompanyProfileDialogProps {
  profile: CompanyProfile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function jobIdOf(row: CompanyProfileMention): string | null {
  const value = (row as unknown as Record<string, unknown>).job_id;
  return typeof value === "string" ? value : null;
}

/** "Open profile": every signal of the company across jobs, newest first. */
export function CompanyProfileDialog({ profile, open, onOpenChange }: CompanyProfileDialogProps) {
  const signals = [...(profile.signals?.items ?? [])].sort(
    (a, b) => (b.published_date ?? "").localeCompare(a.published_date ?? "") || b.id - a.id,
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{profile.name}</DialogTitle>
          <DialogDescription>
            {profile.company_key} · {profile.state_code} · {signals.length} signal
            {signals.length === 1 ? "" : "s"} across jobs
            {profile.signals?.next_cursor ? " (first page)" : ""}
          </DialogDescription>
        </DialogHeader>
        {signals.length === 0 ? (
          <p className="text-[13px] text-muted">No signals recorded for this company yet.</p>
        ) : (
          <ul
            className="max-h-[60vh] divide-y divide-border overflow-auto"
            aria-label="Company signals"
          >
            {signals.map((row) => {
              const jobId = jobIdOf(row);
              return (
                <li key={row.id} className="flex flex-col gap-1 py-2.5">
                  <div className="flex flex-wrap items-center gap-2 text-[13px]">
                    <span className="font-semibold text-ink">
                      {row.signal_title?.trim() || signalTitle(row.signal)}
                    </span>
                    <MaterialityPill materiality={row.materiality} />
                    <span className="text-[12px] text-muted">
                      {formatArticleDate(row.published_date, row.date_precision)}
                    </span>
                    {jobId ? (
                      <Link
                        to="/jobs/$jobId"
                        params={{ jobId }}
                        className="text-[12px] font-medium text-brand-600 hover:underline"
                      >
                        job {shortId(jobId)}
                      </Link>
                    ) : null}
                  </div>
                  <p className="truncate text-[12px] text-ink-2" title={row.evidence ?? undefined}>
                    “{(row.signal_evidence ?? "").trim() || row.evidence}”
                  </p>
                  <p className="truncate text-[11px] text-muted" title={row.title ?? undefined}>
                    {row.title}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
