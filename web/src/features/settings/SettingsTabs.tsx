/**
 * Settings tabs — mockup §3.11: API keys · Workers & health · Stats & costs · Exports · System ·
 * Preferences, plus Users for admins (contract §4.3 `/app/users`).
 */
import { useSession } from "@/app/providers/SessionProvider";
import { TabLink, Tabs } from "@/components/Tabs";

const SETTINGS_TABS = [
  { to: "/settings/keys", label: "API keys" },
  { to: "/settings/workers", label: "Workers & health" },
  { to: "/settings/stats", label: "Stats & costs" },
  { to: "/settings/exports", label: "Exports" },
  { to: "/settings/system", label: "System" },
  { to: "/settings/preferences", label: "Preferences" },
] as const;

export function SettingsTabs() {
  const { can } = useSession();
  return (
    <Tabs label="Settings sections">
      {SETTINGS_TABS.map((tab) => (
        <TabLink key={tab.to} to={tab.to}>
          {tab.label}
        </TabLink>
      ))}
      {can("operate") ? <TabLink to="/settings/access-policies">Website access</TabLink> : null}
      {can("admin") ? <TabLink to="/settings/users">Users</TabLink> : null}
    </Tabs>
  );
}
