import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import type { RouterContext } from "@/app/router";
import { Button } from "@/components/Button";
import { ErrorState } from "@/components/ErrorState";

function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-page px-6 text-center">
      <p className="text-section-head text-muted">404</p>
      <h1 className="text-page-title text-ink">Page not found</h1>
      <p className="max-w-[420px] text-[14px] text-muted">
        The address does not match a screen of Sympera Scout.
      </p>
      <Button asChild variant="primary">
        <Link to="/">Go to the overview</Link>
      </Button>
    </main>
  );
}

function RootErrorPage({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-6">
      <ErrorState
        error={error}
        title="Something went wrong"
        className="max-w-[480px]"
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </main>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => <Outlet />,
  notFoundComponent: NotFoundPage,
  errorComponent: RootErrorPage,
});
