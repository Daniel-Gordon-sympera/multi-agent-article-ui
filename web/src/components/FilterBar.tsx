/**
 * FilterBar — mockup §5: the toolbar row above every table; filters (search + selects) at the
 * left with gap 8, table tools (density, columns, export) at the right.
 */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface FilterBarProps extends ComponentProps<"div"> {
  /** Right-aligned tools: `<DensityToggle/>`, `<ColumnChooser/>`, export buttons. */
  tools?: ReactNode;
  label?: string;
}

export function FilterBar({
  tools,
  label = "Filters",
  className,
  children,
  ...props
}: FilterBarProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex flex-wrap items-center justify-between gap-2", className)}
      {...props}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">{children}</div>
      {tools ? <div className="flex shrink-0 items-center gap-2">{tools}</div> : null}
    </div>
  );
}
