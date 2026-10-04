/**
 * SavedViewsMenu — mockup §3.8: "View: Florida construction" select with "Manage views…", plus
 * the hooks around `/app/views` (list, save, rename/share, delete) and a `SaveViewDialog`.
 * A view stores a search-param object and an optional column list (contract §4.3).
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save, Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createView, deleteView, listViews, updateView } from "@/api/bff";
import { qk } from "@/api/keys";
import { pollingOptions } from "@/api/polling";
import type { View, ViewInput } from "@/api/types/bff";
import { Button } from "@/components/Button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";

export function useSavedViews(route: string) {
  return useQuery({
    queryKey: qk.app.views(route),
    queryFn: () => listViews(route),
    ...pollingOptions("static"),
  });
}

export function useSavedViewMutations(route: string) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.app.views(route) });
  const save = useMutation({
    mutationFn: (input: ViewInput) => createView(input),
    onSuccess: (view) => {
      toast.success(`View “${view.name}” saved`);
      void invalidate();
    },
    onError: (error) => toastError(error, "The view was not saved"),
  });
  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<ViewInput> }) => updateView(id, input),
    onSuccess: () => void invalidate(),
    onError: (error) => toastError(error, "The view was not updated"),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteView(id),
    onSuccess: () => {
      toast.success("View deleted");
      void invalidate();
    },
    onError: (error) => toastError(error, "The view was not deleted"),
  });
  return { save, update, remove };
}

const NONE = "__none__";
const MANAGE = "__manage__";

export interface SavedViewsMenuProps {
  views: View[];
  currentViewId: string | undefined;
  onSelect: (view: View | null) => void;
  onManage?: () => void;
  allLabel?: string;
  width?: number;
  disabled?: boolean;
}

export function SavedViewsMenu({
  views,
  currentViewId,
  onSelect,
  onManage,
  allLabel = "all signals",
  width = 220,
  disabled,
}: SavedViewsMenuProps) {
  const current = currentViewId && views.some((v) => v.id === currentViewId) ? currentViewId : NONE;
  const currentName =
    current === NONE ? allLabel : (views.find((v) => v.id === current)?.name ?? allLabel);
  return (
    <Select
      value={current}
      disabled={disabled}
      onValueChange={(next) => {
        if (next === MANAGE) {
          onManage?.();
          return;
        }
        onSelect(next === NONE ? null : (views.find((v) => v.id === next) ?? null));
      }}
    >
      <SelectTrigger
        aria-label="Saved view"
        className="w-auto shrink-0"
        style={{ minWidth: width }}
      >
        <SelectValue>
          <span className="text-muted">View: </span>
          {currentName}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>View: {allLabel}</SelectItem>
        {views.map((view) => (
          <SelectItem key={view.id} value={view.id}>
            {view.name}
            {view.shared ? <span className="ml-1.5 text-[11px] text-muted">shared</span> : null}
          </SelectItem>
        ))}
        {onManage ? (
          <>
            <SelectSeparator />
            <SelectItem value={MANAGE}>Manage views…</SelectItem>
          </>
        ) : null}
      </SelectContent>
    </Select>
  );
}

export interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { name: string; shared: boolean }) => void | Promise<void>;
  pending?: boolean;
  defaultName?: string;
  description?: ReactNode;
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
  pending,
  defaultName = "",
  description,
}: SaveViewDialogProps) {
  const [name, setName] = useState(defaultName);
  const [shared, setShared] = useState(false);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save view</DialogTitle>
          <DialogDescription>
            {description ??
              "Saves the current filters and visible columns under a name you can reopen later."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            void onSave({ name: name.trim(), shared });
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="save-view-name">View name</Label>
            <Input
              id="save-view-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Florida construction"
              required
            />
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="save-view-shared"
              checked={shared}
              onCheckedChange={(v) => setShared(v === true)}
            />
            <Label htmlFor="save-view-shared" className="font-normal">
              Share with everyone
            </Label>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={pending} disabled={!name.trim()}>
              <Save aria-hidden />
              Save view
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ManageViewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: View[];
  onDelete: (id: string) => void;
  onToggleShared?: (view: View) => void;
  deletingId?: string | null;
}

export function ManageViewsDialog({
  open,
  onOpenChange,
  views,
  onDelete,
  onToggleShared,
  deletingId,
}: ManageViewsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Saved views</DialogTitle>
          <DialogDescription>
            Your views and the shared ones. Deleting a shared view removes it for everyone.
          </DialogDescription>
        </DialogHeader>
        {views.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted">No saved views yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {views.map((view) => (
              <li key={view.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-ink">{view.name}</p>
                  <p className="text-[12px] text-muted">{view.shared ? "shared" : "only you"}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {onToggleShared ? (
                    <Button variant="ghost" size="xs" onClick={() => onToggleShared(view)}>
                      {view.shared ? "Unshare" : "Share"}
                    </Button>
                  ) : null}
                  <Button
                    variant="danger"
                    size="icon-xs"
                    aria-label={`Delete view ${view.name}`}
                    onClick={() => onDelete(view.id)}
                    loading={deletingId === view.id}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
