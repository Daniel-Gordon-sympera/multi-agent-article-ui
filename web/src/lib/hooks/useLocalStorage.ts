/** JSON-in-localStorage state with a validator so corrupted values fall back to the default. */
import { useCallback, useState } from "react";

export function readLocalStorage<T>(
  key: string,
  validate: (value: unknown) => value is T,
  fallback: T,
): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const parsed: unknown = JSON.parse(raw);
    return validate(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocalStorage(key: string, value: unknown): void {
  try {
    if (value === undefined) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage may be unavailable; state stays in memory.
  }
}

export function useLocalStorage<T>(
  key: string,
  fallback: T,
  validate: (value: unknown) => value is T,
): [T, (next: T | ((current: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => readLocalStorage(key, validate, fallback));
  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (c: T) => T)(current) : next;
        writeLocalStorage(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set];
}
