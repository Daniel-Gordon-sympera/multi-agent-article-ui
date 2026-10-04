/**
 * Settings › API keys. Admins create (`POST /v1/api-keys`) and revoke (`DELETE /v1/api-keys/{name}`)
 * keys; the list comes from `GET /v1/api-keys` when capability `api_keys_list` (B4) exists, else
 * from the keys created in this browser (localStorage). Operators and viewers read an explanation.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { KeyRound, Plus } from "lucide-react";
import { useMemo, useState } from "react";
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
import { useLocalKeys, type LocalKeyRecord } from "./localKeys";

interface KeyRow extends LocalKeyRecord {
  revoked_at?: string | null;
}

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
  const { can, hasCapability } = useSession();
  const queryClient = useQueryClient();
  const canList = hasCapability("api_keys_list");
  const local = useLocalKeys();
  const [createOpen, setCreateOpen] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  const remote = useQuery({
    queryKey: qk.v1.apiKeys(),
    queryFn: async () => (await listApiKeys()).items,
    enabled: can("admin") && canList,
    staleTime: 60_000,
  });

  const revoke = useMutation({
    mutationFn: (name: string) => deleteApiKey(name),
    onSuccess: (_result, name) => {
      local.remove(name);
      void queryClient.invalidateQueries({ queryKey: qk.v1.apiKeys() });
      toast.success(`Key ${name} revoked`);
      setRevoking(null);
    },
    onError: (error) => toastError(error, "The key was not revoked"),
  });

  const columns = useMemo(() => buildColumns(setRevoking), []);
  const rows: KeyRow[] = canList ? (remote.data ?? []) : local.keys;

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
      {!canList ? (
        <NoteBanner>
          The pipeline API does not list keys yet — needs pipeline API update (B4). Until then this
          table shows the keys created in this browser; revoking works for any key by name.
        </NoteBanner>
      ) : null}
      <DataTable<KeyRow>
        ariaLabel={canList ? "API keys" : "Keys created in this browser"}
        columns={columns}
        data={rows}
        getRowId={(row) => row.name}
        rowHeight={44}
        isLoading={canList && remote.isPending}
        error={canList ? remote.error : undefined}
        onRetry={() => void remote.refetch()}
        emptyState={
          <EmptyState
            variant="plain"
            icon={<KeyRound />}
            title={canList ? "No API keys" : "No keys created in this browser yet"}
            description="Create one for a script or a second client; the secret is shown once."
          />
        }
      />
      <CreateKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(key) => {
          local.add({ name: key.name, role: key.role, created_at: key.created_at });
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
