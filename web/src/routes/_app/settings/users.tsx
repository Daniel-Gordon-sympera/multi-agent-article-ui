import { createFileRoute, redirect } from "@tanstack/react-router";
import { meQueryOptions } from "@/features/auth/meQuery";
import { LaterPhaseNotice } from "@/features/placeholder/LaterPhaseNotice";

function SettingsUsersPage() {
  return (
    <section aria-labelledby="settings-users-title" className="flex flex-col gap-4">
      <h2 id="settings-users-title" className="text-card-title text-ink">
        Users
      </h2>
      <LaterPhaseNotice screen="User management (create, change role, disable, reset password)" />
    </section>
  );
}

export const Route = createFileRoute("/_app/settings/users")({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me && me.user.role !== "admin") throw redirect({ to: "/settings/workers", replace: true });
  },
  component: SettingsUsersPage,
});
