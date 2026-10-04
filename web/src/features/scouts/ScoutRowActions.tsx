/**
 * Row actions of the Scouts table (mockup §3.3 col. 8): `[▶ Run]` primary sm behind a confirm
 * ("This will create N jobs for …"), `[Edit]` secondary sm → `/jobs/new?scout=`, and the ⋯
 * menu (View runs, Duplicate, Archive with a confirm). Viewers get none of these.
 */
import { Link } from "@tanstack/react-router";
import { Copy, Ellipsis, Pencil, Play, Archive as ArchiveIcon, List } from "lucide-react";
import { useState } from "react";
import type { ScoutWithRuns } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { duplicateScoutSearch, editScoutSearch, runsOfScoutSearch } from "./scoutLinks";
import { jobsToCreate, scoutLocation } from "./scoutPresentation";
import { useScoutMutations } from "./useScoutMutations";

export interface ScoutRowActionsProps {
  scout: ScoutWithRuns;
}

export function ScoutRowActions({ scout }: ScoutRowActionsProps) {
  const { run, archive } = useScoutMutations();
  const [confirmRun, setConfirmRun] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const jobs = jobsToCreate(scout);
  const jobsWord = jobs === 1 ? "job" : "jobs";

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="primary"
        size="sm"
        aria-label={`Run Scout ${scout.name}`}
        onClick={() => setConfirmRun(true)}
        loading={run.isPending && run.variables?.id === scout.id}
      >
        <Play aria-hidden />
        Run
      </Button>
      <Button asChild variant="secondary" size="sm">
        <Link
          to="/jobs/new"
          search={editScoutSearch(scout.id)}
          aria-label={`Edit Scout ${scout.name}`}
        >
          Edit
        </Link>
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`More actions for Scout ${scout.name}`}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/jobs" search={runsOfScoutSearch(scout.id)}>
              <List size={14} aria-hidden />
              View runs
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/jobs/new" search={duplicateScoutSearch(scout.id)}>
              <Copy size={14} aria-hidden />
              Duplicate
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/jobs/new" search={editScoutSearch(scout.id)}>
              <Pencil size={14} aria-hidden />
              Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem tone="danger" onSelect={() => setConfirmArchive(true)}>
            <ArchiveIcon size={14} aria-hidden />
            Archive
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmRun}
        onOpenChange={setConfirmRun}
        title={`Run ${scout.name}?`}
        description={`This will create ${jobs} ${jobsWord} for ${scout.name} (${scoutLocation(scout)}). The runs are listed under Runs and share one batch id.`}
        confirmLabel={`Create ${jobs} ${jobsWord}`}
        confirmVariant="primary"
        pending={run.isPending}
        onConfirm={async () => {
          try {
            await run.mutateAsync(scout);
          } catch {
            // toasted by the mutation
          }
          setConfirmRun(false);
        }}
      />
      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title={`Archive ${scout.name}?`}
        description="The Scout disappears from this list; its runs stay under Runs and keep their batch labels."
        confirmLabel="Archive"
        pending={archive.isPending}
        onConfirm={async () => {
          try {
            await archive.mutateAsync(scout);
          } catch {
            // toasted by the mutation
          }
          setConfirmArchive(false);
        }}
      />
    </div>
  );
}
