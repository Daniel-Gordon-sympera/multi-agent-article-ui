/** Change-password form → `POST /app/auth/password` (clears `must_change_password`). */
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { changePassword } from "@/api/bff";
import { isApiError } from "@/api/client";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { errorMessage } from "@/lib/errors";

export const PASSWORD_MIN_LENGTH = 12;

const schema = z
  .object({
    current_password: z.string().min(1, "Enter your current password"),
    new_password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`),
    confirm_password: z.string().min(1, "Repeat the new password"),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: "The passwords do not match",
    path: ["confirm_password"],
  })
  .refine((v) => v.new_password !== v.current_password, {
    message: "Choose a password you have not used here before",
    path: ["new_password"],
  });

type Values = z.infer<typeof schema>;

export interface ChangePasswordFormProps {
  onChanged: () => void;
}

export function ChangePasswordForm({ onChanged }: ChangePasswordFormProps) {
  const { refresh } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { current_password: "", new_password: "", confirm_password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await changePassword({
        current_password: values.current_password,
        new_password: values.new_password,
      });
      await refresh();
      toast.success("Password changed");
      onChanged();
    } catch (error) {
      if (isApiError(error) && (error.status === 401 || error.status === 403)) {
        setFormError("The current password is not correct.");
      } else {
        setFormError(errorMessage(error, "The password was not changed."));
      }
    }
  });

  const field = (name: keyof Values, label: string, autoComplete: string) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={`password-${name}`}>{label}</Label>
      <Input
        id={`password-${name}`}
        type="password"
        autoComplete={autoComplete}
        invalid={!!errors[name]}
        aria-describedby={errors[name] ? `password-${name}-error` : undefined}
        {...form.register(name)}
      />
      {errors[name] ? (
        <p id={`password-${name}-error`} className="text-[12px] text-status-fail-fg">
          {errors[name]?.message}
        </p>
      ) : null}
    </div>
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
      {field("current_password", "Current password", "current-password")}
      {field("new_password", "New password", "new-password")}
      {field("confirm_password", "Repeat new password", "new-password")}
      {formError ? (
        <p
          role="alert"
          className="rounded-control bg-status-fail-bg px-3 py-2 text-[13px] text-status-fail-fg"
        >
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
        Change password
      </Button>
    </form>
  );
}
