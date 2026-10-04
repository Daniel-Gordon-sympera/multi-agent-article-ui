/**
 * "Last run" cell (mockup §3.3 col. 5): the aggregated StatusPill of the batch over the
 * relative time of its creation. A batch created a moment ago (clock skew, polling tick) is
 * clamped to "just now" instead of reading "in 1 s".
 */
import type { ScoutLastRun } from "@/api/types/bff";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { parseDate } from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";
import { lastRunStatus } from "./scoutPresentation";

export function LastRunCell({ lastRun }: { lastRun: ScoutLastRun | null }) {
  const now = useNow(15_000);
  if (!lastRun) return <span className="text-muted">Never run</span>;
  const status = lastRunStatus(lastRun);
  const created = parseDate(lastRun.created_at);
  const clamped = created && created.getTime() > now.getTime() ? now : (created ?? null);
  return (
    <div className="flex flex-col items-start gap-1">
      {status ? (
        <StatusPill entity="job" status={status} size="sm" />
      ) : (
        <span className="text-muted">Unknown</span>
      )}
      <RelativeTime value={clamped} className="text-[12px] text-muted" />
    </div>
  );
}
