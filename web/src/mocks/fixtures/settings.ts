/**
 * Static Settings fixtures: the maintenance schedule of mockup §4.7 (results are not exposed
 * by the API, so `last_result` is null), the `/app/system` notes and the health checks.
 */
import type { SystemInfo } from "@/api/types/bff";
import type { MaintenanceSchedule } from "@/api/types/overview";
import { daysAgo } from "./clock";

export const MAINTENANCE_SCHEDULE: MaintenanceSchedule = {
  items: [
    {
      name: "sweep_jobs",
      cadence: "every 60 s",
      description: "Finalises jobs whose tasks are done and enforces deadlines.",
      last_result: null,
    },
    {
      name: "expire_artifacts",
      cadence: "hourly",
      description: "Deletes saved article text and exports past their retention.",
      last_result: null,
    },
    {
      name: "purge_work_items",
      cadence: "daily 03:00 UTC",
      description: "Drops old work-item partitions.",
      last_result: null,
    },
    {
      name: "backup_database",
      cadence: "daily 02:00 UTC",
      description: "Dumps the pipeline database to the artifact store.",
      last_result: null,
    },
    {
      name: "export_dataset",
      cadence: "on demand",
      description: "Builds dataset exports requested through POST /v1/exports.",
      last_result: null,
    },
  ],
  note:
    "Schedule from the pipeline plan; last results are not exposed by the pipeline API yet. " +
    "Check the maintenance worker's logs for outcomes.",
};

export const SYSTEM_NOTES: string[] = [
  "Model prices are not exposed by the pipeline API; costs come from GET /v1/stats/daily and the per-job cost ledger.",
  "Proxy zone and traffic volume are not exposed; the proxy state comes from the workers' proxy_ok / proxy_checked_at columns.",
  "Storage figures (snapshots, backups, disk) are not exposed by the pipeline API.",
  "Maintenance results are not exposed; the schedule is the plan's static table.",
];

export const PIPELINE_CHECKS: SystemInfo["pipeline"]["checks"] = {
  database: true,
  artifact_store: true,
  migrations: true,
};

export const BFF_STARTED_AT = daysAgo(1, 22, 10);
