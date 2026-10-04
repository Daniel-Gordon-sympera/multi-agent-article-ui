import type { ColumnDef } from "@tanstack/react-table";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { renderWithProviders } from "@/test/render";
import { useState } from "react";
import type { DensityPreference } from "@/api/types/bff";

interface Row {
  id: string;
  name: string;
  count: number;
}

const columns: ColumnDef<Row, unknown>[] = [
  { id: "name", accessorKey: "name", header: "Name", meta: { hideable: false } },
  { id: "count", accessorKey: "count", header: "Count", meta: { align: "right" } },
  {
    id: "extra",
    accessorFn: (row) => `${row.name}!`,
    header: "Extra",
    meta: { defaultHidden: true },
  },
];

const rows: Row[] = [
  { id: "a", name: "Alpha", count: 3 },
  { id: "b", name: "Beta", count: 12 },
];

function Harness() {
  const [search, setSearch] = useState<{ density?: DensityPreference; cols?: string[] }>({});
  const controls = useDataTableControls({
    columns,
    density: search.density,
    cols: search.cols,
    onChange: (patch) => setSearch((current) => ({ ...current, ...patch })),
  });
  return (
    <>
      <DensityToggle {...controls.densityToggleProps} />
      <ColumnChooser {...controls.columnChooserProps} />
      <DataTable
        columns={columns}
        data={rows}
        ariaLabel="Things"
        getRowId={(row) => row.id}
        minWidth={600}
        {...controls.tableProps}
        pagination={{
          showing: { from: 1, to: 2, total: 12 },
          hasNext: true,
          hasPrev: false,
          onNext: () => undefined,
          onPrev: () => undefined,
          noun: "thing",
        }}
      />
    </>
  );
}

describe("DataTable", () => {
  it("renders rows, right-aligned numeric cells and the pagination footer", async () => {
    await renderWithProviders(<Harness />);
    const table = screen.getByRole("table", { name: "Things" });
    expect(within(table).getAllByRole("row")).toHaveLength(3);
    expect(within(table).getByText("12")).toHaveClass("text-right");
    expect(screen.getByText("Showing 1–2 of 12 things")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Previous/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Next/ })).toBeEnabled();
    expect(table).toHaveStyle({ minWidth: "600px" });
  });

  it("shows the empty state and the loading skeleton", async () => {
    const { rerender } = await renderWithProviders(
      <DataTable columns={columns} data={[]} ariaLabel="Empty" emptyTitle="No rows yet" />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("No rows yet");
    rerender(
      <DataTable columns={columns} data={undefined} ariaLabel="Empty" isLoading skeletonRows={3} />,
    );
    const table = screen.getByRole("table", { name: "Empty" });
    expect(table).toHaveAttribute("aria-busy", "true");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(3);
  });

  it("shows the error state with a retry button", async () => {
    let retried = false;
    await renderWithProviders(
      <DataTable
        columns={columns}
        data={undefined}
        ariaLabel="Broken"
        error={new Error("boom")}
        onRetry={() => (retried = true)}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retried).toBe(true);
  });

  it("toggles a column from the chooser and the density from the toggle", async () => {
    const user = userEvent.setup();
    await renderWithProviders(<Harness />);
    expect(screen.queryByRole("columnheader", { name: "Extra" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Choose columns" }));
    const extra = await screen.findByRole("checkbox", { name: "Extra" });
    await user.click(extra);
    expect(await screen.findByRole("columnheader", { name: "Extra" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Name" })).toBeNull();

    const toggle = screen.getByRole("button", { name: "Toggle density" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("table", { name: "Things" }).closest(".data-table")).toHaveAttribute(
      "data-density",
      "compact",
    );
  });
});
