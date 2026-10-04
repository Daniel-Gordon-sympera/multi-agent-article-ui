/**
 * AttentionItem — mockup §3.1 "Needs attention": a link card (padding 12, border, radius 10)
 * with a 16 px icon (fail red / warn amber), a title and a sub-line. Routes render it as
 * `<Link className={attentionItemClass}><AttentionItemBody …/></Link>`; `AttentionItem` is the
 * plain-anchor / static variant.
 */
import { Clock, Server, TriangleAlert, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import type { AttentionKind } from "@/api/types/bff";
import { cn } from "@/lib/cn";

export interface AttentionItemBodyProps {
  severity: "fail" | "warn";
  kind?: AttentionKind;
  title: ReactNode;
  detail: ReactNode;
  icon?: LucideIcon;
}

const iconByKind: Partial<Record<AttentionKind, LucideIcon>> = {
  dead_task: TriangleAlert,
  failed_job: TriangleAlert,
  partial_job: Clock,
  slow_worker: Server,
  api_not_ready: Server,
};

export const attentionItemClass =
  "flex gap-2.5 rounded-banner border border-border bg-surface p-3 text-left no-underline hover:bg-surface-2 hover:no-underline";

export function AttentionItemBody({ severity, kind, title, detail, icon }: AttentionItemBodyProps) {
  const Icon = icon ?? (kind ? iconByKind[kind] : undefined) ?? TriangleAlert;
  return (
    <>
      <Icon
        size={16}
        strokeWidth={2}
        className={cn(
          "mt-0.5 shrink-0",
          severity === "fail" ? "text-status-fail-fg" : "text-status-warn-fg",
        )}
        aria-hidden
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="text-[12px] text-muted">{detail}</span>
      </span>
    </>
  );
}

export interface AttentionItemProps extends AttentionItemBodyProps {
  href?: string;
  onClick?: () => void;
  className?: string;
}

export function AttentionItem({ href, onClick, className, ...body }: AttentionItemProps) {
  if (href) {
    return (
      <a href={href} className={cn(attentionItemClass, className)} onClick={onClick}>
        <AttentionItemBody {...body} />
      </a>
    );
  }
  return (
    <div className={cn(attentionItemClass, className)}>
      <AttentionItemBody {...body} />
    </div>
  );
}
