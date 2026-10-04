import {
  createFileRoute,
  Outlet,
  redirect,
  useLocation,
  useNavigate,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { qk } from "@/api/keys";
import type { Me } from "@/api/types/bff";
import { AppShell } from "@/app/AppShell";
import { useSession } from "@/app/providers/SessionProvider";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/Skeleton";
import { meQueryOptions } from "@/features/auth/meQuery";

const PASSWORD_PATH = "/account/password";

function AppPending() {
  return (
    <div className="flex min-h-screen bg-page" aria-busy="true" aria-live="polite">
      <div className="hidden w-sidebar flex-col gap-4 border-r border-border bg-surface px-4 py-5 min-[800px]:flex">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col gap-5 px-8 pt-7">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
      <span className="sr-only">Loading your session…</span>
    </div>
  );
}

function AppLoadError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <ErrorState
        error={error}
        title="The console could not load your session"
        className="max-w-[480px]"
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </main>
  );
}

/**
 * SessionGate (contract §5.1): the route-level `beforeLoad` redirects on the first load; this
 * component handles the reactive cases — a `401` while browsing (sign-out elsewhere) and a
 * forced password change — and renders the shell around the pages.
 *
 * Decisions in the effect read the query cache (the source of truth) rather than only the
 * session context: right after `signIn()` the context can lag one batched notification behind
 * the cache, and redirecting on that stale value would bounce back to /sign-in.
 */
function AppLayout() {
  const { status, user } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const mustChangePassword = user?.must_change_password === true;
  const onPasswordPage = location.pathname === PASSWORD_PATH;

  useEffect(() => {
    // While a navigation to /sign-in is pending this layout is still mounted and `location`
    // already points at /sign-in; never redirect from there (it would nest redirect params).
    if (location.pathname.startsWith("/sign-in")) return;
    const cached = queryClient.getQueryData<Me | null>(qk.app.me());
    const signedOut = status === "anonymous" && !cached;
    const needsPassword =
      (cached ? cached.user.must_change_password : mustChangePassword) && !onPasswordPage;
    if (signedOut) {
      void navigate({ to: "/sign-in", search: { redirect: location.href }, replace: true });
    } else if (needsPassword) {
      void navigate({ to: PASSWORD_PATH, replace: true });
    }
  }, [
    location.href,
    location.pathname,
    mustChangePassword,
    navigate,
    onPasswordPage,
    queryClient,
    status,
  ]);

  if (status !== "authenticated" || !user) return <AppPending />;
  if (mustChangePassword) return onPasswordPage ? <Outlet /> : <AppPending />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href }, replace: true });
    }
    if (me.user.must_change_password && location.pathname !== PASSWORD_PATH) {
      throw redirect({ to: PASSWORD_PATH, replace: true });
    }
    return { me };
  },
  pendingComponent: AppPending,
  errorComponent: AppLoadError,
  component: AppLayout,
});
