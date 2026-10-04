/**
 * Result dialog after a fan-out with partial failures (contract §4.5: `201` with `jobs[].error`):
 * one row per leg with its outcome, a `[↺ Retry]` per failed leg and a way to the Runs list.
 */
import { Link } from "@tanstack/react-router";
import { CircleCheck, RotateCcw, TriangleAlert } from "lucide-react";
import type { Batch, BatchJob } from "@/api/types/bff";
import { Button } from "@/components/Button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { shortId } from "@/lib/format";
import { failedLegs } from "./newRunSchema";

export interface BatchResultDialogProps {
  batch: Batch | null;
  onClose: () => void;
  onRetryLeg: (leg: BatchJob) => void;
  retryingPosition: number | null;
}

export function BatchResultDialog({
  batch,
  onClose,
  onRetryLeg,
  retryingPosition,
}: BatchResultDialogProps) {
  const failed = failedLegs(batch);
  const created = batch ? batch.jobs.length - failed.length : 0;
  return (
    <Dialog open={batch !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>
            {failed.length === 0 ? "Every job was created" : "Some jobs were not created"}
          </DialogTitle>
          <DialogDescription>
            {created} of {batch?.jobs.length ?? 0} legs reached the pipeline API
            {batch?.scout_name ? ` for Scout ${batch.scout_name}` : ""}. Retry a failed leg to send
            it again with the same settings; the created runs are already queued.
          </DialogDescription>
        </DialogHeader>
        <ul className="flex flex-col divide-y divide-border rounded-control border border-border">
          {batch?.jobs.map((leg) => {
            const ok = !leg.error && leg.job_id;
            return (
              <li key={leg.position} className="flex items-center gap-3 px-3 py-2.5 text-[13px]">
                {ok ? (
                  <CircleCheck size={16} className="shrink-0 text-status-done-fg" aria-hidden />
                ) : (
                  <TriangleAlert size={16} className="shrink-0 text-status-fail-fg" aria-hidden />
                )}
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-ink">
                    {leg.position}. {leg.industry ?? "one job"}
                  </span>
                  <span className="truncate text-[12px] text-muted">
                    {ok ? (
                      <>
                        created · <span className="font-mono">{shortId(leg.job_id)}</span>
                      </>
                    ) : (
                      (leg.error ?? "no job id returned")
                    )}
                  </span>
                </div>
                {ok ? (
                  <Button asChild variant="ghost" size="xs">
                    <Link to="/jobs/$jobId" params={{ jobId: leg.job_id ?? "" }}>
                      Open
                    </Link>
                  </Button>
                ) : (
                  <Button
                    variant="tonal"
                    size="xs"
                    onClick={() => onRetryLeg(leg)}
                    loading={retryingPosition === leg.position}
                    disabled={retryingPosition !== null}
                  >
                    <RotateCcw aria-hidden />
                    Retry
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Stay here
          </Button>
          <Button asChild variant="primary">
            <Link to="/jobs" onClick={onClose}>
              Go to Runs
            </Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
