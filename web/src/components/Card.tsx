/** Card — mockup §1.5: surface, border, radius 12, shadow-card, padding 20; title row with a link slot. */
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("card flex flex-col gap-4 p-5", className)} {...props} />;
}

export interface CardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right-aligned slot: a TextLink, a pill or a LiveDot. */
  aside?: ReactNode;
  className?: string;
  /** Heading level for the title (default h2). */
  as?: "h2" | "h3";
  id?: string;
}

export function CardHeader({
  title,
  subtitle,
  aside,
  className,
  as: Heading = "h2",
  id,
}: CardHeaderProps) {
  return (
    <header className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <Heading id={id} className="text-card-title text-ink">
          {title}
        </Heading>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-3">{aside}</div> : null}
    </header>
  );
}

/** Section title outside a card ("Active runs" + "All jobs ›"). */
export function SectionHeader({
  title,
  aside,
  subtitle,
  className,
}: Omit<CardHeaderProps, "as" | "id">) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-col gap-0.5">
        <h2 className="text-card-title text-ink">{title}</h2>
        {subtitle ? <p className="text-[13px] text-muted">{subtitle}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 items-center gap-3">{aside}</div> : null}
    </div>
  );
}
