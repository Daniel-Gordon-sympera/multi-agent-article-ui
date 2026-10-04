import { createFileRoute } from "@tanstack/react-router";
import { ApiKeysPage } from "@/features/settings/keys/ApiKeysPage";

export const Route = createFileRoute("/_app/settings/keys")({
  component: ApiKeysPage,
});
