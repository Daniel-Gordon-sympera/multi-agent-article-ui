import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSession } from "@/app/providers/SessionProvider";
import { useTheme } from "@/app/providers/ThemeProvider";
import { PageHeader } from "@/components/PageHeader";
import { AuthLayout } from "@/features/auth/AuthLayout";
import { ChangePasswordForm } from "@/features/auth/ChangePasswordForm";

function PasswordPage() {
  const navigate = useNavigate();
  const { user } = useSession();
  const { prefs } = useTheme();
  const forced = user?.must_change_password === true;
  const onChanged = () => void navigate({ href: prefs.landing, replace: true });

  if (forced) {
    return (
      <AuthLayout
        title="Choose a new password"
        description="Your password was set by an administrator. Pick your own before continuing."
      >
        <ChangePasswordForm onChanged={onChanged} />
      </AuthLayout>
    );
  }
  return (
    <>
      <PageHeader
        crumbs={[
          <Link key="settings" to="/settings/preferences">
            Settings
          </Link>,
          "Change password",
        ]}
        title="Change password"
        subtitle="Signed in as the account below; every other session of this account is signed out once the password changes."
      />
      <section className="card max-w-[440px] p-6">
        <p className="mb-4 text-[13px] text-muted">{user?.email}</p>
        <ChangePasswordForm onChanged={onChanged} />
      </section>
    </>
  );
}

export const Route = createFileRoute("/_app/account/password")({
  component: PasswordPage,
});
