import { createFileRoute } from "@tanstack/react-router";
import { EventsTab } from "@/features/jobs/events/EventsTab";
import { useTabHandlers } from "@/features/jobs/shared/useTabHandlers";
import { eventsTabSearchSchema, type EventsTabSearch } from "@/features/jobs/tabSearchSchemas";

function JobEventsTab() {
  const { jobId } = Route.useParams();
  const search = Route.useSearch();
  const handlers = useTabHandlers<EventsTabSearch>(Route.useNavigate());
  return <EventsTab jobId={jobId} search={search} {...handlers} />;
}

export const Route = createFileRoute("/_app/jobs/$jobId/events")({
  validateSearch: eventsTabSearchSchema,
  component: JobEventsTab,
});
