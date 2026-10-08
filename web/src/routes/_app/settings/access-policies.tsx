import { createFileRoute } from "@tanstack/react-router";
import { AccessPoliciesPage } from "@/features/settings/accessPolicies/AccessPoliciesPage";

export const Route = createFileRoute("/_app/settings/access-policies")({
  component: AccessPoliciesPage,
});
