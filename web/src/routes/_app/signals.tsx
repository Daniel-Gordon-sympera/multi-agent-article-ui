import { createFileRoute } from "@tanstack/react-router";
import { signalsSearchSchema } from "@/features/signals/searchSchema";
import { SignalsExplorer } from "@/features/signals/SignalsExplorer";

export const Route = createFileRoute("/_app/signals")({
  validateSearch: signalsSearchSchema,
  component: SignalsExplorer,
});
