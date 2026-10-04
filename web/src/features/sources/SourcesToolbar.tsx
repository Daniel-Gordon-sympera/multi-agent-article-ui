/**
 * Toolbar of Data Sources (mockup §3.10): search "Search name or domain", State, County,
 * Industry, Origin, Status (default active) and, at the right, density, columns and
 * "Export CSV" of the loaded rows.
 */
import { Download } from "lucide-react";
import type { Source } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { ColumnChooser, DensityToggle } from "@/components/DataTable";
import type { ColumnChooserProps, DensityToggleProps } from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { SearchInput } from "@/components/SearchInput";
import type { SourcesSearch } from "./searchSchema";
import {
  exportSourcesCsv,
  sourceCountyOptions,
  sourceIndustryOptions,
  sourceStateOptions,
} from "./sourcePresentation";

export interface SourcesToolbarProps {
  search: SourcesSearch;
  onSearchChange: (patch: Partial<SourcesSearch>) => void;
  rows: readonly Source[];
  /** Rows used for the filter option lists (the unfiltered active list when available). */
  optionRows: readonly Source[];
  densityToggle: DensityToggleProps;
  columnChooser: ColumnChooserProps;
}

const ORIGIN_OPTIONS = toOptions(["manual", "finder", "csv"]);
const STATUS_OPTIONS = toOptions(["active", "removed", "all"]);

export function SourcesToolbar({
  search,
  onSearchChange,
  rows,
  optionRows,
  densityToggle,
  columnChooser,
}: SourcesToolbarProps) {
  const states = sourceStateOptions(optionRows);
  const counties = sourceCountyOptions(optionRows, search.state);
  const industries = sourceIndustryOptions(optionRows);
  return (
    <FilterBar
      label="Source filters"
      tools={
        <>
          <DensityToggle {...densityToggle} />
          <ColumnChooser {...columnChooser} />
          <Button
            variant="secondary"
            size="sm"
            onClick={() => exportSourcesCsv(rows)}
            disabled={rows.length === 0}
            aria-label="Export CSV of the listed sources"
          >
            <Download aria-hidden />
            Export CSV
          </Button>
        </>
      }
    >
      <SearchInput
        label="Search name or domain"
        width={260}
        value={search.q}
        onValueChange={(q) => onSearchChange({ q })}
      />
      <FilterSelect
        label="State"
        width={110}
        value={search.state}
        options={toOptions(states)}
        onValueChange={(state) => onSearchChange({ state, county: undefined })}
      />
      <FilterSelect
        label="County"
        width={130}
        value={search.county}
        options={toOptions(counties)}
        onValueChange={(county) => onSearchChange({ county })}
      />
      <FilterSelect
        label="Industry"
        width={140}
        value={search.industry}
        options={toOptions(industries)}
        onValueChange={(industry) => onSearchChange({ industry })}
      />
      <FilterSelect
        label="Origin"
        width={120}
        value={search.origin}
        options={ORIGIN_OPTIONS}
        onValueChange={(origin) =>
          onSearchChange({ origin: origin as SourcesSearch["origin"] | undefined })
        }
      />
      <FilterSelect
        label="Status"
        width={130}
        allLabel={null}
        value={search.status ?? "active"}
        options={STATUS_OPTIONS}
        onValueChange={(status) =>
          onSearchChange({
            status: status === "active" ? undefined : (status as SourcesSearch["status"]),
          })
        }
      />
    </FilterBar>
  );
}
