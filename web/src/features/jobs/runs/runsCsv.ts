/** "Export CSV" of the Runs toolbar: the loaded (filtered) page as a client-side CSV. */
import type { BatchMembership } from "@/api/types/bff";
import type { JobProgressSnapshot } from "@/api/types/jobsProgress";
import type { JobRecord } from "@/api/types/jobs";
import { jobIndustry, jobKindLabel, jobTitle } from "@/features/jobs/jobTitle";
import { downloadText, rowsToCsv, type CsvColumn } from "@/lib/csv";
import { costOf, counterOf, durationOf } from "./runsFacts";

export interface RunsCsvContext {
  progress: Record<string, JobProgressSnapshot>;
  batches: Record<string, BatchMembership>;
}

export function runsCsvColumns(context: RunsCsvContext): CsvColumn<JobRecord>[] {
  const snapshot = (job: JobRecord) => context.progress[job.id];
  return [
    { header: "job_id", value: (job) => job.id },
    { header: "title", value: (job) => jobTitle(job) },
    { header: "kind", value: (job) => jobKindLabel(job.kind) },
    { header: "county", value: (job) => job.county },
    { header: "state", value: (job) => job.state_code },
    { header: "industry", value: (job) => jobIndustry(job) ?? "" },
    { header: "status", value: (job) => job.status },
    { header: "stop_reason", value: (job) => job.stop_reason ?? "" },
    { header: "batch_id", value: (job) => context.batches[job.id]?.batch_id ?? "" },
    { header: "batch_position", value: (job) => context.batches[job.id]?.position ?? "" },
    { header: "scout", value: (job) => context.batches[job.id]?.scout_name ?? "" },
    { header: "sites_done", value: (job) => snapshot(job)?.sites_done ?? "" },
    { header: "sites_total", value: (job) => snapshot(job)?.sites_total ?? "" },
    { header: "articles", value: (job) => counterOf(job, snapshot(job), "articles") ?? "" },
    { header: "signals", value: (job) => counterOf(job, snapshot(job), "signals") ?? "" },
    { header: "cost_usd", value: (job) => costOf(job, snapshot(job)) ?? "" },
    { header: "created_at", value: (job) => job.created_at },
    { header: "started_at", value: (job) => job.started_at ?? "" },
    { header: "finished_at", value: (job) => job.finished_at ?? "" },
    { header: "duration_seconds", value: (job) => durationOf(job, snapshot(job)) ?? "" },
    { header: "prompt_version", value: (job) => job.prompt_version },
    { header: "client_reference", value: (job) => job.client_reference ?? "" },
    { header: "created_by", value: (job) => job.created_by },
  ];
}

export function downloadRunsCsv(rows: readonly JobRecord[], context: RunsCsvContext): void {
  const stamp = new Date().toISOString().slice(0, 10);
  downloadText(`runs-${stamp}.csv`, rowsToCsv(rows, runsCsvColumns(context)));
}
