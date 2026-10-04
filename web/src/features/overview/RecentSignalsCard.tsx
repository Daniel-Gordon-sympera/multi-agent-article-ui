/**
 * Recent signals — mockup §3.1: five rows (company over "Signal · County, ST · Mon D", materiality
 * pill at right), each a link to the explorer drawer (`/signals?detail=<mention id>`).
 */
import { Link } from "@tanstack/react-router";
import type { CrossJobSignalRow } from "@/api/types/signals";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { MaterialityPill } from "@/components/MaterialityPill";
import { SkeletonLines } from "@/components/Skeleton";
import { TextLink } from "@/components/TextLink";
import { signalMeta } from "./overviewFormat";

export interface RecentSignalsCardProps {
  signals: CrossJobSignalRow[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function RecentSignalsCard({ signals, loading, error, onRetry }: RecentSignalsCardProps) {
  return (
    <Card aria-labelledby="recent-signals-title">
      <CardHeader
        id="recent-signals-title"
        title="Recent signals"
        subtitle="newest first, all jobs"
        aside={
          <TextLink asChild>
            <Link to="/signals">Open explorer</Link>
          </TextLink>
        }
      />
      {loading && !signals ? <SkeletonLines lines={5} /> : null}
      {error && !signals ? (
        <ErrorState variant="plain" error={error} onRetry={onRetry} title="Signals unavailable" />
      ) : null}
      {signals && signals.length === 0 ? (
        <p className="text-[13px] text-muted">
          No signals yet — they appear as jobs analyse articles.
        </p>
      ) : null}
      {signals && signals.length > 0 ? (
        <ul className="-my-2.5 divide-y divide-border" aria-label="Recent signals">
          {signals.map((row) => (
            <li key={row.id}>
              <Link
                to="/signals"
                search={{ detail: row.id }}
                className="flex items-center justify-between gap-3 py-2.5 no-underline hover:no-underline"
              >
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-[13px] font-semibold text-ink">{row.company}</span>
                  <span className="truncate text-[12px] text-muted">{signalMeta(row)}</span>
                </span>
                <MaterialityPill materiality={row.materiality} />
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
