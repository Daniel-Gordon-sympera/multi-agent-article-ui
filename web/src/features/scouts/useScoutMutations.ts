/** Run (fan-out) and archive mutations of a Scout: invalidation + toasts with a runs link. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { deleteScout, runScout } from "@/api/bff";
import { qk } from "@/api/keys";
import type { Batch, ScoutWithRuns } from "@/api/types/bff";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";
import { runsOfScoutSearch } from "./scoutLinks";

export function describeBatch(batch: Batch): { created: number; failed: number } {
  const created = batch.jobs.filter((leg) => leg.job_id).length;
  return { created, failed: batch.jobs.length - created };
}

export function useScoutMutations() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.app.scouts() });
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.all });
    await queryClient.invalidateQueries({ queryKey: ["app", "batches"] });
  };

  const run = useMutation({
    mutationFn: (scout: ScoutWithRuns) => runScout(scout.id),
    onSuccess: (batch, scout) => {
      const { created, failed } = describeBatch(batch);
      const jobsWord = created === 1 ? "job" : "jobs";
      toast.success(`${scout.name} · run ${batch.run_number ?? ""}`.trim(), {
        description: failed
          ? `${created} ${jobsWord} created, ${failed} ${failed === 1 ? "leg" : "legs"} rejected by the API.`
          : `${created} ${jobsWord} created. They are listed under Runs.`,
        action: {
          label: "View runs",
          onClick: () => void navigate({ to: "/jobs", search: runsOfScoutSearch(scout.id) }),
        },
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The Scout did not run"),
  });

  const archive = useMutation({
    mutationFn: (scout: ScoutWithRuns) => deleteScout(scout.id),
    onSuccess: (_result, scout) => {
      toast.success(`${scout.name} archived`, {
        description: "Its runs stay listed under Runs.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The Scout was not archived"),
  });

  return { run, archive };
}
