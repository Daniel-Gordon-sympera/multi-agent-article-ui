/**
 * Signals explorer (`/signals`, mockup §3.8): header actions (Export CSV, Save view, New run),
 * toolbar (search + saved views | density + columns), active-filter chips with "+ Add filter",
 * the materiality strip, the shared SignalsTable on `GET /app/signals` with offset/keyset
 * paging and the URL-bound drawer (`?detail=&detail_job=`).
 */
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Download, Plus, Save } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { crossJobSignalsExportUrl } from "@/api/bff";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import type { TableControlsPatch } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterChips, type FilterChip } from "@/components/FilterChips";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import { cleanSearch } from "@/lib/url";
import { AddFilterPopover, type SearchPatch } from "./AddFilterPopover";
import { SavedViewsControls } from "./SavedViewsControls";
import { SignalDrawer } from "./SignalDrawer";
import { SignalsMaterialityStrip } from "./SignalsMaterialityStrip";
import { SignalsTable, SignalsTableTools } from "./SignalsTable";
import { summaryText } from "./explorerText";
import { SIGNAL_FILTER_KEYS, type SignalsSearch } from "./searchSchema";
import { toCrossJobFilters } from "./signalExport";
import { activeChips } from "./signalFilters";
import { useCrossJobSignals, useCrossJobSignalsSummary } from "./useSignalsQueries";
import { useSignalsTableControls } from "./useSignalsTable";

const ROUTE_ID = "/_app/signals" as const;
const ROUTE_PATH = "/signals" as const;

export function SignalsExplorer() {
  const search = useSearch({ from: ROUTE_ID });
  const navigate = useNavigate({ from: ROUTE_PATH });
  const { can } = useSession();
  const [saveOpen, setSaveOpen] = useState(false);

  const patch = useCallback(
    (changes: Partial<SignalsSearch>, options: { replace?: boolean } = {}) =>
      void navigate({
        search: (previous: SignalsSearch) =>
          cleanSearch({ ...previous, ...changes }) as SignalsSearch,
        replace: options.replace ?? false,
      }),
    [navigate],
  );
  /** Filter changes restart paging, close the drawer and detach the URL from a saved view. */
  const patchFilters = useCallback(
    (changes: SearchPatch & { q?: string | undefined }) =>
      patch({
        ...changes,
        after: undefined,
        view: undefined,
        detail: undefined,
        detail_job: undefined,
      }),
    [patch],
  );
  const onControlsChange = useCallback(
    (controls: TableControlsPatch) => patch({ ...controls }, { replace: true }),
    [patch],
  );

  const filters = useMemo(() => toCrossJobFilters(search), [search]);
  const summary = useCrossJobSignalsSummary(filters);
  const page = useCrossJobSignals(filters, {
    after: search.after,
    onAfterChange: (after) => patch({ after, detail: undefined, detail_job: undefined }),
  });
  const table = useSignalsTableControls({
    route: "explorer",
    density: search.density,
    cols: search.cols,
    onChange: onControlsChange,
  });

  const chips: FilterChip[] = activeChips(search).map((chip) => ({
    key: chip.key,
    label: chip.label,
    description: chip.label,
    onRemove: () => patchFilters(Object.fromEntries(chip.clears.map((k) => [k, undefined]))),
  }));
  const clearAll = () =>
    patchFilters({
      ...Object.fromEntries(SIGNAL_FILTER_KEYS.map((key) => [key, undefined])),
      q: undefined,
    });

  const total = summary.data?.signals ?? null;

  return (
    <>
      <PageHeader
        title="Signals"
        subtitle="Every signal detected across jobs, with the evidence behind it"
        actions={
          <>
            <Button asChild variant="secondary">
              <a href={crossJobSignalsExportUrl(filters)} download="signals.csv">
                <Download aria-hidden />
                Export CSV
              </a>
            </Button>
            <Button variant="secondary" onClick={() => setSaveOpen(true)}>
              <Save aria-hidden />
              Save view
            </Button>
            {can("operate") ? (
              <Button asChild variant="primary">
                <Link to="/jobs/new">
                  <Plus aria-hidden />
                  New run
                </Link>
              </Button>
            ) : null}
          </>
        }
      />
      <FilterBar tools={<SignalsTableTools table={table} />}>
        <SearchInput
          label="Search company, signal, evidence or domain"
          value={search.q}
          onValueChange={(q) => patchFilters({ q })}
          width={320}
        />
        <SavedViewsControls search={search} saveOpen={saveOpen} onSaveOpenChange={setSaveOpen} />
      </FilterBar>
      <FilterChips
        chips={chips}
        addControl={<AddFilterPopover search={search} onApply={patchFilters} />}
        onClearAll={chips.length || search.q ? clearAll : undefined}
        summary={summaryText(summary.data)}
      />
      <SignalsMaterialityStrip
        summary={summary.data}
        loading={summary.isPending}
        dateAfter={search.date_after}
        dateBefore={search.date_before}
      />
      <SignalsTable
        rows={page.items}
        table={table}
        ariaLabel="Signals across jobs"
        isLoading={page.query.isPending}
        error={page.query.error}
        onRetry={() => void page.query.refetch()}
        emptyDescription="Try fewer filters, or launch a run to collect signals."
        pagination={{
          ...page.footer,
          showing: page.footer.showing ? { ...page.footer.showing, total } : null,
          noun: "signal",
        }}
      />
      <SignalDrawer
        rows={page.items}
        detailId={search.detail}
        detailJobId={search.detail_job}
        loading={page.query.isPending}
      />
    </>
  );
}
