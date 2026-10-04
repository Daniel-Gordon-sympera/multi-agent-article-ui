import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/features/auth/meQuery";
import { UsersPage } from "@/features/settings/users/UsersPage";

export const Route = createFileRoute("/_app/settings/users")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me && me.user.role !== "admin") throw redirect({ to: "/settings/workers", replace: true });
  },
  component: UsersPage,
});
