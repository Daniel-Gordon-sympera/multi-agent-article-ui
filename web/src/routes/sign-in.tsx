import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { useTheme } from "@/app/providers/ThemeProvider";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { meQueryOptions } from "@/features/auth/meQuery";
import { safeRedirect } from "@/features/auth/safeRedirect";
import { SignInForm } from "@/features/auth/SignInForm";
import { optionalString } from "@/lib/url";

const searchSchema = z.object({ redirect: optionalString });

function SignInPage() {
  const navigate = useNavigate();
  const { redirect: target } = Route.useSearch();
  const { prefs } = useTheme();
  return (
    <AuthLayout title="Sign in" description="Use the account an administrator created for you.">
      <SignInForm
        onSignedIn={(me) => {
          const destination = me.user.must_change_password
            ? "/account/password"
            : safeRedirect(target, prefs.landing);
          void navigate({ href: destination, replace: true });
        }}
      />
    </AuthLayout>
  );
}

export const Route = createFileRoute("/sign-in")({
  validateSearch: searchSchema,
  beforeLoad: async ({ context, search }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions).catch(() => null);
    if (me && !me.user.must_change_password) {
      throw redirect({ href: safeRedirect(search.redirect, "/"), replace: true });
    }
  },
  component: SignInPage,
});
