/**
 * Users dialogs (admin): Create (e-mail, name, role, temporary password → must change at first
 * sign-in), Edit (name, role) and Reset password (new temporary password).
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, type ReactNode } from "react";
import { useForm, type FieldValues, type Path, type UseFormReturn } from "react-hook-form";
import { z } from "zod";
import type { CreateUserInput, Role, User } from "@/api/types/bff";
import { Button } from "@/components/Button";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PASSWORD_MIN_LENGTH } from "@/features/auth/ChangePasswordForm";

const ROLE_OPTIONS: Array<{ value: Role; label: string; description: string }> = [
  { value: "viewer", label: "viewer", description: "reads everything, downloads per-job CSVs" },
  {
    value: "operator",
    label: "operator",
    description: "viewer + runs, Scouts, sources, retries, exports",
  },
  { value: "admin", label: "admin", description: "operator + users and pipeline API keys" },
];

const roleSchema = z.enum(["admin", "operator", "viewer"]);
const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`);

const createSchema = z.object({
  email: z.string().trim().email("Enter a valid e-mail address"),
  name: z.string().trim().min(1, "Enter a name"),
  role: roleSchema,
  password: passwordSchema,
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({ name: z.string().trim().min(1, "Enter a name"), role: roleSchema });
type EditValues = z.infer<typeof editSchema>;

const resetSchema = z.object({ password: passwordSchema });
type ResetValues = z.infer<typeof resetSchema>;

function Field<T extends FieldValues>({
  form,
  name,
  label,
  children,
}: {
  form: UseFormReturn<T>;
  name: Path<T>;
  label: string;
  children: ReactNode;
}) {
  const error = form.formState.errors[name];
  const message = typeof error?.message === "string" ? error.message : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`user-${String(name)}`}>{label}</Label>
      {children}
      {message ? (
        <p id={`user-${String(name)}-error`} className="text-[12px] text-status-fail-fg">
          {message}
        </p>
      ) : null}
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: Role; onChange: (role: Role) => void }) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as Role)}>
      <SelectTrigger id="user-role" size="form" aria-label="Role">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLE_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label} — {option.description}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export interface CreateUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CreateUserInput) => Promise<unknown>;
  pending: boolean;
}

export function CreateUserDialog({ open, onOpenChange, onSubmit, pending }: CreateUserDialogProps) {
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", name: "", role: "viewer", password: "" },
  });
  useEffect(() => {
    if (!open) form.reset();
  }, [form, open]);
  const submit = form.handleSubmit(async (values) => {
    await onSubmit(values);
    onOpenChange(false);
  });
  return (
    <Dialog open={open} onOpenChange={(next) => (pending ? undefined : onOpenChange(next))}>
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>
              The temporary password must be changed at the first sign-in.
            </DialogDescription>
          </DialogHeader>
          <Field form={form} name="email" label="E-mail">
            <Input
              id="user-email"
              type="email"
              autoComplete="off"
              invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
          </Field>
          <Field form={form} name="name" label="Name">
            <Input
              id="user-name"
              autoComplete="off"
              invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
          </Field>
          <Field form={form} name="role" label="Role">
            <RoleSelect
              value={form.watch("role")}
              onChange={(role) => form.setValue("role", role)}
            />
          </Field>
          <Field form={form} name="password" label="Temporary password">
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Create user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface EditUserDialogProps {
  user: User | null;
  onClose: () => void;
  onSubmit: (id: string, values: EditValues) => Promise<unknown>;
  pending: boolean;
}

export function EditUserDialog({ user, onClose, onSubmit, pending }: EditUserDialogProps) {
  const form = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user?.name ?? "", role: user?.role ?? "viewer" },
  });
  useEffect(() => {
    if (user) form.reset({ name: user.name, role: user.role });
  }, [form, user]);
  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    await onSubmit(user.id, values);
    onClose();
  });
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}
    >
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Edit user</DialogTitle>
            <DialogDescription>{user?.email}</DialogDescription>
          </DialogHeader>
          <Field form={form} name="name" label="Name">
            <Input
              id="user-name"
              invalid={!!form.formState.errors.name}
              {...form.register("name")}
            />
          </Field>
          <Field form={form} name="role" label="Role">
            <RoleSelect
              value={form.watch("role")}
              onChange={(role) => form.setValue("role", role)}
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export interface ResetPasswordDialogProps {
  user: User | null;
  onClose: () => void;
  onSubmit: (id: string, password: string) => Promise<unknown>;
  pending: boolean;
}

export function ResetPasswordDialog({
  user,
  onClose,
  onSubmit,
  pending,
}: ResetPasswordDialogProps) {
  const form = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "" },
  });
  useEffect(() => {
    if (!user) form.reset();
  }, [form, user]);
  const submit = form.handleSubmit(async (values) => {
    if (!user) return;
    await onSubmit(user.id, values.password);
    onClose();
  });
  return (
    <Dialog
      open={user !== null}
      onOpenChange={(next) => (!next && !pending ? onClose() : undefined)}
    >
      <DialogContent>
        <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              {user?.email} gets this temporary password and must change it at the next sign-in;
              their other sessions end.
            </DialogDescription>
          </DialogHeader>
          <Field form={form} name="password" label="Temporary password">
            <Input
              id="user-password"
              type="password"
              autoComplete="new-password"
              invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
          </Field>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
