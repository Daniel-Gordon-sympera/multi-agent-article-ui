/**
 * SignalRecordCell — mockup §3.6 / §3.8: line 1 company link (600, opens the drawer) + org-kind
 * tag; line 2 signal title (500) + MaterialityPill + confidence Meter (44×6) + score; line 3 the
 * verbatim evidence in curly quotes, 12 px ink-2, one line with an ellipsis (never pre-trimmed,
 * mockup §6.2). Compact density hides the evidence line (72 → 56 px rows).
 */
import { MaterialityPill } from "@/components/MaterialityPill";
import { Meter } from "@/components/Meter";
import { Tag } from "@/components/Tag";
import { SignalDetailLink } from "@/features/signals/SignalDetailLink";
import { signalTitle } from "@/features/signals/signalCatalog";
import { cn } from "@/lib/cn";
import { formatScore } from "@/lib/format";
import { confidenceRatio, signalEvidence, type SignalTableRow } from "./signalColumns";

export interface SignalRecordCellProps {
  row: SignalTableRow;
  /** 330 on the job tab, 280 on the explorer. */
  maxWidth?: number;
  className?: string;
}

export function SignalRecordCell({ row, maxWidth = 330, className }: SignalRecordCellProps) {
  const title = row.signal_title?.trim() || signalTitle(row.signal);
  const evidence = signalEvidence(row);
  const confidence = confidenceRatio(row.confidence_score);
  return (
    <div className={cn("flex min-w-0 flex-col gap-[5px]", className)} style={{ maxWidth }}>
      <div className="flex min-w-0 items-center gap-2">
        <SignalDetailLink
          signalId={row.id}
          className="min-w-0 truncate text-[13px] font-semibold text-brand-600 hover:text-brand-700 hover:underline"
          title={row.company}
        >
          {row.company}
        </SignalDetailLink>
        {row.org_kind ? <Tag className="shrink-0">{row.org_kind}</Tag> : null}
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <span className="truncate text-[13px] font-medium text-ink" title={title}>
          {title}
        </span>
        <MaterialityPill materiality={row.materiality} className="shrink-0" />
        <Meter
          value={confidence}
          width={44}
          ariaLabel={`Confidence ${formatScore(confidence)}`}
          label={formatScore(confidence)}
          className="shrink-0"
        />
      </div>
      <p
        className={cn(
          "signal-evidence truncate text-[12px] text-ink-2",
          "[.data-table[data-density=compact]_&]:hidden",
          "[html[data-density=compact]_.data-table:not([data-density=comfortable])_&]:hidden",
        )}
        title={evidence}
      >
        “{evidence}”
      </p>
    </div>
  );
}
