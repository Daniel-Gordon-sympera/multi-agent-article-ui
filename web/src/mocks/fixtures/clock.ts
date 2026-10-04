/**
 * Fixture clock: timestamps are relative to the moment the mocks load so "29 min ago" stays
 * true in dev and e2e. Tests never assert on absolute times.
 */
export const NOW = new Date();

const iso = (date: Date): string => date.toISOString();

export function secondsAgo(seconds: number): string {
  return iso(new Date(NOW.getTime() - seconds * 1000));
}

export function minutesAgo(minutes: number): string {
  return secondsAgo(minutes * 60);
}

export function hoursAgo(hours: number): string {
  return secondsAgo(hours * 3600);
}

export function daysAgo(days: number, hour = 10, minute = 0): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  d.setUTCHours(hour, minute, 0, 0);
  return iso(d);
}

export function inSeconds(seconds: number): string {
  return iso(new Date(NOW.getTime() + seconds * 1000));
}

export function addSeconds(isoDate: string, seconds: number): string {
  return iso(new Date(new Date(isoDate).getTime() + seconds * 1000));
}

/** `YYYY-MM-DD` of `days` days before today (UTC). */
export function dateDaysAgo(days: number): string {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}
