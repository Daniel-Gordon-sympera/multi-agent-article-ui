/**
 * Data Sources (`/sources`, mockup §3.10): header → 4 stat tiles → toolbar → table →
 * "Suggested by the finder". Add / Import / Edit / Promote dialogs are mounted per target so
 * their fields start from that record. Viewers see no mutating controls. Polling `calm`.
 */
import { Plus, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useSession } from "@/app/providers/SessionProvider";
import type { Source, Suggestion } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { DataTable, useDataTableControls, type TableControlsPatch } from "@/components/DataTable";
import { PageHeader } from "@/components/PageHeader";
import { ImportCsvDialog } from "./ImportCsvDialog";
import type { SourcesSearch } from "./searchSchema";
import { sourceColumns } from "./sourceColumns";
import { SourceFormDialog, type SourceFormMode } from "./SourceFormDialog";
import { SourceStatTiles } from "./SourceStatTiles";
import { SourcesToolbar } from "./SourcesToolbar";
import { SuggestionsCard } from "./SuggestionsCard";
import { sourceFiltersFromSearch, useSources, useSuggestions } from "./useSourceQueries";

export interface SourcesPageProps {
  search: SourcesSearch;
  onSearchChange: (patch: Partial<SourcesSearch>) => void;
}

type OpenDialog = { kind: "import" } | { kind: "form"; key: string; form: SourceFormMode } | null;

export function SourcesPage({ search, onSearchChange }: SourcesPageProps) {
  const { can } = useSession();
  const canOperate = can("operate");
  const filters = useMemo(() => sourceFiltersFromSearch(search), [search]);
  const sources = useSources(filters);
  const isDefaultView =
    !search.q &&
    !search.state &&
    !search.county &&
    !search.industry &&
    !search.origin &&
    !search.status;
  const optionRows = useSources({ status: "active" });
  const suggestions = useSuggestions({
    county: search.county,
    state: search.state,
    industry: search.industry,
  });
  const [dialog, setDialog] = useState<OpenDialog>(null);

  const openForm = (key: string, form: SourceFormMode) => setDialog({ kind: "form", key, form });
  const columns = useMemo(
    () =>
      sourceColumns({
        canOperate,
        onEdit: (source: Source) => openForm(`edit-${source.id}`, { mode: "edit", source }),
      }),
    [canOperate],
  );
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: (patch: TableControlsPatch) => onSearchChange(patch),
  });

  const rows = sources.data?.items ?? [];
  const filtered = !isDefaultView;

  return (
    <>
      <PageHeader
        title="Data Sources"
        subtitle="Curated news sites used as seeds, fed by what the finder discovers"
        actions={
          canOperate ? (
            <>
              <Button
                variant="primary"
                onClick={() =>
                  openForm(`add-${Date.now()}`, {
                    mode: "add",
                    defaults: { county: search.county, state_code: search.state },
                  })
                }
              >
                <Plus aria-hidden />
                Add source
              </Button>
              <Button variant="secondary" onClick={() => setDialog({ kind: "import" })}>
                <Upload aria-hidden />
                Import CSV
              </Button>
            </>
          ) : undefined
        }
      />
      <SourceStatTiles
        stats={sources.data?.stats}
        rows={isDefaultView ? rows : optionRows.data?.items}
        loading={sources.isPending}
      />
      <SourcesToolbar
        search={search}
        onSearchChange={onSearchChange}
        rows={rows}
        optionRows={optionRows.data?.items ?? rows}
        densityToggle={controls.densityToggleProps}
        columnChooser={controls.columnChooserProps}
      />
      <DataTable
        ariaLabel="Data sources"
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        minWidth={900}
        rowHeight={64}
        isLoading={sources.isPending}
        error={sources.error}
        onRetry={() => void sources.refetch()}
        emptyTitle={filtered ? "No sources match these filters" : "No sources yet"}
        emptyDescription={
          filtered
            ? "Clear a filter, or switch Status to see removed sources."
            : "Add a news site, import a CSV or promote one of the finder's suggestions below."
        }
        {...controls.tableProps}
      />
      <SuggestionsCard
        suggestions={suggestions.data}
        isLoading={suggestions.isPending}
        error={suggestions.error}
        onRetry={() => void suggestions.refetch()}
        canOperate={canOperate}
        onPromote={(suggestion: Suggestion) =>
          openForm(`promote-${suggestion.domain}-${suggestion.county}`, {
            mode: "promote",
            suggestion,
          })
        }
      />
      {dialog?.kind === "form" ? (
        <SourceFormDialog
          key={dialog.key}
          open
          onOpenChange={(open) => (open ? undefined : setDialog(null))}
          form={dialog.form}
        />
      ) : null}
      {dialog?.kind === "import" ? (
        <ImportCsvDialog open onOpenChange={(open) => (open ? undefined : setDialog(null))} />
      ) : null}
    </>
  );
}
