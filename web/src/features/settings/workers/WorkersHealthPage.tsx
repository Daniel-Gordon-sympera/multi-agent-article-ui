/**
 * Settings › Workers & health (mockup §3.11): health tiles → Workers table → Dead tasks by
 * category + Maintenance schedule. The `#<instance_id>` hash (contract §7) highlights a row.
 */
import { useLocation } from "@tanstack/react-router";
import { SectionHeader } from "@/components/Card";
import { DeadTasksByCategoryCard, MaintenanceScheduleCard } from "./DeadTasksAndMaintenance";
import { HealthTiles } from "./HealthTiles";
import {
  useDeadByCategory,
  useMaintenanceSchedule,
  useQueueSummary,
  useSystemInfo,
  useWorkers,
} from "../useSettingsQueries";
import { workersSubtitle } from "./workersFormat";
import { WorkersTable } from "./WorkersTable";

export function WorkersHealthPage() {
  const hash = useLocation({ select: (location) => location.hash });
  const highlighted = hash ? decodeURIComponent(hash.replace(/^#/, "")) : null;
  const system = useSystemInfo();
  const queue = useQueueSummary();
  const workers = useWorkers();
  const dead = useDeadByCategory();
  const maintenance = useMaintenanceSchedule();

  return (
    <div className="flex flex-col gap-5">
      <section aria-label="Health">
        <HealthTiles system={system.data} queue={queue.data} workers={workers.data} />
      </section>
      <section aria-labelledby="workers-title" className="flex flex-col gap-3">
        <SectionHeader
          title={<span id="workers-title">Workers</span>}
          subtitle={workersSubtitle(workers.data)}
        />
        <WorkersTable
          workers={workers.data}
          loading={workers.isPending}
          error={workers.error}
          onRetry={() => void workers.refetch()}
          highlighted={highlighted}
        />
      </section>
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(360px, 100%), 1fr))" }}
      >
        <DeadTasksByCategoryCard
          data={dead.data}
          loading={dead.isPending}
          error={dead.error}
          onRetry={() => void dead.refetch()}
        />
        <MaintenanceScheduleCard
          data={maintenance.data}
          loading={maintenance.isPending}
          error={maintenance.error}
          onRetry={() => void maintenance.refetch()}
        />
      </div>
    </div>
  );
}
