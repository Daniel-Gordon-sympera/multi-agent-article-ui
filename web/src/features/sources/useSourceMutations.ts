/** Mutations of Data Sources: add, edit, remove/restore, CSV import, promote, dismiss. */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSource,
  dismissSuggestion,
  importSources,
  promoteSuggestion,
  removeSource,
  restoreSource,
  updateSource,
} from "@/api/bff";
import type {
  DismissSuggestionInput,
  PromoteSuggestionInput,
  Source,
  SourceInput,
} from "@/api/types/bff";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";

/** Every sources query (list, stats, suggestions) shares this prefix. */
const SOURCES_PREFIX = ["app", "sources"] as const;

export function useSourceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: SOURCES_PREFIX });

  const create = useMutation({
    mutationFn: (input: SourceInput) => createSource(input),
    onSuccess: (source) => {
      toast.success(`${source.name} added`, { description: `${source.domain} is now a seed.` });
      void invalidate();
    },
    onError: (error) => toastError(error, "The source was not added"),
  });

  const update = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Partial<SourceInput> }) =>
      updateSource(id, input),
    onSuccess: (source) => {
      toast.success(`${source.name} updated`);
      void invalidate();
    },
    onError: (error) => toastError(error, "The source was not updated"),
  });

  const remove = useMutation({
    mutationFn: (source: Source) => removeSource(source.id),
    onSuccess: (_result, source) => {
      toast.success(`${source.name} removed`, {
        description: "Kept for history; restore it from the Removed view.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The source was not removed"),
  });

  const restore = useMutation({
    mutationFn: (source: Source) => restoreSource(source.id),
    onSuccess: (source) => {
      toast.success(`${source.name} restored`);
      void invalidate();
    },
    onError: (error) => toastError(error, "The source was not restored"),
  });

  const importCsv = useMutation({
    mutationFn: (file: File) => importSources(file),
    onSuccess: (result) => {
      const word = result.imported === 1 ? "source" : "sources";
      toast.success(`Imported ${result.imported} ${word}`, {
        description: result.skipped.length
          ? `${result.skipped.length} ${result.skipped.length === 1 ? "row" : "rows"} skipped.`
          : undefined,
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The CSV was not imported"),
  });

  const promote = useMutation({
    mutationFn: (input: PromoteSuggestionInput) => promoteSuggestion(input),
    onSuccess: (source) => {
      toast.success(`${source.name} added from the finder`, {
        description: "Its tier and reason travel with it; the next seed run can use it.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The suggestion was not added"),
  });

  const dismiss = useMutation({
    mutationFn: (input: DismissSuggestionInput) => dismissSuggestion(input),
    onSuccess: (_result, input) => {
      toast.success(`${input.domain} dismissed`, {
        description: "It will not be suggested again for this county.",
      });
      void invalidate();
    },
    onError: (error) => toastError(error, "The suggestion was not dismissed"),
  });

  return { create, update, remove, restore, importCsv, promote, dismiss };
}
