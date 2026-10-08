import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { listAccessPolicies, resetAccessPolicy, type AccessPolicy } from "@/api/accessPolicies";
import { useKeysetPage } from "@/api/pagination";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { NoteBanner } from "@/components/NoteBanner";
import { RelativeTime } from "@/components/RelativeTime";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";
import { SettingsSection } from "../SettingsSection";

const queryKey = ["v1", "access-policies"] as const;

function PolicyTable() {
  const client = useQueryClient();
  const [after, setAfter] = useState<string>();
  const [selected, setSelected] = useState<string | null>(null);
  const page = useKeysetPage<AccessPolicy>(queryKey, listAccessPolicies, {
    after,
    onAfterChange: setAfter,
    limit: 50,
    polling: "calm",
  });
  const reset = useMutation({
    mutationFn: resetAccessPolicy,
    onSuccess: () => {
      setSelected(null);
      void client.invalidateQueries({ queryKey });
      toast.success("Website access policy reset");
    },
    onError: (error) => toastError(error, "The policy was not reset"),
  });
  const columns = useMemo<ColumnDef<AccessPolicy, unknown>[]>(
    () => [
      { id: "host", header: "Website", cell: ({ row }) => row.original.host },
      {
        id: "active",
        header: "State",
        cell: ({ row }) => (row.original.active ? "Active" : "Reset"),
      },
      {
        id: "reason",
        header: "Access issue",
        cell: ({ row }) =>
          [
            row.original.bot_blocked && "Bot blocked",
            row.original.subscription_required && "Subscription required",
          ]
            .filter(Boolean)
            .join(" · ") ||
          row.original.last_reason ||
          "—",
      },
      {
        id: "provider",
        header: "Last provider",
        cell: ({ row }) => row.original.last_provider || "—",
      },
      {
        id: "seen",
        header: "Last seen",
        cell: ({ row }) => <RelativeTime value={row.original.last_seen} />,
      },
      {
        id: "actions",
        header: "Actions",
        meta: { interactive: true },
        cell: ({ row }) => (
          <Button
            variant="secondary"
            size="sm"
            disabled={!row.original.active}
            onClick={() => setSelected(row.original.host)}
            aria-label={`Reset ${row.original.host}`}
          >
            Reset
          </Button>
        ),
      },
    ],
    [],
  );
  return (
    <>
      <DataTable
        ariaLabel="Website access policies"
        columns={columns}
        data={page.items}
        getRowId={(row) => row.host}
        isLoading={page.query.isPending}
        error={page.query.error}
        onRetry={() => void page.query.refetch()}
        pagination={{ ...page.footer, noun: "policy", pluralNoun: "policies" }}
        emptyTitle="No website access policies"
        emptyDescription="Policies appear when the pipeline records an access problem."
      />
      <ConfirmDialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title={`Reset access policy for ${selected ?? "this website"}?`}
        description="The next retrieval will evaluate access again. This clears the learned block and subscription flags; it does not grant access to restricted content."
        confirmLabel="Reset policy"
        pending={reset.isPending}
        onConfirm={() => {
          if (selected) reset.mutate(selected);
        }}
      />
    </>
  );
}

export function AccessPoliciesPage() {
  const { can } = useSession();
  return (
    <SettingsSection
      id="settings-access-policies"
      title="Website access"
      description="Inspect learned website access problems and reset a policy after access changes."
    >
      {can("operate") ? (
        <PolicyTable />
      ) : (
        <NoteBanner>
          Only operators and admins can view or reset website access policies.
        </NoteBanner>
      )}
    </SettingsSection>
  );
}
