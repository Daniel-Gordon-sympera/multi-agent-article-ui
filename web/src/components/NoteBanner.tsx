/**
 * NoteBanner — mockup §3.3 / §3.7: `role="note"`, info icon, radius 10, padding 10×14;
 * tone brand (brand-100 bg) or warn (amber bg); optional right-aligned link/action.
 */
import { Info } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface NoteBannerProps extends ComponentProps<"div"> {
  tone?: "brand" | "warn";
  action?: ReactNode;
  icon?: ReactNode;
}

export function NoteBanner({
  tone = "brand",
  action,
  icon,
  className,
  children,
  ...props
}: NoteBannerProps) {
  return (
    <div
      role="note"
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-banner px-3.5 py-2.5 text-[13px] text-ink-2",
        tone === "brand" ? "bg-brand-100" : "bg-status-warn-bg",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "mt-px shrink-0 [&>svg]:size-4",
          tone === "brand" ? "text-brand-700" : "text-status-warn-fg",
        )}
        aria-hidden
      >
        {icon ?? <Info size={16} strokeWidth={2} />}
      </span>
      <div className="min-w-0 flex-1 leading-snug">{children}</div>
      {action ? <div className="shrink-0 text-[13px] font-medium">{action}</div> : null}
    </div>
  );
}
