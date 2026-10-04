/**
 * JobHeader — mockup §3.5: breadcrumb `Jobs › 0192f1c2`, title "County, ST · Industry" with the
 * StatusPill, the meta line (mono id + CopyButton · kind tag · prompt tag · created by · Scout /
 * run / batch) and the actions (Cancel run · Resume (with the resume options) · Export CSV ▾ · ⋯).
 */
import { Link } from "@tanstack/react-router";
import { Ellipsis, ExternalLink, Link2, RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import type { BatchMembership } from "@/api/types/bff";
import type { JobDetail, JobRecord } from "@/api/types/jobs";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { copyToClipboard, CopyButton } from "@/components/CopyButton";
import { MetaPair, PageHeader } from "@/components/PageHeader";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { ExportMenu } from "@/features/jobs/ExportMenu";
import { jobTitle } from "@/features/jobs/jobTitle";
import { ResumeDialog } from "@/features/jobs/ResumeDialog";
import { useJobMutations } from "@/features/jobs/useJobMutations";
import { shortId } from "@/lib/format";
import { isCancellableJobStatus, isResumableJobStatus } from "@/lib/status";

export interface JobHeaderProps {
  job: JobDetail | JobRecord;
  batch?: BatchMembership | null;
}

export function JobHeader({ job, batch }: JobHeaderProps) {
  const { can } = useSession();
  const { cancel, resume } = useJobMutations(job.id);
  const [confirm, setConfirm] = useState<"cancel" | "resume" | null>(null);
  const operate = can("operate");
  const cancellable = isCancellableJobStatus(job.status);
  const resumable = isResumableJobStatus(job.status);

  const meta = [
    <span key="id" className="inline-flex items-center gap-1.5 font-mono text-[12px] text-ink-2">
      {job.id}
      <CopyButton value={job.id} label="Copy job id" successMessage="Job id copied" />
    </span>,
    <MetaPair key="kind" label="kind">
      <Tag mono>{job.kind}</Tag>
    </MetaPair>,
    <MetaPair key="prompt" label="prompt">
      <Tag mono>{job.prompt_version}</Tag>
    </MetaPair>,
    <span key="created">
      created <RelativeTime value={job.created_at} mode="smart" className="lowercase" /> by{" "}
      <strong className="font-semibold text-ink-2">{job.created_by}</strong>
    </span>,
  ];
  if (batch) {
    meta.push(
      <span key="batch" className="inline-flex items-center gap-1.5">
        {batch.scout_name ? (
          <>
            Scout{" "}
            {batch.scout_id ? (
              <Link
                to="/jobs"
                search={{ scout: batch.scout_id }}
                className="font-medium"
                title="Runs of this Scout"
              >
                {batch.scout_name}
              </Link>
            ) : (
              <Link to="/jobs/scouts" className="font-medium">
                {batch.scout_name}
              </Link>
            )}
            {batch.run_number ? <> · run {batch.run_number}</> : null}
            {" · "}
          </>
        ) : null}
        <Tag tone="brand">
          batch {batch.position} of {batch.size}
        </Tag>
      </span>,
    );
  }

  return (
    <>
      <PageHeader
        crumbs={[
          <Link key="jobs" to="/jobs">
            Jobs
          </Link>,
          <span key="id" className="font-mono">
            {shortId(job.id)}
          </span>,
        ]}
        title={jobTitle(job)}
        status={
          <StatusPill entity="job" status={job.status} secondary={job.stop_reason ?? undefined} />
        }
        meta={meta}
        actions={
          <>
            {operate ? (
              <Button
                variant="danger"
                onClick={() => setConfirm("cancel")}
                disabled={!cancellable}
                loading={cancel.isPending}
              >
                <Square aria-hidden />
                Cancel run
              </Button>
            ) : null}
            {operate ? (
              <Button
                variant="secondary"
                onClick={() => setConfirm("resume")}
                disabled={!resumable}
                loading={resume.isPending}
              >
                <RotateCcw aria-hidden />
                Resume
              </Button>
            ) : null}
            <ExportMenu jobId={job.id} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" aria-label="More actions">
                  <Ellipsis aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onSelect={() => {
                    void copyToClipboard(job.id).then((ok) =>
                      ok ? toast.success("Job id copied") : toast.error("Could not copy"),
                    );
                  }}
                >
                  <Link2 size={14} aria-hidden /> Copy job id
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    void copyToClipboard(`${window.location.origin}/jobs/${job.id}`).then((ok) =>
                      ok ? toast.success("Link copied") : toast.error("Could not copy"),
                    );
                  }}
                >
                  <Link2 size={14} aria-hidden /> Copy link to this job
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <a
                    href={`/v1/jobs/${encodeURIComponent(job.id)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink no-underline hover:no-underline"
                  >
                    <ExternalLink size={14} aria-hidden /> Open API record
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => setConfirm(open ? "cancel" : null)}
        title="Cancel this run?"
        description="Queued tasks are dropped and running tasks stop after their current step. Results gathered so far stay available; the run can be resumed later."
        confirmLabel="Cancel run"
        pending={cancel.isPending}
        onConfirm={() => cancel.mutate(undefined, { onSettled: () => setConfirm(null) })}
      />
      <ResumeDialog
        open={confirm === "resume"}
        onOpenChange={(open) => setConfirm(open ? "resume" : null)}
        jobTitle={jobTitle(job)}
        pending={resume.isPending}
        onResume={(input) => resume.mutate(input, { onSettled: () => setConfirm(null) })}
      />
    </>
  );
}
