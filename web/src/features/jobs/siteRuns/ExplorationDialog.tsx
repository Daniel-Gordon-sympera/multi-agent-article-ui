/**
 * Exploration dialog — `GET /v1/site-runs/{id}/exploration`: how the Sections agent explored
 * one site (origin, model, prompt, steps, tokens, kept/skipped, outcome, error) with a link to
 * the transcript artifact when one was saved.
 */
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { qk } from "@/api/keys";
import { artifactUrl, getSiteRunExploration } from "@/api/pipeline";
import { pollingOptions } from "@/api/polling";
import type { SiteRun } from "@/api/types/siteRuns";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";
import { KeyValueGrid } from "@/components/KeyValueGrid";
import { RelativeTime } from "@/components/RelativeTime";
import { SkeletonLines } from "@/components/Skeleton";
import { StatusPill } from "@/components/StatusPill";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCompactNumber, formatDuration, secondsBetween } from "@/lib/format";

export interface ExplorationDialogProps {
  run: SiteRun | null;
  onClose: () => void;
}

export function ExplorationDialog({ run, onClose }: ExplorationDialogProps) {
  const exploration = useQuery({
    queryKey: qk.v1.siteRuns.exploration(run?.id ?? ""),
    queryFn: () => getSiteRunExploration(run?.id ?? ""),
    enabled: Boolean(run),
    ...pollingOptions("static"),
  });
  const data = exploration.data;

  return (
    <Dialog open={run !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Exploration · {run?.domain ?? ""}</DialogTitle>
          <DialogDescription>
            How the Sections agent explored this site before discovery started.
          </DialogDescription>
        </DialogHeader>
        {exploration.isPending && run ? <SkeletonLines lines={5} /> : null}
        {exploration.isError ? (
          <ErrorState
            variant="plain"
            error={exploration.error}
            title="No exploration record"
            description="The Sections stage has not recorded an exploration for this site run yet."
          />
        ) : null}
        {data ? (
          <KeyValueGrid
            items={[
              {
                label: "Outcome",
                value: (
                  <StatusPill
                    size="sm"
                    descriptor={{
                      tone:
                        data.outcome === "completed"
                          ? "done"
                          : data.error
                            ? "fail"
                            : data.outcome === "no_sections"
                              ? "neutral"
                              : "warn",
                      label: data.outcome,
                      indicator: "dot",
                    }}
                  />
                ),
              },
              { label: "Origin", value: data.origin, mono: true },
              { label: "Model", value: data.model ?? "— (memory)", mono: true },
              { label: "Prompt version", value: data.prompt_version ?? "—", mono: true },
              { label: "Started", value: <RelativeTime value={data.started_at} mode="datetime" /> },
              {
                label: "Duration",
                value: formatDuration(secondsBetween(data.started_at, data.finished_at)),
              },
              { label: "Steps", value: String(data.steps) },
              {
                label: "Tokens",
                value: `${formatCompactNumber(data.input_tokens)} in · ${formatCompactNumber(data.output_tokens)} out`,
              },
              { label: "Sections kept", value: String(data.kept) },
              { label: "Sections skipped", value: String(data.skipped) },
              {
                label: "Memory source",
                value: data.memory_source ?? "—",
                mono: Boolean(data.memory_source),
              },
              {
                label: "Error",
                value: data.error ? (
                  <span className="font-mono text-[12px] text-status-fail-fg">{data.error}</span>
                ) : (
                  "—"
                ),
              },
            ]}
          />
        ) : null}
        <DialogFooter>
          {data?.transcript_sha ? (
            <Button asChild variant="secondary">
              <a
                href={artifactUrl("transcript", data.transcript_sha)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink aria-hidden />
                Open transcript
              </a>
            </Button>
          ) : null}
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
