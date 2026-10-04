/**
 * Keys created from this browser, kept in `localStorage` (name, role, created — never the
 * secret). The pipeline API lists keys only after B4 (`api_keys_list`); until then this is the
 * only record of what was created here.
 */
import { useCallback } from "react";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

export const LOCAL_KEYS_STORAGE_KEY = "scout.apiKeys.created";

export interface LocalKeyRecord {
  name: string;
  role: "operator" | "reader";
  created_at: string;
}

export function isLocalKeyList(value: unknown): value is LocalKeyRecord[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof (item as LocalKeyRecord).name === "string" &&
        ((item as LocalKeyRecord).role === "operator" ||
          (item as LocalKeyRecord).role === "reader") &&
        typeof (item as LocalKeyRecord).created_at === "string",
    )
  );
}

export function useLocalKeys() {
  const [keys, setKeys] = useLocalStorage<LocalKeyRecord[]>(
    LOCAL_KEYS_STORAGE_KEY,
    [],
    isLocalKeyList,
  );
  const add = useCallback(
    (record: LocalKeyRecord) =>
      setKeys((current) => [...current.filter((k) => k.name !== record.name), record]),
    [setKeys],
  );
  const remove = useCallback(
    (name: string) => setKeys((current) => current.filter((k) => k.name !== name)),
    [setKeys],
  );
  return { keys, add, remove };
}
