/**
 * Settings › Exports: dataset exports (operators) tracked per browser, and where the per-job CSVs
 * live (the job header's Export menu — `GET /v1/jobs/{id}/export/{table}.csv`, any role).
 */
import { Link } from "@tanstack/react-router";
import { useSession } from "@/app/providers/SessionProvider";
import { NoteBanner } from "@/components/NoteBanner";
import { TextLink } from "@/components/TextLink";
import { SettingsSection } from "../SettingsSection";
import { DatasetExportForm } from "./DatasetExportForm";
import { ExportsTable } from "./ExportsTable";
import { useLocalExports } from "./localExports";

export function ExportsPage() {
  const { can } = useSession();
  const local = useLocalExports();
  return (
    <SettingsSection
      id="settings-exports"
      title="Exports"
      description="Dataset exports span jobs and are built asynchronously; per-job CSVs download instantly from the job itself."
    >
      <NoteBanner
        action={
          <TextLink asChild chevron>
            <Link to="/jobs">Open a job</Link>
          </TextLink>
        }
      >
        Per-job CSVs (sources, site ranking, chosen seeds, sections, pages, links, articles,
        summaries, companies, signals, company flags) are one click away in the job header's{" "}
        <strong>Export CSV</strong> menu — every role may download them.
      </NoteBanner>
      {can("operate") ? (
        <DatasetExportForm
          onCreated={(created, tables) =>
            local.add({
              id: created.export_id,
              created_at: new Date().toISOString(),
              tables,
              scope: "dataset",
            })
          }
        />
      ) : (
        <NoteBanner tone="warn">
          Dataset exports need the operator role; viewers can still download per-job CSVs and follow
          exports started earlier from this browser.
        </NoteBanner>
      )}
      <div className="flex flex-col gap-2">
        <h3 className="text-card-title text-ink">Exports started from this browser</h3>
        <p className="text-[13px] text-muted">
          The pipeline API has no export list; ids are remembered here and polled every 5 s while
          queued or running. Downloads expire with the artifact store's retention.
        </p>
        <ExportsTable exports={local.exports} onForget={local.remove} />
      </div>
    </SettingsSection>
  );
}
