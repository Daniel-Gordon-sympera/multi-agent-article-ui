/**
 * PageHeader — mockup §2.3: optional breadcrumbs, title row with `h1` (26/700) + StatusPill,
 * then a subtitle (14 muted) or a meta line (13 muted, wraps), actions right (md buttons).
 * Crumbs are passed as ready elements (`<Link>`s and a final string) so the header stays
 * independent of the router's typed `to` values.
 */
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface PageHeaderProps {
  crumbs?: ReactNode[];
  title: ReactNode;
  status?: ReactNode;
  subtitle?: ReactNode;
  /** Meta entries rendered inline with 14 px gaps (mono id + CopyButton, tag pairs, text). */
  meta?: ReactNode[];
  actions?: ReactNode;
  className?: string;
  /** Lets the sticky-strip pages reduce the gap below the header. */
  compact?: boolean;
}

export function Breadcrumbs({ crumbs, className }: { crumbs: ReactNode[]; className?: string }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-1.5 text-[13px] text-ink-2 [&_a]:font-medium [&_a]:text-muted [&_a]:no-underline [&_a:hover]:text-ink [&_a:hover]:underline",
        className,
      )}
    >
      {crumbs.map((crumb, index) => {
        const last = index === crumbs.length - 1;
        return (
          <Fragment key={index}>
            <span
              className={cn("min-w-0 truncate", last && "font-semibold text-ink-2")}
              aria-current={last ? "page" : undefined}
            >
              {crumb}
            </span>
            {!last ? <ChevronRight size={14} className="shrink-0 text-faint" aria-hidden /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}

/** A "label + value" pair in the meta line: `<MetaPair label="kind"><Tag mono>…</Tag></MetaPair>`. */
export function MetaPair({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      {children}
    </span>
  );
}

export function PageHeader({
  crumbs,
  title,
  status,
  subtitle,
  meta,
  actions,
  className,
  compact,
}: PageHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-2.5", compact && "gap-2", className)}>
      {crumbs && crumbs.length > 0 ? <Breadcrumbs crumbs={crumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-1 basis-[480px] flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="min-w-0 text-page-title text-ink">{title}</h1>
            {status ? <span className="ml-1 inline-flex">{status}</span> : null}
          </div>
          {subtitle ? <p className="text-[14px] text-muted">{subtitle}</p> : null}
          {meta && meta.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2 text-[13px] text-muted">
              {meta.map((entry, index) => (
                <span key={index} className="inline-flex min-w-0 items-center gap-2">
                  {entry}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2.5">{actions}</div>
        ) : null}
      </div>
    </header>
  );
}
