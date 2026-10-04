/**
 * Create API key — `POST /v1/api-keys` (admin). Step 1: name (`^[A-Za-z0-9_.-]+$`) and role;
 * step 2: the plaintext key, shown exactly once with a copy button and a "store it now" warning.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { createApiKey } from "@/api/pipeline";
import type { CreatedApiKey } from "@/api/types/stats";
import { Button } from "@/components/Button";
import { CopyButton } from "@/components/CopyButton";
import { NoteBanner } from "@/components/NoteBanner";
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
import { RadioCard, RadioGroup } from "@/components/ui/radio-group";
import { errorMessage } from "@/lib/errors";

export const API_KEY_NAME_PATTERN = /^[A-Za-z0-9_.-]+$/;

const schema = z.object({
  name: z
    .string()
    .min(1, "Give the key a name")
    .max(100, "At most 100 characters")
    .regex(API_KEY_NAME_PATTERN, "Letters, digits, underscore, dot and dash only"),
  role: z.enum(["operator", "reader"]),
});
type Values = z.infer<typeof schema>;

export interface CreateKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once with the created key's metadata (never the secret). */
  onCreated: (key: CreatedApiKey) => void;
}

export function CreateKeyDialog({ open, onOpenChange, onCreated }: CreateKeyDialogProps) {
  const [created, setCreated] = useState<CreatedApiKey | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", role: "reader" },
  });
  const role = form.watch("role");
  const create = useMutation({
    mutationFn: (values: Values) => createApiKey(values),
    onSuccess: (key) => {
      setCreated(key);
      onCreated(key);
    },
    onError: (error) => setFormError(errorMessage(error, "The key was not created.")),
  });

  const close = (next: boolean) => {
    if (create.isPending) return;
    onOpenChange(next);
    if (!next) {
      setCreated(null);
      setFormError(null);
      form.reset();
    }
  };

  const submit = form.handleSubmit((values) => {
    setFormError(null);
    create.mutate(values);
  });

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent hideClose={created !== null}>
        {created ? (
          <>
            <DialogHeader>
              <DialogTitle>Key created</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{created.name}</span> · {created.role}
              </DialogDescription>
            </DialogHeader>
            <NoteBanner tone="warn">
              Store it now — the key is shown exactly once and cannot be retrieved later.
            </NoteBanner>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={created.key}
                aria-label="API key"
                className="font-mono text-[13px]"
                onFocus={(event) => event.currentTarget.select()}
              />
              <CopyButton
                value={created.key}
                label="Copy API key"
                size="icon-sm"
                variant="secondary"
              />
            </div>
            <DialogFooter>
              <Button variant="primary" onClick={() => close(false)}>
                I stored it
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
            <DialogHeader>
              <DialogTitle>Create API key</DialogTitle>
              <DialogDescription>
                A pipeline API key for scripts or a second client. The secret is shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key-name">Name</Label>
              <Input
                id="api-key-name"
                autoComplete="off"
                placeholder="scout-ui-reader"
                invalid={!!form.formState.errors.name}
                aria-describedby="api-key-name-hint"
                {...form.register("name")}
              />
              <p id="api-key-name-hint" className="text-[12px] text-muted">
                {form.formState.errors.name?.message ??
                  "Letters, digits, underscore, dot and dash; unique among keys."}
              </p>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[13px] font-semibold text-ink-2">Role</legend>
              <RadioGroup
                value={role}
                onValueChange={(value) => form.setValue("role", value as Values["role"])}
                aria-label="Key role"
              >
                <RadioCard
                  id="api-key-role-reader"
                  value="reader"
                  checked={role === "reader"}
                  title="reader"
                  description="Every GET route and per-job CSV exports."
                />
                <RadioCard
                  id="api-key-role-operator"
                  value="operator"
                  checked={role === "operator"}
                  title="operator"
                  description="Also creates, cancels and resumes jobs, retries tasks and starts exports."
                />
              </RadioGroup>
            </fieldset>
            {formError ? (
              <p
                role="alert"
                className="rounded-control bg-status-fail-bg px-3 py-2 text-[13px] text-status-fail-fg"
              >
                {formError}
              </p>
            ) : null}
            <DialogFooter>
              <Button variant="secondary" onClick={() => close(false)} disabled={create.isPending}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={create.isPending}>
                Create key
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
