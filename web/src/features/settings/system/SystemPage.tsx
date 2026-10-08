/**
 * Settings › System: `GET /app/system` as KeyValueGrids (BFF, pipeline), the capability table
 * with the B1–B4 explanations, and the notes about what the API does not expose yet.
 */
import { useQueryClient } from "@tanstack/react-query";
import { qk } from "@/api/keys";
import { RefreshCw } from "lucide-react";
import type { SystemInfo } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { Card, CardHeader } from "@/components/Card";
import { ErrorState } from "@/components/ErrorState";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { RelativeTime } from "@/components/RelativeTime";
import { SkeletonLines } from "@/components/Skeleton";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { SettingsSection } from "../SettingsSection";
import { useSystemInfo } from "../useSettingsQueries";
import { CAPABILITY_CATALOG } from "./capabilityCatalog";

function checkValue(value: string | boolean | undefined): string {
  if (value === undefined) return "—";
  if (value === true) return "ok";
  if (value === false) return "failing";
  return value;
}

function SystemCards({ system }: { system: SystemInfo }) {
  const checks = Object.entries(system.pipeline.checks);
  return (
    <>
      <div
        className="grid gap-5"
        style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}
      >
        <Card aria-labelledby="system-bff-title">
          <CardHeader id="system-bff-title" title="Scout BFF" subtitle="this console's server" />
          <KeyValueGrid
            items={[
              { label: "Version", value: system.bff.version, mono: true },
              {
                label: "Migrations head",
                value: system.bff.migrations_head ?? "unknown",
                mono: true,
              },
              {
                label: "Started",
                value: system.bff.started_at ? (
                  <RelativeTime value={system.bff.started_at} mode="datetime" />
                ) : (
                  "—"
                ),
              },
              {
                label: "Capabilities probed",
                value: system.capabilities_probed_at ? (
                  <RelativeTime value={system.capabilities_probed_at} />
                ) : (
                  "not yet"
                ),
              },
            ]}
          />
        </Card>
        <Card aria-labelledby="system-pipeline-title">
          <CardHeader
            id="system-pipeline-title"
            title="Pipeline API"
            subtitle={system.pipeline.url_host}
            aside={
              <StatusPill entity="health" status={system.pipeline.ready ? "ready" : "not_ready"} />
            }
          />
          <KeyValueGrid
            items={[
              { label: "Version", value: system.pipeline.version ?? "unknown", mono: true },
              {
                label: "Prompt version (latest job)",
                value: system.pipeline.prompt_version ?? "no jobs yet",
                mono: true,
              },
              ...checks.map(([name, value]) => ({
                label: `Check · ${name.replace(/_/g, " ")}`,
                value: checkValue(value),
              })),
              { label: "Model prices", value: "not exposed by the API" },
            ]}
          />
        </Card>
      </div>
      <Card aria-labelledby="system-capabilities-title">
        <CardHeader
          id="system-capabilities-title"
          title="Required pipeline routes"
          subtitle="checked against the pipeline API contract; missing routes are reported as unavailable"
        />
        <div className="overflow-x-auto">
          <table
            aria-label="Capabilities"
            className="w-full border-separate border-spacing-0 text-[13px]"
          >
            <thead>
              <tr>
                {["Capability", "Route", "PR", "State", "When present", "When missing"].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-border px-2 pb-2 text-left text-table-head whitespace-nowrap text-muted first:pl-0"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITY_CATALOG.map((cap) => {
                const present = system.capabilities[cap.name] === true;
                return (
                  <tr key={cap.name} className="align-top">
                    <td className="border-b border-border py-2 pr-2 font-mono text-[12px] text-ink">
                      {cap.name}
                    </td>
                    <td className="border-b border-border px-2 py-2 font-mono text-[12px] whitespace-nowrap text-ink-2">
                      {cap.route}
                    </td>
                    <td className="border-b border-border px-2 py-2">
                      <Tag>{cap.pr}</Tag>
                    </td>
                    <td className="border-b border-border px-2 py-2">
                      <StatusPill
                        size="sm"
                        descriptor={
                          present
                            ? { tone: "done", label: "Available", indicator: "dot" }
                            : { tone: "neutral", label: "Not deployed", indicator: "dot" }
                        }
                      />
                    </td>
                    <td className="border-b border-border px-2 py-2 text-ink-2">{cap.unlocks}</td>
                    <td className="border-b border-border px-2 py-2 text-muted">{cap.fallback}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {system.capabilities.probe_error ? (
          <p className="text-[12px] text-status-warn-fg">
            The last probe failed: {system.capabilities.probe_error}
          </p>
        ) : null}
      </Card>
      {system.notes && system.notes.length > 0 ? (
        <Card aria-labelledby="system-notes-title">
          <CardHeader id="system-notes-title" title="Not exposed by the pipeline API yet" />
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-ink-2">
            {system.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </>
  );
}

export function SystemPage() {
  const system = useSystemInfo();
  const client = useQueryClient();
  return (
    <SettingsSection
      id="settings-system"
      title="System"
      description="Versions, readiness checks, prompt version and the required API contract."
      actions={
        <Button
          variant="secondary"
          onClick={() => {
            void system
              .refetch()
              .then(() => client.invalidateQueries({ queryKey: qk.app.capabilities() }));
          }}
          loading={system.isFetching}
        >
          <RefreshCw aria-hidden />
          Refresh
        </Button>
      }
    >
      {system.isPending ? <SkeletonLines lines={6} /> : null}
      {system.error && !system.data ? (
        <ErrorState
          error={system.error}
          title="System information unavailable"
          onRetry={() => void system.refetch()}
        />
      ) : null}
      {system.data ? <SystemCards system={system.data} /> : null}
    </SettingsSection>
  );
}
