/**
 * Stepper — mockup §3.5 "Pipeline progress": five equal columns, 24 px nodes (done = green
 * circle + white check, current = brand-300 fill with brand-600 ring and brand-700 dot,
 * pending = white with border-strong ring), 2 px connectors, label + duration + stats lines.
 */
import { Check, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { STAGE_LABELS, type Stage, type StageState } from "@/lib/status";

export interface StepperStep {
  stage: Stage;
  state: StageState;
  /** "2 min", "9 min so far", "—" */
  duration?: ReactNode;
  /** "14 queries · 23 domains judged · 5 kept" */
  stats?: ReactNode;
}

export interface StepperProps {
  steps: StepperStep[];
  className?: string;
}

function Node({ state }: { state: StageState }) {
  if (state === "done") {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-status-done-fg text-white">
        <Check size={14} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  if (state === "current") {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-600 bg-brand-300">
        <span className="size-2 rounded-full bg-brand-700" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-status-fail-fg text-white">
        <TriangleAlert size={13} strokeWidth={2.5} aria-hidden />
      </span>
    );
  }
  return (
    <span className="inline-block size-6 shrink-0 rounded-full border-2 border-border-strong bg-surface" />
  );
}

const labelClass: Record<StageState, string> = {
  done: "text-ink",
  current: "text-brand-700",
  pending: "text-muted",
  failed: "text-status-fail-fg",
};

export function Stepper({ steps, className }: StepperProps) {
  return (
    <ol className={cn("flex", className)} aria-label="Pipeline stages">
      {steps.map((step, index) => {
        const last = index === steps.length - 1;
        return (
          <li
            key={step.stage}
            className="flex min-w-0 flex-1 basis-0 flex-col gap-2.5"
            aria-current={step.state === "current" ? "step" : undefined}
          >
            <div className="flex items-center">
              <Node state={step.state} />
              {!last ? (
                <span
                  className={cn(
                    "mx-2 h-0.5 flex-1",
                    step.state === "done" ? "bg-status-done-fg" : "bg-border-strong",
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5 pr-3">
              <p className={cn("text-[14px] font-bold", labelClass[step.state])}>
                {STAGE_LABELS[step.stage]}
                <span className="sr-only">{` — ${step.state}`}</span>
              </p>
              <p className="text-[12px] text-muted">{step.duration ?? "—"}</p>
              {step.stats ? <p className="text-[12px] text-ink-2">{step.stats}</p> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
