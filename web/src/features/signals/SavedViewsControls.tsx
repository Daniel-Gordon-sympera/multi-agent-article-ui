/**
 * Saved views of the explorer (mockup §3.8): the "View: …" select with "Manage views…", the
 * Save-view dialog (name + shared → `POST /app/views` with the current filters and columns) and
 * the manage dialog (rename / share / delete). Selecting a view applies its search and columns
 * and marks the URL with `?view=<id>`.
 */
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { View } from "@/api/types/bff";
import { useSession } from "@/app/providers/SessionProvider";
import {
  ManageViewsDialog,
  SavedViewsMenu,
  SaveViewDialog,
  useSavedViewMutations,
  useSavedViews,
} from "@/components/SavedViewsMenu";
import {
  SIGNALS_ROUTE,
  searchForView,
  viewInputFor,
  type ExplorerSearch,
} from "./savedViewsSearch";
import type { SignalsSearch } from "./searchSchema";

export interface SavedViewsControlsProps {
  search: SignalsSearch;
  /** Controlled by the page: the header's "Save view" button opens the dialog. */
  saveOpen: boolean;
  onSaveOpenChange: (open: boolean) => void;
}

export function SavedViewsControls({
  search,
  saveOpen,
  onSaveOpenChange,
}: SavedViewsControlsProps) {
  const navigate = useNavigate();
  const { user, can } = useSession();
  const views = useSavedViews(SIGNALS_ROUTE);
  const { save, update, remove } = useSavedViewMutations(SIGNALS_ROUTE);
  const [manageOpen, setManageOpen] = useState(false);

  const go = (next: ExplorerSearch) =>
    void navigate({ to: SIGNALS_ROUTE, search: next as never, replace: false });

  const select = (view: View | null) => {
    if (!view) {
      go({ density: search.density });
      return;
    }
    go(searchForView(view, search));
  };

  const saveView = async (input: { name: string; shared: boolean }) => {
    const view = await save.mutateAsync(viewInputFor(search, input));
    onSaveOpenChange(false);
    go({ ...search, view: view.id });
  };

  const canEdit = (view: View) => can("admin") || view.user_id === user?.id;

  return (
    <>
      <SavedViewsMenu
        views={views.data ?? []}
        currentViewId={search.view}
        onSelect={select}
        onManage={() => setManageOpen(true)}
        disabled={views.isPending}
      />
      <SaveViewDialog
        key={saveOpen ? "open" : "closed"}
        open={saveOpen}
        onOpenChange={onSaveOpenChange}
        onSave={saveView}
        pending={save.isPending}
        description="Saves the current filters and visible columns under a name you can reopen later. Shared views are visible to every account."
      />
      <ManageViewsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
        views={views.data ?? []}
        canEdit={canEdit}
        onDelete={(id) => {
          remove.mutate(id, {
            onSuccess: () => {
              if (search.view === id) go({ ...search, view: undefined });
            },
          });
        }}
        onToggleShared={(view) => update.mutate({ id: view.id, input: { shared: !view.shared } })}
        onRename={(view, name) => update.mutate({ id: view.id, input: { name } })}
        deletingId={remove.isPending ? (remove.variables ?? null) : null}
      />
    </>
  );
}
