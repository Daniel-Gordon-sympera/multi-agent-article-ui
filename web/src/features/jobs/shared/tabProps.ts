/** What every Job detail tab receives from its route: the job id and the URL-bound search. */
export interface TabProps<S> {
  jobId: string;
  search: S;
  /** Filter changes (the cursor is dropped so the list starts at page 1). */
  patchFilters: (patch: Partial<S>) => void;
  /** Table state changes (density, columns, cursor, open drawer). */
  patchTable: (patch: Partial<S>) => void;
}
