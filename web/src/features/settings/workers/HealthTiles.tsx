/**
 * Health tiles — mockup §3.11: card (padding 18×20), `h3` title + StatusPill right, rows of
 * 13 px label / 600 tabular value, optional link (Queue → "Open dead tasks ›").
 */
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { QueueSummary, SystemInfo } from "@/api/types/bff";
import type { Worker } from "@/api/types/workers";
import { StatusPill } from "@/components/StatusPill";
import { TextLink } from "@/components/TextLink";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks/useNow";
import { apiTile, proxyTile, queueTile, storageTile, type HealthTileModel } from "./workersFormat";

export function HealthTile({ tile, link }: { tile: HealthTileModel; link?: ReactNode }) {
  return (
    <section
      aria-label={`${tile.title} health`}
      className="card flex min-w-0 flex-col gap-3 px-5 py-[18px]"
    >
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-card-title text-ink">{tile.title}</h3>
        <StatusPill descriptor={tile.status} />
      </header>
      <dl className="flex flex-col gap-1.5">
        {tile.rows.map((row) => (
          <div key={row.label} className="flex items-baseline justify-between gap-3 text-[13px]">
            <dt className="text-ink-2">{row.label}</dt>
            <dd
              className={cn(
                "text-right font-semibold tabular",
                row.tone === "muted" ? "font-normal text-muted" : "text-ink",
                row.tone === "warn" && "text-status-warn-fg",
              )}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {link ? <div>{link}</div> : null}
    </section>
  );
}

export interface HealthTilesProps {
  system: SystemInfo | undefined;
  queue: QueueSummary | undefined;
  workers: Worker[] | undefined;
}

export function HealthTiles({ system, queue, workers }: HealthTilesProps) {
  const now = useNow(5_000);
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(240px, 100%), 1fr))" }}
    >
      <HealthTile tile={apiTile(system)} />
      <HealthTile tile={proxyTile(workers, now)} />
      <HealthTile
        tile={queueTile(queue)}
        link={
          <TextLink asChild chevron>
            <Link to="/jobs" search={{ status: "partial" }}>
              Open dead tasks
            </Link>
          </TextLink>
        }
      />
      <HealthTile tile={storageTile()} />
    </div>
  );
}
