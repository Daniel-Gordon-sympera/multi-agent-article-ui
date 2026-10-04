/**
 * Header + tabs shared by `/jobs` (Runs) and `/jobs/scouts` — mockup §3.2/§3.3: title "Jobs",
 * subtitle, `[+ New run]` primary and `[Bookmark New Scout]` secondary, tabs Runs | Scouts with
 * count badges.
 */
import { Link } from "@tanstack/react-router";
import { Bookmark, Plus } from "lucide-react";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/PageHeader";
import { TabLink, Tabs } from "@/components/Tabs";

export interface JobsPageHeaderProps {
  runsCount?: number | null;
  scoutsCount?: number | null;
}

export function JobsPageHeader({ runsCount, scoutsCount }: JobsPageHeaderProps) {
  const { can } = useSession();
  return (
    <>
      <PageHeader
        title="Jobs"
        subtitle="Runs and the saved Scouts that launch them"
        actions={
          can("operate") ? (
            <>
              <Button asChild variant="primary">
                <Link to="/jobs/new">
                  <Plus aria-hidden />
                  New run
                </Link>
              </Button>
              <Button asChild variant="secondary">
                <Link to="/jobs/new" search={{ scoutMode: "save" }}>
                  <Bookmark aria-hidden />
                  New Scout
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />
      <Tabs>
        <TabLink
          to="/jobs"
          activeOptions={{ exact: true, includeSearch: false }}
          count={runsCount ?? undefined}
        >
          Runs
        </TabLink>
        <TabLink to="/jobs/scouts" count={scoutsCount ?? undefined}>
          Scouts
        </TabLink>
      </Tabs>
    </>
  );
}
