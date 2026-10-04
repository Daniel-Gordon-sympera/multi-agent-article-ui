import { createFileRoute, Outlet } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { SettingsTabs } from "@/features/settings/SettingsTabs";

function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" subtitle="Operations, access and platform configuration" />
      <SettingsTabs />
      <Outlet />
    </>
  );
}

export const Route = createFileRoute("/_app/settings")({
  component: SettingsLayout,
});
