/**
 * Settings › API keys. Admins create (`POST /v1/api-keys`) and revoke (`DELETE /v1/api-keys/{name}`)
 * keys; the complete inventory comes from paginated `GET /v1/api-keys`.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useKeysetPage } from "@/api/pagination";
import { qk } from "@/api/keys";
import { deleteApiKey, listApiKeys } from "@/api/pipeline";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { NoteBanner } from "@/components/NoteBanner";
import { RelativeTime } from "@/components/RelativeTime";
import { Tag } from "@/components/Tag";
import { toast } from "@/components/ui/sonner";
import { toastError } from "@/lib/errors";
import { SettingsSection } from "../SettingsSection";
import { CreateKeyDialog } from "./CreateKeyDialog";
import type { ApiKey } from "@/api/types/stats";

type KeyRow = ApiKey;

function buildColumns(onRevoke: (name: string) => void): ColumnDef<KeyRow, unknown>[] {
  return [
    {
      id: "name",
      header: "Name",
      meta: { mono: true, hideable: false },
      cell: ({ row }) => row.original.name,
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => <Tag tone="brand">{row.original.role}</Tag>,
    },
    {
      id: "created",
      header: "Created",
      cell: ({ row }) => <RelativeTime value={row.original.created_at} mode="smart" />,
    },
    {
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", interactive: true },
      cell: ({ row }) =>
        row.original.revoked_at ? (
          <span className="text-[12px] text-muted">revoked</span>
        ) : (
          <Button
            variant="danger"
            size="xs"
            onClick={() => onRevoke(row.original.name)}
            aria-label={`Revoke key ${row.original.name}`}
          >
            Revoke
          </Button>
        ),
    },
  ];
}

const ROLE_EXPLANATION =
  "The console itself signs in to the pipeline with two keys held by the server (an operator key for admins and operators, a reader key for viewers). Keys created here are for scripts, curl and other clients; the secret is shown exactly once.";

export function ApiKeysPage() {
  const { can } = useSession();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const [after, setAfter] = useState<string>();
  const remote = useKeysetPage(qk.v1.apiKeys(), listApiKeys, {
    after,
    onAfterChange: setAfter,
    limit: 50,
    enabled: can("admin"),
    polling: "calm",
  });

  const revoke = useMutation({
    mutationFn: (name: string) => deleteApiKey(name),
    onSuccess: (_result, name) => {
      void queryClient.invalidateQueries({ queryKey: qk.v1.apiKeys() });
      toast.success(`Key ${name} revoked`);
      setRevoking(null);
    },
    onError: (error) => toastError(error, "The key was not revoked"),
  });

  const columns = useMemo(() => buildColumns(setRevoking), []);
  const rows: KeyRow[] = remote.items;

  if (!can("admin")) {
    return (
      <SettingsSection id="settings-keys" title="API keys" description={ROLE_EXPLANATION}>
        <NoteBanner>
          Only admins create or revoke pipeline API keys. Ask an admin if a script of yours needs
          one.
        </NoteBanner>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection
      id="settings-keys"
      title="API keys"
      description={ROLE_EXPLANATION}
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          Create key
        </Button>
      }
    >
      <DataTable<KeyRow>
        ariaLabel="API keys"
        columns={columns}
        data={rows}
        getRowId={(row) => row.name}
        rowHeight={44}
        isLoading={remote.query.isPending}
        error={remote.query.error}
        onRetry={() => void remote.query.refetch()}
        pagination={{ ...remote.footer, noun: "key", pluralNoun: "keys" }}
        emptyState={
          <EmptyState
            variant="plain"
            icon={<KeyRound />}
            title="No API keys"
            description="Create one for a script or a second client; the secret is shown once."
          />
        }
      />
      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: qk.v1.apiKeys() });
        }}
      />
      <ConfirmDialog
        open={revoking !== null}
        onOpenChange={(open) => (open ? undefined : setRevoking(null))}
        title={`Revoke key ${revoking ?? ""}?`}
        description="Clients using this key lose access immediately. This cannot be undone."
        confirmLabel="Revoke key"
        pending={revoke.isPending}
        onConfirm={() => {
          if (revoking) revoke.mutate(revoking);
        }}
      />
    </SettingsSection>
  );
}
