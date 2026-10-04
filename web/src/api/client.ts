/**
 * The one HTTP wrapper of the SPA (engineering contract §5.2): same origin, cookies included,
 * `X-Requested-With: scout` always, `X-CSRF-Token` on unsafe methods, RFC 9457 problems
 * parsed into `ApiError`, ETag/304 handled transparently for the job resources.
 */
import type { Page, PageParams, Problem } from "@/api/types/common";
import { sessionStore } from "@/api/sessionStore";

export class ApiError extends Error {
  readonly status: number;
  readonly category: string;
  readonly detail: string | undefined;
  readonly title: string;
  readonly errors: unknown;
  readonly problem: Problem | null;

  constructor(status: number, problem: Problem | null, fallbackMessage?: string) {
    const detail = problem?.detail ?? fallbackMessage;
    super(detail ?? problem?.title ?? `Request failed with status ${status}`);
    this.name = "ApiError";
    this.status = status;
    this.category = problem?.error_category ?? `http_${status}`;
    this.detail = detail;
    this.title = problem?.title ?? statusTitle(status);
    this.errors = problem?.errors;
    this.problem = problem;
  }

  /** Short operator-facing wording for toasts and inline errors. */
  get userMessage(): string {
    if (this.status === 0)
      return "The server could not be reached. Check your connection and retry.";
    return this.detail ?? this.title;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

function statusTitle(status: number): string {
  switch (status) {
    case 0:
      return "Network error";
    case 401:
      return "Not signed in";
    case 403:
      return "Forbidden";
    case 404:
      return "Not found";
    case 409:
      return "Conflict";
    case 422:
      return "Invalid request";
    case 429:
      return "Too many attempts";
    case 503:
      return "Service unavailable";
    default:
      return `Request failed (${status})`;
  }
}

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export interface FetchJsonInit extends Omit<RequestInit, "body"> {
  /** Serialised as JSON unless it is already a `BodyInit` (FormData, string, Blob). */
  body?: unknown;
  /** Use the ETag cache for this URL (GET only). */
  etag?: boolean;
}

interface EtagEntry {
  etag: string;
  data: unknown;
}

/** URL → last `ETag` + body, so a `304` can be answered from memory. */
const etagCache = new Map<string, EtagEntry>();

export function clearEtagCache(): void {
  etagCache.clear();
}

function isBodyInit(body: unknown): body is BodyInit {
  return (
    typeof body === "string" ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  );
}

function buildHeaders(method: string, init: FetchJsonInit, hasJsonBody: boolean): Headers {
  const headers = new Headers(init.headers);
  headers.set("X-Requested-With", "scout");
  if (!headers.has("Accept")) headers.set("Accept", "application/json, application/problem+json");
  if (hasJsonBody && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (UNSAFE_METHODS.has(method)) {
    const token = sessionStore.getCsrfToken();
    if (token && !headers.has("X-CSRF-Token")) headers.set("X-CSRF-Token", token);
  }
  return headers;
}

async function parseProblem(response: Response): Promise<Problem | null> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("json")) return null;
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "status" in body) return body as Problem;
    if (body && typeof body === "object" && "detail" in body) {
      const partial = body as { detail?: unknown; title?: unknown; error_category?: unknown };
      return {
        type: "about:blank",
        title: typeof partial.title === "string" ? partial.title : statusTitle(response.status),
        status: response.status,
        detail: typeof partial.detail === "string" ? partial.detail : undefined,
        error_category:
          typeof partial.error_category === "string"
            ? partial.error_category
            : `http_${response.status}`,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function notifySession(error: ApiError): void {
  if (error.status === 401 && error.category === "not_authenticated") sessionStore.signedOut();
  if (error.status === 403 && error.category === "password_change_required") {
    sessionStore.passwordChangeRequired();
  }
}

/** Response metadata the typed functions sometimes need (status for 202/200 branching). */
export interface JsonResult<T> {
  data: T;
  status: number;
  headers: Headers;
}

export async function fetchJsonWithMeta<T>(
  input: string,
  init: FetchJsonInit = {},
): Promise<JsonResult<T>> {
  const method = (init.method ?? "GET").toUpperCase();
  const { body, etag, ...rest } = init;
  const hasJsonBody = body !== undefined && !isBodyInit(body);
  const headers = buildHeaders(method, init, hasJsonBody);
  const cached = etag && method === "GET" ? etagCache.get(input) : undefined;
  if (cached) headers.set("If-None-Match", cached.etag);

  let response: Response;
  try {
    response = await fetch(input, {
      ...rest,
      method,
      headers,
      credentials: "include",
      body: body === undefined ? undefined : hasJsonBody ? JSON.stringify(body) : body,
    });
  } catch (cause) {
    throw new ApiError(0, null, cause instanceof Error ? cause.message : "Network error");
  }

  if (response.status === 304 && cached) {
    return { data: cached.data as T, status: 200, headers: response.headers };
  }

  if (!response.ok) {
    const problem = await parseProblem(response);
    const error = new ApiError(response.status, problem);
    notifySession(error);
    throw error;
  }

  if (response.status === 204 || response.headers.get("content-length") === "0") {
    return { data: undefined as T, status: response.status, headers: response.headers };
  }

  const contentType = response.headers.get("content-type") ?? "";
  const data: T = contentType.includes("json")
    ? ((await response.json()) as T)
    : ((await response.text()) as unknown as T);

  const responseEtag = response.headers.get("etag");
  if (etag && method === "GET" && responseEtag) etagCache.set(input, { etag: responseEtag, data });

  return { data, status: response.status, headers: response.headers };
}

/** `fetchJson<T>(url, init?)` — the contract's name; returns the parsed body only. */
export async function fetchJson<T>(input: string, init: FetchJsonInit = {}): Promise<T> {
  const result = await fetchJsonWithMeta<T>(input, init);
  return result.data;
}

export function withQuery(
  path: string,
  params: Record<string, string | number | boolean | null | undefined> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

/** Fetches one keyset page: `{items, next_cursor}` with `?limit=&after=` appended. */
export async function fetchPage<T>(
  url: string,
  page: PageParams = {},
  filters: Record<string, string | number | boolean | null | undefined> = {},
): Promise<Page<T>> {
  const target = withQuery(url, { ...filters, limit: page.limit, after: page.after ?? undefined });
  const result = await fetchJson<Partial<Page<T>>>(target);
  return { items: result.items ?? [], next_cursor: result.next_cursor ?? null };
}

export const apiGet = <T>(url: string, init?: FetchJsonInit) =>
  fetchJson<T>(url, { ...init, method: "GET" });
export const apiPost = <T>(url: string, body?: unknown, init?: FetchJsonInit) =>
  fetchJson<T>(url, { ...init, method: "POST", body });
export const apiPut = <T>(url: string, body?: unknown, init?: FetchJsonInit) =>
  fetchJson<T>(url, { ...init, method: "PUT", body });
export const apiPatch = <T>(url: string, body?: unknown, init?: FetchJsonInit) =>
  fetchJson<T>(url, { ...init, method: "PATCH", body });
export const apiDelete = <T = void>(url: string, init?: FetchJsonInit) =>
  fetchJson<T>(url, { ...init, method: "DELETE" });
