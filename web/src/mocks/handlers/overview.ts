/** `/app/attention` and `/app/estimate` (contract §4.3). */
import { http, HttpResponse } from "msw";
import type { AttentionItem } from "@/api/types/bff";
import { db } from "@/mocks/db";
import { guard } from "@/mocks/lib/session";

export const overviewHandlers = [
  http.get("/app/attention", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    const items: AttentionItem[] = [];
    for (const task of db.tasks.filter((t) => t.status === "dead")) {
      const job = db.jobs.find((j) => j.id === task.job_id);
      items.push({
        kind: "dead_task",
        severity: "fail",
        title: `1 dead task · ${task.kind}`,
        detail: `${task.error_category ?? "error"} · ${job ? `${job.county} County, ${job.state_code} · ${String(job.input.industry ?? job.kind)}` : ""}`,
        href: `/jobs/${task.job_id}/tasks`,
        job_id: task.job_id ?? undefined,
        task_id: task.id,
      });
    }
    for (const job of db.jobs.filter((j) => j.status === "partial")) {
      items.push({
        kind: "partial_job",
        severity: "warn",
        title: "Partial run waiting for a decision",
        detail: `${job.county} County, ${job.state_code} · ${String(job.input.industry ?? "seeds")} · stopped on ${job.stop_reason ?? "unknown"} · resume?`,
        href: `/jobs/${job.id}`,
        job_id: job.id,
      });
    }
    for (const worker of db.workers) {
      const age = (Date.now() - new Date(worker.last_seen).getTime()) / 1000;
      if (age > 30) {
        items.push({
          kind: "slow_worker",
          severity: "warn",
          title: `${worker.instance_id} heartbeat is slow`,
          detail: `last seen ${Math.round(age)} s ago · lease expires in ${Math.max(0, 60 - Math.round(age))} s`,
          href: "/settings/workers",
          instance_id: worker.instance_id,
        });
      }
    }
    return HttpResponse.json({ items });
  }),

  http.get("/app/estimate", ({ request }) => {
    const { error } = guard(request);
    if (error) return error;
    return HttpResponse.json({
      median_cost_usd: 2.95,
      p90_cost_usd: 3.4,
      samples: 10,
      basis: "recent_jobs",
    });
  }),

  http.post("/app/jobs/:jobId/retry-dead", ({ request, params }) => {
    const { error } = guard(request, { minRole: "operator" });
    if (error) return error;
    const dead = db.tasks.filter((t) => t.job_id === params.jobId && t.status === "dead");
    for (const task of dead) {
      task.status = "queued";
      task.attempts = 0;
      task.last_error = null;
      task.error_category = null;
    }
    const job = db.jobs.find((j) => j.id === params.jobId);
    if (job) {
      job.progress.tasks_pending += dead.length;
      job.progress.tasks_dead = 0;
    }
    return HttpResponse.json({ retried: dead.length, task_ids: dead.map((t) => t.id) });
  }),
];
