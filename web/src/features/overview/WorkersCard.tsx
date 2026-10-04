/**
 * Workers — mockup §3.1: "8 instances · proxy exit US verified 4 min ago", one row per role with
 * an 8 px dot (amber when any instance of the role has a slow heartbeat, red when one is missing)
 * and "N instance(s)"; "Details" → Settings › Workers & health.
 */
import { Link } from "@tanstack/react-router";
import type { Worker } from "@/api/types/workers";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonLines } from "@/components/Skeleton";
import { TextLink } from "@/components/TextLink";
import { cn } from "@/lib/cn";
import { pluralize } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import type { StatusTone } from "@/lib/status";
import { groupWorkersByRole, proxySummary } from "./workersGrouping";

const dotTone: Record<StatusTone, string> = {
  done: "bg-status-done-fg",
  running: "bg-status-running-fg",
  warn: "bg-status-warn-fg",
  fail: "bg-status-fail-fg",
  neutral: "bg-faint",
};

const toneWord: Record<StatusTone, string> = {
  done: "healthy",
  running: "healthy",
  neutral: "unknown",
  warn: "slow heartbeat",
  fail: "missing heartbeat",
};

export interface WorkersCardProps {
  workers: Worker[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function WorkersCard({ workers, loading, error, onRetry }: WorkersCardProps) {
  const now = useNow(5_000);
  const live = (workers ?? []).filter((w) => !w.gone_at);
  const rows = groupWorkersByRole(live, now);
  return (
    <Card aria-labelledby="workers-card-title">
      <CardHeader
        id="workers-card-title"
        title="Workers"
        subtitle={
          workers ? `${pluralize(live.length, "instance")} · ${proxySummary(live, now)}` : "…"
        }
        aside={
          <TextLink asChild>
            <Link to="/settings/workers">Details</Link>
          </TextLink>
        }
      />
      {loading && !workers ? <SkeletonLines lines={6} /> : null}
      {error && !workers ? (
        <ErrorState variant="plain" error={error} onRetry={onRetry} title="Workers unavailable" />
      ) : null}
      {workers && rows.length === 0 ? (
        <p className="text-[13px] text-muted">No worker has reported a heartbeat.</p>
      ) : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col" aria-label="Workers by role">
          {rows.map((row) => (
            <li key={row.role} className="flex h-8 items-center justify-between gap-3">
              <span className="flex items-center gap-2.5 text-[13px] font-medium text-ink">
                <span className={cn("size-2 rounded-full", dotTone[row.tone])} aria-hidden />
                {row.role}
                <span className="sr-only">{toneWord[row.tone]}</span>
              </span>
              <span className="text-[12px] text-muted tabular" title={row.labels.join(", ")}>
                {pluralize(row.count, "instance")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
