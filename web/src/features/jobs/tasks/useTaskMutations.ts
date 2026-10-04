/**
 * Task mutations: retry one dead task (`POST /v1/tasks/{id}/retry`) and "Retry all dead"
 * (`POST /app/jobs/{id}/retry-dead`). Both re-queue optimistically, invalidate the job's task
 * list, detail and progress, and toast the outcome.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { retryDeadTasks } from "@/api/bff";
import { qk } from "@/api/keys";
import { retryTask } from "@/api/pipeline";
import type { Task } from "@/api/types/tasks";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";
import { pluralize } from "@/lib/format";

export function useTaskMutations(jobId: string) {
  const queryClient = useQueryClient();

  const markQueued = (taskIds: readonly number[]) => {
    const ids = new Set(taskIds);
    queryClient.setQueriesData<Task[]>(
      { queryKey: qk.v1.jobs.sub(jobId, "tasks"), exact: false },
      (current) =>
        Array.isArray(current)
          ? current.map((task) =>
              ids.has(task.id)
                ? { ...task, status: "queued", attempts: 0, last_error: null, error_category: null }
                : task,
            )
          : current,
    );
  };

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.sub(jobId, "tasks") });
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.detail(jobId) });
    await queryClient.invalidateQueries({ queryKey: qk.v1.jobs.summary(jobId) });
    await queryClient.invalidateQueries({ queryKey: qk.app.attention() });
  };

  const retryOne = useMutation({
    mutationFn: (taskId: number) => retryTask(taskId),
    onSuccess: (result) => {
      markQueued([result.task_id]);
      toast.success(`Task #${result.task_id} re-queued`, {
        description: "Attempts reset to 0; the job returns to analysing.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The task was not retried"),
  });

  const retryAllDead = useMutation({
    mutationFn: () => retryDeadTasks(jobId),
    onSuccess: (result) => {
      markQueued(result.task_ids);
      const skipped = result.skipped_task_ids?.length ?? 0;
      toast.success(
        result.retried
          ? `${pluralize(result.retried, "dead task")} re-queued`
          : "No dead task to retry",
        {
          description: skipped
            ? `${pluralize(skipped, "task")} had already changed state.`
            : undefined,
        },
      );
      void invalidate();
    },
    onError: (error) => toastError(error, "The dead tasks were not retried"),
  });

  return { retryOne, retryAllDead };
}
