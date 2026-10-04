/**
 * RelativeTime — contract §5.3: honours the `time_display` preference. Modes: `relative`
 * ("29 min ago"), `smart` ("Today 11:02"), `datetime` ("Oct 2, 09:30 UTC"), `date`, `clock`.
 * The tooltip shows the other representation (local ⇄ UTC) with the full timestamp.
 */
import type { ComponentProps } from "react";
import { useTimeDisplay } from "@/app/providers/ThemeProvider";
import { SimpleTooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import {
  formatClock,
  formatDate,
  formatDateTime,
  formatFullTimestamp,
  formatRelativeTime,
  formatSmartDateTime,
  parseDate,
} from "@/lib/format";
import { useNow } from "@/lib/hooks/useNow";

export type RelativeTimeMode = "relative" | "smart" | "datetime" | "date" | "clock";

export interface RelativeTimeProps extends Omit<ComponentProps<"time">, "children"> {
  value: string | Date | null | undefined;
  mode?: RelativeTimeMode;
  /** Re-render cadence for `relative`; 0 disables ticking. */
  tickMs?: number;
  /** Text when `value` is empty. */
  fallback?: string;
  tooltip?: boolean;
}

export function RelativeTime({
  value,
  mode = "relative",
  tickMs = 15_000,
  fallback = "—",
  tooltip = true,
  className,
  ...props
}: RelativeTimeProps) {
  const timeDisplay = useTimeDisplay();
  const now = useNow(mode === "relative" ? tickMs : 0);
  const date = parseDate(value);
  if (!date) return <span className={cn("text-muted", className)}>{fallback}</span>;

  const options = { timeDisplay, now };
  const text =
    mode === "relative"
      ? formatRelativeTime(date, options)
      : mode === "smart"
        ? formatSmartDateTime(date, options)
        : mode === "datetime"
          ? formatDateTime(date, options)
          : mode === "date"
            ? formatDate(date, options)
            : formatClock(date, options);

  const other = timeDisplay === "utc" ? "local" : "utc";
  const tip = `${formatFullTimestamp(date, { timeDisplay })} · ${formatFullTimestamp(date, { timeDisplay: other })}`;

  const element = (
    <time dateTime={date.toISOString()} className={cn("tabular", className)} {...props}>
      {text}
    </time>
  );
  return tooltip ? <SimpleTooltip content={tip}>{element}</SimpleTooltip> : element;
}
