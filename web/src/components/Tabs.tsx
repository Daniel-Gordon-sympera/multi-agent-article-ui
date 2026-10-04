/**
 * Router-aware tabs — mockup §2.4: `<nav aria-label="Sections">` with a bottom hairline; each
 * tab is a typed router `<Link>` (h40, 14 px) with a 2 px underline when active
 * (`aria-current="page"`), an optional count badge and an optional vertical divider between
 * tab groups (results | operations on the job detail page).
 */
import { createLink, type LinkComponent } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface TabsProps extends ComponentProps<"nav"> {
  label?: string;
}

export function Tabs({ className, label = "Sections", children, ...props }: TabsProps) {
  return (
    <nav
      aria-label={label}
      className={cn("flex flex-wrap items-center gap-5 border-b border-border", className)}
      {...props}
    >
      {children}
    </nav>
  );
}

export function TabsDivider() {
  return <span className="mx-1 h-5 w-px bg-border-strong" aria-hidden />;
}

export interface TabCountProps {
  count: number | string | null | undefined;
}

/** Badge h18, radius 999, 11/600; brand on the active tab, surface-2 on inactive ones. */
export function TabCount({ count }: TabCountProps) {
  if (count === null || count === undefined) return null;
  return (
    <span
      className="inline-flex h-[18px] items-center rounded-pill bg-surface-2 px-1.5 text-[11px] leading-none font-semibold text-muted tabular group-aria-[current=page]:bg-brand-100 group-aria-[current=page]:text-brand-700"
      aria-label={`(${count})`}
    >
      {count}
    </span>
  );
}

interface TabAnchorProps extends ComponentProps<"a"> {
  count?: number | string | null;
  children?: ReactNode;
}

function TabAnchor({ className, count, children, ...props }: TabAnchorProps) {
  return (
    <a
      className={cn(
        "group -mb-px inline-flex h-10 items-center gap-2 border-b-2 border-transparent px-1 text-[14px] font-medium whitespace-nowrap text-ink-2 no-underline outline-none",
        "hover:text-ink hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        "aria-[current=page]:border-brand-600 aria-[current=page]:font-semibold aria-[current=page]:text-brand-700",
        className,
      )}
      {...props}
    >
      {children}
      {count !== undefined ? <TabCount count={count} /> : null}
    </a>
  );
}

const CreatedTabLink = createLink(TabAnchor);

/** `<TabLink to="/jobs/$jobId/signals" params={{jobId}} count={24}>Signals</TabLink>`. */
export const TabLink: LinkComponent<typeof TabAnchor> = (props) => (
  <CreatedTabLink
    preload="intent"
    activeOptions={{ exact: false, includeSearch: false }}
    {...props}
  />
);
