/**
 * Job detail tabs — mockup §3.5: results tabs (Overview · Signals · Companies · Summaries ·
 * Articles) │ operations tabs (Site runs · Sections · Tasks · Events) with count badges from the
 * job's progress counters.
 */
import type { JobProgress } from "@/api/types/jobs";
import { TabLink, Tabs, TabsDivider } from "@/components/Tabs";

export interface JobTabsProps {
  jobId: string;
  progress?: Partial<JobProgress> | null;
}

export function JobTabs({ jobId, progress }: JobTabsProps) {
  const params = { jobId };
  return (
    <Tabs>
      <TabLink
        to="/jobs/$jobId"
        params={params}
        activeOptions={{ exact: true, includeSearch: false }}
      >
        Overview
      </TabLink>
      <TabLink to="/jobs/$jobId/signals" params={params} count={progress?.signals}>
        Signals
      </TabLink>
      <TabLink to="/jobs/$jobId/companies" params={params} count={progress?.companies}>
        Companies
      </TabLink>
      <TabLink to="/jobs/$jobId/summaries" params={params} count={progress?.summaries}>
        Summaries
      </TabLink>
      <TabLink to="/jobs/$jobId/articles" params={params} count={progress?.articles}>
        Articles
      </TabLink>
      <TabsDivider />
      <TabLink to="/jobs/$jobId/site-runs" params={params} count={progress?.seeds}>
        Site runs
      </TabLink>
      <TabLink to="/jobs/$jobId/sections" params={params} count={progress?.sections}>
        Sections
      </TabLink>
      <TabLink to="/jobs/$jobId/tasks" params={params} count={progress?.tasks_running}>
        Tasks
      </TabLink>
      <TabLink to="/jobs/$jobId/events" params={params}>
        Events
      </TabLink>
    </Tabs>
  );
}
