import { createFileRoute } from "@tanstack/react-router";
import { JobSignalsTab } from "@/features/signals/JobSignalsTab";
import { jobSignalsSearchSchema } from "@/features/signals/searchSchema";

export const Route = createFileRoute("/_app/jobs/$jobId/signals")({
  validateSearch: jobSignalsSearchSchema,
  component: JobSignalsTab,
});
