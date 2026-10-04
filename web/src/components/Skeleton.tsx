/** Loading placeholder blocks (contract §5.2: skeleton rows while loading). */
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      aria-hidden
      className={cn("animate-pulse rounded-tag bg-border/70", className)}
      {...props}
    />
  );
}

/** A stack of text-like lines, e.g. inside a card while its query loads. */
export function SkeletonLines({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-3.5", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
