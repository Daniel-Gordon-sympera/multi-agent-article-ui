/**
 * MaterialityPill — mockup-spec §1.3 as drawn (High amber, Medium brand, Low neutral), no dot,
 * h22. The split-bar ramp lives in `SplitBar`; see mockup §6.1 for the deliberate difference.
 */
import { cn } from "@/lib/cn";
import { normaliseMateriality, type Materiality } from "@/lib/status";

export interface MaterialityPillProps {
  materiality: Materiality | string | null | undefined;
  className?: string;
}

const classes: Record<Materiality, string> = {
  High: "bg-status-warn-bg text-status-warn-fg",
  Medium: "bg-brand-100 text-brand-700",
  Low: "bg-status-neutral-bg text-status-neutral-fg",
};

export function MaterialityPill({ materiality, className }: MaterialityPillProps) {
  const level = normaliseMateriality(materiality);
  if (!level) return <span className={cn("text-muted", className)}>—</span>;
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-pill px-2.5 text-[12px] leading-none font-semibold whitespace-nowrap",
        classes[level],
        className,
      )}
      data-materiality={level.toLowerCase()}
    >
      {level}
    </span>
  );
}
