/** Cancel / resume mutations for a job: optimistic status, cache invalidation and toasts. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/api/keys";
import { cancelJob, resumeJob } from "@/api/pipeline";
import type { JobDetail, JobStatus, ResumeJobInput } from "@/api/types/jobs";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";

export function useJobMutations(jobId: string) {
  const queryClient = useQueryClient();

  const applyStatus = (status: JobStatus) => {
    queryClient.setQueryData<JobDetail>(qk.v1.jobs.detail(jobId), (current) =>
      current ? { ...current, status } : current,
    );
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.detail(jobId) });
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.summary(jobId) });
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.list() });
  };

  const cancel = useMutation({
    mutationFn: () => cancelJob(jobId),
    onSuccess: (result) => {
      applyStatus(result.status);
      toast.success("Cancelling the run", {
        description: "Running tasks finish their current step, then stop.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The run was not cancelled"),
  });

  const resume = useMutation({
    mutationFn: (input: ResumeJobInput = {}) => resumeJob(jobId, input),
    onSuccess: (result) => {
      applyStatus(result.status);
      toast.success("Run resumed", {
        description: result.task_ids.length
          ? `${result.task_ids.length} tasks re-queued.`
          : undefined,
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The run was not resumed"),
  });

  return { cancel, resume };
}
