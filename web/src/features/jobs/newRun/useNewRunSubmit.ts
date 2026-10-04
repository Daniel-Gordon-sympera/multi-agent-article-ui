/**
 * Mutations of the New run form: create a batch (fan-out), retry one failed leg, run a Scout,
 * save a Scout (PATCH) or create one without running. Successes toast and navigate to Runs;
 * partial failures open the result dialog.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { createBatch, createScout, runScout, updateScout } from "@/api/bff";
import { qk } from "@/api/keys";
import type { Batch, BatchInput, BatchJob, ScoutInput } from "@/api/types/bff";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";
import { pluralize } from "@/lib/format";
import { failedLegs } from "./newRunSchema";

export function useNewRunSubmit() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [result, setResult] = useState<Batch | null>(null);
  const [lastInput, setLastInput] = useState<BatchInput | null>(null);
  const [retryingPosition, setRetryingPosition] = useState<number | null>(null);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.all });
    await queryClient.invalidateQueries({ queryKey: ["app", "batches"] });
    await queryClient.invalidateQueries({ queryKey: qk.app.scouts() });
    await queryClient.invalidateQueries({ queryKey: ["app", "jobs", "progress"] });
  };

  const announce = (batch: Batch, saved: boolean) => {
    const failed = failedLegs(batch);
    const created = batch.jobs.length - failed.length;
    if (failed.length > 0) {
      setResult(batch);
      toast.warning(`${created} of ${batch.jobs.length} jobs created`, {
        description: "Retry the failed legs from the dialog.",
      });
      return;
    }
    toast.success(`Created ${pluralize(created, "job")}`, {
      description: saved
        ? `Saved as Scout ${batch.scout_name ?? ""}; the runs share batch ${batch.id.slice(0, 8)}.`
        : `The runs share batch ${batch.id.slice(0, 8)}.`,
    });
    void navigate({
      to: "/jobs",
      search: batch.scout_id ? { scout: batch.scout_id } : {},
    });
  };

  const create = useMutation({
    mutationFn: (input: BatchInput) => createBatch(input),
    onSuccess: (batch, input) => {
      setLastInput(input);
      void invalidate();
      announce(batch, Boolean(input.save_as_scout));
    },
    onError: (error) => toastError(error, "The jobs were not created"),
  });

  const retryLeg = useMutation({
    mutationFn: (leg: BatchJob) => {
      if (!lastInput || !result) throw new Error("Nothing to retry");
      const input: BatchInput = {
        ...lastInput,
        industries: leg.industry ? [leg.industry] : lastInput.industries,
        save_as_scout: undefined,
        scout_id: result.scout_id ?? lastInput.scout_id,
      };
      setRetryingPosition(leg.position);
      return createBatch(input);
    },
    onSuccess: (batch, leg) => {
      const replacement = batch.jobs[0];
      setResult((current) =>
        current && replacement
          ? {
              ...current,
              jobs: current.jobs.map((row) =>
                row.position === leg.position ? { ...replacement, position: row.position } : row,
              ),
            }
          : current,
      );
      void invalidate();
      if (replacement?.job_id && !replacement.error) toast.success("Job created");
      else toastError(new Error(replacement?.error ?? "no job id returned"), "Still failing");
    },
    onError: (error) => toastError(error, "The retry failed"),
    onSettled: () => setRetryingPosition(null),
  });

  const run = useMutation({
    mutationFn: (scoutId: string) => runScout(scoutId),
    onSuccess: (batch) => {
      void invalidate();
      announce(batch, false);
    },
    onError: (error) => toastError(error, "The Scout was not run"),
  });

  const save = useMutation({
    mutationFn: ({ scoutId, input }: { scoutId: string; input: Partial<ScoutInput> }) =>
      updateScout(scoutId, input),
    onSuccess: (scout) => {
      void queryClient.invalidateQueries({ queryKey: qk.app.scouts() });
      queryClient.setQueryData(qk.app.scout(scout.id), scout);
      toast.success("Scout saved", { description: scout.name });
    },
    onError: (error) => toastError(error, "The Scout was not saved"),
  });

  const createOnly = useMutation({
    mutationFn: (input: ScoutInput) => createScout(input),
    onSuccess: (scout) => {
      void queryClient.invalidateQueries({ queryKey: qk.app.scouts() });
      toast.success("Scout saved", { description: `${scout.name} is ready to run from Scouts.` });
      void navigate({ to: "/jobs/scouts" });
    },
    onError: (error) => toastError(error, "The Scout was not saved"),
  });

  const pending = create.isPending || run.isPending || save.isPending || createOnly.isPending;

  return {
    create,
    retryLeg,
    run,
    save,
    createOnly,
    pending,
    result,
    closeResult: () => setResult(null),
    retryingPosition,
  };
}
