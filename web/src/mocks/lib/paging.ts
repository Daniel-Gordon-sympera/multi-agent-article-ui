/**
 * Keyset pagination for the mocks: `after` is the base64 of the last item's id; filters are
 * exact-match query parameters; unknown filters answer `422 unknown_filter` like the backend.
 */
import { problem } from "./problem";

const RESERVED = new Set(["limit", "after"]);

export function encodeCursor(id: string | number): string {
  return btoa(String(id));
}

export function decodeCursor(cursor: string | null): string | null {
  if (!cursor) return null;
  try {
    return atob(cursor);
  } catch {
    return null;
  }
}

export interface PagedResult<T> {
  items: T[];
  next_cursor: string | null;
}

export function paginate<T>(
  items: T[],
  url: URL,
  idOf: (item: T) => string | number,
): PagedResult<T> {
  const limitRaw = Number(url.searchParams.get("limit") ?? 100);
  const limit = Math.min(1000, Math.max(1, Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 100));
  const after = decodeCursor(url.searchParams.get("after"));
  let start = 0;
  if (after !== null) {
    const index = items.findIndex((item) => String(idOf(item)) === after);
    start = index >= 0 ? index + 1 : items.length;
  }
  const page = items.slice(start, start + limit);
  const hasMore = start + limit < items.length;
  const last = page[page.length - 1];
  return {
    items: page,
    next_cursor: hasMore && last !== undefined ? encodeCursor(idOf(last)) : null,
  };
}

/** Returns a 422 response when the URL has a filter the resource does not support. */
export function rejectUnknownFilters(url: URL, allowed: readonly string[]) {
  for (const key of url.searchParams.keys()) {
    if (RESERVED.has(key) || allowed.includes(key)) continue;
    return problem(422, "unknown_filter", `Unknown filter '${key}'`, {
      errors: [{ loc: ["query", key], msg: "unknown filter" }],
    });
  }
  return null;
}

/** Exact-match filtering on string-ish fields. */
export function applyExactFilters<T extends object>(
  items: T[],
  url: URL,
  fields: readonly string[],
): T[] {
  let result = items;
  for (const field of fields) {
    const value = url.searchParams.get(field);
    if (value === null || value === "") continue;
    result = result.filter(
      (item) =>
        String((item as Record<string, unknown>)[field] ?? "").toLowerCase() ===
        value.toLowerCase(),
    );
  }
  return result;
}

/** Stable ETag from a JSON body. */
export function etagOf(value: unknown): string {
  const text = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) | 0;
  return `"${(hash >>> 0).toString(16)}"`;
}

export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
