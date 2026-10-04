import { describe, expect, it } from "vitest";
import {
  deriveStageStates,
  healthStatus,
  isCancellableJobStatus,
  isResumableJobStatus,
  isTerminalJobStatus,
  jobStatus,
  normaliseMateriality,
  siteRunStatus,
  sourceStatus,
  taskStatus,
  workerStatus,
} from "@/lib/status";

const now = new Date("2026-10-04T11:31:00Z");

describe("status maps (contract §5.5)", () => {
  it("maps job statuses to tones and labels", () => {
    expect(jobStatus("queued")).toEqual({ tone: "neutral", label: "Queued", indicator: "dot" });
    expect(jobStatus("analysing")).toMatchObject({ tone: "running", label: "Analysing" });
    expect(jobStatus("finalizing")).toMatchObject({ tone: "running", label: "Finalizing" });
    expect(jobStatus("completed")).toMatchObject({ tone: "done", label: "Completed" });
    expect(jobStatus("partial")).toMatchObject({ tone: "warn" });
    expect(jobStatus("failed")).toMatchObject({
      tone: "fail",
      label: "Failed",
      indicator: "triangle",
    });
    expect(jobStatus("cancelling")).toMatchObject({ tone: "neutral", label: "Cancelling" });
    expect(jobStatus("unexpected_value")).toMatchObject({
      tone: "neutral",
      label: "Unexpected_value",
    });
  });

  it("maps site-run statuses", () => {
    expect(siteRunStatus("finished")).toMatchObject({ tone: "done", label: "Finished" });
    expect(siteRunStatus("no_sections")).toMatchObject({ tone: "neutral", label: "No sections" });
    expect(siteRunStatus("discovering")).toMatchObject({ tone: "running" });
    expect(siteRunStatus("failed")).toMatchObject({ tone: "fail" });
  });

  it("maps task statuses including retry countdown and rejected results", () => {
    const base = { run_after: "2026-10-04T11:31:42Z", result: null };
    expect(taskStatus({ ...base, status: "succeeded" })).toMatchObject({
      tone: "done",
      label: "Succeeded",
    });
    expect(taskStatus({ ...base, status: "running" })).toMatchObject({ tone: "running" });
    expect(taskStatus({ ...base, status: "failed" }, now)).toMatchObject({
      tone: "warn",
      label: "Retry in 42 s",
    });
    expect(taskStatus({ ...base, status: "dead" })).toMatchObject({ tone: "fail", label: "Dead" });
    expect(
      taskStatus({ status: "succeeded", run_after: base.run_after, result: { rejected: true } }),
    ).toMatchObject({ tone: "neutral", label: "Rejected" });
    expect(
      taskStatus({ status: "succeeded", run_after: base.run_after, result: { partial: true } }),
    ).toMatchObject({ tone: "warn", label: "Partial" });
  });

  it("maps worker heartbeats by age", () => {
    expect(workerStatus({ last_seen: "2026-10-04T11:30:58Z", gone_at: null }, now)).toMatchObject({
      tone: "done",
      label: "Healthy",
    });
    expect(workerStatus({ last_seen: "2026-10-04T11:30:13Z", gone_at: null }, now)).toMatchObject({
      tone: "warn",
      label: "Slow heartbeat",
    });
    expect(workerStatus({ last_seen: "2026-10-04T11:20:00Z", gone_at: null }, now)).toMatchObject({
      tone: "fail",
      label: "Missing",
    });
    expect(
      workerStatus({ last_seen: "2026-10-04T11:20:00Z", gone_at: "2026-10-04T11:25:00Z" }, now),
    ).toMatchObject({ tone: "fail", label: "Gone" });
  });

  it("maps sources, health and materiality", () => {
    expect(sourceStatus("active")).toMatchObject({ tone: "done", label: "Active" });
    expect(sourceStatus("removed")).toMatchObject({ tone: "neutral", label: "Removed" });
    expect(healthStatus("ready")).toMatchObject({ tone: "done", label: "Ready" });
    expect(healthStatus("not_ready")).toMatchObject({ tone: "fail" });
    expect(normaliseMateriality("high")).toBe("High");
    expect(normaliseMateriality("nope")).toBeNull();
  });

  it("knows terminal, cancellable and resumable statuses", () => {
    expect(isTerminalJobStatus("completed")).toBe(true);
    expect(isTerminalJobStatus("analysing")).toBe(false);
    expect(isCancellableJobStatus("queued")).toBe(true);
    expect(isCancellableJobStatus("partial")).toBe(false);
    expect(isResumableJobStatus("partial")).toBe(true);
    expect(isResumableJobStatus("analysing")).toBe(false);
  });
});

describe("deriveStageStates", () => {
  it("marks earlier stages done and the running stage current", () => {
    expect(deriveStageStates("analysing")).toEqual(["done", "done", "done", "current", "pending"]);
    expect(deriveStageStates("finding")).toEqual([
      "current",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(deriveStageStates("queued")).toEqual([
      "pending",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("marks all stages done for completed and partial jobs", () => {
    expect(deriveStageStates("completed")).toEqual(["done", "done", "done", "done", "done"]);
    expect(deriveStageStates("partial")).toEqual(["done", "done", "done", "done", "done"]);
  });

  it("pins the failing stage from the stop reason or the progress counters", () => {
    expect(deriveStageStates("failed", { stopReason: "no_sources_found" })).toEqual([
      "failed",
      "pending",
      "pending",
      "pending",
      "pending",
    ]);
    expect(deriveStageStates("failed", { progress: { articles: 12 } })).toEqual([
      "done",
      "done",
      "failed",
      "pending",
      "pending",
    ]);
  });
});
