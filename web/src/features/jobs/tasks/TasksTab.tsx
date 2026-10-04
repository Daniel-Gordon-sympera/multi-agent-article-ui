/**
 * Job › Tasks — mockup §3.7: status count chips (from the loaded tasks), Kind / Status selects,
 * "Show as tree", `[↺ Retry all dead]` (danger-secondary, operators), the task table (rows 52,
 * tree indent from `parent_task_id`), the per-row Details dialog, Retry on dead rows and the
 * amber note banner below the table.
 */
import { RotateCcw } from "lucide-react";
import { useMemo } from "react";
import type { Task } from "@/api/types/tasks";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import {
  ColumnChooser,
  DataTable,
  DensityToggle,
  useDataTableControls,
} from "@/components/DataTable";
import { FilterBar } from "@/components/FilterBar";
import { FilterSelect, toOptions } from "@/components/FilterSelect";
import { NoteBanner } from "@/components/NoteBanner";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TabProps } from "@/features/jobs/shared/tabProps";
import type { TasksTabSearch } from "@/features/jobs/tabSearchSchemas";
import { useAllJobTasks } from "@/features/jobs/useJobResourcePage";
import { useJobDetail } from "@/features/jobs/useJobQueries";
import { useNow } from "@/lib/hooks/useNow";
import { TASK_STATUSES } from "@/lib/status";
import { TaskDetailsDialog } from "./TaskDetailsDialog";
import { TASK_COLUMNS } from "./tasksColumns";
import { TaskStatusCounts } from "./TaskStatusCounts";
import {
  TASK_KINDS,
  TasksColumnContext,
  buildTaskTree,
  flatTaskRows,
  taskStatusCounts,
  type TaskNode,
} from "./taskTree";
import { useTaskMutations } from "./useTaskMutations";

export function TasksTab({ jobId, search, patchFilters, patchTable }: TabProps<TasksTabSearch>) {
  const { can } = useSession();
  const job = useJobDetail(jobId);
  const tasks = useAllJobTasks(jobId, job.data?.status);
  const now = useNow(1000);
  const { retryOne, retryAllDead } = useTaskMutations(jobId);
  const tree = search.layout !== "flat";
  const all = useMemo(() => tasks.data ?? [], [tasks.data]);
  const counts = useMemo(() => taskStatusCounts(all), [all]);
  const openTask = useMemo(
    () => all.find((task) => String(task.id) === search.task) ?? null,
    [all, search.task],
  );

  const filtered = useMemo(
    () =>
      all.filter(
        (task) =>
          (!search.kind || task.kind === search.kind) &&
          (!search.status || task.status === search.status),
      ),
    [all, search.kind, search.status],
  );
  const rows: TaskNode[] = useMemo(
    () => (tree ? buildTaskTree(filtered) : flatTaskRows(filtered)),
    [filtered, tree],
  );
  const retryingId = retryOne.isPending ? (retryOne.variables ?? null) : null;
  const canOperate = can("operate");
  const facts = useMemo(
    () => ({
      now,
      canOperate,
      retryingId,
      onDetails: (task: Task) => patchTable({ task: String(task.id) }),
      onRetry: (task: Task) => retryOne.mutate(task.id),
    }),
    [canOperate, now, patchTable, retryOne, retryingId],
  );
  const controls = useDataTableControls({
    columns: TASK_COLUMNS,
    density: search.density,
    cols: search.cols,
    onChange: patchTable,
  });

  return (
    <div className="flex flex-col gap-4">
      <FilterBar
        tools={
          <>
            <FilterSelect
              label="Kind"
              value={search.kind}
              onValueChange={(kind) => patchFilters({ kind })}
              options={toOptions([...TASK_KINDS])}
              width={150}
            />
            <FilterSelect
              label="Status"
              value={search.status}
              onValueChange={(status) => patchFilters({ status })}
              options={toOptions([...TASK_STATUSES])}
              width={130}
            />
            <div className="flex items-center gap-2 px-1">
              <Checkbox
                id="tasks-show-as-tree"
                checked={tree}
                onCheckedChange={(value) =>
                  patchTable({ layout: value === true ? undefined : "flat" })
                }
              />
              <Label htmlFor="tasks-show-as-tree" className="cursor-pointer font-medium">
                Show as tree
              </Label>
            </div>
            <DensityToggle {...controls.densityToggleProps} />
            <ColumnChooser {...controls.columnChooserProps} />
            {can("operate") ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => retryAllDead.mutate()}
                loading={retryAllDead.isPending}
                disabled={counts.dead === 0}
              >
                <RotateCcw aria-hidden />
                Retry all dead
              </Button>
            ) : null}
          </>
        }
      >
        <TaskStatusCounts
          counts={counts}
          active={search.status}
          onToggle={(status) => patchFilters({ status })}
        />
      </FilterBar>
      <TasksColumnContext.Provider value={facts}>
        <DataTable
          ariaLabel="Tasks of this job"
          columns={TASK_COLUMNS}
          data={rows}
          getRowId={(row) => String(row.task.id)}
          rowHeight={52}
          minWidth={960}
          {...controls.tableProps}
          isLoading={tasks.isPending}
          error={tasks.isError ? tasks.error : undefined}
          onRetry={() => void tasks.refetch()}
          emptyTitle={all.length ? "No tasks match these filters" : "No tasks yet"}
          emptyDescription={
            all.length
              ? "Clear the kind or status filter to see the whole tree."
              : "Tasks are created as the job moves through its stages."
          }
          footerSlot={
            <div className="px-5 py-3 text-[13px] text-muted" aria-live="polite">
              {rows.length === all.length
                ? `${all.length} tasks`
                : `${rows.length} of ${all.length} tasks match`}
              {tree ? " · tree order" : " · sorted by id"}
            </div>
          }
        />
      </TasksColumnContext.Provider>
      <NoteBanner tone="warn">
        Dead tasks stop retrying after max attempts; the job finishes as partial. Retry resets
        attempts to 0 and re-queues the task; the job returns to analysing.
      </NoteBanner>
      <TaskDetailsDialog
        task={openTask}
        onClose={() => patchTable({ task: undefined })}
        canOperate={can("operate")}
        retrying={retryOne.isPending}
        onRetry={(task) => retryOne.mutate(task.id)}
      />
    </div>
  );
}
