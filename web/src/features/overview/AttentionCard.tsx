/**
 * Needs attention — mockup §3.1: link cards from `GET /app/attention`, "View all" → Settings ›
 * Workers & health. The BFF's `href` strings are the URL contracts of contract §7; they are
 * rendered as typed router links by kind (job tasks, job, worker anchor, system page).
 */
import { Link } from "@tanstack/react-router";
import type { AttentionItem } from "@/api/types/bff";
import { AttentionItemBody, attentionItemClass } from "@/components/AttentionItem";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { SkeletonLines } from "@/components/Skeleton";
import { TextLink } from "@/components/TextLink";
import { pluralize } from "@/lib/format";

function AttentionLink({ item }: { item: AttentionItem }) {
  const body = (
    <AttentionItemBody
      severity={item.severity}
      kind={item.kind}
      title={item.title}
      detail={item.detail}
    />
  );
  if (item.kind === "dead_task" && item.job_id) {
    return (
      <Link to="/jobs/$jobId/tasks" params={{ jobId: item.job_id }} className={attentionItemClass}>
        {body}
      </Link>
    );
  }
  if ((item.kind === "partial_job" || item.kind === "failed_job") && item.job_id) {
    return (
      <Link to="/jobs/$jobId" params={{ jobId: item.job_id }} className={attentionItemClass}>
        {body}
      </Link>
    );
  }
  if (item.kind === "slow_worker") {
    return (
      <Link to="/settings/workers" hash={item.instance_id} className={attentionItemClass}>
        {body}
      </Link>
    );
  }
  if (item.kind === "api_not_ready") {
    return (
      <Link to="/settings/system" className={attentionItemClass}>
        {body}
      </Link>
    );
  }
  return (
    <a href={item.href} className={attentionItemClass}>
      {body}
    </a>
  );
}

export interface AttentionCardProps {
  items: AttentionItem[] | undefined;
  loading: boolean;
  error: unknown;
  onRetry: () => void;
}

export function AttentionCard({ items, loading, error, onRetry }: AttentionCardProps) {
  const subtitle = items ? (items.length ? pluralize(items.length, "item") : "all clear") : "…";
  return (
    <Card aria-labelledby="attention-title">
      <CardHeader
        id="attention-title"
        title="Needs attention"
        subtitle={subtitle}
        aside={
          <TextLink asChild>
            <Link to="/settings/workers">View all</Link>
          </TextLink>
        }
      />
      {loading && !items ? <SkeletonLines lines={3} /> : null}
      {error && !items ? (
        <ErrorState
          variant="plain"
          error={error}
          onRetry={onRetry}
          title="Attention list unavailable"
        />
      ) : null}
      {items && items.length === 0 ? (
        <p className="text-[13px] text-muted">
          No dead tasks, no partial or failed runs, every worker heartbeat on time.
        </p>
      ) : null}
      {items && items.length > 0 ? (
        <ul className="flex flex-col gap-2.5" aria-label="Attention items">
          {items.map((item, index) => (
            <li key={`${item.kind}-${item.job_id ?? item.instance_id ?? index}`}>
              <AttentionLink item={item} />
            </li>
          ))}
        </ul>
      ) : null}
    </Card>
  );
}
