/**
 * Keyset pagination exactly as the API does it (engineering contract §5.2, mockup §6.4):
 * "Next" sends `after=next_cursor`; "Previous" walks a client-side cursor stack; the footer
 * shows "Showing a–b" and adds "of N" only when a total is known.
 *
 * The current cursor is URL-bound when the caller passes `after`/`onAfterChange` (every list
 * route keeps `after` in its search params); otherwise it lives in component state.
 */
import {
  keepPreviousData,
  useQuery,
  type QueryKey,
  type UseQueryResult,
} from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { pollingOptions, type PollKind } from "@/api/polling";
import type { Page, PageParams } from "@/api/types/common";

export const DEFAULT_PAGE_SIZE = 50;

export interface KeysetPageOptions<T> {
  /** Query key without the cursor; the hook appends `{after}`. */
  queryKey: QueryKey;
  /** Fetches one page: `(page) => listJobSignals(id, filters, page)`. */
  fetchPage: (page: PageParams) => Promise<Page<T>>;
  limit?: number;
  /** URL-bound cursor (controlled mode). */
  after?: string | undefined;
  onAfterChange?: (after: string | undefined) => void;
  polling?: PollKind;
  enabled?: boolean;
  /** Total count when the BFF or a summary supplies one. */
  total?: number | null;
}

export interface PageFooterState {
  showing: { from: number; to: number; total: number | null } | null;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export interface KeysetPageResult<T> extends PageFooterState {
  query: UseQueryResult<Page<T>>;
  items: T[];
  pageIndex: number;
  nextCursor: string | null;
  reset: () => void;
  /** Spread onto `<DataTable pagination={…}>`. */
  footer: PageFooterState;
}

const storageKey = (queryKey: QueryKey) => `scout.cursors.${JSON.stringify(queryKey)}`;

function readStack(key: string): string[] {
  try {
    const raw = window.sessionStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeStack(key: string, stack: string[]): void {
  try {
    if (stack.length) window.sessionStorage.setItem(key, JSON.stringify(stack));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Storage may be unavailable (private mode); the stack then lives in memory only.
  }
}

/**
 * `useKeysetPage(key, fetcher)` — contract §5.2. `key` identifies the list (resource + filters);
 * `fetcher` receives `{limit, after}`.
 */
export function useKeysetPage<T>(
  queryKey: QueryKey,
  fetchPage: (page: PageParams) => Promise<Page<T>>,
  options: Omit<KeysetPageOptions<T>, "queryKey" | "fetchPage"> = {},
): KeysetPageResult<T> {
  const {
    limit = DEFAULT_PAGE_SIZE,
    polling = "calm",
    enabled = true,
    total = null,
    onAfterChange,
  } = options;
  const controlled = onAfterChange !== undefined;
  const [internalAfter, setInternalAfter] = useState<string | undefined>(options.after);
  const after = controlled ? options.after : internalAfter;
  const setAfter = useCallback(
    (next: string | undefined) => {
      if (onAfterChange) onAfterChange(next);
      else setInternalAfter(next);
    },
    [onAfterChange],
  );

  const serialisedKey = JSON.stringify(queryKey);
  const stackKey = storageKey(queryKey);
  // The stack is keyed by the list identity: a new list (different filters) starts again from
  // the first page without an effect.
  const [stackState, setStackState] = useState<{ key: string; stack: string[] }>(() => ({
    key: serialisedKey,
    stack: readStack(stackKey),
  }));
  const stack = stackState.key === serialisedKey ? stackState.stack : readStack(stackKey);
  const setStack = useCallback(
    (update: (current: string[]) => string[]) => {
      setStackState((current) => {
        const base = current.key === serialisedKey ? current.stack : readStack(stackKey);
        return { key: serialisedKey, stack: update(base) };
      });
    },
    [serialisedKey, stackKey],
  );

  const query = useQuery({
    queryKey: [...queryKey, { after: after ?? null, limit }],
    queryFn: () => fetchPage({ limit, after: after ?? null }),
    placeholderData: keepPreviousData,
    enabled,
    ...pollingOptions(polling, enabled),
  });

  const nextCursor = query.data?.next_cursor ?? null;
  const items = useMemo(() => query.data?.items ?? [], [query.data]);

  const stackIndex = after ? stack.indexOf(after) : -1;
  // A deep link with an unknown cursor counts as "some later page": Previous returns to page 1.
  const pageIndex = after ? (stackIndex >= 0 ? stackIndex + 1 : 1) : 0;

  const onNext = useCallback(() => {
    if (!nextCursor) return;
    setStack((current) => {
      const base = after ? current.slice(0, Math.max(0, current.indexOf(after) + 1)) : [];
      const next = base.includes(nextCursor) ? base : [...base, nextCursor];
      writeStack(stackKey, next);
      return next;
    });
    setAfter(nextCursor);
  }, [after, nextCursor, setAfter, setStack, stackKey]);

  const onPrev = useCallback(() => {
    if (!after) return;
    const index = stack.indexOf(after);
    setAfter(index > 0 ? stack[index - 1] : undefined);
  }, [after, setAfter, stack]);

  const reset = useCallback(() => {
    setStack(() => []);
    writeStack(stackKey, []);
    setAfter(undefined);
  }, [setAfter, setStack, stackKey]);

  const showing = useMemo(() => {
    if (!query.data || items.length === 0) return null;
    const from = pageIndex * limit + 1;
    return { from, to: from + items.length - 1, total };
  }, [items.length, limit, pageIndex, query.data, total]);

  const footer: PageFooterState = {
    showing,
    hasNext: nextCursor !== null,
    hasPrev: pageIndex > 0,
    onNext,
    onPrev,
  };

  return { query, items, pageIndex, nextCursor, reset, footer, ...footer };
}

/** Formats the footer text: "Showing 1–8 of 12 runs" / "Showing 9–16" / "No runs". */
export function formatShowing(
  showing: PageFooterState["showing"],
  noun: string,
  pluralNoun = `${noun}s`,
): string {
  if (!showing) return `No ${pluralNoun}`;
  const count = showing.total ?? null;
  const unit = count === 1 ? noun : pluralNoun;
  const range = `${showing.from}–${showing.to}`;
  return count === null ? `Showing ${range} ${pluralNoun}` : `Showing ${range} of ${count} ${unit}`;
}
