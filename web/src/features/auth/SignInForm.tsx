/**
 * Sign-in form (contract §4.2): e-mail + password → `POST /app/auth/login`. Messages never say
 * whether the account exists; `429 too_many_attempts` is surfaced as such.
 */
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import type { Me } from "@/api/types/bff";
import { useSession } from "@/app/providers/SessionProvider";
import { Button } from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { describeSignInError } from "@/features/auth/signInErrors";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your e-mail address")
    .email("Enter a valid e-mail address"),
  password: z.string().min(1, "Enter your password"),
});

type SignInValues = z.infer<typeof schema>;

export interface SignInFormProps {
  onSignedIn: (me: Me) => void;
}

export function SignInForm({ onSignedIn }: SignInFormProps) {
  const { signIn } = useSession();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const submit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      const me = await signIn(values.email, values.password);
      onSignedIn(me);
    } catch (error) {
      setFormError(describeSignInError(error));
    }
  });

  const { errors, isSubmitting } = form.formState;

  return (
    <form className="flex flex-col gap-4" onSubmit={(event) => void submit(event)} noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-in-email">E-mail</Label>
        <Input
          id="sign-in-email"
          type="email"
          autoComplete="username"
          invalid={!!errors.email}
          aria-describedby={errors.email ? "sign-in-email-error" : undefined}
          {...form.register("email")}
        />
        {errors.email ? (
          <p id="sign-in-email-error" className="text-[12px] text-status-fail-fg">
            {errors.email.message}
          </p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="sign-in-password">Password</Label>
        <Input
          id="sign-in-password"
          type="password"
          autoComplete="current-password"
          invalid={!!errors.password}
          aria-describedby={errors.password ? "sign-in-password-error" : undefined}
          {...form.register("password")}
        />
        {errors.password ? (
          <p id="sign-in-password-error" className="text-[12px] text-status-fail-fg">
            {errors.password.message}
          </p>
        ) : null}
      </div>
      {formError ? (
        <p
          role="alert"
          className="rounded-control bg-status-fail-bg px-3 py-2 text-[13px] text-status-fail-fg"
        >
          {formError}
        </p>
      ) : null}
      <Button type="submit" variant="primary" loading={isSubmitting} className="mt-1 w-full">
        Sign in
      </Button>
    </form>
  );
}
