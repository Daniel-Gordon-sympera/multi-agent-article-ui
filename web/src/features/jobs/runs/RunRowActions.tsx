/**
 * Row actions of the Runs table (mockup §3.2 col 9): Running/Queued → `[▢ Cancel]`
 * (danger-secondary + ConfirmDialog, §6.13), Partial → `[↺ Resume]` tonal (resume options
 * dialog), Completed/Failed/Cancelled → `[▶ Re-run]` (→ `/jobs/new?from=`), always the `⋯`
 * menu: Open · Copy id · Open tasks · Export CSV ▸ (one item per table).
 */
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Download,
  Ellipsis,
  ExternalLink,
  Link2,
  ListTree,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { useState } from "react";
import type { JobRecord } from "@/api/types/jobs";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { copyToClipboard } from "@/components/CopyButton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { jobTitle } from "@/features/jobs/jobTitle";
import { ResumeDialog } from "@/features/jobs/ResumeDialog";
import { useJobMutations } from "@/features/jobs/useJobMutations";
import { JOB_EXPORT_TABLES, JOB_EXPORT_TABLE_LABELS, jobExportUrl } from "@/lib/csv";
import { shortId } from "@/lib/format";
import { isCancellableJobStatus, isResumableJobStatus } from "@/lib/status";

export function RunRowActions({ job }: { job: JobRecord }) {
  const { can } = useSession();
  const navigate = useNavigate();
  const { cancel, resume } = useJobMutations(job.id);
  const [dialog, setDialog] = useState<"cancel" | "resume" | null>(null);
  const operate = can("operate");
  const short = shortId(job.id);
  const title = jobTitle(job);
  const cancellable = isCancellableJobStatus(job.status);
  const resumable = isResumableJobStatus(job.status);

  const copy = (text: string, done: string) =>
    void copyToClipboard(text).then((ok) =>
      ok ? toast.success(done) : toast.error("Could not copy to the clipboard"),
    );

  return (
    <div className="flex items-center justify-end gap-1">
      {operate && cancellable ? (
        <Button
          variant="danger"
          size="sm"
          aria-label={`Cancel job ${short}`}
          onClick={() => setDialog("cancel")}
          loading={cancel.isPending}
        >
          <Square aria-hidden />
          Cancel
        </Button>
      ) : null}
      {operate && job.status === "partial" ? (
        <Button
          variant="tonal"
          size="sm"
          aria-label={`Resume job ${short}`}
          onClick={() => setDialog("resume")}
          loading={resume.isPending}
        >
          <RotateCcw aria-hidden />
          Resume
        </Button>
      ) : null}
      {operate && !cancellable && job.status !== "partial" ? (
        <Button asChild variant="secondary" size="sm">
          <Link to="/jobs/new" search={{ from: job.id }} aria-label={`Run job ${short} again`}>
            <Play aria-hidden />
            Re-run
          </Link>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label={`More actions for job ${short}`}>
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            onSelect={() => void navigate({ to: "/jobs/$jobId", params: { jobId: job.id } })}
          >
            <ExternalLink size={14} aria-hidden /> Open
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => copy(job.id, "Job id copied")}>
            <Link2 size={14} aria-hidden /> Copy id
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => void navigate({ to: "/jobs/$jobId/tasks", params: { jobId: job.id } })}
          >
            <ListTree size={14} aria-hidden /> Open tasks
          </DropdownMenuItem>
          {operate && resumable && job.status !== "partial" ? (
            <DropdownMenuItem onSelect={() => setDialog("resume")}>
              <RotateCcw size={14} aria-hidden /> Resume with options
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Download size={14} aria-hidden /> Export CSV
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-52">
                {JOB_EXPORT_TABLES.map((table) => (
                  <DropdownMenuItem key={table} asChild>
                    <a
                      href={jobExportUrl(job.id, table)}
                      download={`${short}-${table}.csv`}
                      className="text-ink no-underline hover:no-underline"
                    >
                      {JOB_EXPORT_TABLE_LABELS[table]}
                    </a>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={dialog === "cancel"}
        onOpenChange={(open) => setDialog(open ? "cancel" : null)}
        title="Cancel this run?"
        description={`${title} — queued tasks are dropped and running tasks stop after their current step. Results gathered so far stay available; the run can be resumed later.`}
        confirmLabel="Cancel run"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setDialog(null) })}
      />
      <ResumeDialog
        open={dialog === "resume"}
        onOpenChange={(open) => setDialog(open ? "resume" : null)}
        jobTitle={title}
        pending={resume.isPending}
        onResume={(input) => resume.mutate(input, { onSettled: () => setDialog(null) })}
      />
    </div>
  );
}
