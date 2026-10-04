/**
 * FormField — mockup §3.4: label 13/600 ink-2, the control (h40), a helper line (12 muted) and
 * the inline validation message (12 fail) wired through `aria-describedby`.
 */
import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

export interface FormFieldProps {
  id: string;
  label: ReactNode;
  helper?: ReactNode;
  error?: string;
  className?: string;
  /** Render prop receives the ids to spread on the control. */
  children: (control: {
    id: string;
    describedBy: string | undefined;
    invalid: boolean;
  }) => ReactNode;
  /** Use a `<span>` instead of `<label>` when the control is not labellable (checkbox groups). */
  asGroup?: boolean;
}

export function FormField({
  id,
  label,
  helper,
  error,
  className,
  children,
  asGroup,
}: FormFieldProps) {
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(" ") || undefined;
  return (
    <div
      className={cn("flex min-w-0 flex-col gap-1.5", className)}
      role={asGroup ? "group" : undefined}
      aria-labelledby={asGroup ? `${id}-label` : undefined}
    >
      {asGroup ? (
        <span id={`${id}-label`} className="text-[13px] font-semibold text-ink-2">
          {label}
        </span>
      ) : (
        <Label htmlFor={id}>{label}</Label>
      )}
      {children({ id, describedBy, invalid: Boolean(error) })}
      {error ? (
        <p id={errorId} role="alert" className="text-[12px] text-status-fail-fg">
          {error}
        </p>
      ) : null}
      {helper ? (
        <p id={helperId} className="text-[12px] text-muted">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
