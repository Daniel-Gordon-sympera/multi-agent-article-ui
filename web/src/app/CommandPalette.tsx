/**
 * CommandPalette — contract §5.5: ⌘K / Ctrl+K opens a cmdk dialog with the pages, "Go to job
 * <id>" (full UUID typed, or a cached job matched by id prefix or title), the theme and density
 * toggles and sign-out. Escape or selecting an entry closes it.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bookmark,
  Briefcase,
  Database,
  LayoutDashboard,
  LogOut,
  Moon,
  Plus,
  Rows2,
  Settings2,
  Sun,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { qk } from "@/api/keys";
import type { Page } from "@/api/types/common";
import type { JobRecord } from "@/api/types/jobs";
import { useSession } from "@/app/providers/SessionProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { StatusPill } from "@/components/StatusPill";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { jobTitle } from "@/features/jobs/jobTitle";
import { shortId } from "@/lib/format";

export interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Jobs already loaded into the query cache (any list page or detail); re-read on each open. */
function useCachedJobs(open: boolean): JobRecord[] {
  const queryClient = useQueryClient();
  return useMemo(() => {
    if (!open) return [];
    const seen = new Map<string, JobRecord>();
    for (const [, data] of queryClient.getQueriesData<unknown>({ queryKey: qk.v1.jobs.all })) {
      if (!data || typeof data !== "object") continue;
      const page = data as Partial<Page<JobRecord>>;
      const rows = Array.isArray(page.items) ? page.items : "id" in data ? [data as JobRecord] : [];
      for (const row of rows) if (row && typeof row.id === "string") seen.set(row.id, row);
    }
    return [...seen.values()];
  }, [open, queryClient]);
}

export function useCommandPaletteShortcut(onToggle: () => void): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onToggle();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onToggle]);
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { signOut, can } = useSession();
  const { resolvedTheme, toggleTheme, density, toggleDensity } = useTheme();
  const [query, setQuery] = useState("");
  const cachedJobs = useCachedJobs(open);

  const handleOpenChange = (next: boolean) => {
    if (!next) setQuery("");
    onOpenChange(next);
  };
  const close = () => handleOpenChange(false);
  const go = (fn: () => unknown) => {
    close();
    void fn();
  };

  const trimmed = query.trim();
  const isUuid = UUID_RE.test(trimmed);
  const matchingJobs = useMemo(() => {
    const needle = trimmed.toLowerCase();
    if (!needle) return cachedJobs.slice(0, 5);
    return cachedJobs
      .filter(
        (job) =>
          job.id.toLowerCase().startsWith(needle) || jobTitle(job).toLowerCase().includes(needle),
      )
      .slice(0, 6);
  }, [cachedJobs, trimmed]);

  return (
    <CommandDialog open={open} onOpenChange={handleOpenChange}>
      <CommandInput
        placeholder="Search pages, jump to a job by id…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Pages">
          <CommandItem onSelect={() => go(() => navigate({ to: "/" }))}>
            <LayoutDashboard size={16} aria-hidden /> Overview
          </CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/jobs" }))}>
            <Briefcase size={16} aria-hidden /> Jobs · Runs
          </CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/jobs/scouts" }))}>
            <Bookmark size={16} aria-hidden /> Jobs · Scouts
          </CommandItem>
          {can("operate") ? (
            <CommandItem onSelect={() => go(() => navigate({ to: "/jobs/new" }))}>
              <Plus size={16} aria-hidden /> New run
            </CommandItem>
          ) : null}
          <CommandItem onSelect={() => go(() => navigate({ to: "/signals" }))}>
            <Activity size={16} aria-hidden /> Signals
          </CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/sources" }))}>
            <Database size={16} aria-hidden /> Data Sources
          </CommandItem>
          <CommandItem onSelect={() => go(() => navigate({ to: "/settings/workers" }))}>
            <Settings2 size={16} aria-hidden /> Settings
          </CommandItem>
        </CommandGroup>
        {isUuid || matchingJobs.length > 0 ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="Jobs">
              {isUuid ? (
                <CommandItem
                  value={`go-to-job ${trimmed}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/jobs/$jobId", params: { jobId: trimmed } }))
                  }
                >
                  <Briefcase size={16} aria-hidden /> Go to job{" "}
                  <span className="font-mono text-[12px]">{shortId(trimmed)}</span>
                </CommandItem>
              ) : null}
              {matchingJobs.map((job) => (
                <CommandItem
                  key={job.id}
                  value={`job ${job.id} ${jobTitle(job)}`}
                  onSelect={() =>
                    go(() => navigate({ to: "/jobs/$jobId", params: { jobId: job.id } }))
                  }
                >
                  <Briefcase size={16} aria-hidden />
                  <span className="truncate">{jobTitle(job)}</span>
                  <span className="font-mono text-[12px] text-muted">{shortId(job.id)}</span>
                  <span className="ml-auto">
                    <StatusPill entity="job" status={job.status} size="sm" />
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Appearance">
          <CommandItem onSelect={() => go(toggleTheme)}>
            {resolvedTheme === "dark" ? (
              <Sun size={16} aria-hidden />
            ) : (
              <Moon size={16} aria-hidden />
            )}
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
          </CommandItem>
          <CommandItem onSelect={() => go(toggleDensity)}>
            <Rows2 size={16} aria-hidden />{" "}
            {density === "compact" ? "Comfortable rows" : "Compact rows"}
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => go(() => signOut().then(() => navigate({ to: "/sign-in" })))}
          >
            <LogOut size={16} aria-hidden /> Sign out
            <CommandShortcut>⇧⌘Q</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
