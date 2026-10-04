/**
 * Dataset exports started from this browser (`POST /v1/exports` answers only an id; the API has
 * no list route), kept in `localStorage` so the table can poll `GET /v1/exports/{id}`.
 */
import { useCallback } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

export const LOCAL_EXPORTS_STORAGE_KEY = "scout.exports.created";
export const MAX_LOCAL_EXPORTS = 50;

export interface LocalExportRecord {
  id: string;
  created_at: string;
  tables: string[];
  scope: "job" | "dataset";
}

export function isLocalExportList(value: unknown): value is LocalExportRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as LocalExportRecord).id === "string" &&
        typeof (item as LocalExportRecord).created_at === "string" &&
        Array.isArray((item as LocalExportRecord).tables),
    )
  );
}

export function useLocalExports() {
  const [exports, setExports] = useLocalStorage<LocalExportRecord[]>(
    LOCAL_EXPORTS_STORAGE_KEY,
    [],
    isLocalExportList,
  );
  const add = useCallback(
    (record: LocalExportRecord) =>
      setExports((current) =>
        [record, ...current.filter((e) => e.id !== record.id)].slice(0, MAX_LOCAL_EXPORTS),
      ),
    [setExports],
  );
  const remove = useCallback(
    (id: string) => setExports((current) => current.filter((e) => e.id !== id)),
    [setExports],
  );
  return { exports, add, remove };
}
