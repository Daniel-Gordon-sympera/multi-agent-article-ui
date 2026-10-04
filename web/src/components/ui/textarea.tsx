/** Multi-line input with the same chrome as `Input`. */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps extends ComponentProps<"textarea"> {
  invalid?: boolean;
}

export function Textarea({ className, invalid, ...props }: TextareaProps) {
  return (
    <textarea
      aria-invalid={invalid || undefined}
      className={cn(
        "min-h-[96px] w-full rounded-control border border-border-strong bg-surface px-3 py-2 text-[14px] text-ink outline-none placeholder:text-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint",
        invalid && "border-status-fail-fg",
        className,
      )}
      {...props}
    />
  );
}
