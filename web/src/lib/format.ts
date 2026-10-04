/**
 * Formatting helpers — engineering contract §5.3 and the strings drawn in the mockup
 * (mockup-spec §1.4, §3, §4). Every function is pure; callers pass `now` for determinism.
 */

export type TimeDisplay = "utc" | "local";

export interface TimeOptions {
  /** `utc` (default) renders UTC with a " UTC" suffix; `local` renders the browser's zone. */
  timeDisplay?: TimeDisplay;
  /** Reference instant for relative and "Today/Yesterday" wording. */
  now?: Date;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

interface DateParts {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function partsOf(date: Date, timeDisplay: TimeDisplay): DateParts {
  if (timeDisplay === "utc") {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth(),
      day: date.getUTCDate(),
      hours: date.getUTCHours(),
      minutes: date.getUTCMinutes(),
      seconds: date.getUTCSeconds(),
    };
  }
  return {
    year: date.getFullYear(),
    month: date.getMonth(),
    day: date.getDate(),
    hours: date.getHours(),
    minutes: date.getMinutes(),
    seconds: date.getSeconds(),
  };
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

function clock(p: DateParts, withSeconds = false): string {
  const base = `${pad2(p.hours)}:${pad2(p.minutes)}`;
  return withSeconds ? `${base}:${pad2(p.seconds)}` : base;
}

function monthDay(p: DateParts): string {
  return `${MONTHS[p.month] ?? ""} ${p.day}`;
}

function suffix(timeDisplay: TimeDisplay): string {
  return timeDisplay === "utc" ? " UTC" : "";
}

/** "Oct 2, 09:30 UTC" — full date-time, always with month and day. */
export function formatDateTime(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  const timeDisplay = options.timeDisplay ?? "utc";
  const now = options.now ?? new Date();
  const p = partsOf(date, timeDisplay);
  const yearPart = p.year === partsOf(now, timeDisplay).year ? "" : `, ${p.year}`;
  return `${monthDay(p)}${yearPart}, ${clock(p)}${suffix(timeDisplay)}`;
}

/** "Today 11:02" · "Yesterday 16:10" · "Oct 2, 09:30" (mockup Runs › Started column). */
export function formatSmartDateTime(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  const timeDisplay = options.timeDisplay ?? "utc";
  const now = options.now ?? new Date();
  const p = partsOf(date, timeDisplay);
  const n = partsOf(now, timeDisplay);
  const dayIndex = (x: DateParts) => Date.UTC(x.year, x.month, x.day) / 86_400_000;
  const diffDays = dayIndex(n) - dayIndex(p);
  if (diffDays === 0) return `Today ${clock(p)}`;
  if (diffDays === 1) return `Yesterday ${clock(p)}`;
  const yearPart = p.year === n.year ? "" : `, ${p.year}`;
  return `${monthDay(p)}${yearPart}, ${clock(p)}`;
}

/** "Oct 2, 2026" — date only (article dates, revenue rows). Accepts `YYYY-MM-DD` or ISO. */
export function formatDate(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number) as [number, number, number];
    return `${MONTHS[m - 1] ?? ""} ${d}, ${y}`;
  }
  const date = parseDate(value);
  if (!date) return "—";
  const p = partsOf(date, options.timeDisplay ?? "utc");
  return `${monthDay(p)}, ${p.year}`;
}

/** "Oct 2" — short date without year (recent-signals list). */
export function formatShortDate(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [, m, d] = value.split("-").map(Number) as [number, number, number];
    return `${MONTHS[m - 1] ?? ""} ${d}`;
  }
  const date = parseDate(value);
  if (!date) return "—";
  return monthDay(partsOf(date, options.timeDisplay ?? "utc"));
}

/** "11:02:04" — clock with seconds (task rows). */
export function formatClock(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  return clock(partsOf(date, options.timeDisplay ?? "utc"), true);
}

/** The full timestamp used in tooltips: "2026-10-04 11:02:04 UTC" or the local equivalent. */
export function formatFullTimestamp(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  const timeDisplay = options.timeDisplay ?? "utc";
  const p = partsOf(date, timeDisplay);
  const zone =
    timeDisplay === "utc" ? "UTC" : (Intl.DateTimeFormat().resolvedOptions().timeZone ?? "local");
  return `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)} ${clock(p, true)} ${zone}`;
}

