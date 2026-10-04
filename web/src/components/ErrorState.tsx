/** ErrorState — inline query error with the problem detail and a retry button (contract §5.2). */
import { TriangleAlert } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/Button";
import { cn } from "@/lib/cn";
import { errorMessage, errorTitle } from "@/lib/errors";

export interface ErrorStateProps extends Omit<ComponentProps<"div">, "title"> {
  error?: unknown;
  title?: ReactNode;
  description?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  variant?: "card" | "plain" | "banner";
}

export function ErrorState({
  error,
  title,
  description,
  onRetry,
  retrying = false,
  variant = "card",
  className,
  ...props
}: ErrorStateProps) {
  const heading = title ?? errorTitle(error, "Could not load this");
  const detail = description ?? errorMessage(error, "The request failed. Try again in a moment.");
  return (
    <div
      role="alert"
      className={cn(
        "flex gap-3 text-left",
        variant === "card" &&
          "flex-col items-center rounded-card border border-border bg-surface px-6 py-10 text-center",
        variant === "banner" &&
          "items-start rounded-banner border border-status-fail-bg bg-status-fail-bg/60 px-3.5 py-2.5",
        variant === "plain" && "flex-col items-center px-6 py-8 text-center",
        className,
      )}
      {...props}
    >
      <TriangleAlert
        size={variant === "banner" ? 16 : 22}
        className="shrink-0 text-status-fail-fg"
        aria-hidden
      />
      <div className={cn("flex min-w-0 flex-col gap-1", variant !== "banner" && "items-center")}>
        <p className="text-[14px] font-semibold text-ink">{heading}</p>
        <p className="text-[13px] text-ink-2">{detail}</p>
        {onRetry ? (
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={onRetry} loading={retrying}>
              Retry
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
