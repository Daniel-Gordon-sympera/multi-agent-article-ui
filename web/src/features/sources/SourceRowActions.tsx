/**
 * Row actions of the Data Sources table (mockup §3.10 col. 7): xs `[Remove]` (danger, behind
 * a confirm) or `[Restore]`, plus the 28×28 ⋯ menu "Run a seed job or edit {name}" with
 * Run a seed job → `/jobs/new?mode=seeds&source=<id>`, Edit → dialog, Copy URL.
 */
import { Link } from "@tanstack/react-router";
import { Copy, Ellipsis, Pencil, Play } from "lucide-react";
import { useState } from "react";
import type { Source } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "@/components/ui/sonner";
import { seedRunSearch } from "@/features/scouts/scoutLinks";
import { useSourceMutations } from "./useSourceMutations";

export interface SourceRowActionsProps {
  source: Source;
  onEdit: (source: Source) => void;
}

async function copyUrl(url: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("URL copied", { description: url });
  } catch {
    toast.error("Could not copy the URL", { description: url });
  }
}

export function SourceRowActions({ source, onEdit }: SourceRowActionsProps) {
  const { remove, restore } = useSourceMutations();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const active = source.status === "active";

  return (
    <div className="flex items-center justify-end gap-2">
      {active ? (
        <Button
          variant="danger"
          size="xs"
          aria-label={`Remove ${source.name}`}
          onClick={() => setConfirmRemove(true)}
        >
          Remove
        </Button>
      ) : (
        <Button
          variant="secondary"
          size="xs"
          aria-label={`Restore ${source.name}`}
          loading={restore.isPending && restore.variables?.id === source.id}
          onClick={() => restore.mutate(source)}
        >
          Restore
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={`Run a seed job or edit ${source.name}`}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild disabled={!active}>
            <Link to="/jobs/new" search={seedRunSearch(source.id)}>
              <Play size={14} aria-hidden />
              Run a seed job
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onEdit(source)}>
            <Pencil size={14} aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void copyUrl(source.url)}>
            <Copy size={14} aria-hidden />
            Copy URL
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmRemove}
        onOpenChange={setConfirmRemove}
        title={`Remove ${source.name}?`}
        description={`${source.domain} stops being seeded for ${source.county} County, ${source.state_code}. The row is kept for history and can be restored.`}
        confirmLabel="Remove"
        pending={remove.isPending}
        onConfirm={async () => {
          try {
            await remove.mutateAsync(source);
          } catch {
            // toasted by the mutation
          }
          setConfirmRemove(false);
        }}
      />
    </div>
  );
}
