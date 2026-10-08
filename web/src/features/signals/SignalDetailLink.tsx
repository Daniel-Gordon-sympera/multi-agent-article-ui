/**
 * A link that opens the signal drawer: it keeps the current route and search and sets
 * `?detail=<mention id>` (contract §7: a signal opens at `…?detail=<mention id>`), so the
 * drawer is URL-bound, shareable and works with the back button.
 */
import { Link } from "@tanstack/react-router";
import type { ComponentProps, ReactNode } from "react";
import { detailParam } from "./signalColumns";

export interface SignalDetailLinkProps extends Omit<ComponentProps<"a">, "href" | "children"> {
  signalId: number | string;
  jobId?: string | null;
  children: ReactNode;
}

type AnySearch = Record<string, unknown>;

export function SignalDetailLink({ signalId, jobId, children, ...props }: SignalDetailLinkProps) {
  return (
    <Link
      to="."
      search={(previous: AnySearch) => ({
        ...previous,
        detail: detailParam(signalId),
        detail_job: jobId ?? undefined,
      })}
      replace={false}
      {...(props as Record<string, unknown>)}
    >
      {children}
    </Link>
  );
}
