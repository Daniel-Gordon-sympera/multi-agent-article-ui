/** Text input — mockup §1.5: h40 in forms, h36 in toolbars; border border-strong, radius 8. */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends ComponentProps<"input"> {
  /** `form` = 40 px (default), `toolbar` = 36 px. */
  inputSize?: "form" | "toolbar";
  invalid?: boolean;
}

export function Input({
  className,
  inputSize = "form",
  invalid,
  type = "text",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      aria-invalid={invalid || undefined}
      className={cn(
        "w-full min-w-0 rounded-control border border-border-strong bg-surface px-3 text-ink shadow-none outline-none placeholder:text-faint",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-faint",
        inputSize === "form" ? "h-10 text-[14px]" : "h-9 text-[13px]",
        invalid && "border-status-fail-fg",
        className,
      )}
      {...props}
    />
  );
}
