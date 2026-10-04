/** EmptyState — contract §5.2: a short message with a next action (not drawn; see mockup §6.17). */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface EmptyStateProps extends Omit<ComponentProps<"div">, "title"> {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** `card` draws the dashed container; `plain` is for table bodies. */
  variant?: "card" | "plain";
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = "card",
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center gap-2 px-6 py-10 text-center",
        variant === "card" && "rounded-card border border-dashed border-border-strong bg-surface",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="mb-1 text-faint [&>svg]:size-6" aria-hidden>
          {icon}
        </div>
      ) : null}
      <p className="text-[14px] font-semibold text-ink">{title}</p>
      {description ? <p className="max-w-[440px] text-[13px] text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
