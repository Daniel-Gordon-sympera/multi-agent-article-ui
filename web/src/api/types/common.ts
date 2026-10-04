/** Shapes shared by every pipeline and BFF endpoint (engineering contract §1, §4.3). */

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** Every list answers `{items, next_cursor}`; cursors are opaque and bound to the filters. */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

/** Keyset paging inputs: `?limit=1..1000&after=<cursor>`. */
export interface PageParams {
  limit?: number;
  after?: string | null;
}

/** RFC 9457 problem document with the backend's stable `error_category`. */
export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  error_category: string;
  errors?: unknown;
  [extra: string]: unknown;
}

export type IsoDateTime = string;
export type IsoDate = string;
export type Uuid = string;