/** "just now" · "47 s ago" · "29 min ago" · "3 h ago" · "yesterday" · "2 days ago" · "Oct 2". */
export function formatRelativeTime(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  const now = options.now ?? new Date();
  const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
  if (seconds < 0) return formatFutureTime(-seconds);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  return formatShortDate(date, options);
}

function formatFutureTime(seconds: number): string {
  if (seconds < 60) return `in ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `in ${hours} h ${rest} min` : `in ${hours} h`;
}

/** "in 4 h 31 min" · "in 42 s" — countdown to an instant (deadline, retry). */
export function formatCountdown(
  value: string | Date | null | undefined,
  options: TimeOptions = {},
): string {
  const date = parseDate(value);
  if (!date) return "—";
  const now = options.now ?? new Date();
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (seconds <= 0) return "now";
  return formatFutureTime(seconds);
}

/** "38 s" · "29 min" · "1 h 12 min" · "5 h" — coarse durations (jobs, site runs). */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds))
    return "—";
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "38 s" · "2 m 11 s" · "30 m 00 s" · "1 h 02 m 11 s" — precise durations (task rows). */
export function formatDurationPrecise(totalSeconds: number | null | undefined): string {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds))
    return "—";
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const s = pad2(seconds % 60);
  if (minutes < 60) return `${minutes} m ${s} s`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${pad2(minutes % 60)} m ${s} s`;
}

/** Seconds between two instants; `end` defaults to `now`. */
export function secondsBetween(
  start: string | Date | null | undefined,
  end?: string | Date | null,
  now: Date = new Date(),
): number | null {
  const a = parseDate(start);
  if (!a) return null;
  const b = parseDate(end) ?? now;
  return Math.max(0, (b.getTime() - a.getTime()) / 1000);
}

/** 999 → "999" · 26_300 → "26.3K" · 1_640_000 → "1.6M" · 2_000_000_000 → "2.0B". */
export function formatCompactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs < 1000) return String(Math.round(value));
  const units: Array<[number, string]> = [
    [1e9, "B"],
    [1e6, "M"],
    [1e3, "K"],
  ];
  for (const [limit, unit] of units) {
    if (abs >= limit) return `${(value / limit).toFixed(1)}${unit}`;
  }
  return String(value);
}

/** 1234567 → "1,234,567" — exact integers (counts in tables). */
export function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

/** 21_400_000 → "21.4 MB" · 512 → "512 B" · 0.3 MB stays "0.3 MB". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(1)} ${units[unit] ?? "TB"}`;
}

/** 3.1234 → "$3.12" · null → "—" · 14.2 → "$14.20". */
export function formatMoney(
  value: number | null | undefined,
  options: { signed?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : options.signed && value > 0 ? "+" : "";
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/** 0.92 → "0.92" — confidence scores keep two decimals. */
export function formatScore(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : value;
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

/** 0.13 → "13%" (ratio input) · 13 → "13%" when `isPercent`. */
export function formatPercent(value: number | null | undefined, isPercent = false): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const pct = isPercent ? value : value * 100;
  return `${Math.round(pct)}%`;
}

/** "0192f1c2-7e0a-…" → "0192f1c2" — the 8-char short id drawn everywhere. */
export function shortId(id: string | null | undefined): string {
  if (!id) return "—";
  return id.slice(0, 8);
}

/** "Orange" + "FL" → "Orange County, FL" (title of a job; mockup §3.2). */
export function formatLocation(
  county: string | null | undefined,
  stateCode: string | null | undefined,
): string {
  const c = (county ?? "").trim();
  const s = (stateCode ?? "").trim().toUpperCase();
  const countyPart = c ? (/county$/i.test(c) ? c : `${c} County`) : "";
  if (countyPart && s) return `${countyPart}, ${s}`;
  return countyPart || s || "—";
}

/** "5 / 5" — a ratio of counts; "—" when both are missing. */
export function formatRatio(
  done: number | null | undefined,
  total: number | null | undefined,
): string {
  if ((done === null || done === undefined) && (total === null || total === undefined)) return "—";
  return `${done ?? 0} / ${total ?? 0}`;
}

/** Pluralises a noun: (1, "run") → "1 run"; (3, "run") → "3 runs"; irregulars via `plural`. */
export function pluralize(count: number, noun: string, plural?: string): string {
  const word = count === 1 ? noun : (plural ?? `${noun}s`);
  return `${formatInteger(count)} ${word}`;
}
