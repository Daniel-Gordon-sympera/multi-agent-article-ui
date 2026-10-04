/** A Settings tab body: `h2` title (15/700), optional description and right-aligned actions. */
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface SettingsSectionProps {
  id: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SettingsSection({
  id,
  title,
  description,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section aria-labelledby={`${id}-title`} className={cn("flex flex-col gap-4", className)}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id={`${id}-title`} className="text-card-title text-ink">
            {title}
          </h2>
          {description ? <p className="text-[13px] text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2.5">{actions}</div> : null}
      </header>
      {children}
    </section>
  );
}
