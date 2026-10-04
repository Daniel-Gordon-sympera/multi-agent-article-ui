/** LiveDot — mockup §5: 8 px running-blue dot + "Live" / "Auto-refresh every 5 s" (12/600 blue). */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface LiveDotProps extends ComponentProps<"span"> {
  label?: string;
  /** `done` for "API ready", `warn`/`fail` for degraded states (sidebar footer). */
  tone?: "running" | "done" | "warn" | "fail" | "neutral";
  pulse?: boolean;
}

const dotTone = {
  running: "bg-status-running-fg",
  done: "bg-status-done-fg",
  warn: "bg-status-warn-fg",
  fail: "bg-status-fail-fg",
  neutral: "bg-faint",
};

const textTone = {
  running: "text-status-running-fg",
  done: "text-status-done-fg",
  warn: "text-status-warn-fg",
  fail: "text-status-fail-fg",
  neutral: "text-ink-2",
};

export function LiveDot({
  label = "Live",
  tone = "running",
  pulse = tone === "running",
  className,
  ...props
}: LiveDotProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[12px] font-semibold",
        textTone[tone],
        className,
      )}
      {...props}
    >
      <span className="relative inline-flex size-2" aria-hidden>
        {pulse ? (
          <span
            className={cn(
              "absolute inline-flex size-full animate-ping rounded-full opacity-60",
              dotTone[tone],
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex size-2 rounded-full", dotTone[tone])} />
      </span>
      {label}
    </span>
  );
}
