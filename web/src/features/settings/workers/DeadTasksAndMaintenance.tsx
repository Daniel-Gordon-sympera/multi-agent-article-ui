/**
 * The 2-up bottom row of Settings › Workers & health (mockup §3.11): "Dead tasks by category"
 * (HorizontalBars from `/app/system/dead-by-category`) and the "Maintenance schedule" list.
 */
import type { DeadByCategory, MaintenanceSchedule } from "@/api/types/overview";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { HorizontalBars } from "@/components/HorizontalBars";
import { SkeletonLines } from "@/components/Skeleton";
import { pluralize } from "@/lib/format";

export interface DeadTasksCardProps {
  data: DeadByCategory | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function DeadTasksByCategoryCard({ data, loading, error, onRetry }: DeadTasksCardProps) {
  return (
    <Card aria-labelledby="dead-by-category-title">
      <CardHeader
        id="dead-by-category-title"
        title="Dead tasks by category"
        subtitle={
          data ? `last ${data.days} days · ${pluralize(data.total, "task")}` : "last 7 days"
        }
      />
      {loading && !data ? <SkeletonLines lines={4} /> : null}
      {error && !data ? (
        <ErrorState
          variant="plain"
          error={error}
          onRetry={onRetry}
          title="Categories unavailable"
        />
      ) : null}
      {data && data.items.length === 0 ? (
        <p className="text-[13px] text-muted">No task died in the last {data.days} days.</p>
      ) : null}
      {data && data.items.length > 0 ? (
        <HorizontalBars
          layout="narrow"
          ariaLabel="Dead tasks by category"
          rows={data.items.map((item) => ({
            key: item.category,
            label: item.category,
            mono: true,
            pct: item.pct / 100,
            value: item.count,
          }))}
        />
      ) : null}
    </Card>
  );
}

export interface MaintenanceCardProps {
  data: MaintenanceSchedule | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function MaintenanceScheduleCard({ data, loading, error, onRetry }: MaintenanceCardProps) {
  return (
    <Card aria-labelledby="maintenance-title">
      <CardHeader
        id="maintenance-title"
        title="Maintenance schedule"
        subtitle="single maintenance instance holds the scheduler lock"
      />
      {loading && !data ? <SkeletonLines lines={5} /> : null}
      {error && !data ? (
        <ErrorState variant="plain" error={error} onRetry={onRetry} title="Schedule unavailable" />
      ) : null}
      {data ? (
        <>
          <ul className="-my-2 divide-y divide-border" aria-label="Maintenance jobs">
            {data.items.map((job) => (
              <li key={job.name} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-mono text-[13px] text-ink">{job.name}</span>
                  <span className="text-[12px] text-muted">{job.cadence}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[12px] text-ink-2">
                  <span className="size-2 rounded-full bg-faint" aria-hidden />
                  {job.last_result ?? "result not exposed"}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-muted">{data.note}</p>
        </>
      ) : null}
    </Card>
  );
}
