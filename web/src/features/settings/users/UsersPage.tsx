/**
 * Settings › Users (admin): the accounts table (role tag, created, last login, state) with
 * Create, Edit role/name, Disable/Enable and Reset password; self-protection errors from the BFF
 * (you cannot disable or demote yourself) surface as toasts.
 */
import type { ColumnDef } from "@tanstack/react-table";
import { Plus, UserRound } from "lucide-react";
import { useMemo, useState } from "react";
import type { User } from "@/api/types/bff";
import { useCurrentUser } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataTable } from "@/components/DataTable";
import { EmptyState } from "@/components/EmptyState";
import { RelativeTime } from "@/components/RelativeTime";
import { StatusPill } from "@/components/StatusPill";
import { Tag } from "@/components/Tag";
import { SettingsSection } from "../SettingsSection";
import { CreateUserDialog, EditUserDialog, ResetPasswordDialog } from "./UserDialogs";
import { isUserDisabled, useUserMutations, useUsers } from "./useUserMutations";

interface RowActions {
  selfId: string;
  onEdit: (user: User) => void;
  onReset: (user: User) => void;
  onToggle: (user: User) => void;
}

function buildColumns(actions: RowActions): ColumnDef<User, unknown>[] {
  return [
    {
      id: "user",
      header: "User",
      meta: { hideable: false, minWidth: 220 },
      cell: ({ row }) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-ink">
            {row.original.name}
            {row.original.id === actions.selfId ? (
              <span className="ml-1.5 text-[12px] font-normal text-muted">(you)</span>
            ) : null}
          </span>
          <span className="truncate text-[12px] text-muted">{row.original.email}</span>
        </span>
      ),
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
      id: "last_login",
      header: "Last login",
      cell: ({ row }) =>
        row.original.last_login_at ? (
          <RelativeTime value={row.original.last_login_at} />
        ) : (
          <span className="text-muted">never</span>
        ),
    },
    {
      id: "state",
      header: "State",
      cell: ({ row }) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <StatusPill
            size="sm"
            descriptor={
              isUserDisabled(row.original)
                ? { tone: "neutral", label: "Disabled", indicator: "dot" }
                : { tone: "done", label: "Active", indicator: "dot" }
            }
          />
          {row.original.must_change_password ? <Tag>must change password</Tag> : null}
        </span>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      meta: { actions: true, align: "right", interactive: true },
      cell: ({ row }) => {
        const user = row.original;
        const self = user.id === actions.selfId;
        const disabled = isUserDisabled(user);
        return (
          <span className="inline-flex items-center gap-1.5">
            <Button
              variant="secondary"
              size="xs"
              onClick={() => actions.onEdit(user)}
              aria-label={`Edit ${user.email}`}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => actions.onReset(user)}
              aria-label={`Reset password of ${user.email}`}
            >
              Reset password
            </Button>
            <Button
              variant={disabled ? "tonal" : "danger"}
              size="xs"
              onClick={() => actions.onToggle(user)}
              disabled={self}
              title={self ? "You cannot disable your own account" : undefined}
              aria-label={`${disabled ? "Enable" : "Disable"} ${user.email}`}
            >
              {disabled ? "Enable" : "Disable"}
            </Button>
          </span>
        );
      },
    },
  ];
}

export function UsersPage() {
  const me = useCurrentUser();
  const users = useUsers();
  const { create, update, resetPassword } = useUserMutations();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [resetting, setResetting] = useState<User | null>(null);
  const [toggling, setToggling] = useState<User | null>(null);

  const columns = useMemo(
    () =>
      buildColumns({
        selfId: me.id,
        onEdit: setEditing,
        onReset: setResetting,
        onToggle: (user) => {
          if (isUserDisabled(user)) update.mutate({ id: user.id, input: { disabled: false } });
          else setToggling(user);
        },
      }),
    [me.id, update],
  );

  return (
    <SettingsSection
      id="settings-users"
      title="Users"
      description="Console accounts and roles: viewer ⊂ operator ⊂ admin. New users and reset passwords must be changed at the next sign-in."
      actions={
        <Button variant="primary" onClick={() => setCreateOpen(true)}>
          <Plus aria-hidden />
          Create user
        </Button>
      }
    >
      <DataTable<User>
        ariaLabel="Users"
        columns={columns}
        data={users.data}
        getRowId={(user) => user.id}
        rowHeight={52}
        minWidth={820}
        isLoading={users.isPending}
        error={users.data ? undefined : users.error}
        onRetry={() => void users.refetch()}
        emptyState={<EmptyState variant="plain" icon={<UserRound />} title="No users" />}
      />
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(input) => create.mutateAsync(input)}
        pending={create.isPending}
      />
      <EditUserDialog
        user={editing}
        onClose={() => setEditing(null)}
        onSubmit={(id, values) => update.mutateAsync({ id, input: values })}
        pending={update.isPending}
      />
      <ResetPasswordDialog
        user={resetting}
        onClose={() => setResetting(null)}
        onSubmit={(id, password) => resetPassword.mutateAsync({ id, password })}
        pending={resetPassword.isPending}
      />
      <ConfirmDialog
        open={toggling !== null}
        onOpenChange={(open) => (open ? undefined : setToggling(null))}
        title={`Disable ${toggling?.email ?? "this user"}?`}
        description="They are signed out everywhere and cannot sign in until re-enabled."
        confirmLabel="Disable user"
        pending={update.isPending}
        onConfirm={async () => {
          if (!toggling) return;
          try {
            await update.mutateAsync({ id: toggling.id, input: { disabled: true } });
          } finally {
            setToggling(null);
          }
        }}
      />
    </SettingsSection>
  );
}
